import React, { useEffect, useRef, useState } from 'react';
import {
  AuthMode,
  AuthenticatedSession,
  BillingCycle,
  CORRECT_SPEED_BOOST_KMH,
  MATCH_LENGTHS,
  PRICING_TIERS,
  PricingTierId,
  SPORT_CONFIGS,
  STREAK_SPEED_BOOST_KMH,
  SportDiscipline,
  StakeholderRole,
  WRONG_SPEED_PENALTY_KMH,
  getEffectiveMonthlyPrice,
} from '../game/rules';
import { SUBJECT_METADATA } from '../game/questions';
import { useTheme } from '../context/ThemeContext';

interface Scr01LandingPortalProps {
  session: AuthenticatedSession | null;
  onOpenAuth: (mode: AuthMode, tier?: PricingTierId, role?: StakeholderRole) => void;
  onEnterArena: (sport?: SportDiscipline) => void;
  onOpenCustomLobby: () => void;
  onOpenCurriculum: () => void;
  wsConnected?: boolean;
  activeRoomsCount?: number;
}

/**
 * Animated Apple-Grade Micro-Canvas showcasing the live Oxyain application loop:
 * Answer Academic Question -> Velocity Delta (+20 km/h, +30 km/h streak, -15 km/h stumble) -> Real-Time Track Overtake
 */
