import {
  SubjectId,
  QuestionDifficultyId,
  QuestionItem,
  getQuestionsForMatch,
} from './questions';

export type SportDiscipline = 'racing' | 'sprinting' | 'hurdles';
export type MatchLengthId = 'sprint' | 'circuit' | 'endurance';
export type MultiplayerMode = 'quickplay' | 'custom';
export type RivalDifficulty = 'standard' | 'varsity' | 'olympiad';
export type VelocityPreset = 'standard' | 'turbo';
export type CompetitorCount = 2 | 4 | 6 | 8;

export const QUESTION_COUNT_PRESETS = [5, 10, 15, 25, 50, 100] as const;

export interface MatchLengthConfig {
  id: MatchLengthId;
  label: string;
  questionCount: number;
  durationLabel: string;
  timeLimitSeconds: number;
  trackDistanceMeters: number;
  proOnly?: boolean;
}

export const MATCH_LENGTHS: Record<MatchLengthId, MatchLengthConfig> = {
  sprint: {
    id: 'sprint',
    label: 'Sprint',
    questionCount: 5,
    durationLabel: 'Under 2 min',
    timeLimitSeconds: 120,
    trackDistanceMeters: 600,
    proOnly: false,
  },
  circuit: {
    id: 'circuit',
    label: 'Circuit',
    questionCount: 10,
    durationLabel: '4–5 min',
    timeLimitSeconds: 270,
    trackDistanceMeters: 1200,
    proOnly: false,
  },
  endurance: {
    id: 'endurance',
    label: 'Endurance',
    questionCount: 20,
    durationLabel: '10 min',
    timeLimitSeconds: 600,
    trackDistanceMeters: 2400,
    proOnly: true,
  },
};

export interface SportConfig {
  id: SportDiscipline;
  label: string;
  shortLabel: string;
  subtitle: string;
  venueName: string;
  codePrefix: string;
}

export const SPORT_CONFIGS: Record<SportDiscipline, SportConfig> = {
  racing: {
    id: 'racing',
    label: 'Grand Prix Racing',
    shortLabel: 'Car Racing',
    subtitle: 'Formula prototype aero-chassis with multi-car grid & DRS telemetry',
    venueName: 'Neo-Silverstone Academic Circuit',
    codePrefix: 'RACE',
  },
  sprinting: {
    id: 'sprinting',
    label: 'Stadium Track Sprint',
    shortLabel: 'Sprinting',
    subtitle: 'High-cadence tartan straightaway dash with stride frequency bursts',
    venueName: 'Olympia Tartan Arena',
    codePrefix: 'SPRT',
  },
  hurdles: {
    id: 'hurdles',
    label: '110m Championship Hurdles',
    shortLabel: 'Hurdle Dash',
    subtitle: 'Precision hurdle clearance where correct answers power airborne leaps',
    venueName: 'Zurich Diamond Hurdle Straight',
    codePrefix: 'HURD',
  },
};

// Core speed constants mandated by prompt specification:
// - Correct answer grants +20 km/h speed boost
// - Win-streak (2+ consecutive correct answers) triggers enhanced +30 km/h speed boost per question
// - Incorrect answer decreases speed by -15 km/h and resets streak to 0
export const BASE_SPEED_KMH = 100;
export const MIN_SPEED_KMH = 40;
export const MAX_SPEED_KMH = 380;
export const CORRECT_SPEED_BOOST_KMH = 20;
export const STREAK_SPEED_BOOST_KMH = 30;
export const WRONG_SPEED_PENALTY_KMH = 15;

// Guest (Free) vs Logged-In (Pro) Custom Room Entitlement Constants
export const FREE_MAX_COMPETITORS: CompetitorCount = 4;
export const PRO_MAX_COMPETITORS: CompetitorCount = 8;
export const FREE_MAX_QUESTION_COUNT = 15;
export const PRO_MAX_QUESTION_COUNT = 100;

export interface CustomLobbyConfig {
  competitorCount: CompetitorCount;
  rivalDifficulty: RivalDifficulty;
  velocityPreset: VelocityPreset;
  privateRoom: boolean;
}

export const DEFAULT_CUSTOM_LOBBY_CONFIG: CustomLobbyConfig = {
  competitorCount: 4,
  rivalDifficulty: 'standard',
  velocityPreset: 'standard',
  privateRoom: false,
};

export interface PlayerRaceState {
  id: string;
  name: string;
  isAi?: boolean;
  isHost?: boolean;
  liveryColor?: number;
  accentColor?: number;
  speedKmh: number;
  peakSpeedKmh: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  wrongCount: number;
  answeredCount: number;
  distanceMeters: number;
  laneIndex: -1 | 0 | 1;
  trackSlotOffset: number;
  stumbleTimer: number;
  boostTimer: number;
  lastDeltaKmh: number;
  lastAnswerStatus: 'idle' | 'correct' | 'streak' | 'wrong';
  finished: boolean;
  finishTimeSeconds: number | null;
}

// ============================================================================
// Local In-Memory Replay Arena Telemetry Types
// ============================================================================

export type ReplayEventType =
  | 'match_start'
  | 'lane_adjustment'
  | 'nitro_boost'
  | 'streak_nitro'
  | 'mistake_penalty'
  | 'match_finish';

export interface ReplayEvent {
  id: string;
  stepIndex: number;
  timestampSeconds: number;
  type: ReplayEventType;
  label: string;
  detail: string;
  questionIndex?: number;
  questionPrompt?: string;
  chosenOption?: string;
  correctOption?: string;
  isCorrect?: boolean;
  speedKmh: number;
  deltaKmh: number;
  streak: number;
  distanceMeters: number;
  laneIndex: -1 | 0 | 1;
  playerRank: number;
  competitorDistances: number[];
}

export interface MatchState {
  roomCode: string;
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty: QuestionDifficultyId;
  questionCount: number;
  matchLength: MatchLengthId;
  mode: MultiplayerMode;
  competitorCount: CompetitorCount;
  rivalDifficulty: RivalDifficulty;
  velocityPreset: VelocityPreset;
  questions: QuestionItem[];
  currentQuestionIndex: number;
  elapsedSeconds: number;
  timeLimitSeconds: number;
  trackDistanceMeters: number;
  player: PlayerRaceState;
  opponent: PlayerRaceState;
  competitors: PlayerRaceState[];
  status: 'title' | 'playing' | 'paused' | 'gameover' | 'replay';
  winner: 'player' | 'opponent' | 'tie' | null;
  playerRank: number;
  replayEvents: ReplayEvent[];
  replayMemoryFlushed: boolean;
  lastFeedback: {
    isCorrect: boolean;
    deltaKmh: number;
    streak: number;
    explanation: string;
    correctOption: string;
  } | null;
}

