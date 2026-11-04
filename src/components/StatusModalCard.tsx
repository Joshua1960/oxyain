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
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/78 pointer-events-auto cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0B1120] border border-slate-700 rounded-xl p-6 shadow-2xl space-y-5 cursor-default"
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

            <div className="grid grid-cols-3 gap-2.5 text-left">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Current Speed</div>
                <div className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                  {Math.round(match.player.speedKmh)} km/h
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Position / Streak</div>
                <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                  #{playerFinalRank}/{totalRacers} · {match.player.streak}x
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Progress</div>
                <div className="text-lg font-bold font-mono text-white tabular-nums">
                  {match.player.answeredCount}/{match.questions.length} Qs
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={onResume}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-display tracking-wide transition-colors cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Restart
              </button>
              {isHost && onQuitGame ? (
                <button
                  type="button"
                  data-testid="modal-quit-game-btn"
                  onClick={onQuitGame}
                  className="px-4 py-2.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-200 font-bold font-display text-xs transition-colors cursor-pointer"
                >
                  Quit Game
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReturnToTitle}
                  className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
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
            <div className="grid grid-cols-3 gap-2.5 text-left">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Peak Velocity</div>
                <div className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                  {Math.round(match.player.peakSpeedKmh)} km/h
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Quiz Accuracy</div>
                <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                  {accuracyPct}% ({match.player.correctCount}/{match.player.answeredCount})
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Best Streak / Time</div>
                <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                  {match.player.bestStreak}x · {Math.round(match.elapsedSeconds)}s
                </div>
              </div>
            </div>

            {/* Multi-Competitor Room Standings Table */}
            <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3 space-y-1.5 max-h-36 overflow-y-auto">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                ROOM {match.roomCode} FINAL STANDINGS ({totalRacers} COMPETITORS)
              </div>
              {allStandings.map((racer, idx) => {
                const isSelf = racer.id === match.player.id;
                return (
                  <div
                    key={racer.id}
                    className={`flex items-center justify-between text-xs px-2.5 py-1 rounded ${
                      isSelf ? 'bg-cyan-500/15 text-cyan-200 font-semibold' : 'text-slate-300'
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
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-display text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Watch Replay
                </button>
              </div>
            ) : (
              match.replayMemoryFlushed && (
                <div
                  data-testid="replay-memory-flushed-banner"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between"
                >
                  <span>Match Replay Closed</span>
                  <span className="text-emerald-400 font-bold">Session Cleared</span>
                </div>
              )
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="flex-1 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-display tracking-wide transition-colors cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
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
