import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_SPEED_KMH,
  CORRECT_SPEED_BOOST_KMH,
  STREAK_SPEED_BOOST_KMH,
  WRONG_SPEED_PENALTY_KMH,
  MATCH_LENGTHS,
  PRICING_TIERS,
  createInitialPlayerState,
  applyAnswerToPlayer,
  createMatchState,
  submitMatchAnswer,
  recordLaneAdjustmentEvent,
  reconstructMatchAtReplayStep,
  flushReplayMemory,
  generateRoomCode,
  isValidRoomCode,
  getEffectiveMonthlyPrice,
  validateAuthForm,
  evaluateLobbyAccess,
  evaluateQuestionGeneratorAccess,
  evaluateSourceExtractionAccess,
  getPlayerRankInMatch,
  syncRemotePeersIntoMatch,
  stepMatchSimulation,
  sanitizePlainText,
  clampPlayerTelemetry,
  PRO_MAX_QUESTION_COUNT,
  createInitialQueueState,
  stepQueueTimer,
  pairQueueOpponent,
  buildWaitingRoomSlots,
  canLaunchWaitingRoom,
  terminateMatchByHost,
  resolveRouteFromLocation,
  buildUrlForRoute,
  SHARD_COUNT,
  computeConsistentShardIndex,
  computeMatchmakingBucketKey,
  consumeTokenBucket,
} from './rules';
import {
  PRESET_EXTRACTION_SOURCES,
  buildQuestionItemFromDraft,
  cleanSourceTextWithBackgroundWorker,
  createInitialValidationChecks,
  extractStructuredQuestionsFromCleanedText,
  getQuestionsForMatch,
  inferSubjectFromSourceText,
  isNaturalLanguageClause,
  isNaturalLanguageWord,
  validateCustomQuestionBank,
  validateCustomQuestionDraft,
  validateExtractionInput,
} from './questions';

test('First correct answer grants +20 km/h speed boost and sets streak to 1', () => {
  const initial = createInitialPlayerState('p1', 'Tester');
  assert.equal(initial.speedKmh, BASE_SPEED_KMH);
  assert.equal(initial.streak, 0);

  const afterFirstCorrect = applyAnswerToPlayer(initial, true);
  assert.equal(afterFirstCorrect.speedKmh, BASE_SPEED_KMH + CORRECT_SPEED_BOOST_KMH);
  assert.equal(afterFirstCorrect.lastDeltaKmh, 20);
  assert.equal(afterFirstCorrect.streak, 1);
  assert.equal(afterFirstCorrect.correctCount, 1);
});

test('Win-streak (2+ consecutive correct answers) triggers enhanced +30 km/h speed boost per question', () => {
  const p0 = createInitialPlayerState('p1', 'Tester');
  const p1 = applyAnswerToPlayer(p0, true); // 100 + 20 = 120 km/h, streak = 1
  const p2 = applyAnswerToPlayer(p1, true); // 120 + 30 = 150 km/h, streak = 2
  const p3 = applyAnswerToPlayer(p2, true); // 150 + 30 = 180 km/h, streak = 3

  assert.equal(p1.speedKmh, 120);
  assert.equal(p2.speedKmh, 150);
  assert.equal(p2.lastDeltaKmh, STREAK_SPEED_BOOST_KMH);
  assert.equal(p2.streak, 2);
  assert.equal(p3.speedKmh, 180);
  assert.equal(p3.streak, 3);
  assert.equal(p3.bestStreak, 3);
});

test('Incorrect answer decreases speed by 15 km/h and resets streak to 0', () => {
  const p0 = createInitialPlayerState('p1', 'Tester');
  const p1 = applyAnswerToPlayer(p0, true); // 120 km/h, streak 1
  const p2 = applyAnswerToPlayer(p1, true); // 150 km/h, streak 2
  const pWrong = applyAnswerToPlayer(p2, false); // 150 - 15 = 135 km/h, streak 0

  assert.equal(pWrong.speedKmh, 150 - WRONG_SPEED_PENALTY_KMH);
  assert.equal(pWrong.lastDeltaKmh, -15);
  assert.equal(pWrong.streak, 0);
  assert.equal(pWrong.bestStreak, 2);
  assert.equal(pWrong.wrongCount, 1);
  assert.ok(pWrong.stumbleTimer > 0);
});

test('Match lengths match Sprint (5Q), Circuit (10Q), and Endurance (20Q) specifications', () => {
  assert.equal(MATCH_LENGTHS.sprint.questionCount, 5);
  assert.equal(MATCH_LENGTHS.sprint.timeLimitSeconds, 120);

  assert.equal(MATCH_LENGTHS.circuit.questionCount, 10);
  assert.equal(MATCH_LENGTHS.circuit.timeLimitSeconds, 270);

  assert.equal(MATCH_LENGTHS.endurance.questionCount, 20);
  assert.equal(MATCH_LENGTHS.endurance.timeLimitSeconds, 600);
});