const RIVAL_ROSTER: { name: string; liveryColor: number; accentColor: number }[] = [
  { name: 'Apex Scholar AI', liveryColor: 0xf43f5e, accentColor: 0x38bdf8 },
  { name: 'Nova Velocity', liveryColor: 0xa855f7, accentColor: 0xf59e0b },
  { name: 'Vector Prime', liveryColor: 0x10b981, accentColor: 0x06b6d4 },
  { name: 'Quantum Contender', liveryColor: 0xf97316, accentColor: 0x38bdf8 },
  { name: 'Dr. Elena Vance', liveryColor: 0x3b82f6, accentColor: 0xfacc15 },
  { name: 'Marcus Sterling', liveryColor: 0xec4899, accentColor: 0x2dd4bf },
  { name: 'Kaito Takahashi', liveryColor: 0xeab308, accentColor: 0xf43f5e },
];

export function generateRoomCode(seed?: number, sport?: SportDiscipline): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const alphanum = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  if (sport) {
    const prefix = SPORT_CONFIGS[sport]?.codePrefix || 'RACE';
    if (typeof seed === 'number') {
      let s = (seed ^ prefix.charCodeAt(0)) >>> 0;
      const d1 = (((s * 1664525 + 1013904223) >>> 0) % 9) + 1;
      s = (s * 1664525 + 1013904223) >>> 0;
      const d2 = (s % 9) + 1;
      s = (s * 1664525 + 1013904223) >>> 0;
      const ch = letters[s % letters.length];
      return `${prefix}-${d1}${d2}${ch}`;
    }
    const d1 = Math.floor(Math.random() * 9) + 1;
    const d2 = Math.floor(Math.random() * 9) + 1;
    const ch = alphanum[Math.floor(Math.random() * letters.length)];
    return `${prefix}-${d1}${d2}${ch}`;
  }

  if (typeof seed === 'number') {
    let s = seed >>> 0;
    let code = '';
    for (let i = 0; i < 6; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      code += letters[s % letters.length];
    }
    return code;
  }

  let code = '';
  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 6; i++) {
    code += allLetters[Math.floor(Math.random() * allLetters.length)];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (/^[A-Z]{6}$/.test(normalized)) {
    return true;
  }
  if (/^[A-Z]{3,4}-[A-Z0-9]{3,4}$/.test(normalized)) {
    return true;
  }
  return false;
}

export function evaluateLobbyAccess(
  session: AuthenticatedSession | null,
  config: {
    mode: MultiplayerMode;
    matchLength: MatchLengthId;
    questionCount?: number;
    competitorCount: CompetitorCount;
    rivalDifficulty: RivalDifficulty;
    velocityPreset: VelocityPreset;
  }
): {
  allowed: boolean;
  requiresLoginReason: string | null;
  isProActive: boolean;
} {
  const isLoggedIn = Boolean(session);
  const isProTier = Boolean(session && (session.tier === 'classroom' || session.tier === 'district'));
  const qCount = config.questionCount ?? MATCH_LENGTHS[config.matchLength].questionCount;

  if (!isLoggedIn) {
    if (config.competitorCount > FREE_MAX_COMPETITORS) {
      return {
        allowed: false,
        requiresLoginReason: `Lobbies with ${config.competitorCount} competitors require a logged-in Pro account (Guest Free tier supports up to ${FREE_MAX_COMPETITORS} competitors).`,
        isProActive: false,
      };
    }
    if (config.matchLength === 'endurance' || qCount > FREE_MAX_QUESTION_COUNT) {
      return {
        allowed: false,
        requiresLoginReason:
          'Endurance Championship (20+ Questions) requires logging in. Guests can play up to 15 questions for free.',
        isProActive: false,
      };
    }
    if (config.rivalDifficulty !== 'standard' || config.velocityPreset !== 'standard') {
      return {
        allowed: false,
        requiresLoginReason:
          'Custom Pro Rulesets (Varsity/Olympiad AI Pace & Turbo Velocity) require logging in.',
        isProActive: false,
      };
    }
  }

  return {
    allowed: true,
    requiresLoginReason: null,
    isProActive: isLoggedIn || isProTier,
  };
}

export function createInitialPlayerState(
  id: string,
  name: string,
  laneIndex: -1 | 0 | 1 = -1,
  options?: {
    isAi?: boolean;
    isHost?: boolean;
    liveryColor?: number;
    accentColor?: number;
    trackSlotOffset?: number;
  }
): PlayerRaceState {
  return {
    id,
    name,
    isAi: options?.isAi ?? false,
    isHost: options?.isHost ?? false,
    liveryColor: options?.liveryColor ?? 0x06b6d4,
    accentColor: options?.accentColor ?? 0xf59e0b,
    speedKmh: BASE_SPEED_KMH,
    peakSpeedKmh: BASE_SPEED_KMH,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    wrongCount: 0,
    answeredCount: 0,
    distanceMeters: 0,
    laneIndex,
    trackSlotOffset: options?.trackSlotOffset ?? laneIndex * 2.4,
    stumbleTimer: 0,
    boostTimer: 0,
    lastDeltaKmh: 0,
    lastAnswerStatus: 'idle',
    finished: false,
    finishTimeSeconds: null,
  };
}

export function getPlayerRankInMatch(player: PlayerRaceState, competitors: PlayerRaceState[]): number {
  const all = [player, ...competitors];
  all.sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTimeSeconds ?? Infinity) - (b.finishTimeSeconds ?? Infinity);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    if (Math.abs(b.distanceMeters - a.distanceMeters) > 0.01) {
      return b.distanceMeters - a.distanceMeters;
    }
    return b.speedKmh - a.speedKmh;
  });
  const idx = all.findIndex((p) => p.id === player.id);
  return idx >= 0 ? idx + 1 : 1;
}

export function inferMatchLengthFromCount(count: number): MatchLengthId {
  if (count <= 7) return 'sprint';
  if (count <= 15) return 'circuit';
  return 'endurance';
}

export interface LiveRoomPeer {
  id: string;
  name: string;
  isHost?: boolean;
  ready?: boolean;
  speedKmh: number;
  distanceMeters: number;
  streak: number;
  correctCount: number;
  answeredCount: number;
  laneIndex: -1 | 0 | 1;
  finished: boolean;
}

export interface ActiveRoomSummary {
  roomCode: string;
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty?: QuestionDifficultyId;
  questionCount?: number;
  matchLength: MatchLengthId;
  mode: MultiplayerMode;
  competitorCount: CompetitorCount;
  hostName: string;
  playerCount: number;
  status?: 'lobby' | 'playing';
}

