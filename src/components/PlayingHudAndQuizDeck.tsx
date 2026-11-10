import React, { useState } from 'react';
import {
  CORRECT_SPEED_BOOST_KMH,
  MATCH_LENGTHS,
  MatchState,
  SPORT_CONFIGS,
  STREAK_SPEED_BOOST_KMH,
  WRONG_SPEED_PENALTY_KMH,
} from '../game/rules';

interface PlayingHudAndQuizDeckProps {
  match: MatchState;
  muted: boolean;
  onToggleMute: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onTogglePause: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRestart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onQuitGame?: () => void;
  isHost?: boolean;
  onShiftLane: (delta: -1 | 1) => void;
  onSelectAnswer: (optionIndex: number) => void;
  hasLiveRemotePeer: boolean;
}

export const PlayingHudAndQuizDeck: React.FC<PlayingHudAndQuizDeckProps> = ({
  match,
  muted,
  onToggleMute,
  onTogglePause,
  onRestart,
  onQuitGame,
  isHost = true,
  onShiftLane,
  onSelectAnswer,
  hasLiveRemotePeer,
}) => {
  const [deckCollapsed, setDeckCollapsed] = useState(false);

  const currentQuestion = match.questions[match.currentQuestionIndex];
  const playerProgressPct = Math.min(
    100,
    Math.round((match.player.distanceMeters / match.trackDistanceMeters) * 100)
  );
  const opponentProgressPct = Math.min(
    100,
    Math.round((match.opponent.distanceMeters / match.trackDistanceMeters) * 100)
  );
  const remainingSeconds = Math.max(0, Math.ceil(match.timeLimitSeconds - match.elapsedSeconds));
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedTime = `${mins}:${String(secs).padStart(2, '0')}`;

  const nextCorrectBoost =
    match.player.streak >= 1 ? STREAK_SPEED_BOOST_KMH : CORRECT_SPEED_BOOST_KMH;
  const totalRacers = match.competitorCount || (match.competitors ? match.competitors.length + 1 : 2);
  const currentRank = match.playerRank || 1;

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none">
      {/* Top Perimeter HUD Clusters (Leaves Central 3D Viewport 100% Unobstructed) */}
      <div className="flex items-start justify-between gap-4 p-4 md:px-6">
        {/* Top-Left Cluster: Speedometer, Streak, Position & Room Access Code */}
        <div className="flex flex-wrap items-center gap-4 bg-[#0D1527]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-5 py-3 shadow-xl pointer-events-auto">
          {/* Speedometer Readout (~3:1 Hero-to-Kicker Hierarchy) */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              SPEED (KM/H)
            </div>
            <div className="flex items-baseline gap-2">
              <span
                data-testid="hud-speed-value"
                className="text-3xl font-bold font-mono text-cyan-400 tabular-nums hud-stroke"
              >
                {Math.round(match.player.speedKmh)}
              </span>
              {match.player.lastAnswerStatus !== 'idle' && (
                <span
                  data-testid="hud-speed-delta"
                  className={`text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
                    match.player.lastDeltaKmh > 0 ? 'text-emerald-300 bg-emerald-500/20' : 'text-rose-300 bg-rose-500/20'
                  }`}
                >
                  {match.player.lastDeltaKmh > 0
                    ? `+${match.player.lastDeltaKmh} km/h`
                    : `${match.player.lastDeltaKmh} km/h`}
                </span>
              )}
            </div>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" aria-hidden="true" />

          {/* Win-Streak Counter */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              WIN STREAK
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                data-testid="hud-streak-value"
                className={`text-2xl font-bold font-mono tabular-nums hud-stroke ${
                  match.player.streak >= 2 ? 'text-amber-400' : 'text-white'
                }`}
              >
                {match.player.streak}x
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/[0.08] hidden sm:block" aria-hidden="true" />

          {/* Multi-Competitor Position & Room Access Code */}
          <div className="hidden sm:block">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              POS {currentRank}/{totalRacers} · {MATCH_LENGTHS[match.matchLength].label.toUpperCase()}
            </div>
            <div
              data-testid="hud-room-code"
              className="text-sm font-mono font-bold text-slate-200 tracking-wider tabular-nums"
            >
              {match.roomCode} · {formattedTime}
            </div>
          </div>
        </div>

        {/* Top-Center: Live Multi-Competitor Distance & Standings Progress */}
        <div className="hidden lg:flex flex-col flex-1 max-w-md bg-[#0D1527]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-5 py-3 shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span data-testid="hud-player-name-progress" className="font-semibold text-cyan-300 truncate">
              {match.player.name || 'You'} (#{currentRank}/{totalRacers}): {Math.round(match.player.distanceMeters)}m ({playerProgressPct}%)
            </span>
            <span className="font-semibold text-rose-300 truncate">
              {hasLiveRemotePeer ? 'Live Peer' : match.opponent.name}: {Math.round(match.opponent.distanceMeters)}m ({opponentProgressPct}%)
            </span>
          </div>
          <div className="relative h-2 bg-[#070B14] rounded-full overflow-hidden border border-white/[0.08]">
            <div
              className="absolute top-0 left-0 h-full bg-cyan-400 transition-transform duration-150 origin-left"
              style={{ width: '100%', transform: `scaleX(${playerProgressPct / 100})` }}
            />
            <div
              className="absolute bottom-0 left-0 h-1 bg-rose-500 transition-transform duration-150 origin-left"
              style={{ width: '100%', transform: `scaleX(${opponentProgressPct / 100})` }}
            />
          </div>
        </div>

        {/* Top-Right Cluster: Compact SVG Utility Buttons (Mute [M], Pause [P], Restart [R]) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            title="Mute / Unmute [M]"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0D1527]/90 hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {muted ? (
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
              ) : (
                <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={onTogglePause}
            aria-label="Pause Match (P)"
            title="Pause Match [P]"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0D1527]/90 hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={onRestart}
            aria-label="Restart Match (R)"
            title="Restart Match [R]"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0D1527]/90 hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          {isHost && onQuitGame && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-quit-game-btn"
              onClick={onQuitGame}
              aria-label="Quit Game"
              title="Quit Game (Terminate Ongoing Match)"
              className="h-10 px-4 flex items-center justify-center rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold font-display transition-all whitespace-nowrap cursor-pointer active:scale-[0.98]"
            >
              Quit Game
            </button>
          )}
        </div>
      </div>

      {/* Unified Collapsible Bottom Split-Screen Academic Quiz & Control Dock */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-4 pointer-events-auto">
        {/* Collapse / Expand & Lane Controls Bar */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 bg-[#070B14]/92 border border-slate-800 rounded-lg px-2.5 py-1">
            <button
              type="button"
              onClick={() => onShiftLane(-1)}
              className="px-2 py-0.5 text-xs font-mono text-slate-200 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Lane Left [A]
            </button>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono text-slate-400">
              {SPORT_CONFIGS[match.sport].shortLabel} ({totalRacers} Racers)
            </span>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => onShiftLane(1)}
              className="px-2 py-0.5 text-xs font-mono text-slate-200 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Lane Right [D]
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDeckCollapsed((prev) => !prev)}
            className="px-3 py-1 rounded-lg bg-[#070B14]/92 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-300 transition-colors whitespace-nowrap cursor-pointer"
          >
            {deckCollapsed ? 'Show Quiz Deck' : 'Hide Quiz Deck'}
          </button>
        </div>

        {!deckCollapsed && currentQuestion && (
          <div
            data-testid="quiz-question-deck"
            className="bg-[#0D1527]/95 border border-white/[0.12] rounded-2xl p-5 md:p-6 shadow-2xl backdrop-blur-2xl space-y-4"
          >
            {/* Question Metadata & Progress Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-medium">
                <span className="font-mono font-bold text-cyan-400 tabular-nums">
                  Question {match.currentQuestionIndex + 1} / {match.questions.length}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-white font-semibold">{currentQuestion.subjectLabel}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400">{currentQuestion.topic}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                  {currentQuestion.difficulty}
                </span>
              </div>
            </div>

            {/* Question Prompt */}
            <h2
              data-testid="quiz-question-prompt"
              className="text-base md:text-lg font-bold text-white leading-relaxed"
            >
              {currentQuestion.prompt}
            </h2>

            {/* 4 Multiple-Choice Answer Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((optText, idx) => (
                <button
                  key={`${currentQuestion.id}-opt-${idx}`}
                  type="button"
                  data-testid={`quiz-option-${idx}`}
                  onClick={() => onSelectAnswer(idx)}
                  className="group flex items-center gap-3.5 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-cyan-500/10 border border-white/[0.08] hover:border-cyan-400 text-left transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-lg bg-white/[0.08] group-hover:bg-cyan-500 group-hover:text-slate-950 flex items-center justify-center text-xs font-mono font-bold text-cyan-300 shrink-0 transition-all">
                    {idx + 1}
                  </span>
                  <span className="text-xs md:text-sm font-medium text-slate-100 group-hover:text-white leading-snug">
                    {optText}
                  </span>
                </button>
              ))}
            </div>

            {/* Instant Feedback & Academic Explanation Strip */}
            {match.lastFeedback && (
              <div
                data-testid="quiz-feedback-banner"
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl border text-xs ${
                  match.lastFeedback.isCorrect
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="font-semibold font-mono tabular-nums shrink-0">
                  {match.lastFeedback.isCorrect
                    ? match.lastFeedback.streak >= 2
                      ? `WIN-STREAK (${match.lastFeedback.streak}x): +${match.lastFeedback.deltaKmh} km/h BOOST`
                      : `CORRECT ANSWER: +${match.lastFeedback.deltaKmh} km/h BOOST`
                    : `STUMBLE PENALTY: ${match.lastFeedback.deltaKmh} km/h · STREAK RESET`}
                </div>
                <div className="text-slate-300 truncate">{match.lastFeedback.explanation}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
