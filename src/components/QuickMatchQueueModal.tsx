import React from 'react';
import { Radio, ShieldCheck, Timer, UserCheck, Wifi, X, Zap } from 'lucide-react';
import {
  AuthenticatedSession,
  MatchmakingQueueState,
  SPORT_CONFIGS,
  SportDiscipline,
  normalizeGuestDisplayName,
} from '../game/rules';
import { DIFFICULTY_METADATA, QuestionDifficultyId, SUBJECT_METADATA, SubjectId } from '../game/questions';

interface QuickMatchQueueModalProps {
  isOpen: boolean;
  queueState: MatchmakingQueueState;
  session: AuthenticatedSession | null;
  guestDisplayName?: string;
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty: QuestionDifficultyId;
  questionCount: number;
  wsConnected: boolean;
  onForcePairNow: () => void;
  onCancelQueue: () => void;
}

export const QuickMatchQueueModal: React.FC<QuickMatchQueueModalProps> = ({
  isOpen,
  queueState,
  session,
  guestDisplayName = 'Contender',
  sport,
  subject,
  questionDifficulty,
  questionCount,
  wsConnected,
  onForcePairNow,
  onCancelQueue,
}) => {
  if (!isOpen) return null;

  const playerName = session
    ? session.fullName
    : normalizeGuestDisplayName(guestDisplayName, 'Contender');
  const playerInitials = playerName
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, '')[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CT';

  const sportLabel = SPORT_CONFIGS[sport].shortLabel;
  const subjectLabel = SUBJECT_METADATA[subject].shortLabel;
  const diffLabel = DIFFICULTY_METADATA[questionDifficulty].shortLabel;

  const mins = Math.floor(queueState.elapsedSeconds / 60);
  const secs = Math.floor(queueState.elapsedSeconds % 60);
  const tenths = Math.floor((queueState.elapsedSeconds % 1) * 10);
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;

  const isPaired = queueState.status === 'paired';

  return (
    <div
      data-testid="quick-match-queue-modal"
      onClick={onCancelQueue}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B14]/85 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-[#0F172A]/95 border border-cyan-500/35 shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden text-[#F8FAFC]"
      >
        {/* Top Bar */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 text-[11px] font-mono font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              1v1 Matchmaking Queue
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300 text-[11px] font-mono">
              <Wifi className={`w-3 h-3 ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              {wsConnected ? 'Redis Matchmaker · Live WS' : 'Matchmaker Active'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelQueue}
            aria-label="Cancel matchmaking queue"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Body: Player Card + Pulsing Radar + Opponent Card */}
        <div className="p-6 space-y-6">
          {/* Match Parameter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-900/75 border border-slate-800/90 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-white">{sportLabel}</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-300 font-medium">{subjectLabel}</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300 font-mono">{diffLabel}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-300 font-mono font-bold">{questionCount} Questions</span>
            </div>
            <div
              data-testid="matchmaking-timer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-xs"
            >
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formattedTimer}</span>
            </div>
          </div>

          {/* 3-Column Arena Pairing Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Left: User Avatar Card */}
            <div
              data-testid="queue-user-card"
              className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex flex-col items-center text-center shadow-inner"
            >
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] mb-3">
                <svg className="w-9 h-9 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
                </svg>
                <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono font-extrabold text-[9px]">
                  {playerInitials}
                </span>
              </div>
              <div className="text-sm font-bold text-white truncate max-w-full">{playerName}</div>
              <div className="text-[11px] font-mono text-cyan-300 mt-0.5">
                {session ? 'Pro Contender' : 'Contender'}
              </div>
              <div className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-semibold">
                <ShieldCheck className="w-3 h-3" />
                READY
              </div>
            </div>

            {/* Center: Pulsing Radar Search Animation */}
            <div className="flex flex-col items-center justify-center py-2">
              <div
                data-testid="matchmaking-radar"
                className="relative w-36 h-36 rounded-full bg-slate-950/90 border border-cyan-500/40 flex items-center justify-center overflow-hidden shadow-[0_0_35px_rgba(6,182,212,0.2)]"
              >
                {/* Concentric Radar Rings */}
                <div className="absolute inset-3 rounded-full border border-cyan-500/25 animate-ping" />
                <div className="absolute inset-6 rounded-full border border-cyan-500/30" />
                <div className="absolute inset-11 rounded-full border border-cyan-500/25" />

                {/* Crosshairs */}
                <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-500/20" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-500/20" />

                {/* Rotating Radar Sweep */}
                {!isPaired && (
                  <div
                    className="absolute inset-0 rounded-full animate-spin"
                    style={{
                      background:
                        'conic-gradient(from 0deg, rgba(6, 182, 212, 0.38) 0deg, rgba(6, 182, 212, 0.0) 90deg, transparent 360deg)',
                      animationDuration: '2.2s',
                    }}
                  />
                )}

                {/* Radar Target Blip */}
                <span
                  className={`absolute top-7 right-8 w-2.5 h-2.5 rounded-full ${
                    isPaired
                      ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]'
                      : 'bg-amber-400 animate-ping'
                  }`}
                />
                <span className="relative z-10 px-2.5 py-1 rounded-full bg-slate-900/95 border border-cyan-400/40 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  {isPaired ? 'LOCKED' : '1v1 RADAR'}
                </span>
              </div>

              <div className="mt-3 text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  {isPaired ? 'Opponent Paired — Launching Grid' : 'Scanning 1v1 Queue...'}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Channel: <span className="text-slate-300">{queueState.redisChannel}</span>
                </div>
              </div>
            </div>

            {/* Right: Opponent Slot Card */}
            <div
              data-testid="queue-opponent-card"
              className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                isPaired
                  ? 'bg-emerald-950/25 border-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 border-dashed'
              }`}
            >
              <div
                className={`relative w-16 h-16 rounded-2xl flex items-center justify-center mb-3 border-2 ${
                  isPaired
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-800/70 border-slate-700 text-slate-500 animate-pulse'
                }`}
              >
                <UserCheck className="w-8 h-8" />
              </div>
              <div className="text-sm font-bold text-white truncate max-w-full">
                {isPaired ? queueState.opponentName : 'Searching Rival...'}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {isPaired ? queueState.opponentTitle || 'Varsity Challenger' : 'Awaiting Matchmaker'}
              </div>
              <div
                className={`mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                  isPaired
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                }`}
              >
                {isPaired ? 'PAIRED' : 'QUEUEING'}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
            <button
              type="button"
              data-testid="matchmaking-cancel-btn"
              onClick={onCancelQueue}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel Queue
            </button>

            <button
              type="button"
              data-testid="matchmaking-pair-now-btn"
              onClick={onForcePairNow}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>{isPaired ? 'Entering Race...' : 'Pair & Launch Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