test('Room Access Code generator and validator support both 6-letter codes and alphanumeric RACE-77X codes', () => {
  const code = generateRoomCode(12345);
  assert.equal(code.length, 6);
  assert.equal(isValidRoomCode(code), true);
  assert.equal(isValidRoomCode('ABC123'), false);
  assert.equal(isValidRoomCode('SHORT'), false);
  assert.equal(isValidRoomCode('EDUGAM'), true);

  assert.equal(isValidRoomCode('RACE-77X'), true);
  assert.equal(isValidRoomCode('race-77x'), true);
  assert.equal(isValidRoomCode('SPRT-42K'), true);
  const sportCode = generateRoomCode(2026, 'racing');
  assert.match(sportCode, /^RACE-\d{2}[A-Z0-9]$/);
  assert.equal(isValidRoomCode(sportCode), true);
});

test('All 5 academic subjects return valid question sets for Sprint, Circuit, and Endurance', () => {
  const subjects = ['stem', 'literature', 'social', 'business', 'general'] as const;
  for (const subject of subjects) {
    const sprintQuestions = getQuestionsForMatch(subject, 5, 99);
    assert.equal(sprintQuestions.length, 5);
    assert.equal(sprintQuestions[0].subject, subject);

    const enduranceQuestions = getQuestionsForMatch(subject, 20, 99);
    assert.equal(enduranceQuestions.length, 20);
  }
});

test('Completing all 5 questions in a Sprint match transitions status to gameover', () => {
  let match = createMatchState({
    sport: 'racing',
    subject: 'stem',
    matchLength: 'sprint',
    mode: 'quickplay',
    roomCode: 'TESTRM',
  });

  assert.equal(match.questions.length, 5);
  for (let i = 0; i < 5; i++) {
    const q = match.questions[match.currentQuestionIndex];
    match = submitMatchAnswer(match, q.correctIndex);
  }
  assert.equal(match.status, 'gameover');
  assert.equal(match.winner, 'player');
  assert.equal(match.player.correctCount, 5);
});

test('[SCR-01] Subscription pricing tiers calculate monthly and annual rates accurately', () => {
  assert.equal(PRICING_TIERS.length, 3);
  const classroom = PRICING_TIERS.find((t) => t.id === 'classroom')!;
  assert.equal(getEffectiveMonthlyPrice(classroom, 'monthly'), 29);
  assert.equal(getEffectiveMonthlyPrice(classroom, 'annual'), 23);
});

test('[SCR-01] Authentication form validation enforces email, name, and password rules', () => {
  const invalidEmail = validateAuthForm({
    mode: 'signin',
    email: 'invalid-email',
    password: 'secretpassword',
    role: 'student',
    selectedTier: 'contender',
  });
  assert.equal(invalidEmail.valid, false);

  const validSignup = validateAuthForm({
    mode: 'signup',
    email: 'alex@stanford.edu',
    password: 'strongpassword',
    fullName: 'Dr. Alex Rivera',
    role: 'educator',
    selectedTier: 'classroom',
  });
  assert.equal(validSignup.valid, true);
  assert.equal(validSignup.error, null);
});

test('Custom Multi-Competitor Rooms support larger grids (4 Free, 8 Pro) and enforce Guest vs Logged-In Pro limits', () => {
  const guestFreeAccess = evaluateLobbyAccess(null, {
    mode: 'custom',
    matchLength: 'sprint',
    competitorCount: 4,
    rivalDifficulty: 'standard',
    velocityPreset: 'standard',
  });
  assert.equal(guestFreeAccess.allowed, true);

  const guest8CarAttempt = evaluateLobbyAccess(null, {
    mode: 'custom',
    matchLength: 'circuit',
    competitorCount: 8,
    rivalDifficulty: 'standard',
    velocityPreset: 'standard',
  });
  assert.equal(guest8CarAttempt.allowed, false);

  const custom8Match = createMatchState({
    sport: 'racing',
    subject: 'stem',
    matchLength: 'circuit',
    mode: 'custom',
    roomCode: 'RACE-77X',
    competitorCount: 8,
    rivalDifficulty: 'olympiad',
    velocityPreset: 'turbo',
  });
  assert.equal(custom8Match.roomCode, 'RACE-77X');
  assert.equal(custom8Match.competitorCount, 8);
  assert.equal(custom8Match.competitors.length, 7);

  custom8Match.competitors[0].distanceMeters = 180;
  custom8Match.competitors[1].distanceMeters = 140;
  custom8Match.player.distanceMeters = 155;
  assert.equal(getPlayerRankInMatch(custom8Match.player, custom8Match.competitors), 2);
});

