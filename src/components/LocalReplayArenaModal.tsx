import React, { useEffect, useState } from 'react';
import { MatchState, ReplayEvent, SPORT_CONFIGS } from '../game/rules';

interface LocalReplayArenaModalProps {
  match: MatchState;
  currentStepIndex: number;
  onSelectStep: (stepIdx: number) => void;
  onExitAndFlushMemory: () => void;
}

export const LocalReplayArenaModal: React.FC<LocalReplayArenaModalProps> = ({
  match,
  currentStepIndex,
  onSelectStep,
  onExitAndFlushMemory,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);

  const events: ReplayEvent[] = match.replayEvents || [];
  const totalSteps = events.length;
  const safeIndex = Math.max(0, Math.min(totalSteps - 1, currentStepIndex));
  const activeEvent: ReplayEvent | undefined = events[safeIndex];

  // Estimate transient RAM footprint of the cached event array in bytes
  const estimatedRamBytes = totalSteps * 256;

  useEffect(() => {
    if (!isPlaying || totalSteps <= 1) return;
    const intervalMs = Math.round(1100 / playbackSpeed);
    const timer = window.setInterval(() => {
      onSelectStep(safeIndex + 1 >= totalSteps ? 0 : safeIndex + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, safeIndex, totalSteps, onSelectStep]);

  if (match.status !== 'replay' || !activeEvent) return null;

  const laneLabel =
    activeEvent.laneIndex === -1
      ? 'Left Lane (-1)'
      : activeEvent.laneIndex === 0
      ? 'Center Lane (0)'
      : 'Right Lane (+1)';

  const badgeStyles: Record<ReplayEvent['type'], string> = {
    match_start: 'bg-cyan-500/20 border-cyan-400 text-cyan-300',
    lane_adjustment: 'bg-sky-500/20 border-sky-400 text-sky-300',
    nitro_boost: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
    streak_nitro: 'bg-amber-500/20 border-amber-400 text-amber-300',
    mistake_penalty: 'bg-rose-500/20 border-rose-400 text-rose-300',
    match_finish: 'bg-purple-500/20 border-purple-400 text-purple-300',
  };

  const nodeDotStyles: Record<ReplayEvent['type'], string> = {
    match_start: 'bg-cyan-400',
    lane_adjustment: 'bg-sky-400',
    nitro_boost: 'bg-emerald-400',
    streak_nitro: 'bg-amber-400',
    mistake_penalty: 'bg-rose-500',
    match_finish: 'bg-purple-400',
  };

  const nitroCount = events.filter(
    (e) => e.type === 'nitro_boost' || e.type === 'streak_nitro'
  ).length;
  const mistakeCount = events.filter((e) => e.type === 'mistake_penalty').length;
  const adjustmentCount = events.filter((e) => e.type === 'lane_adjustment').length;

  return (
    <div
      data-testid="local-replay-arena-screen"
      onClick={onExitAndFlushMemory}
      className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-auto cursor-pointer"
    >
      {/* Top Perimeter Telemetry Header over Full-Bleed 3D Game Canvas */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 p-4 md:px-6">
        {/* Left: Replay Telemetry Readouts */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-3.5 bg-[#070B14]/92 border border-cyan-500/40 rounded-xl px-3.5 py-2 pointer-events-auto shadow-2xl cursor-default"
        >
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
              3D MATCH REPLAY
            </div>
            <div className="text-sm font-bold font-display text-white">
              {SPORT_CONFIGS[match.sport].label} · {match.roomCode}
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800" aria-hidden="true" />

          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              SPEED
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                data-testid="replay-speed-value"
                className="text-xl font-bold font-mono text-cyan-400 tabular-nums"
              >
                {Math.round(activeEvent.speedKmh)} km/h
              </span>
              {activeEvent.deltaKmh !== 0 && (
                <span
                  className={`text-xs font-mono font-bold tabular-nums ${
                    activeEvent.deltaKmh > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {activeEvent.deltaKmh > 0
                    ? `+${activeEvent.deltaKmh} km/h`
                    : `${activeEvent.deltaKmh} km/h`}
                </span>
              )}
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" aria-hidden="true" />

          <div className="hidden sm:block">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              LANE &amp; TRACK POSITION
            </div>
            <div className="text-xs font-mono font-bold text-slate-200 tabular-nums">
              {laneLabel} · {activeEvent.distanceMeters}m (#{activeEvent.playerRank}/{match.competitorCount})
            </div>
          </div>
        </div>

        {/* Right: Summary Counters & Exit Button */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2.5 pointer-events-auto shrink-0 cursor-default"
        >
          <div className="hidden xl:flex items-center gap-2.5 bg-[#070B14]/92 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums">
            <span className="text-emerald-400">{nitroCount} Boosts</span>
            <span className="text-slate-600">·</span>
            <span className="text-rose-400">{mistakeCount} Penalties</span>
            <span className="text-slate-600">·</span>
            <span className="text-sky-400">{adjustmentCount} Shifts</span>
          </div>

          <button
            type="button"
            data-testid="exit-flush-replay-btn"
            onClick={onExitAndFlushMemory}
            className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold font-display text-xs tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg"
          >
            Exit Replay
          </button>
        </div>
      </div>

      {/* Bottom Perimeter Step-by-Step Reconstruction Dock */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl mx-auto px-4 pb-4 pointer-events-auto cursor-default"
      >
        <div className="bg-[#0B1120]/96 border border-slate-700/90 rounded-xl p-4 md:p-5 shadow-2xl space-y-3.5">
          {/* Step-by-Step Controls & Timeline Scrubber Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  onSelectStep(0);
                }}
                disabled={safeIndex === 0}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
              >
                Start
              </button>
              <button
                type="button"
                data-testid="replay-prev-step-btn"
                onClick={() => {
                  setIsPlaying(false);
                  onSelectStep(Math.max(0, safeIndex - 1));
                }}
                disabled={safeIndex === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
              >
                Prev Step
              </button>
              <button
                type="button"
                data-testid="replay-play-toggle-btn"
                onClick={() => setIsPlaying((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                {isPlaying ? 'Pause Replay' : 'Auto-Step'}
              </button>
              <button
                type="button"
                data-testid="replay-next-step-btn"
                onClick={() => {
                  setIsPlaying(false);
                  onSelectStep(Math.min(totalSteps - 1, safeIndex + 1));
                }}
                disabled={safeIndex >= totalSteps - 1}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
              >
                Next Step
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  onSelectStep(totalSteps - 1);
                }}
                disabled={safeIndex >= totalSteps - 1}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
              >
                End
              </button>
            </div>

            {/* Playback Rate & Step Readout */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {([0.5, 1, 2] as const).map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackSpeed(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      playbackSpeed === rate
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
              <span
                data-testid="replay-step-indicator"
                className="text-xs font-mono font-bold text-cyan-300 tabular-nums"
              >
                Step {safeIndex + 1} / {totalSteps} · T+{activeEvent.timestampSeconds.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Interactive RAM Event Array Node Timeline */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {events.map((evt, idx) => {
              const isCurrent = idx === safeIndex;
              return (
                <button
                  key={evt.id}
                  type="button"
                  data-testid={`replay-node-${idx}`}
                  onClick={() => {
                    setIsPlaying(false);
                    onSelectStep(idx);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-800 border-cyan-400 text-white font-bold'
                      : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${nodeDotStyles[evt.type]}`} />
                  <span>#{idx + 1}</span>
                  <span>
                    {evt.type === 'nitro_boost'
                      ? '+20 Nitro'
                      : evt.type === 'streak_nitro'
                      ? '+30 Streak'
                      : evt.type === 'mistake_penalty'
                      ? '-15 Stumble'
                      : evt.type === 'lane_adjustment'
                      ? 'Lane Shift'
                      : evt.type === 'match_finish'
                      ? 'Finish'
                      : 'Start'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step-by-Step Event Fidelity Inspector */}
          <div
            data-testid="replay-event-detail-card"
            className="p-3.5 rounded-xl bg-slate-950/95 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-testid="replay-event-badge"
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${
                    badgeStyles[activeEvent.type]
                  }`}
                >
                  {activeEvent.label}
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  Streak: {activeEvent.streak}x · Distance: {activeEvent.distanceMeters}m
                </span>
              </div>

              {activeEvent.questionPrompt ? (
                <div className="text-xs md:text-sm text-white font-medium">
                  Q{activeEvent.questionIndex}: {activeEvent.questionPrompt}
                </div>
              ) : (
                <div className="text-xs md:text-sm text-slate-200">{activeEvent.detail}</div>
              )}

              {activeEvent.chosenOption && (
                <div className="text-xs text-slate-300 font-mono">
                  Selected:{' '}
                  <strong
                    className={activeEvent.isCorrect ? 'text-emerald-400' : 'text-rose-400'}
                  >
                    {activeEvent.chosenOption}
                  </strong>
                  {!activeEvent.isCorrect && activeEvent.correctOption && (
                    <>
                      {' '}
                      · Correct Answer:{' '}
                      <strong className="text-emerald-300">{activeEvent.correctOption}</strong>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