export function evaluateQuestionGeneratorAccess(session: AuthenticatedSession | null): {
  allowed: boolean;
  reason: string | null;
} {
  if (!session) {
    return {
      allowed: false,
      reason:
        'Question Generator Studio is a Pro feature. Sign in with a Pro account to create, edit, and share custom question banks.',
    };
  }
  return {
    allowed: true,
    reason: null,
  };
}

export function evaluateSourceExtractionAccess(session: AuthenticatedSession | null): {
  allowed: boolean;
  reason: string | null;
} {
  if (!session) {
    return {
      allowed: false,
      reason:
        'AI Source Extractor is a Pro feature. Sign in with a Pro account to import questions from PDF, Word DOCX, or web links.',
    };
  }
  return {
    allowed: true,
    reason: null,
  };
}

export function createMatchState(params: {
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty?: QuestionDifficultyId;
  questionCount?: number;
  matchLength: MatchLengthId;
  mode: MultiplayerMode;
  roomCode?: string;
  playerName?: string;
  opponentName?: string;
  competitorCount?: CompetitorCount;
  rivalDifficulty?: RivalDifficulty;
  velocityPreset?: VelocityPreset;
  remotePeers?: LiveRoomPeer[];
  customQuestions?: QuestionItem[];
  seed?: number;
}): MatchState {
  const lengthConfig = MATCH_LENGTHS[params.matchLength];
  const resolvedQuestionCount =
    typeof params.questionCount === 'number' && params.questionCount >= 1
      ? Math.min(PRO_MAX_QUESTION_COUNT, Math.max(1, Math.round(params.questionCount)))
      : lengthConfig.questionCount;

  const resolvedDifficulty: QuestionDifficultyId = params.questionDifficulty ?? 'all';
  const resolvedTrackDistance = resolvedQuestionCount * 120;
  const resolvedTimeLimit = Math.max(60, resolvedQuestionCount * 24);

  const roomCode =
    params.roomCode && isValidRoomCode(params.roomCode)
      ? params.roomCode.trim().toUpperCase()
      : params.mode === 'custom'
      ? generateRoomCode(params.seed, params.sport)
      : generateRoomCode(params.seed);

  const seedFromRoom = roomCode
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), params.seed ?? 101);

  const questions = getQuestionsForMatch(
    params.subject,
    resolvedQuestionCount,
    seedFromRoom,
    resolvedDifficulty,
    params.customQuestions
  );

  const totalCompetitors: CompetitorCount =
    params.competitorCount ?? (params.mode === 'custom' ? 4 : 2);
  const rivalCount = Math.max(1, totalCompetitors - 1);

  const player = createInitialPlayerState(
    'player-1',
    params.playerName || 'You (Guest Contender)',
    -1,
    {
      isAi: false,
      isHost: params.mode === 'custom',
      liveryColor: 0x06b6d4,
      accentColor: 0xf59e0b,
      trackSlotOffset: -2.4,
    }
  );

  const slotOffsets = [2.4, 0, -4.4, 4.4, -1.2, 1.2, 3.6];
  const lanes: (-1 | 0 | 1)[] = [1, 0, -1, 1, 0, 1, -1];
  const remoteList = params.remotePeers ?? [];

  const competitors: PlayerRaceState[] = [];
  for (let i = 0; i < rivalCount; i++) {
    const template = RIVAL_ROSTER[i % RIVAL_ROSTER.length];
    const remotePeer = remoteList[i];
    const isHumanPeer = Boolean(remotePeer);
    const rId = remotePeer ? remotePeer.id : `rival-${i + 1}`;
    const rName = remotePeer
      ? `${remotePeer.name} (LIVE)`
      : i === 0 && params.opponentName
      ? params.opponentName
      : template.name;

    competitors.push(
      createInitialPlayerState(rId, rName, lanes[i % lanes.length], {
        isAi: !isHumanPeer,
        isHost: Boolean(remotePeer?.isHost),
        liveryColor: template.liveryColor,
        accentColor: template.accentColor,
        trackSlotOffset: slotOffsets[i % slotOffsets.length],
      })
    );
  }

  const initialEvent: ReplayEvent = {
    id: 'evt-0',
    stepIndex: 0,
    timestampSeconds: 0,
    type: 'match_start',
    label: 'GRID LAUNCH · BASE CRUISE (100 km/h)',
    detail: `Started ${SPORT_CONFIGS[params.sport].label} (${resolvedQuestionCount} Questions · ${resolvedDifficulty.toUpperCase()} Difficulty) in Room ${roomCode}.`,
    speedKmh: BASE_SPEED_KMH,
    deltaKmh: 0,
    streak: 0,
    distanceMeters: 0,
    laneIndex: -1,
    playerRank: 1,
    competitorDistances: competitors.map(() => 0),
  };

  return {
    roomCode,
    sport: params.sport,
    subject: params.subject,
    questionDifficulty: resolvedDifficulty,
    questionCount: resolvedQuestionCount,
    matchLength: params.matchLength,
    mode: params.mode,
    competitorCount: totalCompetitors,
    rivalDifficulty: params.rivalDifficulty ?? 'standard',
    velocityPreset: params.velocityPreset ?? 'standard',
    questions,
    currentQuestionIndex: 0,
    elapsedSeconds: 0,
    timeLimitSeconds: resolvedTimeLimit,
    trackDistanceMeters: resolvedTrackDistance,
    player,
    opponent: competitors[0],
    competitors,
    status: 'playing',
    winner: null,
    playerRank: 1,
    replayEvents: [initialEvent],
    replayMemoryFlushed: false,
    lastFeedback: null,
  };
}

/**
 * Synchronizes live remote WebSocket human players into the match's competitor slots.
 * Real connected human players replace CPU AI slots (setting `isAi: false`), while any remaining
 * unfilled slots in a 4/6/8-racer grid remain active AI pacers.
 */