test('Subject difficulty levels (Easy Maths to Hard Olympiad) and Custom Question Counts work accurately', () => {
  const easyMathQuestions = getQuestionsForMatch('stem', 4, 101, 'easy');
  assert.equal(easyMathQuestions.length, 4);
  for (const q of easyMathQuestions) {
    assert.equal(q.subject, 'stem');
    assert.equal(q.difficultyTier, 'easy');
    assert.equal(q.difficulty, 'Foundation');
  }

  const hardQuestions = getQuestionsForMatch('stem', 3, 101, 'hard');
  assert.equal(hardQuestions.length, 3);
  for (const q of hardQuestions) {
    assert.equal(q.difficultyTier, 'hard');
    assert.equal(q.difficulty, 'Olympiad');
  }

  // Custom question count (e.g., 8 questions) scales match state and track distance
  const customCountMatch = createMatchState({
    sport: 'racing',
    subject: 'stem',
    questionDifficulty: 'easy',
    questionCount: 8,
    matchLength: 'circuit',
    mode: 'custom',
    roomCode: 'RACE-77X',
  });
  assert.equal(customCountMatch.questionCount, 8);
  assert.equal(customCountMatch.questions.length, 8);
  assert.equal(customCountMatch.trackDistanceMeters, 8 * 120);
});

test('Local In-Memory Replay Arena records RAM events step-by-step, reconstructs 3D state, and flushes memory permanently on exit', () => {
  let match = createMatchState({
    sport: 'racing',
    subject: 'stem',
    questionDifficulty: 'easy',
    questionCount: 3,
    matchLength: 'sprint',
    mode: 'custom',
    roomCode: 'RACE-77X',
  });

  // Initial event 0 is 'match_start'
  assert.equal(match.replayEvents.length, 1);
  assert.equal(match.replayEvents[0].type, 'match_start');

  // Step 1: Lane adjustment (-1 -> 0)
  match = recordLaneAdjustmentEvent(match, 0);
  assert.equal(match.replayEvents.length, 2);
  assert.equal(match.replayEvents[1].type, 'lane_adjustment');
  assert.equal(match.replayEvents[1].laneIndex, 0);

  // Step 2: First correct answer -> 'nitro_boost' (+20 km/h)
  const q1 = match.questions[match.currentQuestionIndex];
  match = submitMatchAnswer(match, q1.correctIndex);
  assert.equal(match.replayEvents.length, 3);
  assert.equal(match.replayEvents[2].type, 'nitro_boost');
  assert.equal(match.replayEvents[2].deltaKmh, 20);
  assert.equal(match.replayEvents[2].speedKmh, 120);

  // Step 3: Second consecutive correct answer -> 'streak_nitro' (+30 km/h)
  const q2 = match.questions[match.currentQuestionIndex];
  match = submitMatchAnswer(match, q2.correctIndex);
  assert.equal(match.replayEvents.length, 4);
  assert.equal(match.replayEvents[3].type, 'streak_nitro');
  assert.equal(match.replayEvents[3].deltaKmh, 30);
  assert.equal(match.replayEvents[3].speedKmh, 150);

  // Step 4: Third question answered wrongly -> 'mistake_penalty' (-15 km/h) + 'match_finish'
  const q3 = match.questions[match.currentQuestionIndex];
  const wrongIdx = (q3.correctIndex + 1) % 4;
  match = submitMatchAnswer(match, wrongIdx);
  assert.equal(match.status, 'gameover');
  assert.equal(match.replayEvents[4].type, 'mistake_penalty');
  assert.equal(match.replayEvents[4].deltaKmh, -15);
  assert.equal(match.replayEvents[4].speedKmh, 135);
  assert.equal(match.replayEvents[5].type, 'match_finish');

  // Reconstruct step 3 (streak_nitro) for 3D canvas playback
  const step3Snapshot = reconstructMatchAtReplayStep(match, 3);
  assert.equal(step3Snapshot.player.speedKmh, 150);
  assert.equal(step3Snapshot.player.streak, 2);
  assert.ok(step3Snapshot.player.boostTimer > 0);

  // Reconstruct step 4 (mistake_penalty) for 3D canvas playback
  const step4Snapshot = reconstructMatchAtReplayStep(match, 4);
  assert.equal(step4Snapshot.player.speedKmh, 135);
  assert.ok(step4Snapshot.player.stumbleTimer > 0);

  // Exiting Replay Arena permanently flushes the RAM-cached replayEvents array
  const flushed = flushReplayMemory(match);
  assert.equal(flushed.replayEvents.length, 0);
  assert.equal(flushed.replayMemoryFlushed, true);
});

