import React, { useState } from 'react';
import {
  AuthenticatedSession,
  evaluateQuestionGeneratorAccess,
} from '../game/rules';
import {
  CustomQuestionBank,
  CustomQuestionDraft,
  QuestionDifficultyId,
  QuestionItem,
  SUBJECT_METADATA,
  SharingVisibility,
  SubjectId,
  buildQuestionItemFromDraft,
  generateBankShareCode,
  validateCustomQuestionBank,
  validateCustomQuestionDraft,
} from '../game/questions';

interface Scr09QuestionGeneratorDashboardProps {
  isOpen: boolean;
  session: AuthenticatedSession | null;
  banks: CustomQuestionBank[];
  activeBankId: string;
  onSelectBank: (bankId: string) => void;
  onSaveBank: (bank: CustomQuestionBank) => void;
  onDeleteBank: (bankId: string) => void;
  onCloseToLobby: () => void;
  onLaunchRaceWithBank: (bank: CustomQuestionBank) => void;
  onOpenAuthModal: () => void;
  onQuickUnlockDemoPro: () => void;
  onOpenSourceExtractor?: () => void;
}

const SUBJECT_CHOICES: Exclude<SubjectId, 'all'>[] = [
  'stem',
  'literature',
  'social',
  'business',
  'general',
];

export const Scr09QuestionGeneratorDashboard: React.FC<
  Scr09QuestionGeneratorDashboardProps