export function syncRemotePeersIntoMatch(
  state: MatchState,
  remotePeers: LiveRoomPeer[]
): MatchState {
  if (!remotePeers || remotePeers.length === 0) return state;

  const updatedCompetitors = state.competitors.map((comp, idx) => {
    const peerById = remotePeers.find((p) => p.id === comp.id);
    const peerBySlot = !peerById && idx < remotePeers.length ? remotePeers[idx] : undefined;
    const peer = peerById || peerBySlot;
    if (!peer) return comp;

    const prevDist = comp.distanceMeters;
    const nextDist = typeof peer.distanceMeters === 'number' ? peer.distanceMeters : prevDist;
    const prevSpeed = comp.speedKmh;
    const nextSpeed = typeof peer.speedKmh === 'number' ? peer.speedKmh : prevSpeed;

    return {
      ...comp,
      id: peer.id,
      name: peer.name.includes('(LIVE)') ? peer.name : `${peer.name} (LIVE)`,
      isAi: false,
      isHost: Boolean(peer.isHost),
      speedKmh: nextSpeed,
      peakSpeedKmh: Math.max(comp.peakSpeedKmh, nextSpeed),
      distanceMeters: nextDist,
      streak: typeof peer.streak === 'number' ? peer.streak : comp.streak,
      correctCount: typeof peer.correctCount === 'number' ? peer.correctCount : comp.correctCount,
      answeredCount: typeof peer.answeredCount === 'number' ? peer.answeredCount : comp.answeredCount,
      laneIndex:
        peer.laneIndex === -1 || peer.laneIndex === 0 || peer.laneIndex === 1
          ? peer.laneIndex
          : comp.laneIndex,
      boostTimer: nextSpeed > prevSpeed ? 0.85 : comp.boostTimer,
      stumbleTimer: nextSpeed < prevSpeed ? 0.65 : comp.stumbleTimer,
      finished: Boolean(peer.finished),
      finishTimeSeconds:
        peer.finished && comp.finishTimeSeconds === null
          ? state.elapsedSeconds
          : comp.finishTimeSeconds,
    };
  });

  const nextRank = getPlayerRankInMatch(state.player, updatedCompetitors);
  return {
    ...state,
    opponent: updatedCompetitors[0] || state.opponent,
    competitors: updatedCompetitors,
    playerRank: nextRank,
  };
}

export function applyAnswerToPlayer(
  player: PlayerRaceState,
  isCorrect: boolean,
  elapsedSeconds = 0
): PlayerRaceState {
  if (isCorrect) {
    const newStreak = player.streak + 1;
    const isStreakBoost = newStreak >= 2;
    const boostKmh = isStreakBoost ? STREAK_SPEED_BOOST_KMH : CORRECT_SPEED_BOOST_KMH;
    const nextSpeed = Math.min(MAX_SPEED_KMH, player.speedKmh + boostKmh);
    const nextPeak = Math.max(player.peakSpeedKmh, nextSpeed);
    const nextBestStreak = Math.max(player.bestStreak, newStreak);

    return {
      ...player,
      speedKmh: nextSpeed,
      peakSpeedKmh: nextPeak,
      streak: newStreak,
      bestStreak: nextBestStreak,
      correctCount: player.correctCount + 1,
      answeredCount: player.answeredCount + 1,
      boostTimer: isStreakBoost ? 1.2 : 0.85,
      stumbleTimer: 0,
      lastDeltaKmh: boostKmh,
      lastAnswerStatus: isStreakBoost ? 'streak' : 'correct',
    };
  } else {
    const nextSpeed = Math.max(MIN_SPEED_KMH, player.speedKmh - WRONG_SPEED_PENALTY_KMH);
    return {
      ...player,
      speedKmh: nextSpeed,
      streak: 0,
      wrongCount: player.wrongCount + 1,
      answeredCount: player.answeredCount + 1,
      stumbleTimer: 0.75,
      boostTimer: 0,
      lastDeltaKmh: -WRONG_SPEED_PENALTY_KMH,
      lastAnswerStatus: 'wrong',
    };
  }
}

export function recordLaneAdjustmentEvent(
  state: MatchState,
  nextLane: -1 | 0 | 1
): MatchState {
  if (state.status !== 'playing' || nextLane === state.player.laneIndex) {
    return state;
  }

  const laneLabel = nextLane === -1 ? 'Left Lane' : nextLane === 0 ? 'Center Lane' : 'Right Lane';
  const stepIndex = state.replayEvents.length;
  const updatedPlayer: PlayerRaceState = {
    ...state.player,
    laneIndex: nextLane,
  };

  const laneEvt: ReplayEvent = {
    id: `evt-${stepIndex}`,
    stepIndex,
    timestampSeconds: Number(state.elapsedSeconds.toFixed(2)),
    type: 'lane_adjustment',
    label: `LANE ADJUSTMENT: ${laneLabel.toUpperCase()}`,
    detail: `Shifted from lane ${state.player.laneIndex} to ${nextLane} (${laneLabel}) at ${Math.round(updatedPlayer.speedKmh)} km/h.`,
    speedKmh: updatedPlayer.speedKmh,
    deltaKmh: 0,
    streak: updatedPlayer.streak,
    distanceMeters: Math.round(updatedPlayer.distanceMeters),
    laneIndex: nextLane,
    playerRank: state.playerRank,
    competitorDistances: state.competitors.map((c) => Math.round(c.distanceMeters)),
  };

  return {
    ...state,
    player: updatedPlayer,
    replayEvents: [...state.replayEvents, laneEvt],
  };
}