test('Live WebSocket multiplayer binds real human players to competitor slots (isAi: false) and syncs telemetry without CPU override', () => {
  let match = createMatchState({
    sport: 'racing',
    subject: 'stem',
    questionDifficulty: 'easy',
    questionCount: 5,
    matchLength: 'sprint',
    mode: 'custom',
    roomCode: 'RACE-77X',
    competitorCount: 4,
    remotePeers: [
      {
        id: 'human-peer-1',
        name: 'Jordan Lee',
        isHost: false,
        speedKmh: 100,
        distanceMeters: 0,
        streak: 0,
        correctCount: 0,
        answeredCount: 0,
        laneIndex: 1,
        finished: false,
      },
    ],
  });

  // Slot 0 of competitors is the live human player (isAi: false), Slots 1 and 2 are CPU fill (isAi: true)
  assert.equal(match.competitors[0].id, 'human-peer-1');
  assert.equal(match.competitors[0].isAi, false);
  assert.equal(match.competitors[1].isAi, true);
  assert.equal(match.competitors[2].isAi, true);

  // Sync live telemetry from the remote human player
  match = syncRemotePeersIntoMatch(match, [
    {
      id: 'human-peer-1',
      name: 'Jordan Lee',
      isHost: false,
      speedKmh: 150,
      distanceMeters: 210,
      streak: 2,
      correctCount: 2,
      answeredCount: 2,
      laneIndex: 0,
      finished: false,
    },
  ]);

  assert.equal(match.competitors[0].speedKmh, 150);
  assert.equal(match.competitors[0].distanceMeters, 210);
  assert.equal(match.competitors[0].laneIndex, 0);
  assert.equal(match.playerRank, 2); // Jordan Lee is ahead at 210m vs player at 0m

  // Stepping simulation does not overwrite the human player's distance with CPU AI logic
  const stepped = stepMatchSimulation(match, 0.05, false);
  assert.equal(stepped.competitors[0].distanceMeters, 210);
});

test('[SCR-09] Custom Question Generator Dashboard enforces Pro route guard, validates 4 options & target correct index, and injects custom banks into 3D matches', () => {
  // 1. Route guard blocks unauthenticated Guest users
  const guestGuard = evaluateQuestionGeneratorAccess(null);
  assert.equal(guestGuard.allowed, false);
  assert.ok(guestGuard.reason?.includes('Pro'));

  // 2. Route guard allows authenticated Pro users
  const proGuard = evaluateQuestionGeneratorAccess({
    email: 'elena.vance@academy.edu',
    fullName: 'Dr. Elena Vance',
    role: 'educator',
    tier: 'classroom',
    billingCycle: 'annual',
  });
  assert.equal(proGuard.allowed, true);

  // 3. Rejects invalid draft with empty or duplicate options
  const invalidDraft = validateCustomQuestionDraft({
    subject: 'stem',
    topic: 'Orbital Mechanics',
    difficultyTier: 'hard',
    prompt: 'What is escape velocity from Earth?',
    options: ['11.2 km/s', '11.2 km/s', '7.9 km/s', '15.0 km/s'],
    correctIndex: 0,
    explanation: 'Escape velocity v_e = sqrt(2GM/R) is approximately 11.2 km/s.',
  });
  assert.equal(invalidDraft.valid, false);

  // 4. Accepts valid 4-option configuration with target correctIndex and explanation
  const validDraft = {
    subject: 'stem' as const,
    topic: 'Orbital Mechanics',
    difficultyTier: 'hard' as const,
    prompt: 'What is the approximate surface escape velocity of planet Earth?',
    options: ['7.9 km/s', '9.8 km/s', '11.2 km/s', '16.7 km/s'] as [
      string,
      string,
      string,
      string,
    ],
    correctIndex: 2 as const,
    explanation: 'Earth escape velocity v_e = sqrt(2GM/R) equals 11.2 km/s.',
  };
  const validCheck = validateCustomQuestionDraft(validDraft);
  assert.equal(validCheck.valid, true);

  const builtQuestion = buildQuestionItemFromDraft(validDraft, 'custom-orbital-1');
  assert.equal(builtQuestion.correctIndex, 2);
  assert.equal(builtQuestion.options[2], '11.2 km/s');
  assert.equal(builtQuestion.difficulty, 'Olympiad');

  // 5. Validates bank metadata & Private/Public sharing visibility
  const bankCheck = validateCustomQuestionBank({
    title: 'Astrophysics Pro Pack',
    visibility: 'public',
    questions: [builtQuestion],
  });
  assert.equal(bankCheck.valid, true);

  // 6. Injecting customQuestions into createMatchState populates the race deck with those exact questions
  const matchWithCustomBank = createMatchState({
    sport: 'racing',
    subject: 'stem',
    questionDifficulty: 'hard',
    questionCount: 3,
    matchLength: 'sprint',
    mode: 'custom',
    roomCode: 'RACE-77X',
    customQuestions: [builtQuestion],
  });
  assert.equal(matchWithCustomBank.questions.length, 3);
  assert.equal(
    matchWithCustomBank.questions[0].prompt,
    'What is the approximate surface escape velocity of planet Earth?'
  );
  assert.equal(matchWithCustomBank.questions[0].correctIndex, 2);
});

