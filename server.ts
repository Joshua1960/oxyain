import express from 'express';
import http from 'http';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';
import {
  CompetitorCount,
  MatchLengthId,
  RivalDifficulty,
  SHARD_COUNT,
  SportDiscipline,
  TokenBucketState,
  VelocityPreset,
  clampPlayerTelemetry,
  computeConsistentShardIndex,
  computeMatchmakingBucketKey,
  consumeTokenBucket,
  generateRoomCode,
  isValidRoomCode,
  sanitizePlainText,
} from './src/game/rules';
import {
  CustomQuestionBank,
  CustomQuestionDraft,
  ExtractionSourceFormat,
  INITIAL_CUSTOM_QUESTION_BANKS,
  QuestionDifficultyId,
  QuestionItem,
  SUBJECT_METADATA,
  SourceExtractionInput,
  SubjectId,
  buildQuestionItemFromDraft,
  cleanSourceTextWithBackgroundWorker,
  extractStructuredQuestionsFromCleanedText,
  getQuestionsForMatch,
  inferSubjectFromSourceText,
  validateCustomQuestionBank,
  validateCustomQuestionDraft,
  validateExtractionInput,
} from './src/game/questions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_STORED_BANKS = 200;
const MAX_ACTIVE_ROOMS = 10_000;
const MAX_DIRECTORY_SNAPSHOT_ROOMS = 50;
const MAX_WS_BUFFER_BYTES = 128 * 1024;
const DIRECTORY_COALESCE_MS = 350;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_BANK_IDS = new Set(INITIAL_CUSTOM_QUESTION_BANKS.map((b) => b.id));

const customQuestionBanks = new Map<string, CustomQuestionBank>(
  INITIAL_CUSTOM_QUESTION_BANKS.map((bank) => [bank.id, structuredClone(bank)])
);

// Fast in-memory sliding-window rate limiter per client IP for mutation routes
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  if (rateLimitBuckets.size > 4000) {
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
  shardId: number;
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
  bucketKey: string;
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
const roomShards: Map<string, GameRoom>[] = Array.from(
  { length: SHARD_COUNT },
  () => new Map<string, GameRoom>()
);
const allSockets = new Set<WebSocket>();
const matchmakerQueue = new Map<string, QueuedMatchmakerEntry>();
const matchmakerBuckets = new Map<string, Set<string>>();
let waitingQuickPlayRoomCode: string | null = null;
let directoryBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
let cachedDirectoryPayload: ReturnType<typeof buildRoomDirectorySnapshot> | null = null;
let cachedDirectoryJson = '';

function safeWsSend(ws: WebSocket | null | undefined, message: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > MAX_WS_BUFFER_BYTES) return;
  try {
    ws.send(message);
  } catch {
    // Ignore transient closed socket write errors
  }
}

function setRoomInStore(room: GameRoom) {
  rooms.set(room.roomCode, room);
  roomShards[room.shardId]?.set(room.roomCode, room);
}

function deleteRoomFromStore(roomCode: string) {
  const existing = rooms.get(roomCode);
  if (existing) {
    roomShards[existing.shardId]?.delete(roomCode);
    rooms.delete(roomCode);
  }
}

function removePlayerFromQueue(playerId: string | null) {
  if (!playerId) return;
  const entry = matchmakerQueue.get(playerId);
  if (entry) {
    if (entry.autoPairTimer) clearTimeout(entry.autoPairTimer);
    matchmakerQueue.delete(playerId);
    const bucket = matchmakerBuckets.get(entry.bucketKey);
    if (bucket) {
      bucket.delete(playerId);
      if (bucket.size === 0) matchmakerBuckets.delete(entry.bucketKey);
    }
  }
}

function broadcastToRoom(room: GameRoom, payload: unknown, excludePlayerId?: string) {
  const message = JSON.stringify(payload);
  for (const [pid, player] of room.players.entries()) {
    if (excludePlayerId && pid === excludePlayerId) continue;
    safeWsSend(player.ws, message);
  }
}

function buildRoomDirectorySnapshot() {
  const summary = [];
  for (const r of rooms.values()) {
    summary.push({
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
    });
    if (summary.length >= MAX_DIRECTORY_SNAPSHOT_ROOMS) break;
  }
  return {
    type: 'directory:update',
    activeRoomsCount: rooms.size,
    rooms: summary,
  };
}

