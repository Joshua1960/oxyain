import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  CompetitorCount,
  MatchLengthId,
  RivalDifficulty,
  SportDiscipline,
  VelocityPreset,
  clampPlayerTelemetry,
  generateRoomCode,
  isValidRoomCode,
  sanitizePlainText,
} from './src/game/rules';
import {
  CustomQuestionBank,
  CustomQuestionDraft,
  INITIAL_CUSTOM_QUESTION_BANKS,
  QuestionDifficultyId,
  QuestionItem,
  SourceExtractionInput,
  SubjectId,
  buildQuestionItemFromDraft,
  cleanSourceTextWithBackgroundWorker,
  extractStructuredQuestionsFromCleanedText,
  validateCustomQuestionBank,
  validateCustomQuestionDraft,
  validateExtractionInput,
} from './src/game/questions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_STORED_BANKS = 100;
const MAX_ACTIVE_ROOMS = 250;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_BANK_IDS = new Set(INITIAL_CUSTOM_QUESTION_BANKS.map((b) => b.id));

const customQuestionBanks = new Map<string, CustomQuestionBank>(
  INITIAL_CUSTOM_QUESTION_BANKS.map((bank) => [bank.id, structuredClone(bank)])
);

// Fast in-memory sliding-window rate limiter per client IP for mutation routes
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  if (rateLimitBuckets.size > 1000) {
    for (const [key, entry] of rateLimitBuckets.entries()) {
      if (now > entry.resetAt) rateLimitBuckets.delete(key);
    }
  }
  const existing = rateLimitBuckets.get(ip);
  if (!existing || now > existing.resetAt) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) return false;
  existing.count += 1;
  return true;
}

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  speedKmh: number;
  distanceMeters: number;
  streak: number;
  correctCount: number;
  answeredCount: number;
  laneIndex: -1 | 0 | 1;
  finished: boolean;
  ws: WebSocket | null;
}

interface GameRoom {
  roomCode: string;
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty: QuestionDifficultyId;
  questionCount: number;
  matchLength: MatchLengthId;
  mode: 'quickplay' | 'custom';
  competitorCount: CompetitorCount;
  rivalDifficulty: RivalDifficulty;
  velocityPreset: VelocityPreset;
  hostId: string;
  hostName: string;
  status: 'lobby' | 'playing';
  createdAt: number;
  players: Map<string, RoomPlayer>;
}

interface QueuedMatchmakerEntry {
  playerId: string;
  playerName: string;
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty: QuestionDifficultyId;
  questionCount: number;
  matchLength: MatchLengthId;
  ws: WebSocket;
  joinedAt: number;
  autoPairTimer?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, GameRoom>();
const allSockets = new Set<WebSocket>();
const matchmakerQueue = new Map<string, QueuedMatchmakerEntry>();
let waitingQuickPlayRoomCode: string | null = null;

function removePlayerFromQueue(playerId: string | null) {
  if (!playerId) return;
  const entry = matchmakerQueue.get(playerId);
  if (entry) {
    if (entry.autoPairTimer) clearTimeout(entry.autoPairTimer);
    matchmakerQueue.delete(playerId);
  }
}

function broadcastToRoom(room: GameRoom, payload: unknown, excludePlayerId?: string) {
  const message = JSON.stringify(payload);
  for (const [pid, player] of room.players.entries()) {
    if (excludePlayerId && pid === excludePlayerId) continue;
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  }
}

function serializeRoomDirectory() {
  const summary = Array.from(rooms.values()).map((r) => ({
    roomCode: r.roomCode,
    sport: r.sport,
    subject: r.subject,
    questionDifficulty: r.questionDifficulty,
    questionCount: r.questionCount,
    matchLength: r.matchLength,
    mode: r.mode,
    competitorCount: r.competitorCount,
    hostName: r.hostName,
    playerCount: r.players.size,
    status: r.status,
  }));
  return {
    type: 'directory:update',
    activeRoomsCount: rooms.size,
    rooms: summary,
  };
}

function broadcastDirectoryUpdate() {
  const message = JSON.stringify(serializeRoomDirectory());
  for (const client of allSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function serializeRoomState(room: GameRoom) {
  return {
    type: 'room:state',
    roomCode: room.roomCode,
    sport: room.sport,
    subject: room.subject,
    questionDifficulty: room.questionDifficulty,
    questionCount: room.questionCount,
    matchLength: room.matchLength,
    mode: room.mode,
    competitorCount: room.competitorCount,
    rivalDifficulty: room.rivalDifficulty,
    velocityPreset: room.velocityPreset,
    hostId: room.hostId,
    hostName: room.hostName,
    status: room.status,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      ready: p.ready,
      speedKmh: p.speedKmh,
      distanceMeters: p.distanceMeters,
      streak: p.streak,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      laneIndex: p.laneIndex,
      finished: p.finished,
    })),
  };
}