> = ({
  isOpen,
  session,
  banks,
  activeBankId,
  onSelectBank,
  onSaveBank,
  onDeleteBank,
  onCloseToLobby,
  onLaunchRaceWithBank,
  onOpenAuthModal,
  onQuickUnlockDemoPro,
  onOpenSourceExtractor,
}) => {
  const activeBank =
    banks.find((b) => b.id === activeBankId) || banks[0];

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState<Exclude<SubjectId, 'all'>>(
    activeBank && activeBank.subject !== 'all' ? activeBank.subject : 'stem'
  );
  const [draftTopic, setDraftTopic] = useState<string>('Linear Kinematics');
  const [draftDifficulty, setDraftDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [draftPrompt, setDraftPrompt] = useState<string>('');
  const [draftOptions, setDraftOptions] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [draftCorrectIndex, setDraftCorrectIndex] = useState<0 | 1 | 2 | 3>(0);
  const [draftExplanation, setDraftExplanation] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [copiedShareCode, setCopiedShareCode] = useState<boolean>(false);

  if (!isOpen) return null;

  const accessGuard = evaluateQuestionGeneratorAccess(session);

  // ============================================================================
  // Route-Guarded Screen State for Unauthenticated / Guest Users
  // ============================================================================
  if (!accessGuard.allowed || !session) {
    return (
      <div
        data-testid="scr09-route-guard-gate"
        onClick={onCloseToLobby}
        className="fixed inset-0 z-30 bg-[#060A12]/95 backdrop-blur-xl overflow-y-auto flex items-center justify-center p-4 md:p-6 pointer-events-auto cursor-pointer"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-[#070B14]/95 border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 cursor-default"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <h1 className="text-2xl md:text-3xl font-bold font-display text-white">
              Question Generator
            </h1>
            <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold shrink-0">
              PRO
            </span>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            {accessGuard.reason}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              data-testid="scr09-gate-back-btn"
              onClick={onCloseToLobby}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                data-testid="scr09-gate-instant-pro-btn"
                onClick={onQuickUnlockDemoPro}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-bold font-display text-xs tracking-wide transition-all cursor-pointer"
              >
                Quick Demo Pro Unlock
              </button>
              <button
                type="button"
                data-testid="scr09-gate-login-btn"
                onClick={onOpenAuthModal}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-display text-xs tracking-wide transition-all shadow-lg shadow-amber-400/20 cursor-pointer active:scale-95"
              >
                Sign In to Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Authenticated Pro Workspace Handlers
  // ============================================================================
  const triggerToast = (msg: string) => {
    setSaveToast(msg);
    window.setTimeout(() => setSaveToast(null), 2600);
  };

  const handleCreateNewBank = () => {
    const newId = `bank-${Date.now()}`;
    const newBank: CustomQuestionBank = {
      id: newId,
      title: `Custom ${SUBJECT_METADATA[draftSubject].shortLabel} Tournament Bank`,
      description: 'Custom Pro question bank for multiplayer 3D academic heats.',
      subject: draftSubject,
      difficultyTier: draftDifficulty,
      visibility: 'private',
      shareCode: generateBankShareCode(),
      authorName: session.fullName,
      authorRole: session.role,
      updatedAt: new Date().toISOString().slice(0, 10),
      questions: [
        buildQuestionItemFromDraft({
          subject: 'stem',
          topic: 'Velocity & Algebra',
          difficultyTier: 'easy',
          prompt: 'If a race car accelerates from 100 km/h by +20 km/h on a correct answer, what is its new velocity?',
          options: ['110 km/h', '120 km/h', '130 km/h', '140 km/h'],
          correctIndex: 1,
          explanation: 'Adding the +20 km/h standard nitro boost to 100 km/h yields 120 km/h.',
        }),
      ],
    };
    onSaveBank(newBank);
    onSelectBank(newId);
    setEditingQuestionId(null);
    setFormError(null);
    triggerToast(`Created new question bank "${newBank.title}"`);
  };

  const handleUpdateBankMeta = (patch: Partial<CustomQuestionBank>) => {
    if (!activeBank) return;
    const updated: CustomQuestionBank = {
      ...activeBank,
      ...patch,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const check = validateCustomQuestionBank(updated);
    if (!check.valid && patch.title !== undefined && patch.title.trim().length === 0) {
      // Allow typing while showing error if needed
    }
    onSaveBank(updated);
  };

  const handleOptionChange = (idx: 0 | 1 | 2 | 3, value: string) => {
    setDraftOptions((prev) => {
      const next: [string, string, string, string] = [...prev] as [
        string,
        string,
        string,
        string,
      ];
      next[idx] = value;
      return next;
    });
    if (formError) setFormError(null);
  };

  const handleLoadQuestionForEdit = (q: QuestionItem) => {
    setEditingQuestionId(q.id);
    setDraftSubject(q.subject);
    setDraftTopic(q.topic);
    setDraftDifficulty(q.difficultyTier);
    setDraftPrompt(q.prompt);
    setDraftOptions([...q.options] as [string, string, string, string]);
    setDraftCorrectIndex(q.correctIndex);
    setDraftExplanation(q.explanation);
    setFormError(null);
  };

  const handleResetQuestionForm = () => {
    setEditingQuestionId(null);
    setDraftPrompt('');
    setDraftOptions(['', '', '', '']);
    setDraftCorrectIndex(0);
    setDraftExplanation('');
    setFormError(null);
  };

  const handleSaveQuestionToBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBank) return;

    const draft: CustomQuestionDraft = {
      subject: draftSubject,
      topic: draftTopic,
      difficultyTier: draftDifficulty,
      prompt: draftPrompt,
      options: draftOptions,
      correctIndex: draftCorrectIndex,
      explanation: draftExplanation,
    };

    const validation = validateCustomQuestionDraft(draft);
    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }

    setFormError(null);
    const builtItem = buildQuestionItemFromDraft(
      draft,
      editingQuestionId || undefined
    );

    const nextQuestions = editingQuestionId
      ? activeBank.questions.map((q) => (q.id === editingQuestionId ? builtItem : q))
      : [...activeBank.questions, builtItem];

    const updatedBank: CustomQuestionBank = {
      ...activeBank,
      questions: nextQuestions,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    onSaveBank(updatedBank);
    triggerToast(
      editingQuestionId
        ? 'Updated question configuration in bank.'
        : `Added Question #${nextQuestions.length} to "${activeBank.title}".`
    );
    handleResetQuestionForm();
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (!activeBank) return;
    if (activeBank.questions.length <= 1) {
      setFormError('A question bank must retain at least 1 question.');
      return;
    }
    const updatedBank: CustomQuestionBank = {
      ...activeBank,
      questions: activeBank.questions.filter((q) => q.id !== questionId),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onSaveBank(updatedBank);
    if (editingQuestionId === questionId) {
      handleResetQuestionForm();
    }
    triggerToast('Removed question from bank.');
  };

  const handleCopyShareCode = () => {
    if (!activeBank) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(activeBank.shareCode).catch(() => {});
    }
    setCopiedShareCode(true);
    window.setTimeout(() => setCopiedShareCode(false), 1800);
  };

  const totalQuestionsAcrossBanks = banks.reduce(
    (sum, b) => sum + b.questions.length,
    0
  );

  return (
    <div
      data-testid="scr09-generator-dashboard"
      onClick={onCloseToLobby}
      className="fixed inset-0 z-30 bg-[#060A12]/95 backdrop-blur-xl overflow-y-auto p-4 md:p-6 pointer-events-auto text-slate-100 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-7xl mx-auto space-y-4 cursor-default"
      >
        {/* Top Perimeter Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#070B14]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-4 shadow-xl">
          <h1 className="text-xl md:text-2xl font-bold font-display text-white">
            Question Generator
          </h1>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden xl:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
              <span className="text-emerald-300 font-semibold">
                PRO: {session.fullName}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{banks.length} Banks</span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-300">{totalQuestionsAcrossBanks} Total Qs</span>
            </div>

            {onOpenSourceExtractor && (
              <button
                type="button"
                data-testid="scr09-open-scr10-btn"
                onClick={onOpenSourceExtractor}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-xs font-semibold text-emerald-300 transition-colors cursor-pointer"
              >
                AI Source Extractor
              </button>
            )}

            <button
              type="button"
              data-testid="scr09-back-to-lobby-btn"
              onClick={onCloseToLobby}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>

            {activeBank && (
              <button
                type="button"
                data-testid="scr09-launch-with-bank-btn"
                onClick={() => onLaunchRaceWithBank(activeBank)}
                className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold font-display text-xs tracking-wide transition-all shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95"
              >
                Launch 3D Race with This Bank ({activeBank.questions.length} Qs)
              </button>
            )}
          </div>
        </div>

        {/* Main 12-Column Question Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN (3 Cols): Question Bank Selector + Sharing Configuration (Private / Public) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Saved Question Banks List */}
            <div className="bg-[#070B14]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Question Banks ({banks.length})
                </span>
                <button
                  type="button"
                  data-testid="scr09-new-bank-btn"
                  onClick={handleCreateNewBank}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  + New Bank
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {banks.map((bank) => {
                  const isSelected = activeBank && bank.id === activeBank.id;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      data-testid={`scr09-bank-item-${bank.id}`}
                      onClick={() => {
                        onSelectBank(bank.id);
                        setEditingQuestionId(null);
                        setFormError(null);
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400/70 text-white shadow-sm'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold font-display truncate">
                          {bank.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                            bank.visibility === 'public'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {bank.visibility === 'public' ? '🌐 PUBLIC' : '🔒 PRIVATE'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>{SUBJECT_METADATA[bank.subject].shortLabel}</span>
                        <span>
                          {bank.questions.length} Qs · {bank.shareCode}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Bank Metadata & Sharing Configuration (Private / Public) */}
            {activeBank && (
              <div className="bg-[#070B14]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-5 space-y-3.5">
                <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  Bank Details &amp; Sharing
                </div>

                <div>
                  <label
                    htmlFor="scr09-bank-title"
                    className="block text-[11px] font-mono text-slate-400 mb-1"
                  >
                    QUESTION BANK TITLE
                  </label>
                  <input
                    id="scr09-bank-title"
                    data-testid="scr09-bank-title-input"
                    type="text"
                    value={activeBank.title}
                    onChange={(e) => handleUpdateBankMeta({ title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="scr09-bank-desc"
                    className="block text-[11px] font-mono text-slate-400 mb-1"
                  >
                    DESCRIPTION
                  </label>
                  <textarea
                    id="scr09-bank-desc"
                    data-testid="scr09-bank-desc-input"
                    rows={2}
                    value={activeBank.description}
                    onChange={(e) => handleUpdateBankMeta({ description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                  />
                </div>

                {/* Sharing Configuration: Private vs Public */}
                <div>
                  <span className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    SHARING ACCESS
                  </span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sharing Visibility">
                    {(['private', 'public'] as SharingVisibility[]).map((vis) => {
                      const active = activeBank.visibility === vis;
                      return (
                        <button
                          key={vis}
                          type="button"
                          data-testid={`scr09-visibility-${vis}`}
                          onClick={() => {
                            handleUpdateBankMeta({ visibility: vis });
                            triggerToast(
                              `Sharing set to ${vis.toUpperCase()} (${activeBank.shareCode})`
                            );
                          }}
                          aria-pressed={active}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? vis === 'public'
                                ? 'bg-emerald-500/15 border-emerald-400 text-white'
                                : 'bg-amber-500/15 border-amber-400 text-white'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/15'
                          }`}
                        >
                          <div className="text-xs font-bold font-display">
                            {vis === 'private' ? '🔒 Private' : '🌐 Public'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {vis === 'private' ? 'Invite Code Only' : 'Community Listed'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Share Code & Delete Bank Row */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="text-xs font-mono">
                    <span className="text-slate-400">Code: </span>
                    <span
                      data-testid="scr09-share-code-value"
                      className="text-cyan-300 font-bold"
                    >
                      {activeBank.shareCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyShareCode}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-cyan-300 cursor-pointer transition-colors"
                    >
                      {copiedShareCode ? 'Copied!' : 'Copy Code'}
                    </button>
                    {banks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteBank(activeBank.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-mono text-rose-300 cursor-pointer transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER COLUMN (5 Cols): Individual Question & 4-Option Multiple-Choice Builder Form */}
          <div className="lg:col-span-5 bg-[#070B14]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold font-display text-white">
                {editingQuestionId ? 'Edit Question' : 'Add Question'}
              </h2>
              {editingQuestionId && (
                <button
                  type="button"
                  onClick={handleResetQuestionForm}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 cursor-pointer transition-colors"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveQuestionToBank} className="space-y-4" noValidate>
              {/* Subject, Difficulty Tier & Topic Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="scr09-q-subject"
                    className="block text-[10px] font-mono text-slate-400 mb-1"
                  >
                    SUBJECT DOMAIN
                  </label>
                  <select
                    id="scr09-q-subject"
                    data-testid="scr09-subject-select"
                    value={draftSubject}
                    onChange={(e) =>
                      setDraftSubject(e.target.value as Exclude<SubjectId, 'all'>)
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all cursor-pointer"
                  >
                    {SUBJECT_CHOICES.map((sId) => (
                      <option key={sId} value={sId} className="bg-slate-950 text-white">
                        {SUBJECT_METADATA[sId].shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="scr09-q-difficulty"
                    className="block text-[10px] font-mono text-slate-400 mb-1"
                  >
                    DIFFICULTY TIER
                  </label>
                  <select
                    id="scr09-q-difficulty"
                    data-testid="scr09-difficulty-select"
                    value={draftDifficulty}
                    onChange={(e) =>
                      setDraftDifficulty(e.target.value as 'easy' | 'medium' | 'hard')
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all cursor-pointer"
                  >
                    <option value="easy" className="bg-slate-950 text-white">Easy (Foundation)</option>
                    <option value="medium" className="bg-slate-950 text-white">Medium (Varsity)</option>
                    <option value="hard" className="bg-slate-950 text-white">Hard (Olympiad)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="scr09-q-topic"
                    className="block text-[10px] font-mono text-slate-400 mb-1"
                  >
                    ACADEMIC TOPIC TAG
                  </label>
                  <input
                    id="scr09-q-topic"
                    data-testid="scr09-topic-input"
                    type="text"
                    value={draftTopic}
                    onChange={(e) => setDraftTopic(e.target.value)}
                    placeholder="e.g., Derivatives"
                    className="w-full px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                  />
                </div>
              </div>

              {/* Individual Question Prompt */}
              <div>
                <label
                  htmlFor="scr09-q-prompt"
                  className="block text-[11px] font-mono text-cyan-300 mb-1"
                >
                  QUESTION PROMPT
                </label>
                <textarea
                  id="scr09-q-prompt"
                  data-testid="scr09-prompt-input"
                  rows={2}
                  value={draftPrompt}
                  onChange={(e) => {
                    setDraftPrompt(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Enter the academic question prompt displayed on the split-screen race deck..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs md:text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                />
              </div>

              {/* 4 Multiple-Choice Text Configurations & Target Correct Index Designation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-300 font-semibold">
                    ANSWER OPTIONS
                  </span>
                  <span className="text-emerald-400 font-bold">
                    Correct: Option #{draftCorrectIndex + 1}
                  </span>
                </div>

                {([0, 1, 2, 3] as const).map((optIdx) => {
                  const isTargetCorrect = draftCorrectIndex === optIdx;
                  const optionLetter = ['A', 'B', 'C', 'D'][optIdx];
                  return (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                        isTargetCorrect
                          ? 'bg-emerald-500/10 border-emerald-400/40'
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid={`scr09-correct-index-${optIdx}`}
                        onClick={() => setDraftCorrectIndex(optIdx)}
                        aria-pressed={isTargetCorrect}
                        title={`Set Option ${optionLetter} as Correct Answer`}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold shrink-0 transition-colors cursor-pointer ${
                          isTargetCorrect
                            ? 'bg-emerald-400 text-slate-950 shadow-sm'
                            : 'bg-white/10 hover:bg-white/15 text-slate-300'
                        }`}
                      >
                        {isTargetCorrect ? `✓ Option ${optionLetter}` : `Option ${optionLetter}`}
                      </button>

                      <input
                        type="text"
                        data-testid={`scr09-option-input-${optIdx}`}
                        value={draftOptions[optIdx]}
                        onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                        placeholder={`Option ${optionLetter} text...`}
                        aria-label={`Multiple-choice Option ${optIdx + 1}`}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Academic Explanation Input */}
              <div>
                <label
                  htmlFor="scr09-q-explanation"
                  className="block text-[11px] font-mono text-amber-300 mb-1"
                >
                  EXPLANATION
                </label>
                <textarea
                  id="scr09-q-explanation"
                  data-testid="scr09-explanation-input"
                  rows={2}
                  value={draftExplanation}
                  onChange={(e) => {
                    setDraftExplanation(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Explain why the correct answer is right..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  data-testid="scr09-form-error"
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200"
                >
                  {formError}
                </div>
              )}

              {saveToast && (
                <div
                  role="status"
                  data-testid="scr09-save-toast"
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 font-mono"
                >
                  ✓ {saveToast}
                </div>
              )}

              <button
                type="submit"
                data-testid="scr09-save-question-btn"
                className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold font-display text-xs md:text-sm tracking-wide transition-all shadow-lg shadow-emerald-400/20 cursor-pointer active:scale-95"
              >
                {editingQuestionId
                  ? 'Save Question Configuration Changes'
                  : '+ Add Question to Active Bank'}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN (4 Cols): Active Bank Question Roster Inspector */}
          <div className="lg:col-span-4 bg-[#070B14]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  Questions in Bank
                </div>
                <div className="text-xs text-slate-400">
                  {activeBank
                    ? `${activeBank.questions.length} Questions in "${activeBank.title}"`
                    : 'Select a bank'}
                </div>
              </div>
              {activeBank && (
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-cyan-300">
                  {activeBank.shareCode}
                </span>
              )}
            </div>

            {activeBank && (
              <div
                data-testid="scr09-question-list"
                className="space-y-3 max-h-[540px] overflow-y-auto pr-1"
              >
                {activeBank.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    data-testid={`scr09-question-card-${qIdx}`}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-cyan-400 font-bold">
                        Q{qIdx + 1} · {q.subjectLabel} · {q.topic}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                        {q.difficulty}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-white leading-snug">
                      {q.prompt}
                    </p>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {q.options.map((optText, oIdx) => {
                        const isCorrect = q.correctIndex === oIdx;
                        return (
                          <div
                            key={oIdx}
                            className={`px-2.5 py-1.5 rounded-lg border truncate transition-colors ${
                              isCorrect
                                ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300 font-semibold'
                                : 'bg-black/30 border-white/5 text-slate-400'
                            }`}
                          >
                            [{oIdx}] {optText} {isCorrect ? '✓' : ''}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-400 bg-black/40 px-3 py-2 rounded-lg border border-white/5">
                      <span className="font-mono text-amber-300">Explanation: </span>
                      {q.explanation}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`scr09-edit-question-${qIdx}`}
                        onClick={() => handleLoadQuestionForEdit(q)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-cyan-300 cursor-pointer transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-testid={`scr09-delete-question-${qIdx}`}
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-mono text-rose-300 cursor-pointer transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
