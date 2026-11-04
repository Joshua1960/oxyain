import React, { useState } from 'react';
import {
  ActiveRoomSummary,
  AuthenticatedSession,
  CompetitorCount,
  FREE_MAX_COMPETITORS,
  FREE_MAX_QUESTION_COUNT,
  PRO_MAX_QUESTION_COUNT,
  LiveRoomPeer,
  MatchLengthId,
  MultiplayerMode,
  QUESTION_COUNT_PRESETS,
  RivalDifficulty,
  SPORT_CONFIGS,
  SportDiscipline,
  VelocityPreset,
  inferMatchLengthFromCount,
  isValidRoomCode,
} from '../game/rules';
import {
  DIFFICULTY_METADATA,
  QuestionDifficultyId,
  SUBJECT_METADATA,
  SubjectId,
} from '../game/questions';

interface TitleScreenModalProps {
  sport: SportDiscipline;
  setSport: (s: SportDiscipline) => void;
  subject: SubjectId;
  setSubject: (s: SubjectId) => void;
  questionDifficulty: QuestionDifficultyId;
  setQuestionDifficulty: (d: QuestionDifficultyId) => void;
  questionCount: number;
  setQuestionCount: (n: number) => void;
  matchLength: MatchLengthId;
  setMatchLength: (m: MatchLengthId) => void;
  mode: MultiplayerMode;
  setMode: (m: MultiplayerMode) => void;
  competitorCount: CompetitorCount;
  setCompetitorCount: (c: CompetitorCount) => void;
  rivalDifficulty: RivalDifficulty;
  setRivalDifficulty: (d: RivalDifficulty) => void;
  velocityPreset: VelocityPreset;
  setVelocityPreset: (v: VelocityPreset) => void;
  roomCodeInput: string;
  setRoomCodeInput: (c: string) => void;
  roomCodeError: string | null;
  setRoomCodeError: (err: string | null) => void;
  proGateNotice: string | null;
  setProGateNotice: (msg: string | null) => void;
  onStartMatch: () => void;
  onGenerateNewCode: () => void;
  onOpenCurriculum: () => void;
  onOpenPublicPortal: () => void;
  onOpenLoginForPro: () => void;
  session: AuthenticatedSession | null;
  wsConnected: boolean;
  activeRoomsCount: number;
  liveRoomPeers?: LiveRoomPeer[];
  activeRooms?: ActiveRoomSummary[];
  onOpenQuestionGenerator?: () => void;
  onOpenSourceExtractor?: () => void;
  onOpenQuickMatchQueue?: () => void;
  onOpenWaitingRoom?: () => void;
  activeCustomBankTitle?: string | null;
  onClearCustomBank?: () => void;
}