function removePlayerFromRoom(roomCode: string | null, playerId: string | null) {
  if (!roomCode || !playerId) return;
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(roomCode);
    if (waitingQuickPlayRoomCode === roomCode) {
      waitingQuickPlayRoomCode = null;
    }
  } else {
    // Reassign host if the host left
    if (room.hostId === playerId) {
      const nextHost = room.players.values().next().value as RoomPlayer | undefined;
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        room.hostName = nextHost.name;
      }
    }
    broadcastToRoom(room, serializeRoomState(room));
  }
  broadcastDirectoryUpdate();
}

function evictStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (code === 'RACE-101') continue;
    if (room.players.size === 0 && now - room.createdAt > ROOM_IDLE_TTL_MS) {
      rooms.delete(code);
    }
  }
  while (rooms.size > MAX_ACTIVE_ROOMS) {
    const oldestKey = Array.from(rooms.keys()).find((k) => k !== 'RACE-101');
    if (!oldestKey) break;
    rooms.delete(oldestKey);
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

  // REST API for live lobby counts and custom room directory
  app.get('/api/rooms', (_req, res) => {
    evictStaleRooms();
    res.json(serializeRoomDirectory());
  });

  // [SCR-09] Custom Question Generator Dashboard REST API
  app.get('/api/question-banks', (_req, res) => {
    res.json({
      banks: Array.from(customQuestionBanks.values()),
    });
  });

  app.post('/api/question-banks', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkRateLimit(clientIp, 60, 60_000)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
      return;
    }

    const body = req.body as CustomQuestionBank | undefined;
    if (!body || !body.id || !body.title || !Array.isArray(body.questions)) {
      res.status(400).json({ error: 'Invalid question bank payload.' });
      return;
    }

    const sanitizedQuestions: QuestionItem[] = body.questions.slice(0, 100).map((q, idx) => ({
      ...q,
      id: sanitizePlainText(q.id || `q-${idx + 1}`, 64),
      topic: sanitizePlainText(q.topic || 'General', 60),
      prompt: sanitizePlainText(q.prompt || '', 320),
      options: [
        sanitizePlainText(q.options?.[0] || '', 160),
        sanitizePlainText(q.options?.[1] || '', 160),
        sanitizePlainText(q.options?.[2] || '', 160),
        sanitizePlainText(q.options?.[3] || '', 160),
      ],
      correctIndex:
        q.correctIndex === 0 || q.correctIndex === 1 || q.correctIndex === 2 || q.correctIndex === 3
          ? q.correctIndex
          : 0,
      explanation: sanitizePlainText(q.explanation || '', 400),
    }));

    const sanitizedBank: CustomQuestionBank = {
      ...body,
      id: sanitizePlainText(body.id, 64),
      title: sanitizePlainText(body.title, 100),
      description: sanitizePlainText(body.description || 'Custom question bank.', 240),
      shareCode: sanitizePlainText(body.shareCode || 'BANK-101', 16).toUpperCase(),
      authorName: sanitizePlainText(body.authorName || 'Educator', 60),
      questions: sanitizedQuestions,
    };

    const validation = validateCustomQuestionBank(sanitizedBank);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error || 'Invalid question bank.' });
      return;
    }

    if (!customQuestionBanks.has(sanitizedBank.id) && customQuestionBanks.size >= MAX_STORED_BANKS) {
      const oldestNonDefault = Array.from(customQuestionBanks.keys()).find(
        (k) => !DEFAULT_BANK_IDS.has(k)
      );
      if (oldestNonDefault) {
        customQuestionBanks.delete(oldestNonDefault);
      }
    }

    customQuestionBanks.set(sanitizedBank.id, sanitizedBank);
    res.json({
      bank: sanitizedBank,
      banks: Array.from(customQuestionBanks.values()),
    });
  });

  app.delete('/api/question-banks/:id', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkRateLimit(clientIp, 60, 60_000)) {
      res.status(429).json({ error: 'Rate limit exceeded.' });
      return;
    }
    const bankId = sanitizePlainText(req.params.id, 64);
    if (customQuestionBanks.size > 1) {
      customQuestionBanks.delete(bankId);
    }
    res.json({
      deletedId: bankId,
      banks: Array.from(customQuestionBanks.values()),
    });
  });

  // [SCR-10] AI Source Extraction Console — Background Worker Text Cleaning + Gemini/Claude JSON Parsing API
  app.post('/api/ai-extract', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkRateLimit(clientIp, 30, 60_000)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before extracting again.' });
      return;
    }

    const input = req.body as SourceExtractionInput | undefined;
    if (!input) {
      res.status(400).json({ error: 'Missing extraction payload.' });
      return;
    }

    const validation = validateExtractionInput(input);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const workerMetrics = cleanSourceTextWithBackgroundWorker(input.rawContent);
    const apiKey = process.env.GEMINI_API_KEY;
    let extractedQuestions: QuestionItem[] = [];
    let usedLiveGemini = false;

    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const promptText = `You are the Oxyain Academic Extraction Engine (${input.parserEngine}).
Extract exactly ${input.questionCount} multiple-choice academic quiz questions from the following cleaned source material.
Subject domain: ${input.targetSubject}
Difficulty tier: ${input.targetDifficulty}
Each question must have:
- topic: short academic topic tag (at least 3 chars)
- prompt: clear question prompt (at least 10 chars)
- options: array of 4 distinct multiple-choice answers
- correctIndex: integer 0, 1, 2, or 3 indicating the correct option
- explanation: concise academic explanation (at least 12 chars)

Cleaned Source Material:
${workerMetrics.cleanedText.slice(0, 8000)}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ['topic', 'prompt', 'options', 'correctIndex', 'explanation'],
              },
            },
          },
        });

        const rawJson = response.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed)) {
            const validatedItems: QuestionItem[] = [];
            for (let i = 0; i < parsed.length; i++) {
              const item = parsed[i];
              if (!item || !Array.isArray(item.options) || item.options.length < 4) continue;
              const cIdx = Number(item.correctIndex);
              const safeIdx: 0 | 1 | 2 | 3 =
                cIdx === 0 || cIdx === 1 || cIdx === 2 || cIdx === 3 ? cIdx : 0;
              const draft: CustomQuestionDraft = {
                subject: input.targetSubject,
                topic: String(item.topic || 'Source Analysis'),
                difficultyTier: input.targetDifficulty,
                prompt: String(item.prompt || ''),
                options: [
                  String(item.options[0] || ''),
                  String(item.options[1] || ''),
                  String(item.options[2] || ''),
                  String(item.options[3] || ''),
                ],
                correctIndex: safeIdx,
                explanation: String(item.explanation || ''),
              };
              const check = validateCustomQuestionDraft(draft);
              if (check.valid) {
                validatedItems.push(
                  buildQuestionItemFromDraft(draft, `gemini-ext-${Date.now()}-${i + 1}`)
                );
              }
            }
            if (validatedItems.length > 0) {
              extractedQuestions = validatedItems.slice(0, input.questionCount);
              usedLiveGemini = true;
            }
          }
        }
      } catch {
        // Fallback to deterministic academic synthesis if API key is invalid or offline
      }
    }

    if (extractedQuestions.length === 0) {
      extractedQuestions = extractStructuredQuestionsFromCleanedText({
        cleanedText: workerMetrics.cleanedText,
        clauses: workerMetrics.clauses,
        targetSubject: input.targetSubject,
        targetDifficulty: input.targetDifficulty,
        questionCount: input.questionCount,
        sourceLabel: input.fileName || input.websiteUrl,
      });
    }

    res.json({
      parserEngine: input.parserEngine,
      usedLiveGemini,
      workerMetrics: {
        originalChars: workerMetrics.originalChars,
        cleanedChars: workerMetrics.cleanedChars,
        strippedArtifactsCount: workerMetrics.strippedArtifactsCount,
        extractedClauseCount: workerMetrics.extractedClauseCount,
        estimatedTokens: workerMetrics.estimatedTokens,
      },
      questions: extractedQuestions,
    });
  });

  wss.on('connection', (ws) => {
    allSockets.add(ws);
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    // Immediately send current room directory to newly connected client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(serializeRoomDirectory()));
    }

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));

        if (data.type === 'lobby:sync' || data.type === 'room:join') {
          evictStaleRooms();
          const playerId: string =
            sanitizePlainText(data.playerId, 40) ||
            currentPlayerId ||
            `p-${Math.random().toString(36).slice(2, 8)}`;
          const playerName: string =
            sanitizePlainText(data.playerName, 40) || 'Guest Contender';
          const sport: SportDiscipline = data.sport || 'racing';
          const subject: SubjectId = data.subject || 'stem';
          const questionDifficulty: QuestionDifficultyId = data.questionDifficulty || 'easy';
          const questionCount: number =
            typeof data.questionCount === 'number' && Number.isFinite(data.questionCount)
              ? Math.max(3, Math.min(100, Math.round(data.questionCount)))
              : 5;
          const matchLength: MatchLengthId = data.matchLength || 'sprint';
          const mode: 'quickplay' | 'custom' = data.mode || 'custom';
          const competitorCount: CompetitorCount =
            data.competitorCount === 2 ||
            data.competitorCount === 4 ||
            data.competitorCount === 6 ||
            data.competitorCount === 8
              ? data.competitorCount
              : mode === 'custom'
              ? 4
              : 2;
          const rivalDifficulty: RivalDifficulty = data.rivalDifficulty || 'standard';
          const velocityPreset: VelocityPreset = data.velocityPreset || 'standard';

          let targetCode: string;
          if (mode === 'custom' && typeof data.roomCode === 'string' && isValidRoomCode(data.roomCode)) {
            targetCode = data.roomCode.trim().toUpperCase();
          } else if (
            mode === 'quickplay' &&
            waitingQuickPlayRoomCode &&
            rooms.has(waitingQuickPlayRoomCode) &&
            (rooms.get(waitingQuickPlayRoomCode)!.players.has(playerId) ||
              rooms.get(waitingQuickPlayRoomCode)!.players.size < 2)
          ) {
            targetCode = waitingQuickPlayRoomCode;
            if (
              !rooms.get(waitingQuickPlayRoomCode)!.players.has(playerId) &&
              rooms.get(waitingQuickPlayRoomCode)!.players.size + 1 >= 2
            ) {
              waitingQuickPlayRoomCode = null;
            }
          } else {
            targetCode = mode === 'custom' ? generateRoomCode(undefined, sport) : generateRoomCode();
            if (mode === 'quickplay') {
              waitingQuickPlayRoomCode = targetCode;
            }
          }

          // If switching rooms, leave previous room first
          if (currentRoomCode && currentRoomCode !== targetCode) {
            removePlayerFromRoom(currentRoomCode, playerId);
          }

          let room = rooms.get(targetCode);
          const isCreatingRoom = !room;
          if (!room) {
            room = {
              roomCode: targetCode,
              sport,
              subject,
              questionDifficulty,
              questionCount,
              matchLength,
              mode,
              competitorCount,
              rivalDifficulty,
              velocityPreset,
              hostId: playerId,
              hostName: playerName,
              status: data.type === 'room:join' ? 'playing' : 'lobby',
              createdAt: Date.now(),
              players: new Map(),
            };
            rooms.set(targetCode, room);
          } else if (room.hostId === playerId) {
            // Host can update room configuration while in lobby
            room.sport = sport;
            room.subject = subject;
            room.questionDifficulty = questionDifficulty;
            room.questionCount = questionCount;
            room.matchLength = matchLength;
            room.competitorCount = competitorCount;
            room.rivalDifficulty = rivalDifficulty;
            room.velocityPreset = velocityPreset;
            room.hostName = playerName;
          }

          currentRoomCode = targetCode;
          currentPlayerId = playerId;

          const existing = room.players.get(playerId);
          const laneChoices: (-1 | 0 | 1)[] = [-1, 1, 0];
          const assignedLane = existing
            ? existing.laneIndex
            : laneChoices[room.players.size % laneChoices.length];

          room.players.set(playerId, {
            id: playerId,
            name: playerName,
            isHost: isCreatingRoom || room.hostId === playerId,
            ready: existing ? existing.ready : true,
            speedKmh: existing ? existing.speedKmh : 100,
            distanceMeters: existing ? existing.distanceMeters : 0,
            streak: existing ? existing.streak : 0,
            correctCount: existing ? existing.correctCount : 0,
            answeredCount: existing ? existing.answeredCount : 0,
            laneIndex: assignedLane,
            finished: existing ? existing.finished : false,
            ws,
          });

          broadcastToRoom(room, serializeRoomState(room));
          broadcastDirectoryUpdate();
        } else if (data.type === 'room:ready' && currentRoomCode && currentPlayerId) {
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          const player = room.players.get(currentPlayerId);
          if (!player) return;
          player.ready = typeof data.ready === 'boolean' ? data.ready : !player.ready;
          broadcastToRoom(room, serializeRoomState(room));
        } else if (data.type === 'room:simulate_join' && currentRoomCode) {
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          if (room.players.size >= room.competitorCount) return;
          const challengerNames = [
            'Marcus Sterling',
            'Aria Chen',
            'Liam O-Connor',
            'Sofia Rostova',
            'Devon Brooks',
            'Kaito Tanaka',
            'Zara Al-Mansoor',
          ];
          const idx = room.players.size;
          const simId = `contender-${Date.now()}-${idx}`;
          const customName = sanitizePlainText(data.playerName, 40);
          const simName = customName || challengerNames[(idx - 1) % challengerNames.length];
          const laneChoices: (-1 | 0 | 1)[] = [1, 0, -1];
          room.players.set(simId, {
            id: simId,
            name: simName,
            isHost: false,
            ready: true,
            speedKmh: 100,
            distanceMeters: 0,
            streak: 0,
            correctCount: 0,
            answeredCount: 0,
            laneIndex: laneChoices[idx % laneChoices.length],
            finished: false,
            ws: null,
          });
          broadcastToRoom(room, serializeRoomState(room));
          broadcastDirectoryUpdate();
        } else if (data.type === 'queue:join') {
          const playerId: string =
            sanitizePlainText(data.playerId, 40) ||
            currentPlayerId ||
            `p-${Math.random().toString(36).slice(2, 8)}`;
          const playerName: string =
            sanitizePlainText(data.playerName, 40) || 'Guest Contender';
          const sport: SportDiscipline = data.sport || 'racing';
          const subject: SubjectId = data.subject || 'stem';
          const questionDifficulty: QuestionDifficultyId = data.questionDifficulty || 'easy';
          const questionCount: number =
            typeof data.questionCount === 'number' && Number.isFinite(data.questionCount)
              ? Math.max(3, Math.min(100, Math.round(data.questionCount)))
              : 5;
          const matchLength: MatchLengthId = data.matchLength || 'sprint';

          currentPlayerId = playerId;
          removePlayerFromQueue(playerId);

          // Check if another live human player is waiting in the Redis-style matchmaker queue
          let matchedPeer: QueuedMatchmakerEntry | null = null;
          for (const [peerId, entry] of matchmakerQueue.entries()) {
            if (peerId !== playerId && entry.ws.readyState === WebSocket.OPEN) {
              matchedPeer = entry;
              break;
            }
          }

          if (matchedPeer) {
            removePlayerFromQueue(matchedPeer.playerId);
            const pairedRoomCode = generateRoomCode(undefined, sport);
            const room: GameRoom = {
              roomCode: pairedRoomCode,
              sport: matchedPeer.sport,
              subject: matchedPeer.subject,
              questionDifficulty: matchedPeer.questionDifficulty,
              questionCount: matchedPeer.questionCount,
              matchLength: matchedPeer.matchLength,
              mode: 'quickplay',
              competitorCount: 2,
              rivalDifficulty: 'standard',
              velocityPreset: 'standard',
              hostId: matchedPeer.playerId,
              hostName: matchedPeer.playerName,
              status: 'playing',
              createdAt: Date.now(),
              players: new Map(),
            };

            room.players.set(matchedPeer.playerId, {
              id: matchedPeer.playerId,
              name: matchedPeer.playerName,
              isHost: true,
              ready: true,
              speedKmh: 100,
              distanceMeters: 0,
              streak: 0,
              correctCount: 0,
              answeredCount: 0,
              laneIndex: -1,
              finished: false,
              ws: matchedPeer.ws,
            });
            room.players.set(playerId, {
              id: playerId,
              name: playerName,
              isHost: false,
              ready: true,
              speedKmh: 100,
              distanceMeters: 0,
              streak: 0,
              correctCount: 0,
              answeredCount: 0,
              laneIndex: 1,
              finished: false,
              ws,
            });

            rooms.set(pairedRoomCode, room);
            currentRoomCode = pairedRoomCode;

            if (matchedPeer.ws.readyState === WebSocket.OPEN) {
              matchedPeer.ws.send(
                JSON.stringify({
                  type: 'queue:matched',
                  roomCode: pairedRoomCode,
                  opponentName: playerName,
                  opponentTitle: 'Live 1v1 Contender',
                  opponentRating: 1940,
                  isHumanOpponent: true,
                  redisChannel: 'mm:1v1:paired',
                })
              );
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'queue:matched',
                  roomCode: pairedRoomCode,
                  opponentName: matchedPeer.playerName,
                  opponentTitle: 'Live 1v1 Contender',
                  opponentRating: 1940,
                  isHumanOpponent: true,
                  redisChannel: 'mm:1v1:paired',
                })
              );
            }
            broadcastToRoom(room, serializeRoomState(room));
            broadcastDirectoryUpdate();
          } else {
            // Enqueue player and schedule automated matchmaker lock-in if no second socket joins within 2.2s
            const autoPairTimer = setTimeout(() => {
              const stillQueued = matchmakerQueue.get(playerId);
              if (!stillQueued || stillQueued.ws.readyState !== WebSocket.OPEN) return;
              matchmakerQueue.delete(playerId);

              const pairedRoomCode = generateRoomCode(undefined, sport);
              const rivalNames = ['Marcus Sterling', 'Dr. Elena Vance', 'Aria Chen', 'Liam O-Connor'];
              const pickedRival = rivalNames[Math.floor(Math.random() * rivalNames.length)];

              const room: GameRoom = {
                roomCode: pairedRoomCode,
                sport,
                subject,
                questionDifficulty,
                questionCount,
                matchLength,
                mode: 'quickplay',
                competitorCount: 2,
                rivalDifficulty: 'standard',
                velocityPreset: 'standard',
                hostId: playerId,
                hostName: playerName,
                status: 'playing',
                createdAt: Date.now(),
                players: new Map(),
              };

              room.players.set(playerId, {
                id: playerId,
                name: playerName,
                isHost: true,
                ready: true,
                speedKmh: 100,
                distanceMeters: 0,
                streak: 0,
                correctCount: 0,
                answeredCount: 0,
                laneIndex: -1,
                finished: false,
                ws,
              });

              rooms.set(pairedRoomCode, room);
              currentRoomCode = pairedRoomCode;

              stillQueued.ws.send(
                JSON.stringify({
                  type: 'queue:matched',
                  roomCode: pairedRoomCode,
                  opponentName: pickedRival,
                  opponentTitle: 'Varsity Challenger',
                  opponentRating: 1890,
                  isHumanOpponent: false,
                  redisChannel: 'mm:1v1:paired',
                })
              );
              broadcastToRoom(room, serializeRoomState(room));
              broadcastDirectoryUpdate();
            }, 2200);

            matchmakerQueue.set(playerId, {
              playerId,
              playerName,
              sport,
              subject,
              questionDifficulty,
              questionCount,
              matchLength,
              ws,
              joinedAt: Date.now(),
              autoPairTimer,
            });

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'queue:status',
                  status: 'searching',
                  queuePosition: matchmakerQueue.size,
                  redisChannel: 'mm:1v1:queue',
                })
              );
            }
          }
        } else if (data.type === 'queue:force_pair') {
          const playerId = currentPlayerId || sanitizePlainText(data.playerId, 40) || 'player-1';
          const entry = matchmakerQueue.get(playerId);
          removePlayerFromQueue(playerId);
          const sport: SportDiscipline = entry?.sport || data.sport || 'racing';
          const pairedRoomCode = generateRoomCode(undefined, sport);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'queue:matched',
                roomCode: pairedRoomCode,
                opponentName: 'Marcus Sterling',
                opponentTitle: 'Varsity Challenger',
                opponentRating: 1910,
                isHumanOpponent: false,
                redisChannel: 'mm:1v1:paired',
              })
            );
          }
        } else if (data.type === 'queue:leave') {
          removePlayerFromQueue(currentPlayerId || sanitizePlainText(data.playerId, 40));
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'queue:status',
                status: 'cancelled',
                redisChannel: 'mm:1v1:queue',
              })
            );
          }
        } else if (data.type === 'room:launch' && currentRoomCode && currentPlayerId) {
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          if (data.sport) room.sport = data.sport;
          if (data.subject) room.subject = data.subject;
          if (data.questionDifficulty) room.questionDifficulty = data.questionDifficulty;
          if (typeof data.questionCount === 'number' && Number.isFinite(data.questionCount)) {
            room.questionCount = Math.max(3, Math.min(100, Math.round(data.questionCount)));
          }
          if (data.matchLength) room.matchLength = data.matchLength;
          if (
            data.competitorCount === 2 ||
            data.competitorCount === 4 ||
            data.competitorCount === 6 ||
            data.competitorCount === 8
          ) {
            room.competitorCount = data.competitorCount;
          }
          if (data.rivalDifficulty) room.rivalDifficulty = data.rivalDifficulty;
          if (data.velocityPreset) room.velocityPreset = data.velocityPreset;

          room.status = 'playing';

          // Reset all connected human players in the room to the starting line
          for (const p of room.players.values()) {
            p.speedKmh = 100;
            p.distanceMeters = 0;
            p.streak = 0;
            p.correctCount = 0;
            p.answeredCount = 0;
            p.finished = false;
          }

          // Broadcast authoritative match start to EVERY connected player in this room
          broadcastToRoom(room, {
            type: 'room:match_started',
            ...serializeRoomState(room),
          });
          broadcastDirectoryUpdate();
        } else if (data.type === 'room:terminate' && currentRoomCode && currentPlayerId) {
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          const player = room.players.get(currentPlayerId);
          // Only the room host (or sole human player) can terminate an ongoing game
          if (room.hostId !== currentPlayerId && !player?.isHost) return;

          room.status = 'lobby';
          for (const p of room.players.values()) {
            p.speedKmh = 100;
            p.distanceMeters = 0;
            p.streak = 0;
            p.correctCount = 0;
            p.answeredCount = 0;
            p.finished = false;
          }

          broadcastToRoom(room, {
            type: 'room:match_terminated',
            roomCode: room.roomCode,
            terminatedBy: room.hostName,
          });
          broadcastToRoom(room, serializeRoomState(room));
          broadcastDirectoryUpdate();
        } else if (data.type === 'player:update' && currentRoomCode && currentPlayerId) {
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          const player = room.players.get(currentPlayerId);
          if (!player) return;

          const wasFinished = player.finished;
          const clamped = clampPlayerTelemetry(data, room.questionCount * 150);
          player.speedKmh = clamped.speedKmh;
          player.distanceMeters = clamped.distanceMeters;
          player.streak = clamped.streak;
          player.correctCount = clamped.correctCount;
          player.answeredCount = clamped.answeredCount;
          player.laneIndex = clamped.laneIndex;
          player.finished = clamped.finished;

          broadcastToRoom(
            room,
            {
              type: 'opponent:telemetry',
              playerId: player.id,
              name: player.name,
              isHost: player.isHost,
              speedKmh: player.speedKmh,
              distanceMeters: player.distanceMeters,
              streak: player.streak,
              correctCount: player.correctCount,
              answeredCount: player.answeredCount,
              laneIndex: player.laneIndex,
              finished: player.finished,
            },
            currentPlayerId
          );

          if (player.finished !== wasFinished) {
            broadcastToRoom(room, serializeRoomState(room));
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      allSockets.delete(ws);
      removePlayerFromQueue(currentPlayerId);
      removePlayerFromRoom(currentRoomCode, currentPlayerId);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Oxyain server running on http://localhost:${PORT}`);
  });
}

startServer();