export function submitMatchAnswer(state: MatchState, selectedIndex: number): MatchState {
  if (state.status !== 'playing') return state;
  const currentQuestion = state.questions[state.currentQuestionIndex];
  if (!currentQuestion) return state;

  const isCorrect = selectedIndex === currentQuestion.correctIndex;
  const updatedPlayer = applyAnswerToPlayer(state.player, isCorrect, state.elapsedSeconds);

  const turboMultiplier = state.velocityPreset === 'turbo' ? 1.25 : 1.0;
  const distanceBurst = isCorrect
    ? Math.round((updatedPlayer.streak >= 2 ? 42 : 28) * turboMultiplier)
    : -6;
  const newDistance = Math.max(
    0,
    Math.min(state.trackDistanceMeters, updatedPlayer.distanceMeters + distanceBurst)
  );
  updatedPlayer.distanceMeters = newDistance;

  const nextQuestionIndex = state.currentQuestionIndex + 1;
  const completedAllQuestions = nextQuestionIndex >= state.questions.length;

  if (completedAllQuestions || newDistance >= state.trackDistanceMeters) {
    updatedPlayer.distanceMeters = state.trackDistanceMeters;
    updatedPlayer.finished = true;
    updatedPlayer.finishTimeSeconds = state.elapsedSeconds;
  }

  const nextRank = getPlayerRankInMatch(updatedPlayer, state.competitors);

  let nextStatus: MatchState['status'] = state.status;
  let winner: MatchState['winner'] = state.winner;

  if (updatedPlayer.finished) {
    nextStatus = 'gameover';
    winner = nextRank === 1 ? 'player' : 'opponent';
  }

  const stepIndex = state.replayEvents.length;
  const eventType: ReplayEventType = isCorrect
    ? updatedPlayer.streak >= 2
      ? 'streak_nitro'
      : 'nitro_boost'
    : 'mistake_penalty';

  const answerEvent: ReplayEvent = {
    id: `evt-${stepIndex}`,
    stepIndex,
    timestampSeconds: Number(state.elapsedSeconds.toFixed(2)),
    type: eventType,
    label: isCorrect
      ? updatedPlayer.streak >= 2
        ? `STREAK NITRO (+${updatedPlayer.lastDeltaKmh} km/h) · ${updatedPlayer.streak}x STREAK`
        : `NITRO BOOST (+${updatedPlayer.lastDeltaKmh} km/h) · Q${state.currentQuestionIndex + 1} CORRECT`
      : `MISTAKE PENALTY (${updatedPlayer.lastDeltaKmh} km/h) · Q${state.currentQuestionIndex + 1} STUMBLE`,
    detail: currentQuestion.explanation,
    questionIndex: state.currentQuestionIndex + 1,
    questionPrompt: currentQuestion.prompt,
    chosenOption: currentQuestion.options[selectedIndex] || 'Option',
    correctOption: currentQuestion.options[currentQuestion.correctIndex],
    isCorrect,
    speedKmh: updatedPlayer.speedKmh,
    deltaKmh: updatedPlayer.lastDeltaKmh,
    streak: updatedPlayer.streak,
    distanceMeters: Math.round(updatedPlayer.distanceMeters),
    laneIndex: updatedPlayer.laneIndex,
    playerRank: nextRank,
    competitorDistances: state.competitors.map((c) => Math.round(c.distanceMeters)),
  };

  const nextEvents = [...state.replayEvents, answerEvent];

  if (nextStatus === 'gameover') {
    const finishStep = nextEvents.length;
    nextEvents.push({
      id: `evt-${finishStep}`,
      stepIndex: finishStep,
      timestampSeconds: Number(state.elapsedSeconds.toFixed(2)),
      type: 'match_finish',
      label: `CHECKERED FLAG · POS #${nextRank}/${state.competitorCount}`,
      detail: `Match concluded at ${Math.round(updatedPlayer.speedKmh)} km/h (Peak: ${Math.round(updatedPlayer.peakSpeedKmh)} km/h).`,
      speedKmh: updatedPlayer.speedKmh,
      deltaKmh: 0,
      streak: updatedPlayer.streak,
      distanceMeters: Math.round(updatedPlayer.distanceMeters),
      laneIndex: updatedPlayer.laneIndex,
      playerRank: nextRank,
      competitorDistances: state.competitors.map((c) => Math.round(c.distanceMeters)),
    });
  }

  return {
    ...state,
    player: updatedPlayer,
    playerRank: nextRank,
    currentQuestionIndex: completedAllQuestions ? state.currentQuestionIndex : nextQuestionIndex,
    status: nextStatus,
    winner,
    replayEvents: nextEvents,
    lastFeedback: {
      isCorrect,
      deltaKmh: updatedPlayer.lastDeltaKmh,
      streak: updatedPlayer.streak,
      explanation: currentQuestion.explanation,
      correctOption: currentQuestion.options[currentQuestion.correctIndex],
    },
  };
}

/**
 * Reconstructs a full MatchState snapshot at a given stepIndex in the local RAM-cached replayEvents array
 * so the full-bleed 3D Three.js viewport can visually re-enact the exact nitro boost, mistake stumble, or lane shift.
 */
export function reconstructMatchAtReplayStep(state: MatchState, stepIndex: number): MatchState {
  if (!state.replayEvents || state.replayEvents.length === 0) {
    return state;
  }
  const clampedIdx = Math.max(0, Math.min(state.replayEvents.length - 1, stepIndex));
  const evt = state.replayEvents[clampedIdx];

  const isNitro = evt.type === 'nitro_boost' || evt.type === 'streak_nitro';
  const isMistake = evt.type === 'mistake_penalty';

  const reconstructedPlayer: PlayerRaceState = {
    ...state.player,
    speedKmh: evt.speedKmh,
    streak: evt.streak,
    distanceMeters: evt.distanceMeters,
    laneIndex: evt.laneIndex,
    boostTimer: isNitro ? 1.0 : 0,
    stumbleTimer: isMistake ? 0.65 : 0,
    lastDeltaKmh: evt.deltaKmh,
    lastAnswerStatus: isMistake
      ? 'wrong'
      : evt.type === 'streak_nitro'
      ? 'streak'
      : isNitro
      ? 'correct'
      : 'idle',
  };

  const reconstructedCompetitors = state.competitors.map((c, idx) => ({
    ...c,
    distanceMeters: evt.competitorDistances[idx] ?? c.distanceMeters,
  }));

  return {
    ...state,
    elapsedSeconds: evt.timestampSeconds,
    player: reconstructedPlayer,
    opponent: reconstructedCompetitors[0] || state.opponent,
    competitors: reconstructedCompetitors,
    playerRank: evt.playerRank,
  };
}

/**
 * Permanently flushes the transient RAM-cached replayEvents array when exiting the Local In-Memory Replay Arena View.
 */
export function flushReplayMemory(state: MatchState): MatchState {
  // Explicitly clear in-place if mutable reference exists, then return new state with empty array
  state.replayEvents.length = 0;
  return {
    ...state,
    status: 'gameover',
    replayEvents: [],
    replayMemoryFlushed: true,
  };
}

