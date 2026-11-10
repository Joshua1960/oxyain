import React from 'react';
import { MATCH_LENGTHS, MatchState, PlayerRaceState, SPORT_CONFIGS } from '../game/rules';

interface StatusModalCardProps {
  match: MatchState;
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
  onQuitGame?: () => void;
  isHost?: boolean;
  onLaunchReplayArena: () => void;
}

export const StatusModalCard: React.FC<StatusModalCardProps> = ({
  match,
  onResume,
  onRestart,
  onReturnToTitle,
  onQuitGame,
  isHost = true,
  onLaunchReplayArena,
}) => {
  if (match.status !== 'paused' && match.status !== 'gameover') return null;

  const isPaused = match.status === 'paused';
  const isVictory = match.winner === 'player';
  const accuracyPct =
    match.player.answeredCount > 0
      ? Math.round((match.player.correctCount / match.player.answeredCount) * 100)
      : 0;

  const allStandings: PlayerRaceState[] = [match.player, ...(match.competitors || [match.opponent])];
  allStandings.sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTimeSeconds ?? Infinity) - (b.finishTimeSeconds ?? Infinity);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.distanceMeters - a.distanceMeters;
  });

  const playerFinalRank = match.playerRank || 1;
  const totalRacers = allStandings.length;
  const hasReplayBuffer =
    Array.isArray(match.replayEvents) &&
    match.replayEvents.length > 0 &&
    !match.replayMemoryFlushed;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-heading"
      data-testid="status-modal-backdrop"
      onClick={isPaused ? onResume : onReturnToTitle}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0D1527]/95 border border-white/[0.12] rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-2xl space-y-6 cursor-default"
      >
        {isPaused ? (
          <>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-1">
                {SPORT_CONFIGS[match.sport].label} · ROOM {match.roomCode} ({totalRacers} RACERS)
              </div>
              <h2 id="status-modal-heading" className="text-2xl font-bold text-white font-display">
                Match Paused
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Race clock paused. Click outside or press Resume to continue.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Current Speed</div>
                <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-1">
                  {Math.round(match.player.speedKmh)} km/h
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Position / Streak</div>
                <div className="text-xl font-bold font-mono text-amber-400 tabular-nums mt-1">
                  #{playerFinalRank}/{totalRacers} · {match.player.streak}x
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Progress</div>
                <div className="text-xl font-bold font-mono text-white tabular-nums mt-1">
                  {match.player.answeredCount}/{match.questions.length} Qs
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onResume}
                className="flex-1 h-11 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-display tracking-wide transition-all shadow-md shadow-cyan-500/20 active:scale-[0.98] cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="h-11 px-5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-100 font-semibold text-xs border border-white/[0.1] transition-all active:scale-[0.98] cursor-pointer"
              >
                Restart
              </button>
              {isHost && onQuitGame ? (
                <button
                  type="button"
                  data-testid="modal-quit-game-btn"
                  onClick={onQuitGame}
                  className="h-11 px-5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold font-display text-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  Quit Game
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReturnToTitle}
                  className="h-11 px-5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  Return to Lobby
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
                {MATCH_LENGTHS[match.matchLength].label.toUpperCase()} FINISHED ({match.questions.length} Qs · {match.questionDifficulty.toUpperCase()}) · ROOM {match.roomCode}
              </div>
              <h2 id="status-modal-heading" className="text-2xl font-bold text-white font-display">
                {isVictory
                  ? `1st Place / ${totalRacers} — Tournament Victory!`
                  : `Position #${playerFinalRank} / ${totalRacers} — Podium Finish`}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {isVictory
                  ? 'Your academic accuracy powered a decisive velocity lead across the finish line.'
                  : `You reached ${Math.round(match.player.distanceMeters)}m with ${accuracyPct}% quiz accuracy.`}
              </p>
            </div>

            {/* 3 Tabular-Nums Mastery Stat Tiles */}
            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Peak Velocity</div>
                <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-1">
                  {Math.round(match.player.peakSpeedKmh)} km/h
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Quiz Accuracy</div>
                <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
                  {accuracyPct}% ({match.player.correctCount}/{match.player.answeredCount})
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-[11px] text-slate-400">Best Streak / Time</div>
                <div className="text-xl font-bold font-mono text-amber-400 tabular-nums mt-1">
                  {match.player.bestStreak}x · {Math.round(match.elapsedSeconds)}s
                </div>
              </div>
            </div>

            {/* Multi-Competitor Room Standings Table */}
            <div className="rounded-xl bg-[#070B14] border border-white/[0.08] p-4 space-y-2 max-h-40 overflow-y-auto">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                ROOM {match.roomCode} FINAL STANDINGS ({totalRacers} COMPETITORS)
              </div>
              {allStandings.map((racer, idx) => {
                const isSelf = racer.id === match.player.id;
                return (
                  <div
                    key={racer.id}
                    className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${
                      isSelf ? 'bg-cyan-500/15 text-cyan-200 font-semibold border border-cyan-500/30' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">
                      #{idx + 1} {racer.name}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      {Math.round(racer.distanceMeters)}m · {Math.round(racer.speedKmh)} km/h
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Post-Match Replay Opt-In Card */}
            {hasReplayBuffer ? (
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold font-display text-cyan-300">
                    3D Match Replay Available ({match.replayEvents.length} Steps)
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Review your speed boosts, lane changes, and question answers step-by-step.
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="launch-replay-arena-btn"
                  onClick={onLaunchReplayArena}
                  className="h-10 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-display text-xs whitespace-nowrap shrink-0 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Watch Replay
                </button>
              </div>
            ) : (
              match.replayMemoryFlushed && (
                <div
                  data-testid="replay-memory-flushed-banner"
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-400 flex items-center justify-between"
                >
                  <span>Match Replay Closed</span>
                  <span className="text-emerald-400 font-bold">Session Cleared</span>
                </div>
              )
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="flex-1 h-11 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-display tracking-wide transition-all shadow-md shadow-cyan-500/20 active:scale-[0.98] cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="h-11 px-5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold text-xs border border-white/[0.1] transition-all active:scale-[0.98] cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
