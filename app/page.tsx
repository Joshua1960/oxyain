'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from '../src/context/ThemeContext';

const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="relative flex items-center justify-center">
        <div className="h-14 w-14 rounded-full border-2 border-slate-500/20 border-t-slate-800 dark:border-t-white animate-spin" />
        <span className="absolute font-bold text-xs tracking-widest text-slate-900 dark:text-white">OXY</span>
      </div>
      <p className="mt-4 text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Initializing Oxyain Arena...
      </p>
    </div>
  ),
});

export default function Page() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