export function stepMatchSimulation(
  state: MatchState,
  rawDt: number,
  allowAiOpponent = true
): MatchState {
  if (state.status !== 'playing') return state;
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const nextElapsed = state.elapsedSeconds + dt;

  const kmhToTrackMps = (kmh: number) => (kmh / 3.6) * 0.32;

  const player = { ...state.player };
  player.stumbleTimer = Math.max(0, player.stumbleTimer - dt);
  player.boostTimer = Math.max(0, player.boostTimer - dt);

  const playerStumbleFactor = player.stumbleTimer > 0 ? 0.45 : 1.0;
  player.distanceMeters = Math.min(
    state.trackDistanceMeters,
    player.distanceMeters + kmhToTrackMps(player.speedKmh) * playerStumbleFactor * dt
  );

  const cadenceBase =
    state.rivalDifficulty === 'olympiad'
      ? 6.0
      : state.rivalDifficulty === 'varsity'
      ? 6.8
      : 7.5;

  const updatedCompetitors = state.competitors.map((comp, idx) => {
    const rival = { ...comp };
    rival.stumbleTimer = Math.max(0, rival.stumbleTimer - dt);
    rival.boostTimer = Math.max(0, rival.boostTimer - dt);

    const shouldSimAi = rival.isAi !== false && (idx === 0 ? allowAiOpponent : true);
    if (shouldSimAi && !rival.finished) {
      const rivalCadence = cadenceBase + idx * 0.45;
      const expectedAnswers = Math.min(
        state.questions.length,
        Math.floor(nextElapsed / rivalCadence)
      );
      if (expectedAnswers > rival.answeredCount) {
        const qIdx = rival.answeredCount;
        const rivalCorrect = (qIdx + state.roomCode.charCodeAt(0) + idx * 3) % 4 !== 2;
        const afterAns = applyAnswerToPlayer(rival, rivalCorrect, nextElapsed);
        Object.assign(rival, afterAns);
        const rivalBurst = rivalCorrect ? (rival.streak >= 2 ? 30 : 18) : -4;
        rival.distanceMeters = Math.max(
          0,
          Math.min(state.trackDistanceMeters, rival.distanceMeters + rivalBurst)
        );
      }

      const oppStumbleFactor = rival.stumbleTimer > 0 ? 0.5 : 1.0;
      rival.distanceMeters = Math.min(
        state.trackDistanceMeters,
        rival.distanceMeters + kmhToTrackMps(rival.speedKmh) * oppStumbleFactor * dt
      );
      if (rival.distanceMeters >= state.trackDistanceMeters) {
        rival.finished = true;
        rival.finishTimeSeconds = nextElapsed;
      }
    }
    return rival;
  });

  const primaryOpponent = updatedCompetitors[0] || state.opponent;
  const nextRank = getPlayerRankInMatch(player, updatedCompetitors);

  let nextStatus: MatchState['status'] = state.status;
  let winner: MatchState['winner'] = state.winner;

  if (player.distanceMeters >= state.trackDistanceMeters && !player.finished) {
    player.finished = true;
    player.finishTimeSeconds = nextElapsed;
  }

  if (player.finished) {
    nextStatus = 'gameover';
    winner = nextRank === 1 ? 'player' : 'opponent';
  } else if (nextElapsed >= state.timeLimitSeconds) {
    nextStatus = 'gameover';
    if (nextRank === 1) winner = 'player';
    else winner = 'opponent';
  }

  let nextReplayEvents = state.replayEvents;
  if (nextStatus === 'gameover' && state.status === 'playing') {
    const finishStep = state.replayEvents.length;
    nextReplayEvents = [
      ...state.replayEvents,
      {
        id: `evt-${finishStep}`,
        stepIndex: finishStep,
        timestampSeconds: Number(nextElapsed.toFixed(2)),
        type: 'match_finish',
        label: `CHECKERED FLAG · POS #${nextRank}/${state.competitorCount}`,
        detail: `Match concluded at ${Math.round(player.speedKmh)} km/h (Peak: ${Math.round(player.peakSpeedKmh)} km/h).`,
        speedKmh: player.speedKmh,
        deltaKmh: 0,
        streak: player.streak,
        distanceMeters: Math.round(player.distanceMeters),
        laneIndex: player.laneIndex,
        playerRank: nextRank,
        competitorDistances: updatedCompetitors.map((c) => Math.round(c.distanceMeters)),
      },
    ];
  }

  return {
    ...state,
    elapsedSeconds: nextElapsed,
    player,
    opponent: primaryOpponent,
    competitors: updatedCompetitors,
    playerRank: nextRank,
    status: nextStatus,
    winner,
    replayEvents: nextReplayEvents,
  };
}

// ============================================================================
// Public Marketing Portal Pricing & Authentication Logic
// ============================================================================

export type BillingCycle = 'monthly' | 'annual';
export type PricingTierId = 'contender' | 'classroom' | 'district';
export type AuthMode = 'signin' | 'signup' | 'sso';
export type StakeholderRole = 'student' | 'educator' | 'investor';

export interface PricingTier {
  id: PricingTierId;
  indexLabel: string;
  name: string;
  audience: string;
  monthlyPriceUsd: number;
  annualMonthlyEquivalentUsd: number;
  summary: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'contender',
    indexLabel: 'FREE PLAN',
    name: 'Contender',
    audience: 'Individual Players & Students',
    monthlyPriceUsd: 0,
    annualMonthlyEquivalentUsd: 0,
    summary: 'Jump straight into 1v1 Quick Play or host up to 4-player multiplayer rooms.',
    features: [
      'Instant 1v1 Quick Play & 4-racer multiplayer grids',
      'Private & public room codes for up to 4 racers',
      'Easy, Medium, and Hard difficulty modes',
      'Full 3D step-by-step post-match replay',
    ],
    ctaLabel: 'Start Free Account',
  },
  {
    id: 'classroom',
    indexLabel: 'PRO PLAN',
    name: 'Classroom & Pro Host',
    audience: 'Educators, Coaches & Tournament Hosts',
    monthlyPriceUsd: 29,
    annualMonthlyEquivalentUsd: 23,
    summary: 'Unlock 8-Racer Grand Prix lobbies, Endurance 20Q+ matches, and custom question tools.',
    features: [
      'Expanded 6-to-8 Racer Grand Prix Car Racing grids',
      'Custom question counts up to 100 Qs & Endurance format',
      'Question Generator Studio & AI Document Import',
      'Live multi-competitor leaderboard & performance stats',
    ],
    ctaLabel: 'Unlock Pro Plan',
    highlighted: true,
  },
  {
    id: 'district',
    indexLabel: 'CAMPUS PLAN',
    name: 'Campus & District',
    audience: 'Schools, Universities & Organizations',
    monthlyPriceUsd: 149,
    annualMonthlyEquivalentUsd: 119,
    summary: 'Campus-wide tournament brackets, SSO login, and curriculum management.',
    features: [
      'Unlimited concurrent multiplayer tournament rooms',
      'Campus SSO & roster synchronization',
      'Cohort mastery & engagement reporting',
      'Dedicated onboarding & custom question libraries',
    ],
    ctaLabel: 'Activate Campus Plan',
  },
];

export function getEffectiveMonthlyPrice(tier: PricingTier, cycle: BillingCycle): number {
  return cycle === 'annual' ? tier.annualMonthlyEquivalentUsd : tier.monthlyPriceUsd;
}

export interface AuthFormInput {
  mode: AuthMode;
  email: string;
  password?: string;
  fullName?: string;
  institutionCode?: string;
  role: StakeholderRole;
  selectedTier: PricingTierId;
}

export interface AuthenticatedSession {
  id: string;
  fullName: string;
  email: string;
  role: StakeholderRole;
  tier: PricingTierId;
}

export function validateAuthForm(input: AuthFormInput): {
  valid: boolean;
  error: string | null;
} {
  const email = input.email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid academic or work email address.' };
  }

  if (input.mode === 'signup') {
    const name = (input.fullName || '').trim();
    if (name.length < 2) {
      return { valid: false, error: 'Please enter your full name (at least 2 characters).' };
    }
  }

  if (input.mode === 'sso') {
    const inst = (input.institutionCode || '').trim();
    if (inst.length < 3) {
      return { valid: false, error: 'Please enter a valid Institution or District SSO domain/code.' };
    }
    return { valid: true, error: null };
  }

  const pwd = input.password || '';
  if (pwd.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }

  return { valid: true, error: null };
}

// ============================================================================
// Security, Input Sanitization & Telemetry Clamping Helpers
// ============================================================================

/**
 * Strips HTML tags, script/style payloads, and non-printable control characters,
 * normalizes whitespace, and enforces a strict character length bound.
 */
