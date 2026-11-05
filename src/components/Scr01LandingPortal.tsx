import React, { useEffect, useRef, useState } from 'react';
import {
  AuthMode,
  AuthenticatedSession,
  BASE_SPEED_KMH,
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
 * Animated Micro-Canvas showcasing the live Oxyain application loop:
 * Answer Academic Question -> Velocity Change (+20 km/h, +30 km/h streak, -15 km/h stumble) -> Real-Time Track Overtake
 */
const HeroLoopMicroCanvas: React.FC<{
  onLaunchDiscipline: (sport: SportDiscipline) => void;
}> = ({ onLaunchDiscipline }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [demoSport, setDemoSport] = useState<SportDiscipline>('racing');
  const [simSpeed, setSimSpeed] = useState<number>(150);
  const [simStreak, setSimStreak] = useState<number>(2);
  const [simEventLabel, setSimEventLabel] = useState<string>('2x Win-Streak Active (+30 km/h Boost)');
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
      setSimEventLabel(`Incorrect Answer: -${WRONG_SPEED_PENALTY_KMH} km/h Stumble & Streak Reset`);
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

      // 1. Track Background Surface
      const isTartan = st.sport !== 'racing';
      ctx.fillStyle = isTartan ? '#451a03' : '#0b1324';
      ctx.fillRect(0, 0, w, h);

      // 2. Track Lanes & Scrolling Telemetry Grid
      const trackTop = 36;
      const trackBottom = h - 36;
      const trackHeight = trackBottom - trackTop;
      ctx.fillStyle = isTartan ? '#7c2d12' : '#111c33';
      ctx.fillRect(0, trackTop, w, trackHeight);

      // Top & Bottom FIA / Stadium Curbs
      for (let x = -64; x < w + 64; x += 32) {
        const drawX = x - (st.scrollOffset % 32);
        const even = Math.floor((x + 64) / 32) % 2 === 0;
        ctx.fillStyle = even ? '#06b6d4' : '#1e293b';
        ctx.fillRect(drawX, trackTop, 16, 6);
        ctx.fillRect(drawX, trackBottom - 6, 16, 6);
      }

      // Scrolling Distance Gate Markers
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1;
      for (let x = w + 64; x >= -64; x -= 64) {
        const gateX = x - st.scrollOffset;
        ctx.beginPath();
        ctx.moveTo(gateX, trackTop);
        ctx.lineTo(gateX, trackBottom);
        ctx.stroke();
      }

      // Center Lane Divider
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.22)';
      ctx.setLineDash([14, 14]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Optional Hurdles in Hurdle Mode
      if (st.sport === 'hurdles') {
        for (let x = 60; x < w + 64; x += 128) {
          const hx = ((x - st.scrollOffset * 2 + w) % w);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(hx - 3, trackTop + 18, 6, trackHeight / 2 - 26);
          ctx.fillRect(hx - 3, h / 2 + 10, 6, trackHeight / 2 - 26);
        }
      }

      // 3. Draw Rival Contender (Bottom Lane)
      const rivalPx = st.rivalX * w;
      const rivalPy = h * 0.67;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.fillRect(rivalPx - 58, rivalPy - 8, 48, 16);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(rivalPx - 24, rivalPy - 11, 48, 22, 5);
      ctx.fill();
      ctx.fillStyle = '#ffe4e6';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText('RIVAL · 135 km/h', rivalPx - 42, rivalPy + 24);

      // 4. Draw Player Contender (Top Lane) with Velocity Slipstream
      const playerPx = st.playerX * w;
      const playerPy = h * 0.33;

      const trailColor =
        st.status === 'stumble'
          ? 'rgba(244, 63, 94, 0.35)'
          : st.status === 'streak'
          ? 'rgba(245, 158, 11, 0.42)'
          : 'rgba(6, 182, 212, 0.38)';
      ctx.fillStyle = trailColor;
      const trailWidth = st.status === 'stumble' ? 28 : st.status === 'streak' ? 96 : 64;
      ctx.fillRect(playerPx - 26 - trailWidth, playerPy - 9, trailWidth, 18);

      ctx.fillStyle =
        st.status === 'stumble' ? '#ef4444' : st.status === 'streak' ? '#f59e0b' : '#06b6d4';
      ctx.beginPath();
      ctx.roundRect(playerPx - 26, playerPy - 12, 52, 24, 6);
      ctx.fill();

      // Cockpit / Visor highlight
      ctx.fillStyle = '#070b14';
      ctx.fillRect(playerPx - 4, playerPy - 7, 16, 14);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(`YOU · ${st.speedKmh} km/h (${st.streak}x)`, playerPx - 46, playerPy - 18);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      id="application-loop"
      className="flex flex-col justify-between h-full bg-[#0B1120] border border-slate-800 rounded-xl p-5 shadow-2xl"
    >
      {/* Top Micro-Canvas Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/90">
        <div className="text-sm font-bold text-white font-display">
          Live Race Simulator
        </div>

        {/* Sport Mode Switch inside the Simulator Toolbar */}
        <div
          className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800"
          role="group"
          aria-label="Micro-Canvas Sport Mode"
        >
          {(['racing', 'sprinting', 'hurdles'] as const).map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setDemoSport(sp)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                demoSport === sp
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {SPORT_CONFIGS[sp].shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Micro-Canvas Stage */}
      <div className="my-4 relative rounded-lg overflow-hidden border border-slate-800 bg-[#070B14]">
        <canvas
          ref={canvasRef}
          width={560}
          height={210}
          data-testid="scr01-micro-canvas"
          className="w-full h-[200px] block"
        />

        {/* Live Telemetry Readout Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/95 border-t border-slate-800/90 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <span className="whitespace-nowrap">
              SPEED: <strong className="text-cyan-400">{simSpeed} km/h</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              STREAK: <strong className="text-amber-400">{simStreak}x</strong>
            </span>
          </div>
          <span
            className={`truncate ${
              simStatus === 'stumble'
                ? 'text-rose-400 font-semibold'
                : simStatus === 'streak'
                ? 'text-amber-300 font-semibold'
                : 'text-emerald-400 font-semibold'
            }`}
          >
            {simEventLabel}
          </span>
        </div>
      </div>

      {/* Interactive Loop Trigger Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => triggerLoopEvent('correct')}
            className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            +20 km/h Correct
          </button>
          <button
            type="button"
            onClick={() => triggerLoopEvent('streak')}
            className="px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-mono font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            +30 km/h Streak
          </button>
          <button
            type="button"
            onClick={() => triggerLoopEvent('stumble')}
            className="px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            -15 km/h Stumble
          </button>
        </div>

        <div className="pt-2 flex items-center justify-end border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => onLaunchDiscipline(demoSport)}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
          >
            Launch {SPORT_CONFIGS[demoSport].shortLabel} in 3D
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
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');

  return (
    <div
      data-testid="scr01-landing-portal"
      className="fixed inset-0 z-30 overflow-y-auto bg-[#070B14]/92 text-slate-100 pointer-events-auto"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 md:px-10 py-4 bg-[#070B14]/95 border-b border-slate-800/90">
        {/* Wordmark */}
        <a
          href="#top"
          className="text-xl font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Oxyain
        </a>

        {/* Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {session ? (
            <button
              type="button"
              onClick={() => onEnterArena()}
              className="px-4 py-2 text-xs font-bold font-display text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Enter 3D Arena ({session.fullName})
            </button>
          ) : (
            <button
              type="button"
              data-testid="header-auth-cta"
              onClick={() => onOpenAuth('signup', 'contender')}
              className="px-4 py-2 text-xs font-bold font-display text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </header>

      {/* Main Marketing Portal Content Container */}
      <div id="top" className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16 space-y-24">
        {/* SECTION 1: Hero Proposition & Animated Micro-Canvas */}
        <section className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Core Value Proposition & Conversion CTA */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h1
                  className="font-bold text-white font-display tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                >
                  High-Speed 3D Esports Powered by Academic Mastery.
                </h1>

                <p className="text-base text-slate-300 leading-relaxed max-w-[60ch]">
                  Compete in 3D car racing, stadium sprinting, and championship hurdles driven by live multi-subject quizzes. Answer accurately to trigger speed boosts and overtake rivals in real time.
                </p>
              </div>

              {/* Primary CTA */}
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    data-start="true"
                    data-testid="hero-launch-arena-btn"
                    onClick={() => onEnterArena()}
                    className="px-5 py-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-display text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Play Now
                  </button>

                  <button
                    type="button"
                    data-testid="hero-custom-lobby-btn"
                    onClick={() => onOpenCustomLobby()}
                    className="px-5 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 text-cyan-300 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Host Multiplayer Room
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Animated Micro-Canvas Showcase */}
            <div className="lg:col-span-6">
              <HeroLoopMicroCanvas onLaunchDiscipline={(sp) => onEnterArena(sp)} />
            </div>
          </div>

          {/* Full-Width 4-Column KPI & Mechanics Strip Below Hero Split */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
            <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800/90">
              <div className="text-xs text-slate-400">Velocity Boost</div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
                +20 / +30 km/h
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800/90">
              <div className="text-xs text-slate-400">Mistake Penalty</div>
              <div className="text-xl font-bold font-mono text-rose-400 tabular-nums mt-1">
                -15 km/h
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800/90">
              <div className="text-xs text-slate-400">Match Formats</div>
              <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-1">
                5 · 10 · 20
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800/90">
              <div className="text-xs text-slate-400">Multiplayer Grids</div>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums mt-1">
                2 to 8 Racers
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Core Features */}
        <section id="capabilities" className="space-y-6">
          <h2
            className="text-2xl md:text-3xl font-bold text-white font-display"
            style={{ textWrap: 'balance' }}
          >
            Built for Competitive Play &amp; Classroom Mastery
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2">
              <h3 className="text-xl font-bold text-white font-display">
                Three 3D Athletic &amp; Motorsport Disciplines
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Switch between Formula Car Racing, 100m Stadium Sprinting, and 110m Hurdles. Every racer responds dynamically to your answers in real time.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2">
              <h3 className="text-xl font-bold text-white font-display">
                Five Academic Domains
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Covers{' '}
                {(['stem', 'literature', 'social', 'business', 'general'] as const)
                  .map((s) => SUBJECT_METADATA[s].label)
                  .join(', ')}{' '}
                across Easy, Medium, and Hard tiers.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2">
              <h3 className="text-xl font-bold text-white font-display">
                Flexible Match Lengths
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Choose <strong className="text-white">Sprint</strong> ({MATCH_LENGTHS.sprint.questionCount} Questions), <strong className="text-white">Circuit</strong> ({MATCH_LENGTHS.circuit.questionCount} Questions), or <strong className="text-white">Endurance</strong> ({MATCH_LENGTHS.endurance.questionCount} Questions).
              </p>
            </div>

            <div className="lg:col-span-2 p-6 rounded-xl bg-[#0B1120] border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white font-display">
                  Private &amp; Public Multiplayer Rooms
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Share a room code to race up to 4 players on Free, or unlock 8-racer Grand Prix grids and custom question packs with Pro.
                </p>
              </div>
              <div className="flex items-center justify-end pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onOpenCustomLobby()}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap cursor-pointer"
                >
                  Open Multiplayer Room
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Subscription Pricing Cards */}
        <section id="pricing" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <h2
              className="text-2xl md:text-3xl font-bold text-white font-display"
              style={{ textWrap: 'balance' }}
            >
              Select Your Plan
            </h2>

            {/* Interactive Billing Cycle Filter Control */}
            <div
              className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 self-start"
              role="group"
              aria-label="Billing Cycle"
            >
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Annual Billing (Save 20%)
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
                  className={`p-6 rounded-xl flex flex-col justify-between space-y-6 border ${
                    tier.highlighted
                      ? 'bg-[#0F172A] border-cyan-400'
                      : 'bg-[#0B1120] border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-slate-400">{tier.indexLabel}</div>
                      <h3 className="text-xl font-bold text-white font-display">{tier.name}</h3>
                      <div className="text-xs text-cyan-400">{tier.audience}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          data-testid={`pricing-amount-${tier.id}`}
                          className="text-3xl font-bold font-mono text-white tabular-nums"
                        >
                          ${effectivePrice}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          / month {effectivePrice > 0 && billingCycle === 'annual' ? '(billed annually)' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">{tier.summary}</p>
                    </div>

                    <ul className="space-y-2.5 pt-2 text-xs text-slate-200">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-cyan-400 font-mono font-bold">·</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    data-testid={`pricing-cta-${tier.id}`}
                    onClick={() => onOpenAuth('signup', tier.id, defaultRole)}
                    className={`w-full py-3 px-4 rounded-lg font-bold font-display text-xs tracking-wide transition-colors whitespace-nowrap cursor-pointer ${
                      tier.highlighted
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {tier.ctaLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quiet Footer */}
        <footer className="pt-8 pb-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <strong className="text-slate-200 font-display">Oxyain</strong> · 3D Academic Racing &amp; Quiz Suite
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => onOpenAuth('signin', 'contender')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onEnterArena()}
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
            >
              Enter 3D Arena
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
