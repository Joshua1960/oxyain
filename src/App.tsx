/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveRoomSummary,
  AppRouteId,
  AuthMode,
  AuthenticatedSession,
  CompetitorCount,
  LiveRoomPeer,
  MatchLengthId,
  MatchState,
  MatchmakingQueueState,
  MultiplayerMode,
  PricingTierId,
  RivalDifficulty,
  SportDiscipline,
  StakeholderRole,
  VelocityPreset,
  buildUrlForRoute,
  completeMatchAndReturnToLobby,
  createInitialQueueState,
  createMatchState,
  evaluateLobbyAccess,
  flushReplayMemory,
  generateRoomCode,
  getRouteDocumentTitle,
  inferMatchLengthFromCount,
  isValidRoomCode,
  normalizeGuestDisplayName,
  pairQueueOpponent,
  reconstructMatchAtReplayStep,
  recordLaneAdjustmentEvent,
  resolveRouteFromLocation,
  stepMatchSimulation,
  stepQueueTimer,
  submitMatchAnswer,
  syncRemotePeersIntoMatch,
  terminateMatchByHost,
} from './game/rules';
import {
  CustomQuestionBank,
  INITIAL_CUSTOM_QUESTION_BANKS,
  QuestionDifficultyId,
  QuestionItem,
  SubjectId,
} from './game/questions';
import { soundFX } from './game/sound';
import { ThreeRaceViewport } from './components/ThreeRaceViewport';
import { TitleScreenModal } from './components/TitleScreenModal';
import { PlayingHudAndQuizDeck } from './components/PlayingHudAndQuizDeck';
import { StatusModalCard } from './components/StatusModalCard';
import { LocalReplayArenaModal } from './components/LocalReplayArenaModal';
import { CurriculumDrawerModal } from './components/CurriculumDrawerModal';
import { Scr01LandingPortal } from './components/Scr01LandingPortal';
import { Scr09QuestionGeneratorDashboard } from './components/Scr09QuestionGeneratorDashboard';
import { Scr10AiSourceExtractionConsole } from './components/Scr10AiSourceExtractionConsole';
import { AuthModal } from './components/AuthModal';
import { QuickMatchQueueModal } from './components/QuickMatchQueueModal';
import { WaitingRoomModal } from './components/WaitingRoomModal';