export function sanitizePlainText(input: unknown, maxLength = 240): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(1, maxLength));
}

/**
 * Clamps and validates live multiplayer telemetry updates so untrusted WebSocket frames
 * cannot inject NaN, Infinity, negative distances, or out-of-bounds speeds/lanes.
 */
export function clampPlayerTelemetry(
  raw: Partial<LiveRoomPeer>,
  maxDistanceMeters = 5000
): Pick<
  LiveRoomPeer,
  'speedKmh' | 'distanceMeters' | 'streak' | 'correctCount' | 'answeredCount' | 'laneIndex' | 'finished'
> {
  const finiteOr = (val: unknown, fallback: number): number =>
    typeof val === 'number' && Number.isFinite(val) ? val : fallback;

  const speedKmh = Math.max(
    MIN_SPEED_KMH,
    Math.min(MAX_SPEED_KMH, Math.round(finiteOr(raw.speedKmh, BASE_SPEED_KMH)))
  );
  const distanceMeters = Math.max(
    0,
    Math.min(maxDistanceMeters, Math.round(finiteOr(raw.distanceMeters, 0)))
  );
  const streak = Math.max(0, Math.min(100, Math.floor(finiteOr(raw.streak, 0))));
  const correctCount = Math.max(0, Math.min(100, Math.floor(finiteOr(raw.correctCount, 0))));
  const answeredCount = Math.max(
    correctCount,
    Math.min(100, Math.floor(finiteOr(raw.answeredCount, 0)))
  );
  const laneIndex: -1 | 0 | 1 =
    raw.laneIndex === -1 || raw.laneIndex === 0 || raw.laneIndex === 1 ? raw.laneIndex : 1;
  const finished = Boolean(raw.finished);

  return {
    speedKmh,
    distanceMeters,
    streak,
    correctCount,
    answeredCount,
    laneIndex,
    finished,
  };
}

// ============================================================================
// 1v1 Matchmaking Queue & Multiplayer Waiting Room Pure Helpers
// ============================================================================

export interface MatchmakingQueueState {
  status: 'idle' | 'searching' | 'paired' | 'cancelled';
  elapsedSeconds: number;
  redisChannel: string;
  queuePosition: number;
  pairedRoomCode: string | null;
  opponentName: string | null;
  opponentTitle: string | null;
  opponentRating: number;
  isHumanOpponent: boolean;
}

export function createInitialQueueState(): MatchmakingQueueState {
  return {
    status: 'searching',
    elapsedSeconds: 0,
    redisChannel: 'mm:1v1:queue',
    queuePosition: 1,
    pairedRoomCode: null,
    opponentName: null,
    opponentTitle: null,
    opponentRating: 1840,
    isHumanOpponent: false,
  };
}

export function stepQueueTimer(
  state: MatchmakingQueueState,
  deltaSeconds: number
): MatchmakingQueueState {
  if (state.status !== 'searching') return state;
  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  return {
    ...state,
    elapsedSeconds: Number((state.elapsedSeconds + safeDelta).toFixed(1)),
  };
}

export function pairQueueOpponent(
  state: MatchmakingQueueState,
  payload: {
    roomCode: string;
    opponentName: string;
    opponentTitle?: string;
    opponentRating?: number;
    isHumanOpponent?: boolean;
  }
): MatchmakingQueueState {
  return {
    ...state,
    status: 'paired',
    pairedRoomCode: sanitizePlainText(payload.roomCode, 16) || 'QM-101',
    opponentName: sanitizePlainText(payload.opponentName, 40) || 'Dr. Elena Vance',
    opponentTitle: sanitizePlainText(payload.opponentTitle || 'Varsity Challenger', 48),
    opponentRating:
      typeof payload.opponentRating === 'number' && Number.isFinite(payload.opponentRating)
        ? Math.max(800, Math.min(3000, Math.round(payload.opponentRating)))
        : 1890,
    isHumanOpponent: Boolean(payload.isHumanOpponent),
  };
}

export interface WaitingRoomSlot {
  slotIndex: number;
  id: string;
  name: string;
  isLocalPlayer: boolean;
  isHuman: boolean;
  isHost: boolean;
  isReady: boolean;
  statusLabel: string;
}

export function buildWaitingRoomSlots(params: {
  localPlayerId: string;
  localPlayerName: string;
  localIsReady: boolean;
  localIsHost: boolean;
  competitorCount: CompetitorCount;
  remotePeers: LiveRoomPeer[];
}): WaitingRoomSlot[] {
  const totalSlots = params.competitorCount;
  const slots: WaitingRoomSlot[] = [];

  slots.push({
    slotIndex: 0,
    id: params.localPlayerId,
    name: sanitizePlainText(params.localPlayerName, 40) || 'You',
    isLocalPlayer: true,
    isHuman: true,
    isHost: params.localIsHost,
    isReady: params.localIsReady,
    statusLabel: params.localIsReady ? 'Ready' : 'In Lobby',
  });

  for (let i = 1; i < totalSlots; i++) {
    const peer = params.remotePeers[i - 1];
    if (peer) {
      const peerReady = peer.ready !== false;
      slots.push({
        slotIndex: i,
        id: peer.id,
        name: sanitizePlainText(peer.name, 40) || `Player ${i + 1}`,
        isLocalPlayer: false,
        isHuman: true,
        isHost: Boolean(peer.isHost),
        isReady: peerReady,
        statusLabel: peerReady ? 'Ready' : 'Joining...',
      });
    } else {
      const fallbackRival = RIVAL_ROSTER[(i - 1) % RIVAL_ROSTER.length];
      slots.push({
        slotIndex: i,
        id: `open-slot-${i + 1}`,
        name: `Open Slot #${i + 1} (${fallbackRival.name} Pacer)`,
        isLocalPlayer: false,
        isHuman: false,
        isHost: false,
        isReady: true,
        statusLabel: 'Waiting for Player',
      });
    }
  }

  return slots;
}

export function canLaunchWaitingRoom(
  slots: WaitingRoomSlot[]
): {
  allowed: boolean;
  humanCount: number;
  readyHumanCount: number;
  minRequiredPlayers: number;
  waitingReason: string | null;
} {
  const humanSlots = slots.filter((s) => s.isHuman);
  const readyHumans = humanSlots.filter((s) => s.isReady);
  const minRequiredPlayers = 2;

  if (humanSlots.length < minRequiredPlayers) {
    return {
      allowed: false,
      humanCount: humanSlots.length,
      readyHumanCount: readyHumans.length,
      minRequiredPlayers,
      waitingReason: 'Waiting for players to join room before starting (minimum 2 players required).',
    };
  }

  if (readyHumans.length < humanSlots.length) {
    return {
      allowed: false,
      humanCount: humanSlots.length,
      readyHumanCount: readyHumans.length,
      minRequiredPlayers,
      waitingReason: 'Waiting for all joined players in the room to mark Ready.',
    };
  }

  return {
    allowed: true,
    humanCount: humanSlots.length,
    readyHumanCount: readyHumans.length,
    minRequiredPlayers,
    waitingReason: null,
  };
}