test('[SCR-10] AI Source Extraction Console enforces Pro route guard, validates PDF/DOCX & URL inputs, cleans text via worker, and extracts valid 4-option JSON questions', () => {
  // 1. Route guard blocks unauthenticated Guest users and allows Pro accounts
  const guestAccess = evaluateSourceExtractionAccess(null);
  assert.equal(guestAccess.allowed, false);
  assert.ok(guestAccess.reason?.includes('Pro'));

  const proAccess = evaluateSourceExtractionAccess({
    id: 'pro-1',
    email: 'elena.vance@academy.edu',
    fullName: 'Dr. Elena Vance',
    role: 'educator',
    tier: 'classroom',
  });
  assert.equal(proAccess.allowed, true);

  // 2. Rejects unsupported file extensions (.exe / .png) and invalid URLs
  const invalidExt = validateExtractionInput({
    sourceFormat: 'pdf',
    fileName: 'malicious_archive.exe',
    rawContent: PRESET_EXTRACTION_SOURCES[0].rawContent,
    targetSubject: 'stem',
    targetDifficulty: 'medium',
    questionCount: 4,
    parserEngine: 'gemini-3.8-flash',
  });
  assert.equal(invalidExt.valid, false);

  const invalidUrl = validateExtractionInput({
    sourceFormat: 'url',
    websiteUrl: 'not-a-valid-url',
    rawContent: PRESET_EXTRACTION_SOURCES[2].rawContent,
    targetSubject: 'social',
    targetDifficulty: 'medium',
    questionCount: 4,
    parserEngine: 'gemini-3.8-flash',
  });
  assert.equal(invalidUrl.valid, false);

  // 3. Accepts valid PDF, DOCX, and HTTPS Website Reference inputs
  const validPdfInput = validateExtractionInput({
    sourceFormat: 'pdf',
    fileName: 'MIT_18_01_Kinematics_Calculus_Notes.pdf',
    rawContent: PRESET_EXTRACTION_SOURCES[0].rawContent,
    targetSubject: 'stem',
    targetDifficulty: 'medium',
    questionCount: 4,
    parserEngine: 'gemini-3.8-flash',
  });
  assert.equal(validPdfInput.valid, true);

  const validDocxInput = validateExtractionInput({
    sourceFormat: 'docx',
    fileName: 'Wharton_Monetary_Policy_Valuation_2026.docx',
    rawContent: PRESET_EXTRACTION_SOURCES[1].rawContent,
    targetSubject: 'business',
    targetDifficulty: 'hard',
    questionCount: 3,
    parserEngine: 'claude-json-schema',
  });
  assert.equal(validDocxInput.valid, true);

  // 4. Background worker strips PDF/DOCX/HTML artifacts and segments clauses
  const workerMetrics = cleanSourceTextWithBackgroundWorker(PRESET_EXTRACTION_SOURCES[0].rawContent);
  assert.ok(workerMetrics.strippedArtifactsCount > 0);
  assert.ok(!workerMetrics.cleanedText.includes('%PDF-1.7'));
  assert.ok(workerMetrics.extractedClauseCount >= 3);

  // 5. Validation check matrix initializes 5 checks
  const checks = createInitialValidationChecks('pdf', 'gemini-3.8-flash');
  assert.equal(checks.length, 5);

  // 6. Extracts 4-option multiple-choice questions that pass strict schema validation
  const extracted = extractStructuredQuestionsFromCleanedText({
    cleanedText: workerMetrics.cleanedText,
    clauses: workerMetrics.clauses,
    targetSubject: 'stem',
    targetDifficulty: 'medium',
    questionCount: 4,
  });
  assert.equal(extracted.length, 4);
  for (const q of extracted) {
    const check = validateCustomQuestionDraft({
      subject: q.subject,
      topic: q.topic,
      difficultyTier: q.difficultyTier,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    });
    assert.equal(check.valid, true);
  }
});

test('Security sanitization strips HTML/script tags and clamps untrusted WebSocket telemetry', () => {
  const dirty = '  <script>alert("xss")</script><b>Dr. Elena\u0000   Vance</b>  ';
  assert.equal(sanitizePlainText(dirty, 40), 'alert("xss")Dr. Elena Vance');
  assert.equal(sanitizePlainText(12345, 40), '');

  const clamped = clampPlayerTelemetry(
    {
      speedKmh: 99999,
      distanceMeters: -500,
      streak: Number.NaN,
      correctCount: 8,
      answeredCount: 2,
      laneIndex: 99 as unknown as -1 | 0 | 1,
      finished: true,
    },
    1200
  );
  assert.equal(clamped.speedKmh, 380);
  assert.equal(clamped.distanceMeters, 0);
  assert.equal(clamped.streak, 0);
  assert.equal(clamped.correctCount, 8);
  assert.equal(clamped.answeredCount, 8);
  assert.equal(clamped.laneIndex, 1);
  assert.equal(clamped.finished, true);
});