export default function App() {
  const initialResolved =
    typeof window !== 'undefined'
      ? resolveRouteFromLocation(window.location.pathname, window.location.search)
      : { route: 'landing' as AppRouteId, autostart: false };

  const [activeRoute, setActiveRoute] = useState<AppRouteId>(initialResolved.route);
  const [showPublicPortal, setShowPublicPortal] = useState<boolean>(
    initialResolved.route === 'landing'
  );
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(
    initialResolved.route === 'generator'
  );
  const [isExtractorOpen, setIsExtractorOpen] = useState<boolean>(
    initialResolved.route === 'extractor'
  );
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: AuthMode;
    tier: PricingTierId;
    role: StakeholderRole;
  }>({
    isOpen: false,
    mode: 'signup',
    tier: 'classroom',
    role: 'educator',
  });

  const [customBanks, setCustomBanks] = useState<CustomQuestionBank[]>(
    INITIAL_CUSTOM_QUESTION_BANKS
  );
  const [activeBankId, setActiveBankId] = useState<string>(
    INITIAL_CUSTOM_QUESTION_BANKS[0].id
  );
  const [selectedRaceBank, setSelectedRaceBank] = useState<CustomQuestionBank | null>(
    null
  );

  const [sport, setSport] = useState<SportDiscipline>(initialResolved.sport || 'racing');
  const [subject, setSubject] = useState<SubjectId>('stem');
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficultyId>('easy');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [matchLength, setMatchLength] = useState<MatchLengthId>('sprint');
  const [mode, setMode] = useState<MultiplayerMode>(
    initialResolved.route === 'matchmaking' ? 'quickplay' : 'custom'
  );
  const [competitorCount, setCompetitorCount] = useState<CompetitorCount>(
    initialResolved.route === 'matchmaking' ? 2 : 4
  );
  const [rivalDifficulty, setRivalDifficulty] = useState<RivalDifficulty>('standard');
  const [velocityPreset, setVelocityPreset] = useState<VelocityPreset>('standard');
  const [roomCodeInput, setRoomCodeInput] = useState<string>(
    initialResolved.roomCode || 'RACE-101'
  );
  const [roomCodeError, setRoomCodeError] = useState<string | null>(null);
  const [proGateNotice, setProGateNotice] = useState<string | null>(null);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(
    initialResolved.route === 'curriculum'
  );
  const [muted, setMuted] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeRoomsCount, setActiveRoomsCount] = useState(0);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);
  const [liveRoomPeers, setLiveRoomPeers] = useState<LiveRoomPeer[]>([]);
  const [hasLiveRemotePeer, setHasLiveRemotePeer] = useState(false);
  const [replayStepIndex, setReplayStepIndex] = useState<number>(0);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(
    initialResolved.route === 'matchmaking'
  );
  const [queueState, setQueueState] = useState<MatchmakingQueueState>(() =>
    createInitialQueueState()
  );
  const [isWaitingRoomOpen, setIsWaitingRoomOpen] = useState<boolean>(
    initialResolved.route === 'waiting-room'
  );
  const [localIsReady, setLocalIsReady] = useState<boolean>(true);
  const [isLocalHost, setIsLocalHost] = useState<boolean>(true);

  const clientPlayerIdRef = useRef<string>(`p-${Math.random().toString(36).slice(2, 9)}`);
  const fallbackCallsign = `Contender-${clientPlayerIdRef.current.slice(-3).toUpperCase()}`;
  const [guestDisplayName, setGuestDisplayName] = useState<string>(() => {
    if (initialResolved.player) {
      return normalizeGuestDisplayName(initialResolved.player, fallbackCallsign);
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('oxyain_guest_display_name');
        if (saved && saved.trim().length > 0) {
          return normalizeGuestDisplayName(saved, fallbackCallsign);
        }
      } catch {
        // Ignore storage errors
      }
    }
    return fallbackCallsign;
  });

  const defaultGuestCallsignRef = useRef<string>(
    normalizeGuestDisplayName(guestDisplayName, fallbackCallsign)
  );
  defaultGuestCallsignRef.current = normalizeGuestDisplayName(
    guestDisplayName,
    fallbackCallsign
  );

  const handleUpdateGuestDisplayName = useCallback(
    (nextRaw: string) => {
      const cleaned = nextRaw.replace(/<[^>]*>/g, '').slice(0, 28);
      setGuestDisplayName(cleaned);
      const normalized = normalizeGuestDisplayName(cleaned, fallbackCallsign);
      defaultGuestCallsignRef.current = normalized;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('oxyain_guest_display_name', normalized);
        } catch {
          // Ignore storage errors
        }
      }
    },
    [fallbackCallsign]
  );

  const [lastCompletedMatch, setLastCompletedMatch] = useState<MatchState | null>(null);

  const [match, setMatch] = useState<MatchState>(() => {
    const initial = createMatchState({
      sport: initialResolved.sport || 'racing',
      subject: 'stem',
      questionDifficulty: 'easy',
      questionCount: 5,
      matchLength: 'sprint',
      mode: 'custom',
      roomCode: initialResolved.roomCode || 'RACE-101',
      playerName: defaultGuestCallsignRef.current,
      competitorCount: 4,
    });
    return {
      ...initial,
      status:
        initialResolved.route === 'play'
          ? 'playing'
          : initialResolved.route === 'replay'
          ? 'replay'
          : 'title',
    };
  });

  // When in Replay Arena view ('replay'), reconstruct the exact step snapshot for the 3D WebGL viewport
  const viewportMatchState =
    match.status === 'replay' ? reconstructMatchAtReplayStep(match, replayStepIndex) : match;

  // Mutable ref shared with Three.js 60Hz loop so HUD updates never remount the WebGL canvas
  const matchRef = useRef<MatchState>(viewportMatchState);
  matchRef.current = viewportMatchState;

  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<AuthenticatedSession | null>(session);
  sessionRef.current = session;
  const seenPromptsRef = useRef<Set<string>>(new Set());
  const aiQuestionPoolRef = useRef<QuestionItem[]>([]);
  const lobbyConfigRef = useRef({
    sport,
    subject,
    questionDifficulty,
    questionCount,
    selectedRaceBank,
  });
  lobbyConfigRef.current = {
    sport,
    subject,
    questionDifficulty,
    questionCount,
    selectedRaceBank,
  };

  // Canonical route transition helper with History API sync
  const navigateToRoute = useCallback(
    (
      targetRoute: AppRouteId,
      options?: {
        roomCode?: string;
        sport?: SportDiscipline;
        replace?: boolean;
        skipHistoryPush?: boolean;
      }
    ) => {
      setActiveRoute(targetRoute);
      document.body.dataset.route = targetRoute;
      if (typeof document !== 'undefined') {
        document.title = getRouteDocumentTitle(targetRoute);
      }

      if (options?.sport) {
        setSport(options.sport);
      }
      if (options?.roomCode && isValidRoomCode(options.roomCode)) {
        setRoomCodeInput(options.roomCode.trim().toUpperCase());
      }

      if (!options?.skipHistoryPush && typeof window !== 'undefined') {
        const nextUrl = buildUrlForRoute(targetRoute, {
          roomCode: options?.roomCode,
          sport: options?.sport,
        });
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== nextUrl) {
          if (options?.replace) {
            window.history.replaceState({ route: targetRoute }, '', nextUrl);
          } else {
            window.history.pushState({ route: targetRoute }, '', nextUrl);
          }
        }
      }

      switch (targetRoute) {
        case 'landing':
          setShowPublicPortal(true);
          setIsGeneratorOpen(false);
          setIsExtractorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          setMatch((prev) => (prev.status === 'title' ? prev : { ...prev, status: 'title' }));
          break;
        case 'lobby':
          setShowPublicPortal(false);
          setIsGeneratorOpen(false);
          setIsExtractorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          setMatch((prev) => (prev.status === 'title' ? prev : { ...prev, status: 'title' }));
          break;
        case 'waiting-room':
          setShowPublicPortal(false);
          setIsGeneratorOpen(false);
          setIsExtractorOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          setMode('custom');
          setIsWaitingRoomOpen(true);
          setMatch((prev) => (prev.status === 'title' ? prev : { ...prev, status: 'title' }));
          break;
        case 'matchmaking':
          setShowPublicPortal(false);
          setIsGeneratorOpen(false);
          setIsExtractorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsCurriculumOpen(false);
          setMode('quickplay');
          setIsQueueModalOpen(true);
          setMatch((prev) => (prev.status === 'title' ? prev : { ...prev, status: 'title' }));
          break;
        case 'generator':
          setShowPublicPortal(false);
          setIsExtractorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          setIsGeneratorOpen(true);
          setMatch((prev) => (prev.status === 'title' ? prev : { ...prev, status: 'title' }));
          break;
        case 'extractor':
          setShowPublicPortal(false);
          setIsGeneratorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          setIsExtractorOpen(true);
          setMatch((prev) => (prev.status === 'title' ? prev : { ...prev, status: 'title' }));
          break;
        case 'curriculum':
          setIsCurriculumOpen(true);
          break;
        case 'play':
          setShowPublicPortal(false);
          setIsGeneratorOpen(false);
          setIsExtractorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          break;
        case 'replay':
          setShowPublicPortal(false);
          setIsGeneratorOpen(false);
          setIsExtractorOpen(false);
          setIsWaitingRoomOpen(false);
          setIsQueueModalOpen(false);
          setIsCurriculumOpen(false);
          break;
      }
    },
    []
  );

  // Sync document.body.dataset.state, document.title & normalize initial URL if non-canonical
  useEffect(() => {
    document.body.dataset.state = match.status;
    document.body.dataset.route = activeRoute;
    document.title = getRouteDocumentTitle(activeRoute);
  }, [match.status, activeRoute]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resolved = resolveRouteFromLocation(window.location.pathname, window.location.search);
    if (resolved.route === 'replay' && (!match.replayEvents || match.replayEvents.length === 0)) {
      navigateToRoute('lobby', { replace: true });
      return;
    }
    const canonical = buildUrlForRoute(resolved.route, {
      roomCode: resolved.roomCode,
      sport: resolved.sport,
    });
    if (window.location.pathname !== canonical.split('?')[0]) {
      window.history.replaceState({ route: resolved.route }, '', canonical);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolveRouteFromLocation(window.location.pathname, window.location.search);
      navigateToRoute(resolved.route, {
        roomCode: resolved.roomCode,
        sport: resolved.sport,
        skipHistoryPush: true,
      });
      if (resolved.route === 'play') {
        setMatch((prev) => ({ ...prev, status: 'playing' }));
      } else if (resolved.route === 'replay') {
        setMatch((prev) => ({ ...prev, status: 'replay' }));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navigateToRoute]);

  // Connect to WebSocket server & listen for room:state, directory:update, room:match_started, and opponent:telemetry
  useEffect(() => {
    let isMounted = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'directory:update') {
            if (typeof msg.activeRoomsCount === 'number') {
              setActiveRoomsCount(msg.activeRoomsCount);
            }
            if (Array.isArray(msg.rooms)) {
              setActiveRooms(msg.rooms);
            }
          } else if (msg.type === 'room:state' && Array.isArray(msg.players)) {
            const remotePeers: LiveRoomPeer[] = msg.players.filter(
              (p: LiveRoomPeer) => p.id !== clientPlayerIdRef.current
            );
            const selfEntry = msg.players.find(
              (p: LiveRoomPeer) => p.id === clientPlayerIdRef.current
            );
            if (selfEntry && typeof selfEntry.isHost === 'boolean') {
              setIsLocalHost(selfEntry.isHost);
            } else if (typeof msg.hostId === 'string') {
              setIsLocalHost(msg.hostId === clientPlayerIdRef.current);
            }
            setLiveRoomPeers(remotePeers);
            setHasLiveRemotePeer(remotePeers.length > 0);

            if (remotePeers.length > 0) {
              setMatch((prev) => syncRemotePeersIntoMatch(prev, remotePeers));
            }
          } else if (msg.type === 'room:match_started' && Array.isArray(msg.players)) {
            const remotePeers: LiveRoomPeer[] = msg.players.filter(
              (p: LiveRoomPeer) => p.id !== clientPlayerIdRef.current
            );
            const selfEntry = msg.players.find(
              (p: LiveRoomPeer) => p.id === clientPlayerIdRef.current
            );
            if (selfEntry && typeof selfEntry.isHost === 'boolean') {
              setIsLocalHost(selfEntry.isHost);
            } else if (typeof msg.hostId === 'string') {
              setIsLocalHost(msg.hostId === clientPlayerIdRef.current);
            }
            setLiveRoomPeers(remotePeers);
            setHasLiveRemotePeer(remotePeers.length > 0);

            const resolvedPlayerName = sessionRef.current
              ? sessionRef.current.fullName
              : defaultGuestCallsignRef.current;

            const syncedMatch = createMatchState({
              sport: msg.sport || 'racing',
              subject: msg.subject || 'stem',
              questionDifficulty: msg.questionDifficulty || 'easy',
              questionCount: typeof msg.questionCount === 'number' ? msg.questionCount : 5,
              matchLength: msg.matchLength || 'sprint',
              mode: msg.mode || 'custom',
              roomCode: msg.roomCode || 'RACE-101',
              playerName: resolvedPlayerName,
              competitorCount: msg.competitorCount || 4,
              rivalDifficulty: msg.rivalDifficulty || 'standard',
              velocityPreset: msg.velocityPreset || 'standard',
              remotePeers,
            });

            navigateToRoute('play', {
              roomCode: msg.roomCode || 'RACE-101',
              sport: msg.sport || 'racing',
            });
            document.body.dataset.state = 'playing';
            setReplayStepIndex(0);
            setMatch(syncedMatch);
          } else if (msg.type === 'room:match_terminated') {
            navigateToRoute('lobby', { roomCode: msg.roomCode || roomCodeInput });
            document.body.dataset.state = 'title';
            setMatch((prev) => terminateMatchByHost(prev, true));
          } else if (msg.type === 'queue:status') {
            setQueueState((prev) => ({
              ...prev,
              status: msg.status === 'cancelled' ? 'cancelled' : 'searching',
              queuePosition: typeof msg.queuePosition === 'number' ? msg.queuePosition : 1,
              redisChannel: msg.redisChannel || 'mm:1v1:queue',
            }));
          } else if (msg.type === 'queue:matched') {
            setQueueState((prev) =>
              pairQueueOpponent(prev, {
                roomCode: msg.roomCode || 'QM-101',
                opponentName: msg.opponentName || 'Marcus Sterling',
                opponentTitle: msg.opponentTitle || 'Varsity Challenger',
                opponentRating: msg.opponentRating || 1900,
                isHumanOpponent: Boolean(msg.isHumanOpponent),
              })
            );

            const cfg = lobbyConfigRef.current;
            const resolvedPlayerName = sessionRef.current
              ? sessionRef.current.fullName
              : defaultGuestCallsignRef.current;
            const pairedRoom = msg.roomCode || 'QM-101';

            window.setTimeout(() => {
              if (!isMounted) return;
              const nextMatch = createMatchState({
                sport: cfg.sport,
                subject: cfg.subject,
                questionDifficulty: cfg.questionDifficulty,
                questionCount: cfg.questionCount,
                matchLength: inferMatchLengthFromCount(cfg.questionCount),
                mode: 'quickplay',
                roomCode: pairedRoom,
                playerName: resolvedPlayerName,
                opponentName: msg.opponentName || 'Marcus Sterling',
                competitorCount: 2,
                rivalDifficulty: 'standard',
                velocityPreset: 'standard',
                customQuestions: cfg.selectedRaceBank
                  ? cfg.selectedRaceBank.questions
                  : undefined,
              });
              setRoomCodeInput(pairedRoom);
              navigateToRoute('play', { roomCode: pairedRoom, sport: cfg.sport });
              document.body.dataset.state = 'playing';
              setReplayStepIndex(0);
              setMatch(nextMatch);
            }, 550);
          } else if (
            msg.type === 'opponent:telemetry' &&
            msg.playerId !== clientPlayerIdRef.current
          ) {
            setHasLiveRemotePeer(true);
            const singlePeerUpdate: LiveRoomPeer = {
              id: msg.playerId,
              name: msg.name || 'Live Contender',
              isHost: Boolean(msg.isHost),
              speedKmh: typeof msg.speedKmh === 'number' ? msg.speedKmh : 100,
              distanceMeters: typeof msg.distanceMeters === 'number' ? msg.distanceMeters : 0,
              streak: typeof msg.streak === 'number' ? msg.streak : 0,
              correctCount: typeof msg.correctCount === 'number' ? msg.correctCount : 0,
              answeredCount: typeof msg.answeredCount === 'number' ? msg.answeredCount : 0,
              laneIndex:
                msg.laneIndex === -1 || msg.laneIndex === 0 || msg.laneIndex === 1
                  ? msg.laneIndex
                  : 1,
              finished: Boolean(msg.finished),
            };
            setMatch((prev) => syncRemotePeersIntoMatch(prev, [singlePeerUpdate]));
          }
        } catch {
          // Ignore non-JSON frame
        }
      };

      ws.onclose = () => {
        if (isMounted) setWsConnected(false);
      };
    } catch {
      // Fallback gracefully if WebSocket is blocked
    }

    fetch('/api/rooms')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data) {
          if (typeof data.activeRoomsCount === 'number') {
            setActiveRoomsCount(data.activeRoomsCount);
          }
          if (Array.isArray(data.rooms)) {
            setActiveRooms(data.rooms);
          }
        }
      })
      .catch(() => {});

    fetch('/api/question-banks')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data && Array.isArray(data.banks) && data.banks.length > 0) {
          setCustomBanks(data.banks);
          setActiveBankId((prev) =>
            data.banks.some((b: CustomQuestionBank) => b.id === prev)
              ? prev
              : data.banks[0].id
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const handleSaveCustomBank = useCallback((updatedBank: CustomQuestionBank) => {
    setCustomBanks((prev) => {
      const exists = prev.some((b) => b.id === updatedBank.id);
      return exists
        ? prev.map((b) => (b.id === updatedBank.id ? updatedBank : b))
        : [...prev, updatedBank];
    });
    fetch('/api/question-banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedBank),
    }).catch(() => {});
  }, []);

  const handleDeleteCustomBank = useCallback((bankId: string) => {
    setCustomBanks((prev) => {
      const filtered = prev.filter((b) => b.id !== bankId);
      if (filtered.length > 0) {
        setActiveBankId(filtered[0].id);
      }
      return filtered;
    });
    fetch(`/api/question-banks/${encodeURIComponent(bankId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }, []);

  // Pre-fetch fresh AI-generated random questions whenever lobby subject/difficulty/count changes or returning to lobby
  useEffect(() => {
    if (match.status !== 'title') return;
    let cancelled = false;
    fetch('/api/ai-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        difficulty: questionDifficulty,
        count: Math.min(25, Math.max(questionCount, 10)),
        excludePrompts: Array.from(seenPromptsRef.current).slice(-150),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.questions)) return;
        const fresh: QuestionItem[] = data.questions.filter(
          (q: QuestionItem) =>
            q &&
            typeof q.prompt === 'string' &&
            !seenPromptsRef.current.has(q.prompt.trim().toLowerCase())
        );
        if (fresh.length > 0) {
          aiQuestionPoolRef.current = [...fresh, ...aiQuestionPoolRef.current].slice(0, 120);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [subject, questionDifficulty, questionCount, match.status]);

  // Automatically sync lobby presence over WebSocket whenever in the Lobby or changing room parameters
  useEffect(() => {
    const ws = wsRef.current;
    if (!wsConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (match.status !== 'title') return;
    if (mode === 'custom' && !isValidRoomCode(roomCodeInput)) return;

    const playerName = session ? session.fullName : defaultGuestCallsignRef.current;
    const inferredLength = inferMatchLengthFromCount(questionCount);
    const effectiveCompetitors: CompetitorCount = mode === 'custom' ? competitorCount : 2;

    ws.send(
      JSON.stringify({
        type: 'lobby:sync',
        playerId: clientPlayerIdRef.current,
        playerName,
        sport,
        subject,
        questionDifficulty,
        questionCount,
        matchLength: inferredLength,
        mode,
        competitorCount: effectiveCompetitors,
        rivalDifficulty,
        velocityPreset,
        roomCode: mode === 'custom' ? roomCodeInput.trim().toUpperCase() : undefined,
      })
    );
  }, [
    wsConnected,
    match.status,
    mode,
    roomCodeInput,
    sport,
    subject,
    questionDifficulty,
    questionCount,
    competitorCount,
    rivalDifficulty,
    velocityPreset,
    session,
    guestDisplayName,
  ]);

  const broadcastPlayerUpdate = useCallback((nextMatch: MatchState) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'player:update',
          speedKmh: nextMatch.player.speedKmh,
          distanceMeters: nextMatch.player.distanceMeters,
          streak: nextMatch.player.streak,
          correctCount: nextMatch.player.correctCount,
          answeredCount: nextMatch.player.answeredCount,
          laneIndex: nextMatch.player.laneIndex,
          finished: nextMatch.player.finished,
        })
      );
    }
  }, []);

  const handleStartMatch = useCallback(() => {
    if (mode === 'custom' && !isValidRoomCode(roomCodeInput)) {
      setRoomCodeError(
        'Please enter a valid Room Access Code (e.g., RACE-101 or 6-letter code like OXYAIN).'
      );
      return;
    }
    setRoomCodeError(null);

    const inferredLength = inferMatchLengthFromCount(questionCount);
    const accessCheck = evaluateLobbyAccess(session, {
      mode,
      matchLength: inferredLength,
      questionCount,
      competitorCount: mode === 'custom' ? competitorCount : 2,
      rivalDifficulty,
      velocityPreset,
    });

    if (!accessCheck.allowed) {
      setProGateNotice(accessCheck.requiresLoginReason);
      return;
    }
    setProGateNotice(null);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const activeCode =
      mode === 'custom' ? roomCodeInput.trim().toUpperCase() : generateRoomCode();
    if (mode === 'quickplay') {
      setRoomCodeInput(activeCode);
    }

    const playerName = session ? session.fullName : defaultGuestCallsignRef.current;
    const effectiveCompetitors: CompetitorCount = mode === 'custom' ? competitorCount : 2;

    // Pull unseen AI-generated questions matching current subject & difficulty when no custom bank is forced
    let initialCustomQuestions: QuestionItem[] | undefined = selectedRaceBank
      ? selectedRaceBank.questions
      : undefined;

    if (!selectedRaceBank && aiQuestionPoolRef.current.length > 0) {
      const matchingAi = aiQuestionPoolRef.current.filter(
        (q) =>
          !seenPromptsRef.current.has(q.prompt.trim().toLowerCase()) &&
          (subject === 'all' || q.subject === subject) &&
          (questionDifficulty === 'all' || q.difficultyTier === questionDifficulty)
      );
      if (matchingAi.length > 0) {
        initialCustomQuestions = matchingAi.slice(0, questionCount);
      }
    }

    const nextMatch = createMatchState({
      sport,
      subject,
      questionDifficulty,
      questionCount,
      matchLength: inferredLength,
      mode,
      roomCode: activeCode,
      playerName,
      competitorCount: effectiveCompetitors,
      rivalDifficulty,
      velocityPreset,
      remotePeers: liveRoomPeers,
      customQuestions: initialCustomQuestions,
      excludePrompts: seenPromptsRef.current,
    });

    for (const q of nextMatch.questions) {
      seenPromptsRef.current.add(q.prompt.trim().toLowerCase());
    }
    aiQuestionPoolRef.current = aiQuestionPoolRef.current.filter(
      (q) => !seenPromptsRef.current.has(q.prompt.trim().toLowerCase())
    );

    navigateToRoute('play', { roomCode: activeCode, sport });
    document.body.dataset.state = 'playing';
    setReplayStepIndex(0);
    setMatch(nextMatch);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:join',
          playerId: clientPlayerIdRef.current,
          playerName,
          sport,
          subject,
          questionDifficulty,
          questionCount,
          matchLength: inferredLength,
          mode,
          competitorCount: effectiveCompetitors,
          rivalDifficulty,
          velocityPreset,
          roomCode: activeCode,
        })
      );
      ws.send(
        JSON.stringify({
          type: 'room:launch',
          sport,
          subject,
          questionDifficulty,
          questionCount,
          matchLength: inferredLength,
          competitorCount: effectiveCompetitors,
          rivalDifficulty,
          velocityPreset,
        })
      );
    }
  }, [
    mode,
    roomCodeInput,
    sport,
    subject,
    questionDifficulty,
    questionCount,
    competitorCount,
    rivalDifficulty,
    velocityPreset,
    session,
    liveRoomPeers,
    selectedRaceBank,
    navigateToRoute,
  ]);

  const handleLaunchRaceWithCustomBank = useCallback(
    (bank: CustomQuestionBank) => {
      const bankQCount = Math.max(1, bank.questions.length);
      const inferredLen = inferMatchLengthFromCount(bankQCount);
      const activeCode =
        mode === 'custom' && isValidRoomCode(roomCodeInput)
          ? roomCodeInput.trim().toUpperCase()
          : 'RACE-101';
      const playerName = session ? session.fullName : defaultGuestCallsignRef.current;
      const effectiveCompetitors: CompetitorCount = mode === 'custom' ? competitorCount : 2;

      setSelectedRaceBank(bank);
      setSubject(bank.subject);
      setQuestionDifficulty(bank.difficultyTier);
      setQuestionCount(bankQCount);
      setMatchLength(inferredLen);
      navigateToRoute('play', { roomCode: activeCode, sport });

      const nextMatch = createMatchState({
        sport,
        subject: bank.subject,
        questionDifficulty: bank.difficultyTier,
        questionCount: bankQCount,
        matchLength: inferredLen,
        mode,
        roomCode: activeCode,
        playerName,
        competitorCount: effectiveCompetitors,
        rivalDifficulty,
        velocityPreset,
        remotePeers: liveRoomPeers,
        customQuestions: bank.questions,
      });

      document.body.dataset.state = 'playing';
      setReplayStepIndex(0);
      setMatch(nextMatch);
    },
    [
      mode,
      roomCodeInput,
      session,
      competitorCount,
      sport,
      rivalDifficulty,
      velocityPreset,
      liveRoomPeers,
      navigateToRoute,
    ]
  );

  const handleSelectAnswer = useCallback(
    (optionIndex: number) => {
      setMatch((prev) => {
        if (prev.status !== 'playing') return prev;
        const next = submitMatchAnswer(prev, optionIndex);
        if (next.lastFeedback?.isCorrect) {
          soundFX.playCorrectBoost(next.player.streak);
        } else {
          soundFX.playWrongStumble();
        }
        broadcastPlayerUpdate(next);

        if (next.status === 'gameover') {
          if (next.winner === 'player') {
            soundFX.playVictoryFanfare();
          }
          const completed = completeMatchAndReturnToLobby(next);
          setLastCompletedMatch(completed.completedMatchSnapshot);
          window.setTimeout(() => {
            navigateToRoute(completed.targetRoute, {
              roomCode: next.roomCode,
              sport: next.sport,
            });
          }, 0);
          return completed.lobbyMatchState;
        }
        return next;
      });
    },
    [broadcastPlayerUpdate, navigateToRoute]
  );

  const handleShiftLane = useCallback(
    (delta: -1 | 1) => {
      setMatch((prev) => {
        if (prev.status !== 'playing') return prev;
        const nextLane = Math.max(-1, Math.min(1, prev.player.laneIndex + delta)) as -1 | 0 | 1;
        if (nextLane !== prev.player.laneIndex) {
          soundFX.playLaneShift();
        }
        const next = recordLaneAdjustmentEvent(prev, nextLane);
        broadcastPlayerUpdate(next);
        return next;
      });
    },
    [broadcastPlayerUpdate]
  );

  const handleLaunchReplayArena = useCallback(() => {
    setReplayStepIndex(0);
    navigateToRoute('replay');
    setMatch((prev) => {
      const sourceMatch =
        lastCompletedMatch &&
        Array.isArray(lastCompletedMatch.replayEvents) &&
        lastCompletedMatch.replayEvents.length > 0
          ? lastCompletedMatch
          : prev;
      return {
        ...sourceMatch,
        status: 'replay',
      };
    });
  }, [navigateToRoute, lastCompletedMatch]);

  const handleExitAndFlushReplay = useCallback(() => {
    setReplayStepIndex(0);
    navigateToRoute('lobby', { roomCode: match.roomCode, sport: match.sport });
    setLastCompletedMatch((prev) => (prev ? flushReplayMemory(prev) : null));
    setMatch((prev) => ({
      ...flushReplayMemory(prev),
      status: 'title',
    }));
  }, [navigateToRoute, match.roomCode, match.sport]);

  const handleQuitGameByHost = useCallback(() => {
    if (!isLocalHost) return;
    navigateToRoute('lobby', { roomCode: match.roomCode });
    document.body.dataset.state = 'title';
    setMatch((prev) => terminateMatchByHost(prev, isLocalHost));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'room:terminate',
          roomCode: match.roomCode,
        })
      );
    }
  }, [isLocalHost, match.roomCode, navigateToRoute]);

  // 1v1 Matchmaking Queue timer & handlers
  useEffect(() => {
    if (!isQueueModalOpen || queueState.status !== 'searching') return;
    const interval = window.setInterval(() => {
      setQueueState((prev) => stepQueueTimer(prev, 0.1));
    }, 100);
    return () => window.clearInterval(interval);
  }, [isQueueModalOpen, queueState.status]);

  const handleOpenQuickMatchQueue = useCallback(() => {
    const inferredLength = inferMatchLengthFromCount(questionCount);
    const accessCheck = evaluateLobbyAccess(session, {
      mode: 'quickplay',
      matchLength: inferredLength,
      questionCount,
      competitorCount: 2,
      rivalDifficulty: 'standard',
      velocityPreset: 'standard',
    });

    if (!accessCheck.allowed) {
      setProGateNotice(accessCheck.requiresLoginReason);
      return;
    }
    setProGateNotice(null);
    setMode('quickplay');
    setQueueState(createInitialQueueState());
    navigateToRoute('matchmaking');

    const ws = wsRef.current;
    const playerName = session ? session.fullName : defaultGuestCallsignRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'queue:join',
          playerId: clientPlayerIdRef.current,
          playerName,
          sport,
          subject,
          questionDifficulty,
          questionCount,
          matchLength: inferredLength,
        })
      );
    }
  }, [questionCount, session, sport, subject, questionDifficulty, navigateToRoute]);

  const handleForcePairNow = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'queue:force_pair',
          playerId: clientPlayerIdRef.current,
          sport,
        })
      );
    } else {
      handleStartMatch();
    }
  }, [sport, handleStartMatch]);

  const handleCancelQueue = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'queue:leave',
          playerId: clientPlayerIdRef.current,
        })
      );
    }
    navigateToRoute('lobby');
  }, [navigateToRoute]);

  const handleOpenWaitingRoom = useCallback(() => {
    if (!isValidRoomCode(roomCodeInput)) {
      setRoomCodeError(
        'Please enter a valid Room Access Code (e.g., RACE-101 or 6-letter code like OXYAIN).'
      );
      return;
    }
    setRoomCodeError(null);

    const inferredLength = inferMatchLengthFromCount(questionCount);
    const accessCheck = evaluateLobbyAccess(session, {
      mode: 'custom',
      matchLength: inferredLength,
      questionCount,
      competitorCount,
      rivalDifficulty,
      velocityPreset,
    });

    if (!accessCheck.allowed) {
      setProGateNotice(accessCheck.requiresLoginReason);
      return;
    }
    setProGateNotice(null);
    setMode('custom');
    setLocalIsReady(true);
    navigateToRoute('waiting-room', { roomCode: roomCodeInput.trim().toUpperCase() });
  }, [
    roomCodeInput,
    questionCount,
    session,
    competitorCount,
    rivalDifficulty,
    velocityPreset,
    navigateToRoute,
  ]);

  const handleToggleWaitingRoomReady = useCallback(() => {
    setLocalIsReady((prev) => {
      const next = !prev;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'room:ready',
            ready: next,
          })
        );
      }
      return next;
    });
  }, []);

  const handleSimulatePlayerJoin = useCallback(
    (customPlayerName?: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'room:simulate_join',
            playerName: customPlayerName,
          })
        );
      } else {
        setLiveRoomPeers((prev) => {
          if (prev.length + 1 >= competitorCount) return prev;
          const names = ['Marcus Sterling', 'Aria Chen', 'Liam O-Connor', 'Sofia Rostova'];
          const nextIdx = prev.length;
          return [
            ...prev,
            {
              id: `sim-${Date.now()}-${nextIdx}`,
              name: customPlayerName || names[nextIdx % names.length],
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
          ];
        });
      }
    },
    [competitorCount]
  );

  // Simulation step interval (10Hz state reconciliation for HUD numbers while Three.js interpolates smoothly at 60Hz)
  useEffect(() => {
    if (match.status !== 'playing') return;
    let lastTime = performance.now();

    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setMatch((prev) => {
        if (prev.status !== 'playing') return prev;
        const next = stepMatchSimulation(prev, dt, !hasLiveRemotePeer);
        if (next.status === 'gameover' && prev.status === 'playing') {
          if (next.winner === 'player') {
            soundFX.playVictoryFanfare();
          }
          const completed = completeMatchAndReturnToLobby(next);
          setLastCompletedMatch(completed.completedMatchSnapshot);
          window.setTimeout(() => {
            navigateToRoute(completed.targetRoute, {
              roomCode: next.roomCode,
              sport: next.sport,
            });
          }, 0);
          return completed.lobbyMatchState;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [match.status, hasLiveRemotePeer, navigateToRoute]);

  // Unified Keyboard Input Listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCurriculumOpen) {
        if (e.key === 'Escape') {
          setIsCurriculumOpen(false);
          if (activeRoute === 'curriculum') {
            navigateToRoute(showPublicPortal ? 'landing' : 'lobby');
          }
        }
        return;
      }
      if (authModalState.isOpen) {
        if (e.key === 'Escape') {
          setAuthModalState((prev) => ({ ...prev, isOpen: false }));
        }
        return;
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const currentStatus = match.status;

      if (currentStatus === 'title' && !showPublicPortal) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (mode === 'custom' && !isWaitingRoomOpen) {
            handleOpenWaitingRoom();
          } else if (mode === 'custom' && isWaitingRoomOpen) {
            if (liveRoomPeers.length >= 1 && localIsReady) {
              handleStartMatch();
            }
          } else {
            handleStartMatch();
          }
        }
        return;
      }

      if (currentStatus === 'playing') {
        if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
          e.preventDefault();
          handleSelectAnswer(Number(e.key) - 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          handleShiftLane(-1);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleShiftLane(1);
        } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          e.preventDefault();
          setMatch((prev) => ({ ...prev, status: 'paused' }));
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setMuted((prev) => {
            const next = !prev;
            soundFX.muted = next;
            return next;
          });
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          handleStartMatch();
        }
      } else if (currentStatus === 'paused') {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          e.preventDefault();
          setMatch((prev) => ({ ...prev, status: 'playing' }));
        }
      } else if (currentStatus === 'replay') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setReplayStepIndex((prev) =>
            Math.min((match.replayEvents?.length || 1) - 1, prev + 1)
          );
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setReplayStepIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleExitAndFlushReplay();
        }
      } else if (currentStatus === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartMatch();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isCurriculumOpen,
    authModalState.isOpen,
    showPublicPortal,
    match.status,
    match.replayEvents?.length,
    mode,
    isWaitingRoomOpen,
    liveRoomPeers.length,
    localIsReady,
    handleOpenWaitingRoom,
    handleStartMatch,
    handleSelectAnswer,
    handleShiftLane,
    handleExitAndFlushReplay,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070B14] select-none">
      {/* Persistent Three.js 3D Viewport mounted once in an isolated container */}
      <ThreeRaceViewport
        matchRef={matchRef}
        previewSport={sport}
        previewCompetitorCount={mode === 'custom' ? competitorCount : 2}
        isTitleScreen={match.status === 'title'}
      />

      {/* [SCR-01] Universal Landing Page & Public Marketing Terminal (Root '/') */}
      {match.status === 'title' && showPublicPortal && (
        <Scr01LandingPortal
          session={session}
          onOpenAuth={(authMode, tier = 'classroom', role = 'educator') =>
            setAuthModalState({
              isOpen: true,
              mode: authMode,
              tier,
              role,
            })
          }
          onEnterArena={(selectedSport) => {
            navigateToRoute('lobby', { sport: selectedSport });
          }}
          onOpenCustomLobby={() => {
            setMode('custom');
            setRoomCodeInput('RACE-101');
            navigateToRoute('lobby', { roomCode: 'RACE-101' });
          }}
          onOpenCurriculum={() => navigateToRoute('curriculum')}
          wsConnected={wsConnected}
          activeRoomsCount={activeRoomsCount}
        />
      )}

      {/* 3D Tournament Lobby & Custom Multi-Competitor Room Configurator ('/lobby') */}
      {match.status === 'title' &&
        !showPublicPortal &&
        !isGeneratorOpen &&
        !isExtractorOpen && (
          <TitleScreenModal
            sport={sport}
            setSport={setSport}
            subject={subject}
            setSubject={(s) => {
              setSelectedRaceBank(null);
              setSubject(s);
            }}
            questionDifficulty={questionDifficulty}
            setQuestionDifficulty={(d) => {
              setSelectedRaceBank(null);
              setQuestionDifficulty(d);
            }}
            questionCount={questionCount}
            setQuestionCount={setQuestionCount}
            matchLength={matchLength}
            setMatchLength={setMatchLength}
            mode={mode}
            setMode={setMode}
            competitorCount={competitorCount}
            setCompetitorCount={setCompetitorCount}
            rivalDifficulty={rivalDifficulty}
            setRivalDifficulty={setRivalDifficulty}
            velocityPreset={velocityPreset}
            setVelocityPreset={setVelocityPreset}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            roomCodeError={roomCodeError}
            setRoomCodeError={setRoomCodeError}
            proGateNotice={proGateNotice}
            setProGateNotice={setProGateNotice}
            onStartMatch={handleStartMatch}
            onGenerateNewCode={() => {
              const nextCode = generateRoomCode(undefined, sport);
              setRoomCodeInput(nextCode);
              setRoomCodeError(null);
              navigateToRoute('lobby', { roomCode: nextCode, replace: true });
            }}
            onOpenCurriculum={() => navigateToRoute('curriculum')}
            onOpenPublicPortal={() => navigateToRoute('landing')}
            onOpenLoginForPro={() =>
              setAuthModalState({
                isOpen: true,
                mode: 'signup',
                tier: 'classroom',
                role: 'educator',
              })
            }
            session={session}
            wsConnected={wsConnected}
            activeRoomsCount={activeRoomsCount}
            liveRoomPeers={liveRoomPeers}
            activeRooms={activeRooms}
            onOpenQuestionGenerator={() => navigateToRoute('generator')}
            onOpenSourceExtractor={() => navigateToRoute('extractor')}
            onOpenQuickMatchQueue={handleOpenQuickMatchQueue}
            onOpenWaitingRoom={handleOpenWaitingRoom}
            activeCustomBankTitle={selectedRaceBank ? selectedRaceBank.title : null}
            onClearCustomBank={() => setSelectedRaceBank(null)}
            guestDisplayName={guestDisplayName}
            onChangeGuestDisplayName={handleUpdateGuestDisplayName}
            lastCompletedMatch={lastCompletedMatch}
            onDismissLastMatch={() => setLastCompletedMatch(null)}
            onWatchLastMatchReplay={handleLaunchReplayArena}
          />
        )}

      {/* Quick Match Matchmaking Lobby (1v1 Queue State) ('/matchmaking') */}
      <QuickMatchQueueModal
        isOpen={isQueueModalOpen}
        queueState={queueState}
        session={session}
        guestDisplayName={guestDisplayName}
        sport={sport}
        subject={subject}
        questionDifficulty={questionDifficulty}
        questionCount={questionCount}
        wsConnected={wsConnected}
        onForcePairNow={handleForcePairNow}
        onCancelQueue={handleCancelQueue}
      />

      {/* Multiplayer Waiting Room System ('/waiting-room') */}
      <WaitingRoomModal
        isOpen={isWaitingRoomOpen}
        roomCode={roomCodeInput}
        sport={sport}
        subject={subject}
        questionDifficulty={questionDifficulty}
        questionCount={questionCount}
        competitorCount={competitorCount}
        session={session}
        localPlayerId={clientPlayerIdRef.current}
        localIsReady={localIsReady}
        remotePeers={liveRoomPeers}
        wsConnected={wsConnected}
        onToggleReady={handleToggleWaitingRoomReady}
        onSimulatePlayerJoin={handleSimulatePlayerJoin}
        onLaunchMatch={handleStartMatch}
        onLeaveWaitingRoom={() => navigateToRoute('lobby', { roomCode: roomCodeInput })}
        guestDisplayName={guestDisplayName}
        onChangeGuestDisplayName={handleUpdateGuestDisplayName}
      />

      {/* [SCR-09] Custom Question Generator Dashboard ('/generator') */}
      <Scr09QuestionGeneratorDashboard
        isOpen={isGeneratorOpen}
        session={session}
        banks={customBanks}
        activeBankId={activeBankId}
        onSelectBank={(id) => setActiveBankId(id)}
        onSaveBank={handleSaveCustomBank}
        onDeleteBank={handleDeleteCustomBank}
        onCloseToLobby={() => navigateToRoute('lobby')}
        onLaunchRaceWithBank={handleLaunchRaceWithCustomBank}
        onOpenSourceExtractor={() => navigateToRoute('extractor')}
        onOpenAuthModal={() =>
          setAuthModalState({
            isOpen: true,
            mode: 'signup',
            tier: 'classroom',
            role: 'educator',
          })
        }
        onQuickUnlockDemoPro={() =>
          setSession({
            id: 'pro-demo-elena',
            email: 'elena.vance@academy.edu',
            fullName: 'Dr. Elena Vance',
            role: 'educator',
            tier: 'classroom',
          })
        }
      />

      {/* [SCR-10] AI Source Extraction Console ('/extractor') */}
      {isExtractorOpen && (
        <Scr10AiSourceExtractionConsole
          session={session}
          onSaveExtractedBank={(bank) => {
            handleSaveCustomBank(bank);
            setActiveBankId(bank.id);
          }}
          onLaunchWithExtractedBank={handleLaunchRaceWithCustomBank}
          onOpenInQuestionGenerator={(bank) => {
            handleSaveCustomBank(bank);
            setActiveBankId(bank.id);
            navigateToRoute('generator');
          }}
          onBackToLobby={() => navigateToRoute('lobby')}
          onOpenAuthForPro={() =>
            setAuthModalState({
              isOpen: true,
              mode: 'signup',
              tier: 'classroom',
              role: 'educator',
            })
          }
          onQuickDemoProLogin={() =>
            setSession({
              id: 'pro-demo-elena',
              email: 'elena.vance@academy.edu',
              fullName: 'Dr. Elena Vance',
              role: 'educator',
              tier: 'classroom',
            })
          }
        />
      )}

      {/* Active Gameplay HUD & Split-Screen Academic Quiz Deck ('/play') */}
      {(match.status === 'playing' || match.status === 'paused' || match.status === 'gameover') && (
        <PlayingHudAndQuizDeck
          match={match}
          muted={muted}
          onToggleMute={(e) => {
            e.currentTarget.blur();
            setMuted((prev) => {
              const next = !prev;
              soundFX.muted = next;
              return next;
            });
          }}
          onTogglePause={(e) => {
            e.currentTarget.blur();
            setMatch((prev) => ({
              ...prev,
              status: prev.status === 'paused' ? 'playing' : 'paused',
            }));
          }}
          onRestart={(e) => {
            e.currentTarget.blur();
            handleStartMatch();
          }}
          onQuitGame={handleQuitGameByHost}
          isHost={isLocalHost}
          onShiftLane={handleShiftLane}
          onSelectAnswer={handleSelectAnswer}
          hasLiveRemotePeer={hasLiveRemotePeer}
        />
      )}

      {/* Pause / Victory / Game Over Status Modal */}
      <StatusModalCard
        match={match}
        onResume={() => setMatch((prev) => ({ ...prev, status: 'playing' }))}
        onRestart={handleStartMatch}
        onReturnToTitle={() => {
          navigateToRoute('lobby', { roomCode: match.roomCode });
          setMatch((prev) => ({ ...prev, status: 'title' }));
        }}
        onQuitGame={handleQuitGameByHost}
        isHost={isLocalHost}
        onLaunchReplayArena={handleLaunchReplayArena}
      />

      {/* Local In-Memory Replay Arena View Screen ('/replay') */}
      <LocalReplayArenaModal
        match={match}
        currentStepIndex={replayStepIndex}
        onSelectStep={(idx) => setReplayStepIndex(idx)}
        onExitAndFlushMemory={handleExitAndFlushReplay}
      />

      {/* Authentication & Plan Enrollment Modal */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        initialTier={authModalState.tier}
        initialRole={authModalState.role}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        onAuthenticated={(newSession) => {
          setSession(newSession);
          setAuthModalState((prev) => ({ ...prev, isOpen: false }));
          setProGateNotice(null);
          setMode('custom');
          setCompetitorCount(8);
          if (activeRoute === 'landing') {
            navigateToRoute('lobby');
          }
        }}
      />

      {/* Educator, Student & Investor Curriculum Brief Modal ('/curriculum') */}
      <CurriculumDrawerModal
        isOpen={isCurriculumOpen}
        onClose={() => {
          setIsCurriculumOpen(false);
          if (activeRoute === 'curriculum') {
            navigateToRoute(showPublicPortal ? 'landing' : 'lobby');
          }
        }}
      />
    </main>
  );
}
