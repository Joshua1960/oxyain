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
  MatchState,
  MultiplayerMode,
  QUESTION_COUNT_PRESETS,
  RivalDifficulty,
  SPORT_CONFIGS,
  SportDiscipline,
  VelocityPreset,
  inferMatchLengthFromCount,
  isValidRoomCode,
  normalizeGuestDisplayName,
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
  roomError?: string | null;
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
  guestDisplayName: string;
  onChangeGuestDisplayName: (nextName: string) => void;
  lastCompletedMatch?: MatchState | null;
  onDismissLastMatch?: () => void;
  onWatchLastMatchReplay?: () => void;
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
  roomError,
  proGateNotice,
  setProGateNotice,
  onStartMatch,
  onGenerateNewCode,
  onOpenPublicPortal,
  onOpenLoginForPro,
  session,
  liveRoomPeers = [],
  activeRooms = [],
  onOpenSourceExtractor,
  onOpenQuickMatchQueue,
  onOpenWaitingRoom,
  guestDisplayName,
  onChangeGuestDisplayName,
  lastCompletedMatch,
  onDismissLastMatch,
  onWatchLastMatchReplay,
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs shadow-sm">
            OX
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-display">
              Oxyain Arena
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {session ? (
            <div
              data-testid="lobby-auth-status"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium"
            >
              {session.fullName}
            </div>
          ) : (
            <>
              <div
                data-testid="lobby-guest-display-name"
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-cyan-300 text-xs font-mono font-medium"
              >
                {normalizeGuestDisplayName(guestDisplayName, 'Contender')}
              </div>
              <button
                type="button"
                data-testid="lobby-login-pro-btn"
                onClick={onOpenLoginForPro}
                className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-200 text-xs font-medium transition-all cursor-pointer"
              >
                Sign In
              </button>
            </>
          )}
          {onOpenSourceExtractor && (
            <button
              type="button"
              data-testid="open-scr10-extractor-btn"
              onClick={onOpenSourceExtractor}
              className="h-9 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-all cursor-pointer"
            >
              AI Import
            </button>
          )}
          <button
            type="button"
            onClick={onOpenPublicPortal}
            className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.1] text-xs font-medium transition-all cursor-pointer"
          >
            Home
          </button>
        </div>
      </div>

      {/* Sleek Centered Lobby Card */}
      <div className="w-full max-w-2xl mx-auto my-auto py-3 pointer-events-auto">
        <div className="bg-[#0D1527]/95 border border-white/[0.08] rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
          {/* Post-Match Result Summary Banner (shown when returning to Lobby after finishing a game) */}
          {lastCompletedMatch && (
            <div
              data-testid="lobby-last-match-banner"
              className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                    Match Complete
                  </span>
                  <span className="text-xs font-bold font-display text-white truncate">
                    {lastCompletedMatch.winner === 'player'
                      ? `1st Place / ${lastCompletedMatch.competitorCount} — Tournament Victory!`
                      : `Position #${lastCompletedMatch.playerRank || 2} / ${lastCompletedMatch.competitorCount} — Podium Finish`}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-300">
                  {lastCompletedMatch.player.name} · Peak {Math.round(lastCompletedMatch.player.peakSpeedKmh)} km/h ·{' '}
                  {lastCompletedMatch.player.answeredCount > 0
                    ? Math.round(
                        (lastCompletedMatch.player.correctCount /
                          lastCompletedMatch.player.answeredCount) *
                          100
                      )
                    : 0}
                  % Accuracy ({lastCompletedMatch.player.correctCount}/{lastCompletedMatch.player.answeredCount})
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onWatchLastMatchReplay &&
                  Array.isArray(lastCompletedMatch.replayEvents) &&
                  lastCompletedMatch.replayEvents.length > 0 &&
                  !lastCompletedMatch.replayMemoryFlushed && (
                    <button
                      type="button"
                      data-testid="lobby-watch-replay-btn"
                      onClick={onWatchLastMatchReplay}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-display text-xs cursor-pointer"
                    >
                      Watch 3D Replay
                    </button>
                  )}
                {onDismissLastMatch && (
                  <button
                    type="button"
                    data-testid="lobby-dismiss-last-match-btn"
                    onClick={onDismissLastMatch}
                    aria-label="Dismiss match summary"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Anonymous Player Display Name Input Row */}
          {!session && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-950/90 border border-slate-800">
              <label
                htmlFor="guest-display-name-input"
                className="text-xs font-medium text-slate-300"
              >
                Display Name
              </label>
              <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                <input
                  id="guest-display-name-input"
                  data-testid="guest-display-name-input"
                  type="text"
                  maxLength={28}
                  value={guestDisplayName}
                  onChange={(e) => onChangeGuestDisplayName(e.target.value)}
                  placeholder="Enter display name..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* 1. Mode Toggle */}
          <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Game Mode">
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
              className={`h-11 px-4 rounded-xl text-xs font-bold font-display transition-all cursor-pointer ${
                mode === 'quickplay'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.08]'
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
              className={`h-11 px-4 rounded-xl text-xs font-bold font-display transition-all cursor-pointer ${
                mode === 'custom'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.08]'
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

              {roomError && (
                <p role="alert" className="text-xs text-rose-400">
                  {roomError}
                </p>
              )}

              {activeRooms && activeRooms.filter((r) => r.status === 'lobby' && r.roomCode !== roomCodeInput).length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-400">Open Active Rooms:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeRooms
                      .filter((r) => r.status === 'lobby' && r.roomCode !== roomCodeInput)
                      .slice(0, 4)
                      .map((r) => (
                        <button
                          key={r.roomCode}
                          type="button"
                          onClick={() => {
                            setRoomCodeInput(r.roomCode);
                            setSport(r.sport);
                            setSubject(r.subject);
                            setRoomCodeError(null);
                          }}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-300 cursor-pointer"
                        >
                          {r.roomCode} ({r.playerCount}/{r.competitorCount})
                        </button>
                      ))}
                  </div>
                </div>
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
                      {cnt}{locked ? ' 🔒' : ''}
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
          <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-center gap-3">
            {mode === 'custom' ? (
              <button
                type="button"
                data-testid="open-waiting-room-btn"
                onClick={onOpenWaitingRoom}
                className="w-full h-12 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-display text-sm tracking-wide transition-all shadow-md shadow-cyan-500/20 active:scale-[0.98] cursor-pointer"
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
                    className="w-full sm:w-auto flex-1 h-12 px-5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.12] text-cyan-300 font-bold font-display text-xs tracking-wide transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Find 1v1 Opponent
                  </button>
                )}
                <button
                  type="button"
                  data-start="true"
                  data-testid="launch-match-btn"
                  onClick={onStartMatch}
                  className="w-full sm:w-auto flex-1 h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-display text-sm tracking-wide transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98] cursor-pointer"
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