test('Pro users can configure up to 100 questions and generate 100-question matches', () => {
  assert.equal(PRO_MAX_QUESTION_COUNT, 100);

  const proSession = {
    id: 'pro-user-1',
    fullName: 'Dr. Elena Vance',
    email: 'pro@oxyain.com',
    role: 'educator' as const,
    tier: 'classroom' as const,
  };

  const guestAccess = evaluateLobbyAccess(null, {
    mode: 'custom',
    matchLength: 'endurance',
    questionCount: 100,
    competitorCount: 4,
    rivalDifficulty: 'standard',
    velocityPreset: 'standard',
  });
  assert.equal(guestAccess.allowed, false);

  const proAccess = evaluateLobbyAccess(proSession, {
    mode: 'custom',
    matchLength: 'endurance',
    questionCount: 100,
    competitorCount: 8,
    rivalDifficulty: 'olympiad',
    velocityPreset: 'turbo',
  });
  assert.equal(proAccess.allowed, true);
  assert.equal(proAccess.isProActive, true);

  const questions100 = getQuestionsForMatch('stem', 100, 777, 'all');
  assert.equal(questions100.length, 100);

  const match100 = createMatchState({
    sport: 'racing',
    subject: 'stem',
    questionDifficulty: 'hard',
    questionCount: 100,
    matchLength: 'endurance',
    mode: 'custom',
    competitorCount: 8,
  });
  assert.equal(match100.questionCount, 100);
  assert.equal(match100.questions.length, 100);
  assert.equal(match100.trackDistanceMeters, 12000);
});

test('1v1 Matchmaking Queue state machine tracks elapsed search time and pairs opponents cleanly', () => {
  const q0 = createInitialQueueState();
  assert.equal(q0.status, 'searching');
  assert.equal(q0.elapsedSeconds, 0);
  assert.equal(q0.redisChannel, 'mm:1v1:queue');

  const q1 = stepQueueTimer(q0, 1.5);
  assert.equal(q1.elapsedSeconds, 1.5);

  const paired = pairQueueOpponent(q1, {
    roomCode: 'QM-842K',
    opponentName: 'Marcus Sterling',
    opponentTitle: 'Olympiad Challenger',
    opponentRating: 1960,
    isHumanOpponent: true,
  });
  assert.equal(paired.status, 'paired');
  assert.equal(paired.pairedRoomCode, 'QM-842K');
  assert.equal(paired.opponentName, 'Marcus Sterling');
  assert.equal(paired.isHumanOpponent, true);

  // Timer does not increment after pairing
  const afterPaired = stepQueueTimer(paired, 2.0);
  assert.equal(afterPaired.elapsedSeconds, 1.5);
});

test('Multiplayer Waiting Room ensures players join first before the game starts', () => {
  // 1. Only host in room -> cannot start yet (waiting for players to join)
  const soloSlots = buildWaitingRoomSlots({
    localPlayerId: 'local-1',
    localPlayerName: 'Dr. Elena Vance',
    localIsReady: true,
    localIsHost: true,
    competitorCount: 4,
    remotePeers: [],
  });

  const soloCheck = canLaunchWaitingRoom(soloSlots);
  assert.equal(soloCheck.allowed, false);
  assert.equal(soloCheck.humanCount, 1);
  assert.equal(soloCheck.minRequiredPlayers, 2);
  assert.ok(soloCheck.waitingReason?.includes('Waiting for players to join'));

  // 2. Second player joins room -> match can now start
  const slots = buildWaitingRoomSlots({
    localPlayerId: 'local-1',
    localPlayerName: 'Dr. Elena Vance',
    localIsReady: true,
    localIsHost: true,
    competitorCount: 4,
    remotePeers: [
      {
        id: 'peer-2',
        name: 'Liam O-Connor',
        isHost: false,
        ready: true,
        speedKmh: 100,
        distanceMeters: 0,
        streak: 0,
        correctCount: 0,
        answeredCount: 0,
        laneIndex: 1,
        finished: false,
      },
    ],
  });

  assert.equal(slots.length, 4);
  assert.equal(slots[0].isLocalPlayer, true);
  assert.equal(slots[0].isHuman, true);
  assert.equal(slots[1].isHuman, true);
  assert.equal(slots[1].name, 'Liam O-Connor');
  assert.equal(slots[2].isHuman, false);
  assert.equal(slots[3].isHuman, false);

  const check = canLaunchWaitingRoom(slots);
  assert.equal(check.allowed, true);
  assert.equal(check.humanCount, 2);
  assert.equal(check.readyHumanCount, 2);
  assert.equal(check.waitingReason, null);
});