/**
 * Terminates an ongoing match when triggered by the game host, resetting the match status
 * to 'title' and clearing transient in-game buffers.
 */
export function terminateMatchByHost(
  state: MatchState,
  isHost = true
): MatchState {
  if (!isHost) {
    return state;
  }

  return {
    ...state,
    status: 'title',
    winner: null,
    lastFeedback: null,
    replayEvents: [],
    replayMemoryFlushed: true,
  };
}

// ============================================================================
// Application URL Routing & History State Machine
// ============================================================================

export type AppRouteId =
  | 'landing'
  | 'lobby'
  | 'waiting-room'
  | 'matchmaking'
  | 'play'
  | 'replay'
  | 'generator'
  | 'extractor'
  | 'curriculum';

export interface ResolvedRouteState {
  route: AppRouteId;
  roomCode?: string;
  sport?: SportDiscipline;
  player?: string;
  autostart: boolean;
}

/**
 * Resolves the active application screen from browser pathname and query string.
 * Root path ('/') always resolves to 'landing' unless overridden by a specific route or ?autostart=1.
 */
export function resolveRouteFromLocation(
  pathname = '/',
  search = ''
): ResolvedRouteState {
  const cleanPath = (pathname || '/').split('?')[0].replace(/\/+$/, '').toLowerCase() || '/';
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);

  const autostart = params.get('autostart') === '1';
  const screenParam = (params.get('screen') || '').trim().toLowerCase();
  const rawRoom = params.get('room')?.trim().toUpperCase();
  const roomCode = rawRoom && isValidRoomCode(rawRoom) ? rawRoom : undefined;
  const rawSport = params.get('sport')?.trim().toLowerCase();
  const sport: SportDiscipline | undefined =
    rawSport === 'racing' || rawSport === 'sprinting' || rawSport === 'hurdles'
      ? rawSport
      : undefined;
  const player = params.get('player')?.trim() || undefined;

  if (autostart || cleanPath === '/play' || cleanPath === '/race' || screenParam === 'play') {
    return { route: 'play', roomCode, sport, player, autostart };
  }
  if (cleanPath === '/replay' || screenParam === 'replay') {
    return { route: 'replay', roomCode, sport, player, autostart: false };
  }
  if (
    cleanPath === '/generator' ||
    cleanPath === '/question-generator' ||
    screenParam === 'generator' ||
    screenParam === 'scr09'
  ) {
    return { route: 'generator', roomCode, sport, player, autostart: false };
  }
  if (
    cleanPath === '/extractor' ||
    cleanPath === '/ai-extractor' ||
    cleanPath === '/import' ||
    screenParam === 'extractor' ||
    screenParam === 'scr10'
  ) {
    return { route: 'extractor', roomCode, sport, player, autostart: false };
  }
  if (cleanPath === '/waiting-room' || screenParam === 'waiting-room') {
    return { route: 'waiting-room', roomCode, sport, player, autostart: false };
  }
  if (cleanPath === '/matchmaking' || cleanPath === '/queue' || screenParam === 'matchmaking') {
    return { route: 'matchmaking', roomCode, sport, player, autostart: false };
  }
  if (cleanPath === '/curriculum' || screenParam === 'curriculum') {
    return { route: 'curriculum', roomCode, sport, player, autostart: false };
  }
  if (
    cleanPath === '/lobby' ||
    cleanPath === '/arena' ||
    screenParam === 'lobby' ||
    Boolean(roomCode)
  ) {
    return { route: 'lobby', roomCode, sport, player, autostart: false };
  }

  return { route: 'landing', roomCode, sport, player, autostart: false };
}

/**
 * Builds a clean, canonical browser URL for any application route.
 */
export function buildUrlForRoute(
  route: AppRouteId,
  options?: { roomCode?: string; sport?: SportDiscipline }
): string {
  const query = new URLSearchParams();
  if (
    options?.roomCode &&
    isValidRoomCode(options.roomCode) &&
    (route === 'lobby' || route === 'waiting-room' || route === 'play')
  ) {
    query.set('room', options.roomCode.trim().toUpperCase());
  }
  if (options?.sport && (route === 'lobby' || route === 'play')) {
    query.set('sport', options.sport);
  }
  const qs = query.toString();
  const suffix = qs ? `?${qs}` : '';

  switch (route) {
    case 'landing':
      return '/';
    case 'lobby':
      return `/lobby${suffix}`;
    case 'waiting-room':
      return `/waiting-room${suffix}`;
    case 'matchmaking':
      return '/matchmaking';
    case 'play':
      return `/play${suffix}`;
    case 'replay':
      return '/replay';
    case 'generator':
      return '/generator';
    case 'extractor':
      return '/extractor';
    case 'curriculum':
      return '/curriculum';
    default:
      return '/';
  }
}

// ============================================================================
// High-Concurrency Sharding & Token-Bucket Rate Limiting (1M Users Ready)
// ============================================================================

export const SHARD_COUNT = 64;

/**
 * O(1) deterministic FNV-1a 32-bit consistent hash mapping any room code or player key
 * onto a fixed shard partition [0, shardCount - 1].
 */
export function computeConsistentShardIndex(key: string, shardCount = SHARD_COUNT): number {
  const safeCount = Math.max(1, Math.floor(shardCount));
  const normalized = String(key || '').trim().toUpperCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % safeCount;
}

/**
 * Builds an O(1) partitioned matchmaking queue key so pairing 1v1 players never
 * performs an O(N) scan over all queued sockets.
 */
export function computeMatchmakingBucketKey(
  sport: SportDiscipline,
  subject: SubjectId,
  difficulty: QuestionDifficultyId
): string {
  return `mm:1v1:${sport}:${subject}:${difficulty}`;
}

export interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

/**
 * O(1) token-bucket rate limiter for WebSocket and HTTP request streams.
 */
export function consumeTokenBucket(
  bucket: TokenBucketState,
  nowMs: number,
  capacity = 30,
  refillPerSecond = 15,
  cost = 1
): { allowed: boolean; nextBucket: TokenBucketState } {
  const elapsedSeconds = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
  const replenished = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
  if (replenished < cost) {
    return {
      allowed: false,
      nextBucket: {
        tokens: replenished,
        lastRefillMs: nowMs,
      },
    };
  }
  return {
    allowed: true,
    nextBucket: {
      tokens: replenished - cost,
      lastRefillMs: nowMs,
    },
  };
}