function serializeRoomDirectory() {
  if (!cachedDirectoryPayload) {
    cachedDirectoryPayload = buildRoomDirectorySnapshot();
    cachedDirectoryJson = JSON.stringify(cachedDirectoryPayload);
  }
  return cachedDirectoryPayload;
}

function broadcastDirectoryUpdate() {
  cachedDirectoryPayload = null;
  if (directoryBroadcastTimer) return;
  directoryBroadcastTimer = setTimeout(() => {
    directoryBroadcastTimer = null;
    cachedDirectoryPayload = buildRoomDirectorySnapshot();
    cachedDirectoryJson = JSON.stringify(cachedDirectoryPayload);
    for (const client of allSockets) {
      safeWsSend(client, cachedDirectoryJson);
    }
  }, DIRECTORY_COALESCE_MS);
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
    deleteRoomFromStore(roomCode);
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
      deleteRoomFromStore(code);
    }
  }
  while (rooms.size > MAX_ACTIVE_ROOMS) {
    const oldestKey = Array.from(rooms.keys()).find((k) => k !== 'RACE-101');
    if (!oldestKey) break;
    deleteRoomFromStore(oldestKey);
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    // Lightweight transparent gzip compression for large JSON API responses
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (acceptEncoding.includes('gzip') && req.path.startsWith('/api/')) {
      const origJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const rawStr = JSON.stringify(body);
        if (rawStr.length > 1024 && !res.headersSent) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.end(zlib.gzipSync(Buffer.from(rawStr, 'utf8')));
          return res;
        }
        return origJson(body);
      }) as typeof res.json;
    }
    next();
  });
  app.use(express.json({ limit: '25mb' }));

  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

  // Helper to extract genuine human-readable text from PDF buffers, DOCX buffers, or Website URLs
  async function extractCleanTextFromUploadedDocument(params: {
    format: ExtractionSourceFormat;
    base64Data?: string;
    websiteUrl?: string;
    rawContent?: string;
  }): Promise<string> {
    const { format, base64Data, websiteUrl, rawContent } = params;
    const cleanBase64 = base64Data
      ? base64Data.replace(/^data:[^;]+;base64,/i, '').trim()
      : '';

    if (format === 'docx' && cleanBase64) {
      const buffer = Buffer.from(cleanBase64, 'base64');
      // 1. Real DOCX (ZIP archive starting with PK) -> extract with mammoth
      if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          if (result && typeof result.value === 'string' && result.value.trim().length > 0) {
            return result.value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
          }
        } catch {
          // Fall through to XML / raw extraction
        }
      }

      // 2. Fallback: XML <w:t> tags or plain UTF-8 text
      const utf8 = buffer.toString('utf8');
      const xmlMatches = Array.from(utf8.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g))
        .map((m) => m[1].trim())
        .filter(Boolean);
      if (xmlMatches.length > 0) {
        return xmlMatches.join(' ');
      }
      const cleanedFallback = cleanSourceTextWithBackgroundWorker(utf8);
      if (cleanedFallback.clauses.length > 0) {
        return cleanedFallback.cleanedText;
      }
    }

    if (format === 'pdf' && cleanBase64) {
      const buffer = Buffer.from(cleanBase64, 'base64');
      // 1. Standard PDF extraction via unpdf (PDF.js engine)
      try {
        const pdfData = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
        const text = typeof pdfData?.text === 'string' ? pdfData.text.trim() : '';
        if (text.length >= 20) {
          const cleaned = cleanSourceTextWithBackgroundWorker(text);
          if (cleaned.clauses.length > 0) {
            return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
          }
        }
      } catch {
        // Fall through to FlateDecode / stream decompression
      }

      // 2. Decompress PDF FlateDecode streams with Node zlib and extract BT..ET (...) strings
      try {
        const latin1 = buffer.toString('latin1');
        const extractedPieces: string[] = [];
        const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
        let match: RegExpExecArray | null;
        while ((match = streamRegex.exec(latin1)) !== null) {
          const streamBytes = Buffer.from(match[1], 'latin1');
          let decompressed = '';
          try {
            decompressed = zlib.inflateSync(streamBytes).toString('latin1');
          } catch {
            try {
              decompressed = zlib.inflateRawSync(streamBytes).toString('latin1');
            } catch {
              decompressed = match[1];
            }
          }
          const parens = Array.from(decompressed.matchAll(/\(([^()\\]{2,240})\)/g))
            .map((m) => m[1].replace(/[^\x20-\x7E]/g, ' ').trim())
            .filter(Boolean);
          if (parens.length > 0) {
            extractedPieces.push(parens.join(' '));
          }
        }
        if (extractedPieces.length > 0) {
          const joined = extractedPieces.join('\n');
          const cleaned = cleanSourceTextWithBackgroundWorker(joined);
          if (cleaned.clauses.length > 0) {
            return cleaned.cleanedText;
          }
        }
      } catch {
        // Fall through
      }

      // 3. Multimodal Gemini PDF transcription if GEMINI_API_KEY is configured
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });
          const resp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanBase64,
                },
              },
              'Extract and return the readable text content from this PDF document verbatim as plain text sentences.',
            ],
          });
          if (resp.text && resp.text.trim().length >= 30) {
            return resp.text.trim();
          }
        } catch {
          // Fall through
        }
      }

      // 4. Plain-text PDF fixture fallback
      const utf8 = buffer.toString('utf8');
      const cleanedUtf8 = cleanSourceTextWithBackgroundWorker(utf8);
      if (cleanedUtf8.clauses.length > 0) {
        return cleanedUtf8.cleanedText;
      }
    }

    if (format === 'url' && websiteUrl && /^https?:\/\//i.test(websiteUrl.trim())) {
      const existingClean = cleanSourceTextWithBackgroundWorker(rawContent || '');
      if (existingClean.clauses.length > 0) {
        return existingClean.cleanedText;
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(websiteUrl.trim(), {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OxyainExtractor/1.0)' },
        });
        clearTimeout(timer);
        if (response.ok) {
          const html = await response.text();
          const strippedHtml = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
            .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
            .replace(/<(?:nav|footer|header|aside)[\s\S]*?<\/(?:nav|footer|header|aside)>/gi, ' ')
            .replace(/<\/?(?:p|div|h[1-6]|li|tr|br|section|article)[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>');
          const cleanedUrlText = cleanSourceTextWithBackgroundWorker(strippedHtml);
          if (cleanedUrlText.clauses.length > 0) {
            return cleanedUrlText.clauses.join('\n').slice(0, 12000);
          }
        }
      } catch {
        // Ignore network errors on unreachable external URLs
      }
    }

    const fallbackClean = cleanSourceTextWithBackgroundWorker(rawContent || '');
    return fallbackClean.cleanedText;
  }

  // Health & Horizontal Shard Telemetry Endpoint
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      shardCount: SHARD_COUNT,
      activeRoomsCount: rooms.size,
      connectedSocketsCount: allSockets.size,
      queuedPlayersCount: matchmakerQueue.size,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // REST API for live lobby counts and custom room directory
  app.get('/api/rooms', (_req, res) => {
    evictStaleRooms();
    res.setHeader('Cache-Control', 'public, max-age=1');
    res.json(serializeRoomDirectory());
  });

  // Dynamic AI Random Question Generator Endpoint (Gemini 3.8 Flash + Non-Repeating Fallback)
  app.post('/api/ai-questions', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkRateLimit(clientIp, 60, 60_000)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
      return;
    }

    const body = (req.body || {}) as {
      subject?: SubjectId;
      difficulty?: QuestionDifficultyId;
      count?: number;
      excludePrompts?: string[];
    };

    const subject: SubjectId =
      body.subject === 'stem' ||
      body.subject === 'literature' ||
      body.subject === 'social' ||
      body.subject === 'business' ||
      body.subject === 'general'
        ? body.subject
        : 'all';
    const difficulty: QuestionDifficultyId =
      body.difficulty === 'easy' || body.difficulty === 'medium' || body.difficulty === 'hard'
        ? body.difficulty
        : 'all';
    const count = Math.max(1, Math.min(100, Math.round(Number(body.count) || 10)));
    const excludeList = Array.isArray(body.excludePrompts)
      ? body.excludePrompts.slice(0, 300).map((p) => sanitizePlainText(p, 240))
      : [];
    const excludedSet = new Set(excludeList.map((p) => p.toLowerCase()));

    const apiKey = process.env.GEMINI_API_KEY;
    const aiQuestions: QuestionItem[] = [];
    let usedLiveGemini = false;

    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const aiBatchCount = Math.min(25, count);
        const subjectDesc =
          subject === 'all'
            ? 'a balanced mix of STEM & Mathematics, Languages & Literature, Social Sciences, Business & Finance, and General Knowledge'
            : SUBJECT_METADATA[subject].label;
        const diffDesc =
          difficulty === 'all'
            ? 'a progressive mix of Easy, Medium, and Hard'
            : difficulty;

        const avoidSnippet =
          excludeList.length > 0
            ? `\nDo NOT repeat or closely paraphrase any of these previously asked questions:\n- ${excludeList
                .slice(-25)
                .join('\n- ')}`
            : '';

        const promptText = `Generate ${aiBatchCount} brand-new, diverse, random multiple-choice academic quiz questions for ${subjectDesc} at ${diffDesc} difficulty (Random seed: ${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}).
Rules:
- Every question must be unique, factually accurate, and engaging.
- Do not repeat questions.${avoidSnippet}
- Provide subject ('stem' | 'literature' | 'social' | 'business' | 'general'), difficultyTier ('easy' | 'medium' | 'hard'), topic, prompt, 4 distinct options, correctIndex (0..3), and a concise explanation.`;

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
                  subject: { type: Type.STRING },
                  difficultyTier: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: [
                  'subject',
                  'difficultyTier',
                  'topic',
                  'prompt',
                  'options',
                  'correctIndex',
                  'explanation',
                ],
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '[]').trim());
        if (Array.isArray(parsed)) {
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (!item || !Array.isArray(item.options) || item.options.length < 4) continue;
            const itemSubj: Exclude<SubjectId, 'all'> =
              subject !== 'all'
                ? subject
                : item.subject === 'literature' ||
                  item.subject === 'social' ||
                  item.subject === 'business' ||
                  item.subject === 'general'
                ? item.subject
                : 'stem';
            const itemTier: 'easy' | 'medium' | 'hard' =
              difficulty !== 'all'
                ? difficulty
                : item.difficultyTier === 'easy' || item.difficultyTier === 'hard'
                ? item.difficultyTier
                : 'medium';

            const draft: CustomQuestionDraft = {
              subject: itemSubj,
              topic: sanitizePlainText(item.topic || 'Academic Challenge', 60),
              difficultyTier: itemTier,
              prompt: sanitizePlainText(item.prompt || '', 300),
              options: [
                sanitizePlainText(item.options[0], 140),
                sanitizePlainText(item.options[1], 140),
                sanitizePlainText(item.options[2], 140),
                sanitizePlainText(item.options[3], 140),
              ],
              correctIndex:
                item.correctIndex === 0 ||
                item.correctIndex === 1 ||
                item.correctIndex === 2 ||
                item.correctIndex === 3
                  ? item.correctIndex
                  : 0,
              explanation: sanitizePlainText(item.explanation || '', 320),
            };
            const check = validateCustomQuestionDraft(draft);
            const promptKey = draft.prompt.toLowerCase();
            if (check.valid && !excludedSet.has(promptKey)) {
              excludedSet.add(promptKey);
              aiQuestions.push(
                buildQuestionItemFromDraft(draft, `ai-gen-${Date.now()}-${i + 1}`)
              );
            }
          }
          if (aiQuestions.length > 0) {
            usedLiveGemini = true;
          }
        }
      } catch {
        // Fallback to non-repeating procedural + curated question synthesizer
      }
    }

    const randomSeed = ((Date.now() & 0xfffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const questions = getQuestionsForMatch(
      subject,
      count,
      randomSeed,
      difficulty,
      aiQuestions.length > 0 ? aiQuestions : undefined,
      excludedSet
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      questions,
      usedLiveGemini,
    });
  });

  // [SCR-09] Custom Question Generator Dashboard REST API
  app.get('/api/question-banks', (_req, res) => {
    res.setHeader('Cache-Control', 'private, max-age=2');
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

  // [SCR-10] Parse PDF, DOCX, or Website URL into clean, human-readable source text
  app.post('/api/parse-document', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkRateLimit(clientIp, 45, 60_000)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
      return;
    }

    const { format, base64Data, websiteUrl, rawContent } = (req.body || {}) as {
      format?: ExtractionSourceFormat;
      fileName?: string;
      base64Data?: string;
      websiteUrl?: string;
      rawContent?: string;
    };

    const resolvedFormat: ExtractionSourceFormat =
      format === 'docx' || format === 'url' ? format : 'pdf';

    const extractedText = await extractCleanTextFromUploadedDocument({
      format: resolvedFormat,
      base64Data,
      websiteUrl,
      rawContent,
    });

    const workerMetrics = cleanSourceTextWithBackgroundWorker(extractedText);
    const inferredSubject = inferSubjectFromSourceText(workerMetrics.cleanedText);

    if (workerMetrics.clauses.length === 0) {
      res.status(422).json({
        error:
          'No readable text sentences could be extracted from this file. Please upload a text-based PDF or DOCX, or paste the text directly.',
        extractedText: '',
        workerMetrics,
        inferredSubject,
      });
      return;
    }

    res.json({
      extractedText,
      workerMetrics,
      inferredSubject,
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

    // If base64Data or websiteUrl was provided, ensure we extract clean text from the document first
    let effectiveRawContent = input.rawContent || '';
    const initialClean = cleanSourceTextWithBackgroundWorker(effectiveRawContent);
    if (
      initialClean.clauses.length === 0 &&
      (input.base64Data || (input.sourceFormat === 'url' && input.websiteUrl))
    ) {
      effectiveRawContent = await extractCleanTextFromUploadedDocument({
        format: input.sourceFormat,
        base64Data: input.base64Data,
        websiteUrl: input.websiteUrl,
        rawContent: input.rawContent,
      });
    }

    const normalizedInput: SourceExtractionInput = {
      ...input,
      rawContent: effectiveRawContent,
    };

    const validation = validateExtractionInput(normalizedInput);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const workerMetrics = cleanSourceTextWithBackgroundWorker(effectiveRawContent);
    const resolvedSubject: Exclude<SubjectId, 'all'> =
      input.targetSubject || inferSubjectFromSourceText(workerMetrics.cleanedText);
    const apiKey = process.env.GEMINI_API_KEY;
    let extractedQuestions: QuestionItem[] = [];
    let usedLiveGemini = false;

    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const promptText = `Extract exactly ${input.questionCount} multiple-choice quiz questions based strictly on the provided source material.
Difficulty tier: ${input.targetDifficulty}
Rules:
- Every question, option, and explanation must be based directly on facts in the source material.
- Do NOT invent unrelated trivia or use gibberish tokens.
- topic: short 1-3 word topic tag from the source material (at least 3 chars)
- prompt: clear, natural English question prompt (at least 10 chars)
- options: array of 4 distinct, natural English multiple-choice answers
- correctIndex: integer 0, 1, 2, or 3 indicating the correct option
- explanation: concise explanation citing the source material (at least 12 chars)

Source Material:
${workerMetrics.cleanedText.slice(0, 10000)}`;

        const cleanBase64 = input.base64Data
          ? input.base64Data.replace(/^data:[^;]+;base64,/i, '').trim()
          : '';
        const contentsPayload =
          input.sourceFormat === 'pdf' && cleanBase64
            ? [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: cleanBase64,
                  },
                },
                promptText,
              ]
            : promptText;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contentsPayload,
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
                subject: resolvedSubject,
                topic: String(item.topic || 'Source Material'),
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
        // Fallback to deterministic synthesis from the cleaned source sentences
      }
    }

    if (extractedQuestions.length === 0) {
      extractedQuestions = extractStructuredQuestionsFromCleanedText({
        cleanedText: workerMetrics.cleanedText,
        clauses: workerMetrics.clauses,
        targetSubject: resolvedSubject,
        targetDifficulty: input.targetDifficulty,
        questionCount: input.questionCount,
        sourceLabel: input.fileName || input.websiteUrl,
      });
    }

    res.json({
      parserEngine: input.parserEngine,
      usedLiveGemini,
      inferredSubject: resolvedSubject,
      extractedText: workerMetrics.cleanedText,
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
    let socketTokenBucket: TokenBucketState = {
      tokens: 45,
      lastRefillMs: Date.now(),
    };

    // Immediately send current room directory to newly connected client
    serializeRoomDirectory();
    safeWsSend(ws, cachedDirectoryJson);

    ws.on('message', (raw) => {
      // Per-socket O(1) token-bucket rate limit guard against packet floods
      const rateCheck = consumeTokenBucket(socketTokenBucket, Date.now(), 45, 25, 1);
      socketTokenBucket = rateCheck.nextBucket;
      if (!rateCheck.allowed) return;

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
              shardId: computeConsistentShardIndex(targetCode),
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
            setRoomInStore(room);
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
          const bucketKey = computeMatchmakingBucketKey(sport, subject, questionDifficulty);

          currentPlayerId = playerId;
          removePlayerFromQueue(playerId);

          // O(1) bucketed lookup first, with fallback to any open 1v1 contender
          let matchedPeer: QueuedMatchmakerEntry | null = null;
          const bucketIds = matchmakerBuckets.get(bucketKey);
          if (bucketIds) {
            for (const peerId of bucketIds) {
              const candidate = matchmakerQueue.get(peerId);
              if (candidate && peerId !== playerId && candidate.ws.readyState === WebSocket.OPEN) {
                matchedPeer = candidate;
                break;
              }
            }
          }
          if (!matchedPeer) {
            for (const [peerId, entry] of matchmakerQueue.entries()) {
              if (peerId !== playerId && entry.ws.readyState === WebSocket.OPEN) {
                matchedPeer = entry;
                break;
              }
            }
          }

          if (matchedPeer) {
            removePlayerFromQueue(matchedPeer.playerId);
            const pairedRoomCode = generateRoomCode(undefined, sport);
            const room: GameRoom = {
              roomCode: pairedRoomCode,
              shardId: computeConsistentShardIndex(pairedRoomCode),
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

            setRoomInStore(room);
            currentRoomCode = pairedRoomCode;

            safeWsSend(
              matchedPeer.ws,
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
            safeWsSend(
              ws,
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
            broadcastToRoom(room, serializeRoomState(room));
            broadcastDirectoryUpdate();
          } else {
            // Enqueue player and schedule automated matchmaker lock-in if no second socket joins within 2.2s
            const autoPairTimer = setTimeout(() => {
              const stillQueued = matchmakerQueue.get(playerId);
              if (!stillQueued || stillQueued.ws.readyState !== WebSocket.OPEN) return;
              removePlayerFromQueue(playerId);

              const pairedRoomCode = generateRoomCode(undefined, sport);
              const rivalNames = ['Marcus Sterling', 'Dr. Elena Vance', 'Aria Chen', 'Liam O-Connor'];
              const pickedRival = rivalNames[Math.floor(Math.random() * rivalNames.length)];

              const room: GameRoom = {
                roomCode: pairedRoomCode,
                shardId: computeConsistentShardIndex(pairedRoomCode),
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

              setRoomInStore(room);
              currentRoomCode = pairedRoomCode;

              safeWsSend(
                stillQueued.ws,
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
              bucketKey,
              sport,
              subject,
              questionDifficulty,
              questionCount,
              matchLength,
              ws,
              joinedAt: Date.now(),
              autoPairTimer,
            });
            let bucket = matchmakerBuckets.get(bucketKey);
            if (!bucket) {
              bucket = new Set();
              matchmakerBuckets.set(bucketKey, bucket);
            }
            bucket.add(playerId);

            safeWsSend(
              ws,
              JSON.stringify({
                type: 'queue:status',
                status: 'searching',
                queuePosition: matchmakerQueue.size,
                redisChannel: bucketKey,
              })
            );
          }
        } else if (data.type === 'queue:force_pair') {
          const playerId = currentPlayerId || sanitizePlainText(data.playerId, 40) || 'player-1';
          const entry = matchmakerQueue.get(playerId);
          removePlayerFromQueue(playerId);
          const sport: SportDiscipline = entry?.sport || data.sport || 'racing';
          const pairedRoomCode = generateRoomCode(undefined, sport);
          safeWsSend(
            ws,
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
        } else if (data.type === 'queue:leave') {
          removePlayerFromQueue(currentPlayerId || sanitizePlainText(data.playerId, 40));
          safeWsSend(
            ws,
            JSON.stringify({
              type: 'queue:status',
              status: 'cancelled',
              redisChannel: 'mm:1v1:queue',
            })
          );
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
            ...serializeRoomState(room),
            type: 'room:match_started',
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
    app.use(express.static(distPath, { maxAge: '1h', etag: true }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Oxyain server running on http://localhost:${PORT}`);
  });
}

startServer();
