import React, { useState } from 'react';
import { QUESTION_BANK, SUBJECT_METADATA, SubjectId } from '../game/questions';
import {
  BASE_SPEED_KMH,
  CORRECT_SPEED_BOOST_KMH,
  MATCH_LENGTHS,
  STREAK_SPEED_BOOST_KMH,
  WRONG_SPEED_PENALTY_KMH,
} from '../game/rules';

interface CurriculumDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CurriculumDrawerModal: React.FC<CurriculumDrawerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [filterSubject, setFilterSubject] = useState<SubjectId>('all');

  if (!isOpen) return null;

  const filteredQuestions =
    filterSubject === 'all'
      ? QUESTION_BANK
      : QUESTION_BANK.filter((q) => q.subject === filterSubject);

  const filterTabs: SubjectId[] = ['all', 'stem', 'literature', 'social', 'business', 'general'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="curriculum-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 pointer-events-auto cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#0B1120] border border-slate-700 rounded-xl shadow-2xl overflow-hidden cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="curriculum-modal-title" className="text-lg font-bold text-white font-display">
              Question Bank &amp; Game Rules
            </h2>
            <p className="text-xs text-slate-400">
              Browse questions across all five subjects
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Mechanics & Match Formats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Velocity & Streak Physics</div>
              <div className="text-sm font-semibold text-white mb-2">
                Base Cruise: <span className="font-mono tabular-nums text-cyan-400">{BASE_SPEED_KMH} km/h</span>
              </div>
              <div className="text-xs text-slate-300 space-y-1 font-mono tabular-nums">
                <div>1st Correct: +{CORRECT_SPEED_BOOST_KMH} km/h</div>
                <div>Win-Streak (2+): +{STREAK_SPEED_BOOST_KMH} km/h / Q</div>
                <div>Incorrect Answer: -{WRONG_SPEED_PENALTY_KMH} km/h &amp; Reset</div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Tournament Match Formats</div>
              <div className="text-xs text-slate-200 space-y-1.5 font-mono tabular-nums mt-2">
                <div>
                  Sprint: {MATCH_LENGTHS.sprint.questionCount} Qs · {MATCH_LENGTHS.sprint.durationLabel}
                </div>
                <div>
                  Circuit: {MATCH_LENGTHS.circuit.questionCount} Qs · {MATCH_LENGTHS.circuit.durationLabel}
                </div>
                <div>
                  Endurance: {MATCH_LENGTHS.endurance.questionCount} Qs · {MATCH_LENGTHS.endurance.durationLabel}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Educator & Investor Highlights</div>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                Deterministic room seeding ensures both 1v1 competitors receive identical academic question sequences. Immediate post-answer explanations reinforce retention.
              </p>
            </div>
          </div>

          {/* Interactive Subject Filter Bar */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-white">
                Verified Question Bank ({filteredQuestions.length} Items)
              </h3>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterSubject(tab)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      filterSubject === tab
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {SUBJECT_METADATA[tab].shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800/90 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {String(idx + 1).padStart(2, '0')}. {q.subjectLabel} · {q.topic} · {q.difficulty}
                    </span>
                    <span className="font-mono text-emerald-400">
                      Answer: {q.options[q.correctIndex]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-100">{q.prompt}</p>
                  <p className="text-xs text-slate-400">{q.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
