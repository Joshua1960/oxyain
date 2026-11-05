import React, { useState, useEffect } from 'react';
import {
  AuthMode,
  AuthenticatedSession,
  PRICING_TIERS,
  PricingTierId,
  StakeholderRole,
  validateAuthForm,
} from '../game/rules';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: AuthMode;
  initialTier: PricingTierId;
  initialRole?: StakeholderRole;
  onClose: () => void;
  onAuthenticated: (session: AuthenticatedSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  initialTier,
  initialRole = 'student',
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedTier, setSelectedTier] = useState<PricingTierId>(initialTier);
  const [role, setRole] = useState<StakeholderRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setSelectedTier(initialTier);
    setRole(initialRole);
    setError(null);
  }, [initialMode, initialTier, initialRole, isOpen]);

  if (!isOpen) return null;

  const activeTierObj = PRICING_TIERS.find((t) => t.id === selectedTier) || PRICING_TIERS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAuthForm({
      mode,
      email,
      password,
      fullName,
      role,
      selectedTier,
    });

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);
    const resolvedName =
      mode === 'signup'
        ? fullName.trim()
        : email.split('@')[0];

    onAuthenticated({
      id: `usr-${Date.now().toString(36)}`,
      fullName: resolvedName,
      email: email.trim(),
      role,
      tier: selectedTier,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
      data-testid="auth-modal"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 pointer-events-auto cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0B1120] border border-slate-700 rounded-xl shadow-2xl overflow-hidden cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono text-cyan-400">
              ACCOUNT ACCESS
            </div>
            <h2 id="auth-modal-heading" className="text-xl font-bold text-white font-display">
              {mode === 'signup'
                ? 'Create Your Oxyain Account'
                : 'Sign In to Oxyain'}
            </h2>
          </div>
          <button
            type="button"
            data-testid="auth-close-btn"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Mode Segmented Control */}
        <div className="px-6 pt-5">
          <div
            className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800"
            role="group"
            aria-label="Authentication Mode"
          >
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'signup'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'signin'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {/* Selected Subscription Plan Summary */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Plan: </span>
              <span className="font-semibold text-white">{activeTierObj.name}</span>
            </div>
            <span className="font-mono font-bold text-cyan-400 tabular-nums">
              ${activeTierObj.monthlyPriceUsd}/mo
            </span>
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-fullname" className="block text-xs font-medium text-slate-300 mb-1">
                Full Name
              </label>
              <input
                id="auth-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {error && (
            <p role="alert" data-testid="auth-error-msg" className="text-xs text-rose-400 font-medium">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="auth-submit-btn"
              className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-display tracking-wide transition-colors whitespace-nowrap cursor-pointer"
            >
              {mode === 'signup'
                ? 'Create Account & Enter'
                : 'Sign In & Enter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