const HeroLoopMicroCanvas: React.FC<{
  onLaunchDiscipline: (sport: SportDiscipline) => void;
}> = ({ onLaunchDiscipline }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [demoSport, setDemoSport] = useState<SportDiscipline>('racing');
  const [simSpeed, setSimSpeed] = useState<number>(150);
  const [simStreak, setSimStreak] = useState<number>(2);
  const [simEventLabel, setSimEventLabel] = useState<string>('2x Win-Streak (+30 km/h Boost)');
  const [simStatus, setSimStatus] = useState<'correct' | 'streak' | 'stumble'>('streak');

  const stateRef = useRef({
    sport: 'racing' as SportDiscipline,
    speedKmh: 150,
    streak: 2,
    status: 'streak' as 'correct' | 'streak' | 'stumble',
    flashTimer: 0,
    playerX: 0.58,
    rivalX: 0.42,
    scrollOffset: 0,
  });

  useEffect(() => {
    stateRef.current.sport = demoSport;
  }, [demoSport]);

  const triggerLoopEvent = (type: 'correct' | 'streak' | 'stumble') => {
    const st = stateRef.current;
    st.status = type;
    st.flashTimer = 0.9;

    if (type === 'correct') {
      const nextSpeed = Math.min(340, st.speedKmh + CORRECT_SPEED_BOOST_KMH);
      st.speedKmh = nextSpeed;
      st.streak = 1;
      setSimSpeed(nextSpeed);
      setSimStreak(1);
      setSimStatus('correct');
      setSimEventLabel(`Correct Answer: +${CORRECT_SPEED_BOOST_KMH} km/h Velocity Boost`);
    } else if (type === 'streak') {
      const nextStreak = Math.max(2, st.streak + 1);
      const nextSpeed = Math.min(360, st.speedKmh + STREAK_SPEED_BOOST_KMH);
      st.speedKmh = nextSpeed;
      st.streak = nextStreak;
      setSimSpeed(nextSpeed);
      setSimStreak(nextStreak);
      setSimStatus('streak');
      setSimEventLabel(`${nextStreak}x Win-Streak: +${STREAK_SPEED_BOOST_KMH} km/h Super Boost`);
    } else {
      const nextSpeed = Math.max(65, st.speedKmh - WRONG_SPEED_PENALTY_KMH);
      st.speedKmh = nextSpeed;
      st.streak = 0;
      setSimSpeed(nextSpeed);
      setSimStreak(0);
      setSimStatus('stumble');
      setSimEventLabel(`Incorrect Answer: -${WRONG_SPEED_PENALTY_KMH} km/h Stumble & Reset`);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      if (document.hidden) {
        lastTime = now;
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const st = stateRef.current;

      st.flashTimer = Math.max(0, st.flashTimer - dt);
      st.scrollOffset = (st.scrollOffset + st.speedKmh * dt * 1.45) % 64;

      const targetPlayerX = st.status === 'stumble' ? 0.34 : st.status === 'streak' ? 0.68 : 0.56;
      st.playerX += (targetPlayerX - st.playerX) * Math.min(1, dt * 4.5);
      st.rivalX = 0.45 + Math.sin(now * 0.0016) * 0.05;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Track Background Surface
      const isTartan = st.sport !== 'racing';
      ctx.fillStyle = isTartan ? '#2A1711' : '#0B111E';
      ctx.fillRect(0, 0, w, h);

      // Track Lanes & Telemetry Strip
      const trackTop = 34;
      const trackBottom = h - 34;
      const trackHeight = trackBottom - trackTop;
      ctx.fillStyle = isTartan ? '#3D1E16' : '#141E33';
      ctx.fillRect(0, trackTop, w, trackHeight);

      // Curbs with subtle optical tick
      for (let x = -64; x < w + 64; x += 32) {
        const drawX = x - (st.scrollOffset % 32);
        const even = Math.floor((x + 64) / 32) % 2 === 0;
        ctx.fillStyle = even ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(drawX, trackTop, 16, 4);
        ctx.fillRect(drawX, trackBottom - 4, 16, 4);
      }

      // Track Dividers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let x = w + 64; x >= -64; x -= 64) {
        const gateX = x - st.scrollOffset;
        ctx.beginPath();
        ctx.moveTo(gateX, trackTop);
        ctx.lineTo(gateX, trackBottom);
        ctx.stroke();
      }

      // Center Lane Dashes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hurdles (in Hurdle Mode)
      if (st.sport === 'hurdles') {
        for (let x = 60; x < w + 64; x += 128) {
          const hx = (x - st.scrollOffset * 2 + w) % w;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillRect(hx - 2, trackTop + 16, 4, trackHeight / 2 - 24);
          ctx.fillRect(hx - 2, h / 2 + 10, 4, trackHeight / 2 - 24);
        }
      }

      // Rival Contender (Bottom Lane) - Crisp Monochrome
      const rivalPx = st.rivalX * w;
      const rivalPy = h * 0.67;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(rivalPx - 44, rivalPy - 8, 36, 16);
      ctx.fillStyle = '#6E6E73';
      ctx.beginPath();
      ctx.roundRect(rivalPx - 20, rivalPy - 10, 40, 20, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '500 10px var(--font-sans, sans-serif)';
      ctx.fillText('Rival · 135 km/h', rivalPx - 38, rivalPy + 23);

      // Player Contender (Top Lane) - High Contrast Monochrome
      const playerPx = st.playerX * w;
      const playerPy = h * 0.33;

      const trailWidth = st.status === 'stumble' ? 20 : st.status === 'streak' ? 76 : 48;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(playerPx - 22 - trailWidth, playerPy - 8, trailWidth, 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(playerPx - 22, playerPy - 11, 44, 22, 7);
      ctx.fill();

      // Canopy
      ctx.fillStyle = '#05070E';
      ctx.beginPath();
      ctx.roundRect(playerPx - 2, playerPy - 7, 12, 14, 3);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 11px var(--font-sans, sans-serif)';
      ctx.fillText(`You · ${st.speedKmh} km/h (${st.streak}x)`, playerPx - 44, playerPy - 17);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      id="application-loop"
      className="apple-glass rounded-[28px] p-5 sm:p-6 flex flex-col justify-between h-full space-y-4"
    >
      {/* Micro-Canvas Top Segment */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-slate-800 dark:bg-white animate-pulse" />
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white tracking-tight">
            Live Telemetry Simulator
          </span>
        </div>

        {/* Apple Segmented Control for Sport Discipline */}
        <div
          className="p-1 rounded-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/[0.08] flex items-center gap-0.5"
          role="group"
          aria-label="Micro-Canvas Sport Mode"
        >
          {(['racing', 'sprinting', 'hurdles'] as const).map((sp) => {
            const isActive = demoSport === sp;
            return (
              <button
                key={sp}
                type="button"
                onClick={() => setDemoSport(sp)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'apple-pill-active'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {SPORT_CONFIGS[sp].shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] bg-[#070B14]">
        <canvas
          ref={canvasRef}
          width={560}
          height={210}
          data-testid="scr01-micro-canvas"
          className="w-full h-[190px] block"
        />

        {/* Live Readout Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-black/70 backdrop-blur-md border-t border-white/[0.08] text-xs font-mono tabular-nums">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Velocity: <strong className="text-white font-bold">{simSpeed} km/h</strong>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-slate-300">
              Streak: <strong className="text-white font-bold">{simStreak}x</strong>
            </span>
          </div>
          <span className="truncate font-medium text-[11px] text-slate-200">
            {simEventLabel}
          </span>
        </div>
      </div>

      {/* Tactile Action Triggers */}
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => triggerLoopEvent('correct')}
            className="h-11 px-3 rounded-2xl bg-black/5 hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-black/10 dark:border-white/10 text-slate-900 dark:text-white text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center active:scale-[0.97]"
          >
            +20 km/h Correct
          </button>
          <button
            type="button"
            onClick={() => triggerLoopEvent('streak')}
            className="h-11 px-3 rounded-2xl bg-black/5 hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-black/10 dark:border-white/10 text-slate-900 dark:text-white text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center active:scale-[0.97]"
          >
            +30 km/h Streak
          </button>
          <button
            type="button"
            onClick={() => triggerLoopEvent('stumble')}
            className="h-11 px-3 rounded-2xl bg-black/5 hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-black/10 dark:border-white/10 text-slate-900 dark:text-white text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center active:scale-[0.97]"
          >
            -15 km/h Stumble
          </button>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => onLaunchDiscipline(demoSport)}
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            Enter {SPORT_CONFIGS[demoSport].shortLabel} in 3D Arena &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export const Scr01LandingPortal: React.FC<Scr01LandingPortalProps> = ({
  session,
  onOpenAuth,
  onEnterArena,
  onOpenCustomLobby,
  onOpenCurriculum,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');

  return (
    <div
      data-testid="scr01-landing-portal"
      className="fixed inset-0 z-30 overflow-y-auto bg-[var(--bg-canvas)] text-[var(--text-primary)] pointer-events-auto transition-colors duration-200"
    >
      {/* Floating Apple-Style Navigation Capsule */}
      <div className="sticky top-4 z-40 px-4 sm:px-8 max-w-6xl mx-auto">
        <header className="apple-glass rounded-full px-5 sm:px-7 py-3 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <a
            href="#top"
            className="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap group"
          >
            <span className="w-8 h-8 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 flex items-center justify-center font-bold text-xs shadow-md transition-transform group-hover:scale-105">
              OX
            </span>
            <span className="tracking-[-0.02em]">Oxyain</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10">
              PRO ESPORTS
            </span>
          </a>

          {/* Primary Navigation, Theme Switcher & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenCurriculum()}
              className="hidden md:inline-flex px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-black dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              Curriculum
            </button>

            {/* Apple-Style Light / Dark Mode Toggle Pill */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="h-10 px-3.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {theme === 'dark' ? (
                <>
                  <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  <span className="hidden sm:inline text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span className="hidden sm:inline text-[11px]">Dark</span>
                </>
              )}
            </button>

            {session ? (
              <button
                type="button"
                onClick={() => onEnterArena()}
                className="h-10 px-5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 rounded-full transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
              >
                Enter Arena ({session.fullName})
              </button>
            ) : (
              <button
                type="button"
                data-testid="header-auth-cta"
                onClick={() => onOpenAuth('signup', 'contender')}
                className="h-10 px-5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 rounded-full transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </header>
      </div>

      {/* Main Marketing Portal Content */}
      <main id="top" className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-16 space-y-24">
        {/* SECTION 1: Hero Proposition & Animated Micro-Canvas */}
        <section className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Hero Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-300 backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-slate-800 dark:bg-white" />
                  Real-Time 3D Academic Racing
                </div>

                <h1
                  className="font-extrabold text-slate-900 dark:text-white tracking-[-0.035em] leading-[1.08]"
                  style={{ fontSize: 'clamp(2.35rem, 4.4vw, 3.8rem)', textWrap: 'balance' }}
                >
                  High-Speed 3D Esports Powered by Academic Mastery.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-[54ch]">
                  Compete in high-speed 3D car racing, stadium sprinting, and championship hurdles fueled by live curriculum quizzes. Answer accurately to trigger instant velocity boosts and overtake rivals.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    data-start="true"
                    data-testid="hero-launch-arena-btn"
                    onClick={() => onEnterArena()}
                    className="h-12 sm:h-13 px-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black font-bold text-sm tracking-wide transition-all shadow-md whitespace-nowrap cursor-pointer active:scale-[0.98]"
                  >
                    Play Now
                  </button>

                  <button
                    type="button"
                    data-testid="hero-custom-lobby-btn"
                    onClick={() => onOpenCustomLobby()}
                    className="h-12 sm:h-13 px-8 rounded-full bg-black/5 hover:bg-black/10 text-slate-800 border border-black/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] dark:border-white/[0.12] dark:text-white font-semibold text-sm transition-all whitespace-nowrap cursor-pointer active:scale-[0.98]"
                  >
                    Host Multiplayer Room
                  </button>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Micro-Canvas Telemetry Stage */}
            <div className="lg:col-span-6">
              <HeroLoopMicroCanvas onLaunchDiscipline={(sp) => onEnterArena(sp)} />
            </div>
          </div>

          {/* Full-Width 4-Column KPI Cards (Apple Activity Summary Style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-black/[0.08] dark:border-white/[0.08]">
            <div className="apple-card rounded-3xl p-5 space-y-1">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                Velocity Boost
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                +20 / +30 km/h
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Streak accelerations</div>
            </div>

            <div className="apple-card rounded-3xl p-5 space-y-1">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                Mistake Penalty
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                -15 km/h
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Deceleration penalty</div>
            </div>

            <div className="apple-card rounded-3xl p-5 space-y-1">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                Match Formats
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                5 · 10 · 20 Qs
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Sprint, Circuit, Endurance</div>
            </div>

            <div className="apple-card rounded-3xl p-5 space-y-1">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                Multiplayer Grids
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                2 to 8 Racers
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Real-time room syncing</div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Core Capabilities Bento Grid */}
        <section id="capabilities" className="space-y-8">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Engineered For Competition
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Built for Competitive Esports &amp; Classroom Mastery
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="apple-card rounded-3xl p-6 space-y-3.5">
              <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white font-bold text-xs">
                01
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Three 3D Athletic Disciplines
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Race Formula cars on asphalt, sprint 100m on Olympic tartan, or hurdle with precision timing. Every vehicle and avatar responds instantly to quiz accuracy.
              </p>
            </div>

            <div className="apple-card rounded-3xl p-6 space-y-3.5">
              <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white font-bold text-xs">
                02
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Five Academic Domains
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Compete across{' '}
                {(['stem', 'literature', 'social', 'business', 'general'] as const)
                  .map((s) => SUBJECT_METADATA[s].label)
                  .join(', ')}{' '}
                from Novice to Olympiad difficulty tiers.
              </p>
            </div>

            <div className="apple-card rounded-3xl p-6 space-y-3.5">
              <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white font-bold text-xs">
                03
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Flexible Match Lengths
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Choose <strong className="text-slate-900 dark:text-white font-semibold">Sprint</strong> ({MATCH_LENGTHS.sprint.questionCount}Q), <strong className="text-slate-900 dark:text-white font-semibold">Circuit</strong> ({MATCH_LENGTHS.circuit.questionCount}Q), or <strong className="text-slate-900 dark:text-white font-semibold">Endurance</strong> ({MATCH_LENGTHS.endurance.questionCount}Q) to fit any schedule.
              </p>
            </div>

            <div className="md:col-span-2 lg:col-span-3 apple-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Multiplayer Sharded Rooms &amp; AI Extraction Console
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl font-normal">
                  Host private rooms with custom room codes, matchmake 1v1 instantly, or upload lecture notes and PDFs to generate custom racing trivia in seconds with Gemini AI.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenCustomLobby()}
                  className="h-11 px-6 rounded-full bg-black/5 hover:bg-black/10 text-slate-800 border border-black/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] dark:border-white/[0.12] dark:text-white text-xs font-semibold transition-all whitespace-nowrap cursor-pointer active:scale-95"
                >
                  Open Custom Lobby
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Subscription Pricing Cards */}
        <section id="pricing" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Predictable Pricing
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Transparent Plans for Players &amp; Schools
              </h2>
            </div>

            {/* Apple Segmented Toggle for Billing Cycle */}
            <div
              className="p-1 rounded-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/[0.08] flex items-center gap-1 self-start"
              role="group"
              aria-label="Billing Cycle"
            >
              <button
                type="button"
                data-testid="billing-toggle-monthly"
                onClick={() => setBillingCycle('monthly')}
                className={`h-9 px-4 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'apple-pill-active'
                    : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                data-testid="billing-toggle-annual"
                onClick={() => setBillingCycle('annual')}
                className={`h-9 px-4 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'apple-pill-active'
                    : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {PRICING_TIERS.map((tier) => {
              const effectivePrice = getEffectiveMonthlyPrice(tier, billingCycle);
              const defaultRole: StakeholderRole =
                tier.id === 'classroom'
                  ? 'educator'
                  : tier.id === 'district'
                  ? 'investor'
                  : 'student';

              return (
                <div
                  key={tier.id}
                  data-testid={`pricing-card-${tier.id}`}
                  className={`p-7 sm:p-8 rounded-[28px] flex flex-col justify-between space-y-6 transition-all ${
                    tier.highlighted
                      ? 'apple-glass border-2 border-slate-900/30 dark:border-white/30 shadow-2xl'
                      : 'apple-card'
                  }`}
                >
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {tier.indexLabel}
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{tier.name}</h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tier.audience}</div>
                    </div>

                    <div className="pt-3 border-t border-black/[0.08] dark:border-white/[0.08]">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          data-testid={`pricing-amount-${tier.id}`}
                          className="text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight font-mono"
                        >
                          ${effectivePrice}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          / mo {effectivePrice > 0 && billingCycle === 'annual' ? '(billed annually)' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{tier.summary}</p>
                    </div>

                    <ul className="space-y-3 pt-3 text-xs text-slate-700 dark:text-slate-300">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="w-4 h-4 rounded-full bg-black/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            ✓
                          </span>
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    data-testid={`pricing-cta-${tier.id}`}
                    onClick={() => onOpenAuth('signup', tier.id, defaultRole)}
                    className={`w-full h-12 px-5 rounded-full font-bold text-xs tracking-wide transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] ${
                      tier.highlighted
                        ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black shadow-md'
                        : 'bg-black/5 hover:bg-black/10 text-slate-800 border border-black/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] dark:text-white dark:border-white/[0.12]'
                    }`}
                  >
                    {tier.ctaLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: Bespoke Footer with Grand Liquid Glass OXYAIN Typography */}
        <footer className="pt-16 pb-6 relative overflow-hidden border-t border-black/[0.08] dark:border-white/[0.08] space-y-12">
          {/* Top Footer Navigation Columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white tracking-tight">Disciplines</h4>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li><button type="button" onClick={() => onEnterArena('racing')} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Formula Racing 3D</button></li>
                <li><button type="button" onClick={() => onEnterArena('sprinting')} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Olympic 100m Sprint</button></li>
                <li><button type="button" onClick={() => onEnterArena('hurdles')} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Championship Hurdles</button></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white tracking-tight">Academic Domains</h4>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li><span className="hover:text-black dark:hover:text-white transition-colors cursor-default">STEM &amp; Calculus</span></li>
                <li><span className="hover:text-black dark:hover:text-white transition-colors cursor-default">Literature &amp; Linguistics</span></li>
                <li><span className="hover:text-black dark:hover:text-white transition-colors cursor-default">World History &amp; Social</span></li>
                <li><span className="hover:text-black dark:hover:text-white transition-colors cursor-default">Macroeconomics &amp; Business</span></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white tracking-tight">Platform</h4>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li><button type="button" onClick={() => onOpenCustomLobby()} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Multiplayer Sharded Rooms</button></li>
                <li><button type="button" onClick={() => onOpenCurriculum()} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Curriculum Drawer</button></li>
                <li><span className="hover:text-black dark:hover:text-white transition-colors cursor-default">AI Source Extractor</span></li>
                <li><span className="hover:text-black dark:hover:text-white transition-colors cursor-default">RAM Replay Arena</span></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white tracking-tight">Account &amp; Access</h4>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li><button type="button" onClick={() => onOpenAuth('signin', 'contender')} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Sign In</button></li>
                <li><button type="button" onClick={() => onOpenAuth('signup', 'contender')} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Create Account</button></li>
                <li><button type="button" onClick={() => onOpenAuth('signup', 'classroom', 'educator')} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Educator Portal</button></li>
                <li><button type="button" onClick={() => onEnterArena()} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Instant Quick Play</button></li>
              </ul>
            </div>
          </div>

          {/* Legal & Copyright Row */}
          <div className="pt-8 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <strong className="text-slate-900 dark:text-white font-semibold">Oxyain</strong>
              <span>&middot; High-Speed 3D Esports Powered by Academic Mastery</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Apple HIG Design System</span>
              <span>&middot;</span>
              <span>WCAG 2.2 AA</span>
              <span>&middot;</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="hover:text-black dark:hover:text-white transition-colors cursor-pointer font-medium"
              >
                Theme: {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>

          {/* Liquid Glass Horizon Shelf & Grand OXYAIN Typography */}
          <div className="relative pt-6 pb-2 -mx-5 sm:-mx-8 overflow-hidden select-none pointer-events-none">
            {/* Top liquid glass horizon reflection line */}
            <div className="w-full h-px liquid-glass-horizon" />

            {/* Grand Oversized Liquid Glass Watermark Text covering the bottom of the footer */}
            <div className="w-full text-center overflow-hidden">
              <span className="block text-[15vw] sm:text-[17vw] lg:text-[18vw] font-black tracking-[-0.045em] leading-none text-center liquid-glass-text select-none">
                OXYAIN
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