export const TitleScreenModal: React.FC<TitleScreenModalProps> = ({
  sport,
  setSport,
  subject,
  setSubject,
  questionDifficulty,
  setQuestionDifficulty,
  questionCount,
  setQuestionCount,
  setMatchLength,
  mode,
  setMode,
  competitorCount,
  setCompetitorCount,
  roomCodeInput,
  setRoomCodeInput,
  roomCodeError,
  setRoomCodeError,
  proGateNotice,
  setProGateNotice,
  onStartMatch,
  onGenerateNewCode,
  onOpenPublicPortal,
  onOpenLoginForPro,
  session,
  liveRoomPeers = [],
  onOpenQuestionGenerator,
  onOpenSourceExtractor,
  onOpenQuickMatchQueue,
  onOpenWaitingRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const sportsList: SportDiscipline[] = ['racing', 'sprinting', 'hurdles'];
  const subjectsList: SubjectId[] = ['all', 'stem', 'literature', 'social', 'business', 'general'];
  const difficultiesList: QuestionDifficultyId[] = ['easy', 'medium', 'hard', 'all'];
  const gridSizes: { count: CompetitorCount; label: string; pro: boolean }[] = [
    { count: 2, label: '2 Players', pro: false },
    { count: 4, label: '4 Players', pro: false },
    { count: 6, label: '6 Players', pro: true },
    { count: 8, label: '8 Players', pro: true },
  ];

  const isLoggedIn = Boolean(session);

  const handleCopyCode = () => {
    if (navigator.clipboard && roomCodeInput) {
      navigator.clipboard.writeText(roomCodeInput).catch(() => {});
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleSelectGridSize = (count: CompetitorCount, requiresPro: boolean) => {
    if (requiresPro && !isLoggedIn) {
      setProGateNotice(
        `${count}-Player Rooms require a Pro account (up to ${FREE_MAX_COMPETITORS} players Free).`
      );
      return;
    }
    setProGateNotice(null);
    setCompetitorCount(count);
  };

  const handleSelectQuestionCount = (nextCount: number) => {
    const clamped = Math.max(3, Math.min(PRO_MAX_QUESTION_COUNT, nextCount));
    if (clamped > FREE_MAX_QUESTION_COUNT && !isLoggedIn) {
      setProGateNotice(
        `${clamped}-Question matches require a Pro account (up to ${FREE_MAX_QUESTION_COUNT} Free, up to ${PRO_MAX_QUESTION_COUNT} Pro).`
      );
      return;
    }
    setProGateNotice(null);
    setQuestionCount(clamped);
    setMatchLength(inferMatchLengthFromCount(clamped));
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-6 pointer-events-none overflow-y-auto">
      {/* Minimal Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-3">
          <svg
            width="38"
            height="38"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M8 10L24 4L40 10V24C40 34.5 24 43 24 43C24 43 8 34.5 8 24V10Z"
              fill="#0B1324"
              stroke="#06B6D4"
              strokeWidth="2.5"
            />
            <path
              d="M15 27L22 15H29L24 23H32L19 35L22 27H15Z"
              fill="#F59E0B"
              stroke="#FFFBEB"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-display">
            Oxyain
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {session ? (
            <div
              data-testid="lobby-auth-status"
              className="px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-mono"
            >
              {session.fullName}
            </div>
          ) : (
            <button
              type="button"
              data-testid="lobby-login-pro-btn"
              onClick={onOpenLoginForPro}
              className="px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Sign In
            </button>
          )}
          {onOpenSourceExtractor && (
            <button
              type="button"
              data-testid="open-scr10-extractor-btn"
              onClick={onOpenSourceExtractor}
              className="px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 text-emerald-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              AI Import
            </button>
          )}
          <button
            type="button"
            onClick={onOpenPublicPortal}
            className="px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            Home
          </button>
        </div>
      </div>

      {/* Simple Centered Lobby Card */}
      <div className="w-full max-w-2xl mx-auto my-auto py-3 pointer-events-auto">
        <div className="bg-[#0B1120]/95 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
          {/* 1. Mode Toggle */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Game Mode">
            <button
              type="button"
              data-testid="mode-quickplay-btn"
              onClick={() => {
                setMode('quickplay');
                setCompetitorCount(2);
                setRoomCodeError(null);
                setProGateNotice(null);
              }}
              aria-pressed={mode === 'quickplay'}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold font-display border transition-colors cursor-pointer ${
                mode === 'quickplay'
                  ? 'bg-emerald-500/20 border-emerald-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              Quick Play (1v1)
            </button>

            <button
              type="button"
              data-testid="mode-custom-lobby-btn"
              onClick={() => {
                setMode('custom');
                if (competitorCount === 2) setCompetitorCount(4);
                setRoomCodeError(null);
              }}
              aria-pressed={mode === 'custom'}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold font-display border transition-colors cursor-pointer ${
                mode === 'custom'
                  ? 'bg-cyan-500/20 border-cyan-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              Multiplayer Room
            </button>
          </div>

          {/* 2. Multiplayer Room Setup (only when Multiplayer Room is active) */}
          {mode === 'custom' && (
            <div
              data-testid="custom-lobby-config-panel"
              className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="room-code-input"
                  className="text-xs font-medium text-slate-300"
                >
                  Room Code
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="room-code-input"
                    data-testid="room-code-input"
                    type="text"
                    maxLength={9}
                    value={roomCodeInput}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                      setRoomCodeInput(val);
                      if (roomCodeError && isValidRoomCode(val)) {
                        setRoomCodeError(null);
                      }
                    }}
                    placeholder="RACE-101"
                    className="w-32 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold tracking-widest text-white uppercase focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    data-testid="copy-room-code-btn"
                    onClick={handleCopyCode}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 cursor-pointer"
                  >
                    {copiedCode ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    data-testid="new-room-code-btn"
                    onClick={onGenerateNewCode}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    New
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {gridSizes.map((g) => {
                  const active = competitorCount === g.count;
                  const locked = g.pro && !isLoggedIn;
                  return (
                    <button
                      key={g.count}
                      type="button"
                      data-testid={`grid-size-${g.count}`}
                      onClick={() => handleSelectGridSize(g.count, g.pro)}
                      aria-pressed={active}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : locked
                          ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {g.label}
                      {locked ? ' 🔒' : ''}
                    </button>
                  );
                })}
              </div>

              {roomCodeError && (
                <p role="alert" className="text-xs text-rose-400">
                  {roomCodeError}
                </p>
              )}
            </div>
          )}

          {proGateNotice && (
            <div
              role="status"
              data-testid="pro-gate-banner"
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-950/85 border border-amber-500/50 text-xs text-amber-200"
            >
              <span>{proGateNotice}</span>
              <button
                type="button"
                data-testid="pro-gate-login-btn"
                onClick={onOpenLoginForPro}
                className="px-3 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}

          {/* 3. Sport & Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1">
                Sport
              </span>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Sport Discipline">
                {sportsList.map((sId) => {
                  const cfg = SPORT_CONFIGS[sId];
                  const active = sport === sId;
                  return (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => setSport(sId)}
                      aria-pressed={active}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors truncate cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {cfg.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1">
                Difficulty
              </span>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Question Difficulty">
                {difficultiesList.map((diffId) => {
                  const meta = DIFFICULTY_METADATA[diffId];
                  const active = questionDifficulty === diffId;
                  return (
                    <button
                      key={diffId}
                      type="button"
                      data-testid={`difficulty-${diffId}`}
                      onClick={() => setQuestionDifficulty(diffId)}
                      aria-pressed={active}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {meta.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Subject */}
          <div>
            <span className="block text-xs font-medium text-slate-300 mb-1">
              Subject
            </span>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Academic Subject">
              {subjectsList.map((subjId) => {
                const meta = SUBJECT_METADATA[subjId];
                const active = subject === subjId;
                return (
                  <button
                    key={subjId}
                    type="button"
                    data-testid={`subject-${subjId}`}
                    onClick={() => setSubject(subjId)}
                    aria-pressed={active}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors truncate cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Number of Questions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-300">
                Questions
              </span>
              <span className="text-xs font-mono text-cyan-300 tabular-nums">
                {questionCount} Questions
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="qcount-decrement-btn"
                onClick={() => handleSelectQuestionCount(questionCount - 1)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-white cursor-pointer"
              >
                -
              </button>
              <div className="grid grid-cols-6 gap-1 flex-1" role="group" aria-label="Question Count Presets">
                {QUESTION_COUNT_PRESETS.map((cnt) => {
                  const active = questionCount === cnt;
                  const locked = cnt > FREE_MAX_QUESTION_COUNT && !isLoggedIn;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`qcount-${cnt}`}
                      onClick={() => handleSelectQuestionCount(cnt)}
                      aria-pressed={active}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : locked
                          ? 'bg-slate-900/60 border-slate-800 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {cnt}Q{locked ? '🔒' : ''}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                data-testid="qcount-increment-btn"
                onClick={() => handleSelectQuestionCount(questionCount + 1)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-white cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* 6. Simple Primary Action Row */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
            {mode === 'custom' ? (
              <button
                type="button"
                data-testid="open-waiting-room-btn"
                onClick={onOpenWaitingRoom}
                className="w-full py-3 px-5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-display text-sm tracking-wide transition-colors cursor-pointer"
              >
                Enter Multiplayer Room ({roomCodeInput} · {liveRoomPeers.length + 1}/{competitorCount} Joined)
              </button>
            ) : (
              <>
                {onOpenQuickMatchQueue && (
                  <button
                    type="button"
                    data-testid="open-matchmaking-queue-btn"
                    onClick={onOpenQuickMatchQueue}
                    className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-400/50 text-cyan-300 font-bold font-display text-xs tracking-wide transition-colors cursor-pointer"
                  >
                    Find 1v1 Opponent
                  </button>
                )}
                <button
                  type="button"
                  data-start="true"
                  data-testid="launch-match-btn"
                  onClick={onStartMatch}
                  className="w-full sm:w-auto flex-1 py-2.5 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-display text-sm tracking-wide transition-colors cursor-pointer"
                >
                  Start 1v1 Match
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Control Hint */}
      <div className="text-center text-xs text-slate-400 font-mono pointer-events-none">
        A / D Lane · 1–4 Answer · P Pause
      </div>
    </div>
  );
};