test('Game host can terminate an ongoing game via terminateMatchByHost, while non-host cannot', () => {
  const activeMatch = createMatchState({
    sport: 'racing',
    subject: 'stem',
    questionDifficulty: 'easy',
    questionCount: 5,
    matchLength: 'sprint',
    mode: 'custom',
    competitorCount: 4,
  });
  assert.equal(activeMatch.status, 'playing');

  // Non-host attempt does not terminate match
  const nonHostAttempt = terminateMatchByHost(activeMatch, false);
  assert.equal(nonHostAttempt.status, 'playing');

  // Host terminates ongoing match -> transitions to 'title' and flushes replay buffer
  const terminated = terminateMatchByHost(activeMatch, true);
  assert.equal(terminated.status, 'title');
  assert.equal(terminated.winner, null);
  assert.equal(terminated.replayEvents.length, 0);
  assert.equal(terminated.replayMemoryFlushed, true);
});

test('AI document extraction builds questions directly from actual user source material', () => {
  const customSourceText = `
    Photosynthesis converts solar radiation into chemical energy inside chloroplasts.
    Chlorophyll pigments absorb blue and red wavelengths to drive ATP synthesis.
    The Calvin cycle fixes atmospheric carbon dioxide into glucose molecules inside the stroma.
    Cellular respiration oxidizes glucose in mitochondria to yield 36 ATP molecules per cycle.
  `;
  const cleaned = cleanSourceTextWithBackgroundWorker(customSourceText);
  const extracted = extractStructuredQuestionsFromCleanedText({
    cleanedText: cleaned.cleanedText,
    clauses: cleaned.clauses,
    targetSubject: 'stem',
    targetDifficulty: 'medium',
    questionCount: 4,
    sourceLabel: 'Biology_Lecture_Notes.pdf',
  });

  assert.equal(extracted.length, 4);
  for (const q of extracted) {
    const check = validateCustomQuestionDraft({
      subject: q.subject,
      topic: q.topic,
      difficultyTier: q.difficultyTier,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    });
    assert.equal(check.valid, true);
    // Verify the correct answer or explanation comes directly from the custom biology source text
    const combinedText = `${q.prompt} ${q.options[q.correctIndex]} ${q.explanation}`.toLowerCase();
    const matchesActualSource =
      combinedText.includes('photosynthesis') ||
      combinedText.includes('chlorophyll') ||
      combinedText.includes('calvin') ||
      combinedText.includes('respiration') ||
      combinedText.includes('glucose') ||
      combinedText.includes('atp');
    assert.equal(matchesActualSource, true);
  }
});

test('AI Source Extractor rejects binary PDF/DOCX gibberish tokens and auto-infers subject from real source text without a subject selector', () => {
  // 1. Exact binary gibberish tokens reported by user are rejected
  assert.equal(isNaturalLanguageWord('moyD'), false);
  assert.equal(isNaturalLanguageWord('IvG'), false);
  assert.equal(isNaturalLanguageWord("PN'k"), false);
  assert.equal(isNaturalLanguageWord('UfP"&n'), false);
  assert.equal(isNaturalLanguageWord('ji]K'), false);
  assert.equal(isNaturalLanguageWord('2hk'), false);
  assert.equal(isNaturalLanguageWord('chloroplast'), true);
  assert.equal(isNaturalLanguageWord('thermodynamics'), true);

  const gibberishClause = "t. IvG 5$, 2hk 'X9 PN'k I: J16P moyD UfP\"&n ji]K";
  assert.equal(isNaturalLanguageClause(gibberishClause), false);

  // 2. Pure binary gibberish fails validation
  const gibberishValidation = validateExtractionInput({
    sourceFormat: 'pdf',
    fileName: 'corrupted_binary.pdf',
    rawContent: `${gibberishClause}. ${gibberishClause}. ${gibberishClause}.`,
    targetDifficulty: 'medium',
    questionCount: 4,
    parserEngine: 'gemini-3.8-flash',
  });
  assert.equal(gibberishValidation.valid, false);

  // 3. Real source text mixed with binary stream noise strips all gibberish and extracts clean questions without targetSubject
  const noisyDocument = `
    %PDF-1.7
    t. IvG 5$, 2hk 'X9 PN'k I: J16P moyD UfP"&n ji]K
    Monetary policy governs how a central bank manages liquidity and interest rates to maintain price stability.
    Open market operations involve buying and selling government treasury securities to regulate the money supply.
    When inflation rises above target, the central bank increases the discount rate to cool borrowing and spending.
    Fiscal policy differs from monetary policy because taxation and government expenditure are enacted by the legislature.
    endstream endobj
  `;

  const cleaned = cleanSourceTextWithBackgroundWorker(noisyDocument);
  assert.ok(!cleaned.cleanedText.includes('moyD'));
  assert.ok(!cleaned.cleanedText.includes("PN'k"));
  assert.ok(!cleaned.cleanedText.includes('J16P'));
  assert.equal(inferSubjectFromSourceText(cleaned.cleanedText), 'business');

  const extracted = extractStructuredQuestionsFromCleanedText({
    cleanedText: cleaned.cleanedText,
    clauses: cleaned.clauses,
    targetDifficulty: 'medium',
    questionCount: 4,
    sourceLabel: 'Central_Bank_Policy.pdf',
  });

  assert.equal(extracted.length, 4);
  for (const q of extracted) {
    assert.equal(q.subject, 'business');
    assert.ok(!q.prompt.includes('moyD'));
    assert.ok(!q.prompt.includes('IvG'));
    for (const opt of q.options) {
      assert.ok(!opt.includes('moyD'));
      assert.ok(!opt.includes("PN'k"));
      assert.ok(!opt.includes('ji]K'));
    }
  }
});

