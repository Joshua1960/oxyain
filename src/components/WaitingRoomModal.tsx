import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Flag,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import {
  AuthenticatedSession,
  CompetitorCount,
  LiveRoomPeer,
  SPORT_CONFIGS,
  SportDiscipline,
  buildWaitingRoomSlots,
  canLaunchWaitingRoom,
  normalizeGuestDisplayName,
} from '../game/rules';
import {
  DIFFICULTY_METADATA,
  QuestionDifficultyId,
  SUBJECT_METADATA,
  SubjectId,
} from '../game/questions';

interface WaitingRoomModalProps {
  isOpen: boolean;
  roomCode: string;
  sport: SportDiscipline;
  subject: SubjectId;
  questionDifficulty: QuestionDifficultyId;
  questionCount: number;
  competitorCount: CompetitorCount;
  session: AuthenticatedSession | null;
  localPlayerId: string;
  localIsHost: boolean;
  localIsReady: boolean;
  remotePeers: LiveRoomPeer[];
  wsConnected: boolean;
  roomError: string | null;
  onToggleReady: () => void;
  onLaunchMatch: () => void;
  onLeaveWaitingRoom: () => void;
  guestDisplayName?: string;
  onChangeGuestDisplayName?: (nextName: string) => void;
}

export const WaitingRoomModal: React.FC<WaitingRoomModalProps> = ({
  isOpen,
  roomCode,
  sport,
  subject,
  questionDifficulty,
  questionCount,
  competitorCount,
  session,
  localPlayerId,
  localIsHost,
  localIsReady,
  remotePeers,
  wsConnected,
  roomError,
  onToggleReady,
  onLaunchMatch,
  onLeaveWaitingRoom,
  guestDisplayName = 'Contender',
  onChangeGuestDisplayName,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const localPlayerName = session
    ? session.fullName
    : normalizeGuestDisplayName(guestDisplayName, 'Contender');
  const slots = buildWaitingRoomSlots({
    localPlayerId,
    localPlayerName,
    localIsReady,
    localIsHost,
    competitorCount,
    remotePeers,
  });

  const launchStatus = canLaunchWaitingRoom(slots);

  const handleCopyCode = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomCode).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div
      data-testid="waiting-room-modal"
      onClick={onLeaveWaitingRoom}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B14]/85 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-[#0D1527]/98 border border-white/[0.12] shadow-2xl backdrop-blur-2xl overflow-hidden text-[#F8FAFC]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#070B14]/80 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-bold">
              <Users className="w-3.5 h-3.5" />
              Multiplayer Room
            </span>
            <span
              data-testid="waiting-room-joined-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/[0.08] text-slate-200 text-xs font-mono"
            >
              <Wifi className={`w-3 h-3 ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              {launchStatus.humanCount} Joined
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Room: {roomCode}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onLeaveWaitingRoom}
              aria-label="Close waiting room"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Room Join Gate Banner */}
          <div
            data-testid="waiting-room-gate-status"
            className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
              launchStatus.allowed
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                : 'bg-amber-950/70 border-amber-500/50 text-amber-200'
            }`}
          >
            <span>
              {launchStatus.allowed
                ? `${launchStatus.humanCount} players are ready. The host can start the match.`
                : launchStatus.waitingReason}
            </span>
            <span className="font-mono text-[11px] text-slate-300">
              {SPORT_CONFIGS[sport].shortLabel} · {SUBJECT_METADATA[subject].shortLabel} ·{' '}
              {DIFFICULTY_METADATA[questionDifficulty].shortLabel} · {questionCount} Questions
            </span>
          </div>

          {/* Anonymous Host Display Name Editor inside Waiting Room */}
          {!session && onChangeGuestDisplayName && (
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="waiting-room-self-name-input"
                className="text-xs font-medium text-slate-300"
              >
                Your Display Name
              </label>
              <input
                id="waiting-room-self-name-input"
                data-testid="waiting-room-self-name-input"
                type="text"
                maxLength={28}
                value={guestDisplayName}
                onChange={(e) => onChangeGuestDisplayName(e.target.value)}
                placeholder="Enter your display name..."
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 sm:w-64"
              />
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
            Share room code <span className="font-mono font-bold text-cyan-300">{roomCode}</span>.
            Guests can enter the code from the lobby and join this waiting room.
          </div>

          {roomError && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-xs text-rose-200">
              {roomError}
            </div>
          )}

          {/* Slot Roster Grid */}
          <div
            data-testid="waiting-room-slots-grid"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1"
          >
            {slots.map((slot) => (
              <div
                key={slot.id}
                data-testid={`waiting-slot-${slot.slotIndex + 1}`}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-all ${
                  slot.isHuman
                    ? 'bg-slate-900/90 border-cyan-500/40'
                    : 'bg-slate-900/45 border-slate-800 border-dashed'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                      slot.isHuman
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                        : 'bg-slate-800/70 border-slate-700 text-slate-500'
                    }`}
                  >
                    #{slot.slotIndex + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-bold truncate ${
                          slot.isHuman ? 'text-white' : 'text-slate-400'
                        }`}
                      >
                        {slot.isHuman ? slot.name : `Open Slot #${slot.slotIndex + 1}`}
                      </span>
                      {slot.isHost && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold uppercase">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {slot.isHuman ? 'Joined Room' : 'Awaiting player'}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase shrink-0 flex items-center gap-1 ${
                    slot.isHuman && slot.isReady
                      ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-300'
                      : slot.isHuman
                      ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300'
                      : 'bg-slate-800/80 border border-slate-700 text-slate-400'
                  }`}
                >
                  {slot.isHuman && slot.isReady && <CheckCircle2 className="w-3 h-3" />}
                  {slot.isHuman ? slot.statusLabel : 'Waiting'}
                </span>
              </div>
            ))}
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="waiting-room-leave-btn"
                onClick={onLeaveWaitingRoom}
                className="h-11 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold border border-white/[0.08] transition-all cursor-pointer"
              >
                Back to Lobby
              </button>

              <button
                type="button"
                data-testid="waiting-room-ready-btn"
                onClick={onToggleReady}
                className={`h-11 px-4 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                  localIsReady
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{localIsReady ? 'Ready' : 'Mark Ready'}</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="waiting-room-start-btn"
              disabled={!localIsHost || !launchStatus.allowed || !wsConnected}
              onClick={() => {
                if (localIsHost && launchStatus.allowed && wsConnected) {
                  onLaunchMatch();
                }
              }}
              className={`h-11 px-6 rounded-xl font-display font-bold text-xs tracking-wide flex items-center gap-2 transition-all active:scale-[0.98] ${
                localIsHost && launchStatus.allowed && wsConnected
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 cursor-pointer'
                  : 'bg-white/[0.04] border border-white/[0.08] text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <Flag className="w-4 h-4" />
              <span>
                {!wsConnected
                  ? 'Connecting to room…'
                  : !localIsHost
                  ? 'Waiting for Host'
                  : launchStatus.allowed
                  ? `Start Match (${launchStatus.humanCount} Joined)`
                  : `Waiting for Players (${launchStatus.humanCount}/${launchStatus.minRequiredPlayers})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