test('SPA Route Resolver ensures root (/) is always the Landing Page and all screens route cleanly via pathname or query params', () => {
  // 1. Root path always resolves to Landing Page
  const rootState = resolveRouteFromLocation('/', '');
  assert.equal(rootState.route, 'landing');
  assert.equal(rootState.autostart, false);
  assert.equal(rootState.roomCode, undefined);

  // 2. Clean pathnames resolve to their respective screens
  assert.equal(resolveRouteFromLocation('/lobby', '').route, 'lobby');
  assert.equal(resolveRouteFromLocation('/waiting-room', '?room=race-88x').route, 'waiting-room');
  assert.equal(resolveRouteFromLocation('/waiting-room', '?room=race-88x').roomCode, 'RACE-88X');
  assert.equal(resolveRouteFromLocation('/matchmaking', '').route, 'matchmaking');
  assert.equal(resolveRouteFromLocation('/play', '').route, 'play');
  assert.equal(resolveRouteFromLocation('/replay', '').route, 'replay');
  assert.equal(resolveRouteFromLocation('/generator', '').route, 'generator');
  assert.equal(resolveRouteFromLocation('/extractor', '').route, 'extractor');
  assert.equal(resolveRouteFromLocation('/curriculum', '').route, 'curriculum');

  // 3. Query parameter ?screen=... and ?autostart=1 work seamlessly
  const queryExtractor = resolveRouteFromLocation('/', '?screen=extractor');
  assert.equal(queryExtractor.route, 'extractor');
  const autoStartState = resolveRouteFromLocation('/', '?autostart=1');
  assert.equal(autoStartState.route, 'play');
  assert.equal(autoStartState.autostart, true);

  // 4. Unknown paths fall back safely to Landing Page
  assert.equal(resolveRouteFromLocation('/non-existent-page-xyz', '').route, 'landing');

  // 5. buildUrlForRoute produces clean canonical paths
  assert.equal(buildUrlForRoute('landing'), '/');
  assert.equal(buildUrlForRoute('lobby'), '/lobby');
  assert.equal(buildUrlForRoute('waiting-room', { roomCode: 'RACE-77X' }), '/waiting-room?room=RACE-77X');
  assert.equal(buildUrlForRoute('extractor'), '/extractor');
  assert.equal(buildUrlForRoute('generator'), '/generator');
});

test('High-concurrency sharding and token-bucket rate limiter scale deterministically for 1M+ concurrent users', () => {
  assert.equal(SHARD_COUNT, 64);

  // Deterministic consistent shard index in [0, 63]
  const shardA1 = computeConsistentShardIndex('RACE-77X');
  const shardA2 = computeConsistentShardIndex('race-77x');
  assert.equal(shardA1, shardA2);
  assert.ok(shardA1 >= 0 && shardA1 < SHARD_COUNT);

  // Distribution across shards for 256 sample room codes
  const seenShards = new Set<number>();
  for (let i = 0; i < 256; i++) {
    seenShards.add(computeConsistentShardIndex(`ROOM-${i}X`));
  }
  assert.ok(seenShards.size > 32);

  // Matchmaking O(1) bucket key partitioning
  assert.equal(
    computeMatchmakingBucketKey('racing', 'stem', 'hard'),
    'mm:1v1:racing:stem:hard'
  );

  // Token-bucket rate limiter allows burst up to capacity, rejects excess, and refills smoothly over time
  let bucket = { tokens: 5, lastRefillMs: 1000 };
  for (let i = 0; i < 5; i++) {
    const res = consumeTokenBucket(bucket, 1000, 5, 10, 1);
    assert.equal(res.allowed, true);
    bucket = res.nextBucket;
  }
  const blocked = consumeTokenBucket(bucket, 1000, 5, 10, 1);
  assert.equal(blocked.allowed, false);

  // 500ms later at 10 tokens/sec -> +5 tokens refilled
  const refilled = consumeTokenBucket(blocked.nextBucket, 1500, 5, 10, 1);
  assert.equal(refilled.allowed, true);
  assert.equal(refilled.nextBucket.tokens, 4);
});

