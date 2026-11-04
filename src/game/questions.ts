export type SubjectId = 'stem' | 'literature' | 'social' | 'business' | 'general' | 'all';
export type QuestionDifficultyId = 'easy' | 'medium' | 'hard' | 'all';

export interface QuestionItem {
  id: string;
  subject: Exclude<SubjectId, 'all'>;
  subjectLabel: string;
  topic: string;
  difficulty: 'Foundation' | 'Varsity' | 'Olympiad';
  difficultyTier: 'easy' | 'medium' | 'hard';
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export const DIFFICULTY_METADATA: Record<
  QuestionDifficultyId,
  { id: QuestionDifficultyId; label: string; shortLabel: string; description: string }
> = {
  easy: {
    id: 'easy',
    label: 'Easy (Basic Maths & Foundation)',
    shortLabel: 'Easy',
    description: 'Mental maths, arithmetic, ratios, basic geometry, and core foundational facts',
  },
  medium: {
    id: 'medium',
    label: 'Medium (Varsity Standard)',
    shortLabel: 'Medium',
    description: 'Multi-step algebra, kinematics, applied economics, and analytical literature',
  },
  hard: {
    id: 'hard',
    label: 'Hard (Olympiad & Advanced)',
    shortLabel: 'Hard',
    description: 'Calculus, electromagnetism, game theory, and championship-grade synthesis',
  },
  all: {
    id: 'all',
    label: 'Progressive (Easy → Hard)',
    shortLabel: 'Mixed',
    description: 'Starts with approachable Easy questions and scales into Medium and Hard challenges',
  },
};

export const SUBJECT_METADATA: Record<
  SubjectId,
  { id: SubjectId; label: string; shortLabel: string; description: string; accentColor: string }
> = {
  all: {
    id: 'all',
    label: 'All-Rounder Championship',
    shortLabel: 'All Subjects',
    description: 'Cross-disciplinary decathlon blending all five academic domains',
    accentColor: '#06B6D4',
  },
  stem: {
    id: 'stem',
    label: 'STEM & Mathematics',
    shortLabel: 'STEM & Maths',
    description: 'Arithmetic, algebra, geometry, physics, chemistry, and computer science',
    accentColor: '#0EA5E9',
  },
  literature: {
    id: 'literature',
    label: 'Languages & Literature',
    shortLabel: 'Literature',
    description: 'Grammar, vocabulary, world classics, rhetoric, and poetic meter',
    accentColor: '#F59E0B',
  },
  social: {
    id: 'social',
    label: 'Social Sciences',
    shortLabel: 'Social Sci',
    description: 'Civics, world history, political philosophy, psychology, and geography',
    accentColor: '#10B981',
  },
  business: {
    id: 'business',
    label: 'Business & Finance',
    shortLabel: 'Finance',
    description: 'Percentages, profit margins, capital markets, accounting, and strategy',
    accentColor: '#8B5CF6',
  },
  general: {
    id: 'general',
    label: 'General Knowledge',
    shortLabel: 'General',
    description: 'Global landmarks, scientific breakthroughs, Olympic records, and fine arts',
    accentColor: '#F43F5E',
  },
};

export const QUESTION_BANK: QuestionItem[] = [
  // ======================== STEM & MATHEMATICS (EASY -> HARD) ========================
  {
    id: 'math-easy-1',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Mental Arithmetic',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'What is 15% of 200?',
    options: ['25', '30', '35', '45'],
    correctIndex: 1,
    explanation: '10% of 200 is 20, and 5% of 200 is 10. Adding them gives 20 + 10 = 30.',
  },
  {
    id: 'math-easy-2',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Linear Equations',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'Solve for x in the equation: 3x + 7 = 28',
    options: ['x = 5', 'x = 7', 'x = 9', 'x = 11'],
    correctIndex: 1,
    explanation: 'Subtract 7 from both sides to get 3x = 21, then divide by 3 to get x = 7.',
  },
  {
    id: 'math-easy-3',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Geometry & Area',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'What is the area of a right-angled triangle with a base of 10 meters and a height of 6 meters?',
    options: ['16 m²', '30 m²', '60 m²', '45 m²'],
    correctIndex: 1,
    explanation: 'The area of a triangle is ½ × base × height = ½ × 10 × 6 = 30 m².',
  },
  {
    id: 'math-easy-4',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Speed, Distance & Time',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'If a sprinter runs 100 meters in 10 seconds, what is their average speed in meters per second?',
    options: ['8 m/s', '10 m/s', '12 m/s', '100 m/s'],
    correctIndex: 1,
    explanation: 'Average speed = Distance ÷ Time = 100 m ÷ 10 s = 10 m/s.',
  },
  {
    id: 'math-easy-5',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Order of Operations',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'Evaluate the expression: 8² - 4 × 5',
    options: ['44', '300', '24', '54'],
    correctIndex: 0,
    explanation: 'Following PEMDAS/BODMAS: 8² = 64, and 4 × 5 = 20. Then 64 - 20 = 44.',
  },
  {
    id: 'stem-1',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Classical Mechanics',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'If a race car doubles its velocity while keeping mass constant, by what factor does its kinetic energy increase?',
    options: ['2x (Doubles)', '4x (Quadruples)', '8x (Octuples)', '1.41x (Square root of 2)'],
    correctIndex: 1,
    explanation: 'Kinetic energy is KE = ½mv². Doubling velocity (2v)² increases kinetic energy by a factor of 4.',
  },
  {
    id: 'stem-2',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Chemical Thermodynamics',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'Which condition guarantees that a chemical reaction is spontaneous at all temperatures?',
    options: [
      'ΔH < 0 (Exothermic) and ΔS > 0',
      'ΔH > 0 (Endothermic) and ΔS < 0',
      'ΔH > 0 (Endothermic) and ΔS > 0',
      'ΔH < 0 (Exothermic) and ΔS < 0',
    ],
    correctIndex: 0,
    explanation: 'Gibbs free energy ΔG = ΔH - TΔS is always negative (spontaneous) when ΔH < 0 and ΔS > 0.',
  },
  {
    id: 'stem-3',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Computer Science',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'What is the worst-case time complexity of binary search on a sorted array of n elements?',
    options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(1)'],
    correctIndex: 2,
    explanation: 'Binary search halves the search interval on each comparison, yielding logarithmic O(log n) time.',
  },
  {
    id: 'stem-4',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Calculus & Kinematics',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'A sprinter’s position is given by s(t) = 3t² + 2t meters. What is their instantaneous velocity at t = 4 seconds?',
    options: ['24 m/s', '26 m/s', '56 m/s', '14 m/s'],
    correctIndex: 1,
    explanation: 'Velocity is the first derivative v(t) = s\'(t) = 6t + 2. At t = 4, v(4) = 6(4) + 2 = 26 m/s.',
  },
  {
    id: 'stem-5',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Molecular Biology',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'During high-intensity sprinting, which molecule directly donates a phosphate group to regenerate ATP in skeletal muscle?',
    options: ['Phosphocreatine (Creatine Phosphate)', 'Triglyceride Lipase', 'Deoxyribose', 'Cellulose'],
    correctIndex: 0,
    explanation: 'The phosphagen system uses phosphocreatine (PCr) catalyzed by creatine kinase for rapid ATP resynthesis.',
  },
  {
    id: 'stem-6',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Electromagnetism',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'According to Faraday’s Law of Induction, the induced electromotive force in a closed loop is proportional to:',
    options: [
      'The steady magnetic field strength B',
      'The negative rate of change of magnetic flux (-dΦB/dt)',
      'The square of loop resistance R²',
      'The permittivity of free space ε₀',
    ],
    correctIndex: 1,
    explanation: 'Faraday’s law states ε = -dΦB/dt: voltage is induced only when magnetic flux through the circuit changes over time.',
  },
  {
    id: 'stem-7',
    subject: 'stem',
    subjectLabel: 'STEM & Maths',
    topic: 'Integral Calculus',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'What is the definite integral of f(x) = 3x² from x = 0 to x = 4?',
    options: ['48', '64', '16', '32'],
    correctIndex: 1,
    explanation: 'The antiderivative of 3x² is x³. Evaluating from 0 to 4 gives 4³ - 0³ = 64.',
  },

  // ======================== LANGUAGES & LITERATURE ========================
  {
    id: 'lit-1',
    subject: 'literature',
    subjectLabel: 'Languages & Literature',
    topic: 'Rhetorical Devices',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'Which rhetorical figure reverses the grammatical structure of successive clauses, such as "Ask not what your country can do for you—ask what you can do for your country"?',
    options: ['Chiasmus (Antimetabole)', 'Synecdoche', 'Litotes', 'Zeugma'],
    correctIndex: 0,
    explanation: 'Chiasmus (and specifically antimetabole) inverts parallel words or clauses in an A-B-B-A mirror structure.',
  },
  {
    id: 'lit-2',
    subject: 'literature',
    subjectLabel: 'Languages & Literature',
    topic: 'World Literature',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'Which Colombian Nobel laureate authored "One Hundred Years of Solitude", chronicling the Buendía family in Macondo?',
    options: ['Jorge Luis Borges', 'Gabriel García Márquez', 'Mario Vargas Llosa', 'Octavio Paz'],
    correctIndex: 1,
    explanation: 'Gabriel García Márquez published Cien años de soledad in 1967, a landmark of magical realism.',
  },
  {
    id: 'lit-3',
    subject: 'literature',
    subjectLabel: 'Languages & Literature',
    topic: 'Classical Epic Poetry',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'In Homer’s Odyssey, what Greek term denotes the hero’s "homecoming" journey across the sea?',
    options: ['Nostos', 'Hubris', 'Catharsis', 'Peripeteia'],
    correctIndex: 0,
    explanation: 'Nostos (νόστος) refers to a heroic return home by sea, the root of the English word "nostalgia".',
  },
  {
    id: 'lit-4',
    subject: 'literature',
    subjectLabel: 'Languages & Literature',
    topic: 'Historical Linguistics',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'Which systematic phonetic shift explains why Proto-Indo-European *pater became English "father" while Latin retained "pater"?',
    options: ['Grimm’s Law', 'Sapir-Whorf Hypothesis', 'Chomsky Hierarchy', 'Zipf’s Law'],
    correctIndex: 0,
    explanation: 'Grimm’s Law describes the First Germanic Sound Shift where voiceless stops (*p, *t, *k) became fricatives (f, θ, h).',
  },
  {
    id: 'lit-5',
    subject: 'literature',
    subjectLabel: 'Languages & Literature',
    topic: 'Shakespearean Drama',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'Unrhymed iambic pentameter—consisting of five unstressed-stressed syllable pairs per line—is formally known as:',
    options: ['Blank Verse', 'Free Verse', 'Heroic Couplets', 'Villanelle'],
    correctIndex: 0,
    explanation: 'Blank verse is unrhymed iambic pentameter, the primary dramatic meter of Shakespeare and Milton.',
  },

  // ======================== SOCIAL SCIENCES ========================
  {
    id: 'soc-1',
    subject: 'social',
    subjectLabel: 'Social Sciences',
    topic: 'Cognitive Psychology',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'In Daniel Kahneman and Amos Tversky’s Prospect Theory, people typically experience the pain of a loss as:',
    options: [
      'Roughly twice as powerful as the pleasure of an equivalent gain',
      'Equal in magnitude to an equivalent gain',
      'Negligible when framed in percentages',
      'Only relevant in long-term horizons',
    ],
    correctIndex: 0,
    explanation: 'Loss aversion demonstrates that losses loom larger than gains of equal nominal value.',
  },
  {
    id: 'soc-2',
    subject: 'social',
    subjectLabel: 'Social Sciences',
    topic: 'Political Philosophy',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'In John Rawls’s "A Theory of Justice", principles of fairness are chosen behind a hypothetical device called the:',
    options: ['Veil of Ignorance', 'Panopticon', 'Leviathan', 'Allegory of the Cave'],
    correctIndex: 0,
    explanation: 'Behind the Veil of Ignorance, decision-makers do not know their own class, status, or abilities in society.',
  },
  {
    id: 'soc-3',
    subject: 'social',
    subjectLabel: 'Social Sciences',
    topic: 'Economic & World History',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'Which 1648 treaties ended the Thirty Years’ War and established the modern principle of state sovereignty?',
    options: ['Peace of Westphalia', 'Treaty of Tordesillas', 'Congress of Vienna', 'Treaty of Utrecht'],
    correctIndex: 0,
    explanation: 'The Peace of Westphalia (1648) laid the foundation for the Westphalian system of sovereign nation-states.',
  },
  {
    id: 'soc-4',
    subject: 'social',
    subjectLabel: 'Social Sciences',
    topic: 'Demographic Geography',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'In Stage 2 of the Demographic Transition Model, rapid population growth is primarily driven by:',
    options: [
      'A sharp decline in death rates while birth rates remain high',
      'A surge in birth rates accompanied by rising mortality',
      'Zero net migration combined with sub-replacement fertility',
      'De-urbanization into agrarian settlements',
    ],
    correctIndex: 0,
    explanation: 'Improved sanitation, food supply, and medicine lower mortality rapidly before fertility norms adjust downward.',
  },
  {
    id: 'soc-5',
    subject: 'social',
    subjectLabel: 'Social Sciences',
    topic: 'Sociology & Networks',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'Sociologist Mark Granovetter famously demonstrated that novel job opportunities and information diffuse fastest through:',
    options: ['The Strength of Weak Ties', 'Echo Chambers of Strong Kinship', 'Command Hierarchies', 'Dunbar’s Inner 5'],
    correctIndex: 0,
    explanation: 'Acquaintances ("weak ties") bridge separate social clusters, carrying non-redundant information across networks.',
  },

  // ======================== BUSINESS & FINANCE ========================
  {
    id: 'biz-easy-1',
    subject: 'business',
    subjectLabel: 'Business & Finance',
    topic: 'Profit & Margin Maths',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'A product costs $60 to manufacture and sells for $100. What is the gross profit margin percentage?',
    options: ['40%', '60%', '66.7%', '25%'],
    correctIndex: 0,
    explanation: 'Gross profit is $100 - $60 = $40. Gross margin = ($40 ÷ $100) × 100% = 40%.',
  },
  {
    id: 'biz-1',
    subject: 'business',
    subjectLabel: 'Business & Finance',
    topic: 'Corporate Valuation',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'When central banks raise benchmark interest rates, what happens to the Net Present Value (NPV) of distant future cash flows?',
    options: [
      'NPV decreases because the discount rate in the denominator rises',
      'NPV increases proportionally with the coupon rate',
      'NPV remains invariant to discount rates',
      'NPV turns infinite',
    ],
    correctIndex: 0,
    explanation: 'Present Value = CF / (1 + r)^t. A higher discount rate r reduces the present value of future cash flows.',
  },
  {
    id: 'biz-2',
    subject: 'business',
    subjectLabel: 'Business & Finance',
    topic: 'SaaS & Venture Metrics',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'A software company acquires customers for $400 (CAC) and earns $100/month gross margin with 5% monthly churn. What is its LTV:CAC ratio?',
    options: ['5.0x ($2,000 LTV / $400 CAC)', '2.5x ($1,000 LTV / $400 CAC)', '1.25x ($500 LTV / $400 CAC)', '10.0x ($4,000 LTV / $400 CAC)'],
    correctIndex: 0,
    explanation: 'LTV = Gross Margin / Churn = $100 / 0.05 = $2,000. Dividing $2,000 by $400 CAC yields a 5.0x LTV:CAC ratio.',
  },
  {
    id: 'biz-3',
    subject: 'business',
    subjectLabel: 'Business & Finance',
    topic: 'Financial Accounting',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'Which financial metric measures operating cash profitability before capital structure and tax differences by adding back D&A to operating income?',
    options: ['EBITDA', 'Current Ratio', 'Working Capital Turnover', 'Return on Equity (ROE)'],
    correctIndex: 0,
    explanation: 'EBITDA stands for Earnings Before Interest, Taxes, Depreciation, and Amortization.',
  },
  {
    id: 'biz-4',
    subject: 'business',
    subjectLabel: 'Business & Finance',
    topic: 'Game Theory & Strategy',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'A strategic state in which no player can improve their payoff by unilaterally changing their strategy is known as a:',
    options: ['Nash Equilibrium', 'Pareto Frontier', 'Giffen Paradox', 'Coase Theorem'],
    correctIndex: 0,
    explanation: 'Formulated by John Nash, a Nash Equilibrium occurs when each player’s strategy is optimal given the choices of all others.',
  },
  {
    id: 'biz-5',
    subject: 'business',
    subjectLabel: 'Business & Finance',
    topic: 'Capital Structure',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'According to the Modigliani-Miller Theorem (with corporate taxes), adding debt to a firm’s capital structure increases firm value primarily due to:',
    options: [
      'The tax shield provided by tax-deductible interest payments',
      'Complete elimination of bankruptcy risk',
      'Guaranteed dividend growth',
      'Lower equity beta',
    ],
    correctIndex: 0,
    explanation: 'Because interest expenses reduce taxable corporate income, debt creates an interest tax shield (VL = VU + Tc·D).',
  },

  // ======================== GENERAL KNOWLEDGE ========================
  {
    id: 'gen-1',
    subject: 'general',
    subjectLabel: 'General Knowledge',
    topic: 'Olympic Athletics',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'What is the official standard height of the hurdles in the men’s Olympic 110-meter hurdles event?',
    options: ['1.067 meters (42 inches)', '0.762 meters (30 inches)', '1.500 meters (59 inches)', '0.500 meters (20 inches)'],
    correctIndex: 0,
    explanation: 'Olympic 110m hurdles stand at 1.067 meters (3 ft 6 in), with 10 hurdles spaced along the straight track.',
  },
  {
    id: 'gen-2',
    subject: 'general',
    subjectLabel: 'General Knowledge',
    topic: 'Motorsport Engineering',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'In Formula 1 racing, what does the movable rear-wing acronym "DRS" stand for?',
    options: ['Drag Reduction System', 'Downforce Recovery Stabilizer', 'Differential Rotor Sync', 'Dynamic Roll Suspension'],
    correctIndex: 0,
    explanation: 'DRS (Drag Reduction System) opens an adjustable flap on the rear wing to reduce aerodynamic drag and aid overtaking.',
  },
  {
    id: 'gen-3',
    subject: 'general',
    subjectLabel: 'General Knowledge',
    topic: 'World Geography',
    difficulty: 'Foundation',
    difficultyTier: 'easy',
    prompt: 'Which strait separates the European and Asian parts of Istanbul while linking the Black Sea to the Sea of Marmara?',
    options: ['Bosphorus Strait', 'Strait of Hormuz', 'Strait of Malacca', 'Strait of Magellan'],
    correctIndex: 0,
    explanation: 'The Bosphorus Strait cuts directly through Istanbul, forming part of the continental boundary between Europe and Asia.',
  },
  {
    id: 'gen-4',
    subject: 'general',
    subjectLabel: 'General Knowledge',
    topic: 'History of Science',
    difficulty: 'Varsity',
    difficultyTier: 'medium',
    prompt: 'Who became the first person in history to win two Nobel Prizes in two different scientific fields (Physics and Chemistry)?',
    options: ['Marie Skłodowska-Curie', 'Linus Pauling', 'Albert Einstein', 'Rosalind Franklin'],
    correctIndex: 0,
    explanation: 'Marie Curie won the Nobel Prize in Physics (1903) and the Nobel Prize in Chemistry (1911).',
  },
  {
    id: 'gen-5',
    subject: 'general',
    subjectLabel: 'General Knowledge',
    topic: 'Architecture & Engineering',
    difficulty: 'Olympiad',
    difficultyTier: 'hard',
    prompt: 'Why has the unreinforced concrete dome of the Roman Pantheon remained standing for nearly two millennia?',
    options: [
      'Graduated lighter aggregate (pumice) toward the oculus and stepped exterior rings',
      'Internal titanium tension cables installed by Hadrian',
      'A hollow wooden truss frame hidden inside the coffers',
      'Counterweighted marble flying buttresses',
    ],
    correctIndex: 0,
    explanation: 'Roman engineers varied the aggregate from heavy travertine at the base to lightweight volcanic pumice near the oculus.',
  },
];

export type SharingVisibility = 'private' | 'public';

export interface CustomQuestionDraft {
  subject: Exclude<SubjectId, 'all'>;
  topic: string;
  difficultyTier: 'easy' | 'medium' | 'hard';
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface CustomQuestionBank {
  id: string;
  title: string;
  description: string;
  subject: SubjectId;
  difficultyTier: QuestionDifficultyId;
  visibility: SharingVisibility;
  shareCode: string;
  authorName: string;
  authorRole: string;
  updatedAt: string;
  questions: QuestionItem[];
}

export function generateBankShareCode(seed?: number): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  if (typeof seed === 'number') {
    let s = seed >>> 0;
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      suffix += chars[s % chars.length];
    }
    return `BANK-${suffix}`;
  }
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BANK-${suffix}`;
}

export function validateCustomQuestionDraft(draft: CustomQuestionDraft): {
  valid: boolean;
  error: string | null;
} {
  const promptTrimmed = (draft.prompt || '').trim();
  if (promptTrimmed.length < 5) {
    return {
      valid: false,
      error: 'Question prompt must be at least 5 characters long.',
    };
  }

  const topicTrimmed = (draft.topic || '').trim();
  if (topicTrimmed.length < 2) {
    return {
      valid: false,
      error: 'Academic topic tag is required (at least 2 characters).',
    };
  }

  if (!Array.isArray(draft.options) || draft.options.length !== 4) {
    return {
      valid: false,
      error: 'Exactly 4 multiple-choice option configurations are required.',
    };
  }

  const trimmedOptions = draft.options.map((opt) => (opt || '').trim());
  for (let i = 0; i < 4; i++) {
    if (trimmedOptions[i].length === 0) {
      return {
        valid: false,
        error: `Multiple-choice Option ${i + 1} cannot be empty.`,
      };
    }
  }

  const uniqueOptions = new Set(trimmedOptions.map((o) => o.toLowerCase()));
  if (uniqueOptions.size < 4) {
    return {
      valid: false,
      error: 'All 4 multiple-choice options must be distinct.',
    };
  }

  if (
    draft.correctIndex !== 0 &&
    draft.correctIndex !== 1 &&
    draft.correctIndex !== 2 &&
    draft.correctIndex !== 3
  ) {
    return {
      valid: false,
      error: 'Target correct index must be 0, 1, 2, or 3 (Option A–D).',
    };
  }

  const explanationTrimmed = (draft.explanation || '').trim();
  if (explanationTrimmed.length < 8) {
    return {
      valid: false,
      error: 'Academic explanation must be at least 8 characters long.',
    };
  }

  return { valid: true, error: null };
}

export function buildQuestionItemFromDraft(
  draft: CustomQuestionDraft,
  id?: string
): QuestionItem {
  const subjectMeta = SUBJECT_METADATA[draft.subject] || SUBJECT_METADATA.stem;
  const difficultyLabel: QuestionItem['difficulty'] =
    draft.difficultyTier === 'easy'
      ? 'Foundation'
      : draft.difficultyTier === 'medium'
      ? 'Varsity'
      : 'Olympiad';

  return {
    id: id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subject: draft.subject,
    subjectLabel: subjectMeta.shortLabel,
    topic: draft.topic.trim(),
    difficulty: difficultyLabel,
    difficultyTier: draft.difficultyTier,
    prompt: draft.prompt.trim(),
    options: [
      draft.options[0].trim(),
      draft.options[1].trim(),
      draft.options[2].trim(),
      draft.options[3].trim(),
    ],
    correctIndex: draft.correctIndex,
    explanation: draft.explanation.trim(),
  };
}

export function validateCustomQuestionBank(bank: {
  title: string;
  visibility: SharingVisibility;
  questions: QuestionItem[];
}): { valid: boolean; error: string | null } {
  if (!bank.title || bank.title.trim().length < 3) {
    return {
      valid: false,
      error: 'Question Bank Title must be at least 3 characters long.',
    };
  }
  if (bank.visibility !== 'private' && bank.visibility !== 'public') {
    return {
      valid: false,
      error: 'Sharing visibility must be either "private" or "public".',
    };
  }
  if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
    return {
      valid: false,
      error: 'Question Bank must contain at least 1 valid question.',
    };
  }
  return { valid: true, error: null };
}

export const INITIAL_CUSTOM_QUESTION_BANKS: CustomQuestionBank[] = [
  {
    id: 'bank-ap-calculus-sprint',
    title: 'AP Calculus & Kinematics Velocity Pack',
    description:
      'High-speed derivatives, integrals, and Newtonian mechanics curated for Varsity & Olympiad Grand Prix heats.',
    subject: 'stem',
    difficultyTier: 'medium',
    visibility: 'public',
    shareCode: 'BANK-842K',
    authorName: 'Dr. Elena Vance',
    authorRole: 'educator',
    updatedAt: '2026-11-03',
    questions: [
      {
        id: 'custom-calc-1',
        subject: 'stem',
        subjectLabel: 'STEM & Maths',
        topic: 'Differential Calculus',
        difficulty: 'Varsity',
        difficultyTier: 'medium',
        prompt: 'What is the first derivative of f(x) = 4x³ - 6x + 9 with respect to x?',
        options: ['12x² - 6', '4x² - 6', '12x³ - 6x', '8x² + 9'],
        correctIndex: 0,
        explanation:
          'Applying the power rule d/dx(x^n) = nx^(n-1) gives 4(3x²) - 6(1) + 0 = 12x² - 6.',
      },
      {
        id: 'custom-calc-2',
        subject: 'stem',
        subjectLabel: 'STEM & Maths',
        topic: 'Rotational Kinematics',
        difficulty: 'Varsity',
        difficultyTier: 'medium',
        prompt: 'A race car wheel rotates at a constant 20 rad/s. How many radians does it turn in 4.5 seconds?',
        options: ['45 rad', '75 rad', '90 rad', '110 rad'],
        correctIndex: 2,
        explanation: 'Angular displacement θ = ω × t = 20 rad/s × 4.5 s = 90 radians.',
      },
      {
        id: 'custom-calc-3',
        subject: 'stem',
        subjectLabel: 'STEM & Maths',
        topic: 'Definite Integrals',
        difficulty: 'Olympiad',
        difficultyTier: 'hard',
        prompt: 'Evaluate the definite integral ∫₀³ (2x + 1) dx.',
        options: ['9', '10', '12', '15'],
        correctIndex: 2,
        explanation:
          'The antiderivative of 2x + 1 is x² + x. Evaluating from 0 to 3 gives (3² + 3) - 0 = 9 + 3 = 12.',
      },
    ],
  },
  {
    id: 'bank-macro-finance-private',
    title: 'Wall Street & Monetary Policy Seminar',
    description:
      'Private classroom assessment covering bond yields, central bank discount rates, and equity valuation multiples.',
    subject: 'business',
    difficultyTier: 'hard',
    visibility: 'private',
    shareCode: 'BANK-319P',
    authorName: 'Prof. Marcus Sterling',
    authorRole: 'educator',
    updatedAt: '2026-11-03',
    questions: [
      {
        id: 'custom-fin-1',
        subject: 'business',
        subjectLabel: 'Finance',
        topic: 'Fixed Income & Yields',
        difficulty: 'Varsity',
        difficultyTier: 'medium',
        prompt: 'When prevailing market interest rates rise, what happens to the market price of existing fixed-coupon bonds?',
        options: [
          'Bond prices fall',
          'Bond prices rise proportionally',
          'Bond prices remain fixed at par',
          'Coupon rates automatically double',
        ],
        correctIndex: 0,
        explanation:
          'Bond prices and market interest rates move inversely so existing fixed coupons match new market yields.',
      },
      {
        id: 'custom-fin-2',
        subject: 'business',
        subjectLabel: 'Finance',
        topic: 'Corporate Valuation',
        difficulty: 'Olympiad',
        difficultyTier: 'hard',
        prompt: 'A company has an Enterprise Value of $450M and EBITDA of $50M. What is its EV/EBITDA multiple?',
        options: ['6.5x', '7.5x', '9.0x', '11.2x'],
        correctIndex: 2,
        explanation: 'EV / EBITDA = $450M / $50M = 9.0x.',
      },
    ],
  },
];

export function getQuestionsForMatch(
  subject: SubjectId,
  count: number,
  seed = 42,
  difficulty: QuestionDifficultyId = 'all',
  customQuestions?: QuestionItem[]
): QuestionItem[] {
  const safeCount = Math.max(1, Math.min(100, Math.round(count)));

  // Deterministic LCG shuffle so multiplayer peers with the same room seed see identical question sequences
  let s = seed >>> 0;
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const shuffle = (arr: QuestionItem[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // If a custom question bank is active and has questions, prioritize those custom questions first!
  if (Array.isArray(customQuestions) && customQuestions.length > 0) {
    const result: QuestionItem[] = [];
    for (let i = 0; i < safeCount; i++) {
      const base = customQuestions[i % customQuestions.length];
      result.push({
        ...base,
        id: `${base.id}-q${i + 1}`,
      });
    }
    return result;
  }

  const subjectFiltered =
    subject === 'all'
      ? [...QUESTION_BANK]
      : QUESTION_BANK.filter((q) => q.subject === subject);

  const primaryPool =
    difficulty === 'all'
      ? subjectFiltered
      : subjectFiltered.filter((q) => q.difficultyTier === difficulty);

  // Fallback pools if a specific subject+difficulty slice has fewer items than requested count
  const sameDifficultyOtherSubjects =
    difficulty === 'all'
      ? []
      : QUESTION_BANK.filter((q) => q.subject !== subject && q.difficultyTier === difficulty);

  const remainingSubjectQuestions =
    difficulty === 'all'
      ? []
      : subjectFiltered.filter((q) => q.difficultyTier !== difficulty);

  const otherQuestions = QUESTION_BANK.filter(
    (q) =>
      !primaryPool.includes(q) &&
      !sameDifficultyOtherSubjects.includes(q) &&
      !remainingSubjectQuestions.includes(q)
  );

  let ordered: QuestionItem[];
  if (difficulty === 'all') {
    // Progressive ordering when 'all' (Mixed Easy -> Medium -> Hard) is chosen
    const easySubj = shuffle(subjectFiltered.filter((q) => q.difficultyTier === 'easy'));
    const medSubj = shuffle(subjectFiltered.filter((q) => q.difficultyTier === 'medium'));
    const hardSubj = shuffle(subjectFiltered.filter((q) => q.difficultyTier === 'hard'));
    const rest = shuffle(QUESTION_BANK.filter((q) => !subjectFiltered.includes(q)));
    ordered = [...easySubj, ...medSubj, ...hardSubj, ...rest];
  } else {
    ordered = [
      ...shuffle(primaryPool),
      ...shuffle(remainingSubjectQuestions),
      ...shuffle(sameDifficultyOtherSubjects),
      ...shuffle(otherQuestions),
    ];
  }

  const result: QuestionItem[] = [];
  for (let i = 0; i < safeCount; i++) {
    const base = ordered[i % ordered.length];
    result.push({
      ...base,
      id: `${base.id}-q${i + 1}`,
    });
  }
  return result;
}

// ============================================================================
// [SCR-10] AI Source Extraction Console Pure Logic & Validation Pipeline
// ============================================================================

export type ExtractionSourceFormat = 'pdf' | 'docx' | 'url';
export type AiParserEngineId = 'gemini-3.8-flash' | 'claude-json-schema';
export type ValidationCheckStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface ExtractionValidationCheck {
  id: string;
  code: string;
  label: string;
  detail: string;
  status: ValidationCheckStatus;
  metricLabel: string;
}

export interface SourceExtractionInput {
  sourceFormat: ExtractionSourceFormat;
  fileName?: string;
  fileSizeBytes?: number;
  websiteUrl?: string;
  rawContent: string;
  base64Data?: string;
  targetSubject?: Exclude<SubjectId, 'all'>;
  targetDifficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  parserEngine: AiParserEngineId;
}

export interface WorkerSanitizationMetrics {
  cleanedText: string;
  originalChars: number;
  cleanedChars: number;
  strippedArtifactsCount: number;
  extractedClauseCount: number;
  estimatedTokens: number;
  clauses: string[];
}

export interface PresetExtractionSource {
  id: string;
  format: ExtractionSourceFormat;
  label: string;
  fileName?: string;
  fileSizeBytes?: number;
  websiteUrl?: string;
  subject: Exclude<SubjectId, 'all'>;
  difficultyTier: 'easy' | 'medium' | 'hard';
  SuggestedBankTitle: string;
  rawContent: string;
}

export const PRESET_EXTRACTION_SOURCES: PresetExtractionSource[] = [
  {
    id: 'preset-pdf-calculus',
    format: 'pdf',
    label: 'PDF · MIT 18.01 Kinematics & Calculus Lecture Notes',
    fileName: 'MIT_18_01_Kinematics_Calculus_Notes.pdf',
    fileSizeBytes: 248320,
    subject: 'stem',
    difficultyTier: 'medium',
    SuggestedBankTitle: 'MIT 18.01 Kinematics & Calculus Extracted Pack',
    rawContent: `%PDF-1.7 [Binary Header Stripped]
Lecture 04: Instantaneous Velocity, Acceleration & Rotational Dynamics.
1. If the displacement of a Formula prototype car is s(t) = 5t^2 + 10t meters, the first derivative v(t) = ds/dt = 10t + 10 gives instantaneous velocity. At t = 3 seconds, velocity equals 40 m/s.
2. Centripetal acceleration during cornering on a flat track of radius r at speed v is governed by a_c = v^2 / r. Doubling cornering speed quadruples the required lateral tire grip.
3. By the Fundamental Theorem of Calculus, the definite integral of velocity v(t) from t = a to t = b equals net displacement Δs. For v(t) = 6t, integrating from t = 0 to t = 5 seconds yields 3(25) = 75 meters.
4. Work-Energy Theorem: Net work done on a rigid body equals the change in kinetic energy ΔKE = 1/2 m v_f^2 - 1/2 m v_i^2.
endobj %%EOF`,
  },
  {
    id: 'preset-docx-macro',
    format: 'docx',
    label: 'DOCX · Wharton Monetary Policy & Valuation Brief',
    fileName: 'Wharton_Monetary_Policy_Valuation_2026.docx',
    fileSizeBytes: 184910,
    subject: 'business',
    difficultyTier: 'hard',
    SuggestedBankTitle: 'Wharton Monetary Policy & Valuation Pack',
    rawContent: `[DOCX XML word/document.xml stream]
Executive Briefing: Central Bank Discount Rates, WACC & Bond Convexity.
1. Weighted Average Cost of Capital (WACC) blends the after-tax cost of debt and cost of equity: WACC = (E/V)*Re + (D/V)*Rd*(1 - Tc). Corporate tax shields lower the effective cost of debt.
2. When the Federal Reserve raises benchmark policy rates by 100 basis points, existing fixed-coupon bonds decline in market price so their yield-to-maturity converges to the new prevailing rate.
3. Free Cash Flow to Firm (FCFF) is calculated as EBIT * (1 - Tax Rate) + Depreciation & Amortization - Capital Expenditures - Change in Net Working Capital.
4. In SaaS unit economics, Net Dollar Retention (NDR) above 120% indicates that expansion revenue from existing cohorts exceeds gross logo and contraction churn.`,
  },
  {
    id: 'preset-url-neuro',
    format: 'url',
    label: 'URL · Stanford Encyclopedia — Cognitive Decision Systems',
    websiteUrl: 'https://plato.stanford.edu/entries/decision-theory-causal/',
    subject: 'social',
    difficultyTier: 'medium',
    SuggestedBankTitle: 'Stanford Cognitive Decision & Game Theory Pack',
    rawContent: `<html lang="en"><head><title>Decision Theory & Prospect Heuristics</title></head><body>
Section 1: Dual-Process Cognition and Prospect Theory.
1. Daniel Kahneman characterizes System 1 thinking as fast, automatic, and heuristic-driven, whereas System 2 thinking is deliberative, analytical, and effortful.
2. Under Tversky and Kahneman's Availability Heuristic, individuals estimate the probability of an event based on how easily examples can be recalled from memory.
3. In Ultimatum Bargaining Games, responders routinely reject splits below 20% of the endowment to punish perceived unfairness, deviating from subgame-perfect Nash equilibrium predictions.
4. Pareto Efficiency occurs when no individual can be made better off without making at least one individual worse off.</body></html>`,
  },
];

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'among',
  'because',
  'before',
  'being',
  'below',
  'between',
  'both',
  'could',
  'during',
  'each',
  'from',
  'further',
  'having',
  'into',
  'more',
  'most',
  'other',
  'over',
  'same',
  'should',
  'some',
  'such',
  'than',
  'that',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'under',
  'until',
  'very',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'within',
  'without',
  'would',
  'also',
  'does',
  'have',
  'were',
  'been',
  'only',
  'upon',
  'every',
]);

/**
 * Checks whether a token is a genuine human-readable word or number,
 * rejecting compressed binary/PDF/ZIP noise like "moyD", "IvG", "5$", "2hk", "'X9", "PN'k", "UfP\"&n", "ji]K".
 */
export function isNaturalLanguageWord(rawToken: string): boolean {
  const trimmed = rawToken
    .replace(/^[(\[{"'“”‘’]+|[.,;:?!)\]}"'“”‘’]+$/g, '')
    .trim();
  if (!trimmed || trimmed.length > 32) return false;

  // Reject tokens containing binary/cipher symbols inside the word
  if (/[$&[\]{}\\|~`@#*^<>_"']/.test(trimmed)) {
    return false;
  }

  // Allow clean numeric values or measurements (e.g., "100", "40", "120%", "36", "18.01")
  if (/^\d+(?:\.\d+)?(?:%|s|m|km|kg|Hz|W|J|V|A)?$/.test(trimmed)) {
    return true;
  }

  // Allow standard mathematical/scientific expressions used in STEM notes (e.g., "s(t)", "v(t)", "ds/dt")
  if (/^[a-zA-Z]\([a-zA-Z0-9]\)$/.test(trimmed) || /^d[a-z]\/d[a-z]$/.test(trimmed)) {
    return true;
  }

  // Must consist strictly of letters (and optional internal hyphen or possessive 's)
  const cleanWord = trimmed.replace(/'s$/i, '');
  if (!/^[A-Za-z]+(?:-[A-Za-z]+)*$/.test(cleanWord)) {
    return false;
  }

  // Single-letter words in English are only "a", "A", "I", or math variables in equations
  if (cleanWord.length === 1) {
    return /^[aAiIxyzrtvmn]$/.test(cleanWord);
  }

  // Reject words with random uppercase letters after lowercase letters (e.g., "moyD", "IvG", "uFp")
  const parts = cleanWord.split('-');
  for (const part of parts) {
    const isAllLower = /^[a-z]+$/.test(part);
    const isTitleCase = /^[A-Z][a-z]+$/.test(part);
    const isAcronym = /^[A-Z]{2,6}$/.test(part);
    if (!isAllLower && !isTitleCase && !isAcronym) {
      return false;
    }
    // Non-acronym words of 3+ chars must contain at least one vowel and not have 5+ consecutive consonants
    if (!isAcronym && part.length >= 3) {
      if (!/[aeiouyAEIOUY]/.test(part)) return false;
      if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{5,}/.test(part)) return false;
    }
  }

  return true;
}

/**
 * Checks whether a candidate clause is a genuine human-readable sentence/phrase
 * rather than binary stream noise.
 */
export function isNaturalLanguageClause(clause: string): boolean {
  const cleaned = clause.trim();
  if (cleaned.length < 18) return false;

  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  if (rawTokens.length < 4) return false;

  let validWords = 0;
  let multiCharWords = 0;
  let mathConnectors = 0;

  for (const tok of rawTokens) {
    if (/^[=+\-*/Δ()]+$/.test(tok)) {
      mathConnectors++;
      continue;
    }
    if (isNaturalLanguageWord(tok)) {
      validWords++;
      const alphaOnly = tok.replace(/[^A-Za-z]/g, '');
      if (alphaOnly.length >= 3) {
        multiCharWords++;
      }
    }
  }

  const effectiveTotal = Math.max(1, rawTokens.length - mathConnectors);
  const validRatio = validWords / effectiveTotal;

  return validWords >= 4 && multiCharWords >= 3 && validRatio >= 0.65;
}

/**
 * Automatically infers the closest academic subject category from the source text
 * so users do not need to manually pick a Subject dropdown when extracting from a source.
 */
export function inferSubjectFromSourceText(
  text: string
): Exclude<SubjectId, 'all'> {
  const lower = (text || '').toLowerCase();
  const scores: Record<Exclude<SubjectId, 'all'>, number> = {
    stem: 0,
    business: 0,
    social: 0,
    literature: 0,
    general: 1,
  };

  const stemTerms = [
    'velocity',
    'acceleration',
    'calculus',
    'derivative',
    'integral',
    'energy',
    'force',
    'mass',
    'physics',
    'chemistry',
    'biology',
    'cell',
    'photosynthesis',
    'chloroplast',
    'mitochondria',
    'atp',
    'glucose',
    'molecule',
    'atom',
    'electron',
    'quantum',
    'equation',
    'theorem',
    'algorithm',
    'function',
    'matrix',
    'vector',
    'dna',
    'rna',
    'protein',
  ];
  const businessTerms = [
    'capital',
    'wacc',
    'revenue',
    'equity',
    'debt',
    'market',
    'bond',
    'yield',
    'valuation',
    'cash flow',
    'fcff',
    'retention',
    'monetary',
    'fiscal',
    'inflation',
    'interest rate',
    'investment',
    'margin',
    'profit',
    'finance',
    'corporate',
  ];
  const socialTerms = [
    'cognition',
    'heuristic',
    'psychology',
    'sociology',
    'equilibrium',
    'pareto',
    'kahneman',
    'decision',
    'society',
    'political',
    'government',
    'history',
    'treaty',
    'constitution',
    'democracy',
    'policy',
    'behavior',
  ];
  const literatureTerms = [
    'novel',
    'poem',
    'poetry',
    'shakespeare',
    'metaphor',
    'narrative',
    'protagonist',
    'rhetoric',
    'tragedy',
    'author',
    'literary',
    'stanza',
    'allegory',
    'irony',
    'sonnet',
    'dramatic',
  ];

  for (const w of stemTerms) if (lower.includes(w)) scores.stem += 2;
  for (const w of businessTerms) if (lower.includes(w)) scores.business += 2;
  for (const w of socialTerms) if (lower.includes(w)) scores.social += 2;
  for (const w of literatureTerms) if (lower.includes(w)) scores.literature += 2;

  let best: Exclude<SubjectId, 'all'> = 'general';
  let bestScore = scores.general;
  for (const subj of ['stem', 'business', 'social', 'literature'] as const) {
    if (scores[subj] > bestScore) {
      best = subj;
      bestScore = scores[subj];
    }
  }
  return best;
}

export function validateExtractionInput(input: SourceExtractionInput): {
  valid: boolean;
  error: string | null;
} {
  if (input.sourceFormat === 'pdf' || input.sourceFormat === 'docx') {
    const fileName = (input.fileName || '').trim();
    if (!fileName) {
      return {
        valid: false,
        error: 'Please drop or select a valid PDF (.pdf) or Word (.docx) document.',
      };
    }
    const lower = fileName.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      return {
        valid: false,
        error: 'Unsupported file format. Only .pdf and .docx documents are supported.',
      };
    }
  } else if (input.sourceFormat === 'url') {
    const url = (input.websiteUrl || '').trim();
    if (!url || !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
      return {
        valid: false,
        error: 'Please enter a valid website URL starting with http:// or https://.',
      };
    }
  }

  const rawTrimmed = (input.rawContent || '').trim();
  if (rawTrimmed.length < 30 && !input.base64Data) {
    return {
      valid: false,
      error:
        'Source text must contain at least 30 characters of readable text.',
    };
  }

  if (rawTrimmed.length >= 30) {
    const cleaned = cleanSourceTextWithBackgroundWorker(rawTrimmed);
    if (cleaned.clauses.length === 0) {
      return {
        valid: false,
        error:
          'Could not extract readable sentences from this source. Please upload a text-based PDF/DOCX or paste readable text.',
      };
    }
  }

  if (
    typeof input.questionCount !== 'number' ||
    input.questionCount < 1 ||
    input.questionCount > 100
  ) {
    return {
      valid: false,
      error: 'Question count must be between 1 and 100.',
    };
  }

  return { valid: true, error: null };
}

export function cleanSourceTextWithBackgroundWorker(rawText: string): WorkerSanitizationMetrics {
  const originalChars = rawText.length;

  // Strip PDF stream tokens, XML/DOCX markers, HTML tags, and non-printable control chars
  const artifactRegex =
    /(%PDF-[0-9.]+|\b\d+\s+\d+\s+obj\b|\bendobj\b|\bstream\b|\bendstream\b|\bxref\b|\btrailer\b|\bstartxref\b|%%EOF|\[Binary Header Stripped\]|\[DOCX XML[^\]]*\]|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>|[\x00-\x08\x0B\x0C\x0E-\x1F])/gi;
  const matches = rawText.match(artifactRegex);
  const strippedArtifactsCount = matches ? matches.length : 0;

  const strippedText = rawText
    .replace(artifactRegex, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // Split into candidate sentences/clauses and retain ONLY genuine natural-language clauses
  const candidateSegments = strippedText
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.replace(/^\s*(?:\d+[\.)]|[-•*])\s*/, '').trim())
    .filter((s) => s.length >= 18);

  const clauses = candidateSegments.filter((seg) => isNaturalLanguageClause(seg));

  const cleanedText =
    clauses.length > 0
      ? clauses.join(' ')
      : strippedText
          .split(/\s+/)
          .filter((tok) => isNaturalLanguageWord(tok))
          .join(' ');

  const cleanedChars = cleanedText.length;
  const estimatedTokens = Math.max(1, Math.ceil(cleanedChars / 4));

  return {
    cleanedText,
    originalChars,
    cleanedChars,
    strippedArtifactsCount,
    extractedClauseCount: clauses.length,
    estimatedTokens,
    clauses,
  };
}

export function createInitialValidationChecks(
  sourceFormat: ExtractionSourceFormat,
  parserEngine: AiParserEngineId
): ExtractionValidationCheck[] {
  const formatLabel =
    sourceFormat === 'pdf'
      ? 'PDF Document'
      : sourceFormat === 'docx'
      ? 'Word Document'
      : 'Website Link';
  const engineLabel =
    parserEngine === 'gemini-3.8-flash' ? 'Gemini AI' : 'Claude AI';

  return [
    {
      id: 'check-ingest',
      code: '1',
      label: `${formatLabel} Check`,
      detail: 'Checks file format or website URL and confirms readable text.',
      status: 'pending',
      metricLabel: 'Ready',
    },
    {
      id: 'check-worker',
      code: '2',
      label: 'Text Preparation',
      detail: 'Extracts clean sentences and key facts from your source material.',
      status: 'pending',
      metricLabel: '0 passages',
    },
    {
      id: 'check-schema',
      code: '3',
      label: `${engineLabel} Question Generation`,
      detail: 'Creates multiple-choice questions directly from the source text.',
      status: 'pending',
      metricLabel: 'Idle',
    },
    {
      id: 'check-options',
      code: '4',
      label: 'Answer Options Check',
      detail: 'Confirms each question has 4 distinct answer choices.',
      status: 'pending',
      metricLabel: '0 / 0',
    },
    {
      id: 'check-index',
      code: '5',
      label: 'Answer Key Check',
      detail: 'Verifies the correct answer and source explanation.',
      status: 'pending',
      metricLabel: 'Pending',
    },
  ];
}

function capitalizeFirst(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function placeCorrectOptionAt(
  correctOption: string,
  distractors: string[],
  targetIndex: 0 | 1 | 2 | 3
): [string, string, string, string] {
  const cleanCorrect = correctOption.trim().slice(0, 150);
  const uniqueDistractors: string[] = [];
  for (const d of distractors) {
    const cleanD = d.trim().slice(0, 150);
    if (
      cleanD.length >= 2 &&
      cleanD.toLowerCase() !== cleanCorrect.toLowerCase() &&
      !uniqueDistractors.some((u) => u.toLowerCase() === cleanD.toLowerCase())
    ) {
      uniqueDistractors.push(cleanD);
    }
    if (uniqueDistractors.length === 3) break;
  }

  let padIdx = 1;
  while (uniqueDistractors.length < 3) {
    const fallback = `Not stated in the provided source passage (#${padIdx})`;
    if (
      fallback.toLowerCase() !== cleanCorrect.toLowerCase() &&
      !uniqueDistractors.some((u) => u.toLowerCase() === fallback.toLowerCase())
    ) {
      uniqueDistractors.push(fallback);
    }
    padIdx++;
  }

  const result: string[] = [];
  let dCursor = 0;
  for (let i = 0; i < 4; i++) {
    if (i === targetIndex) {
      result.push(cleanCorrect);
    } else {
      result.push(uniqueDistractors[dCursor++]);
    }
  }
  return result as [string, string, string, string];
}

export function extractStructuredQuestionsFromCleanedText(params: {
  cleanedText: string;
  clauses: string[];
  targetSubject?: Exclude<SubjectId, 'all'>;
  targetDifficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  sourceLabel?: string;
}): QuestionItem[] {
  const safeCount = Math.max(1, Math.min(100, Math.round(params.questionCount)));
  const rawCleaned = (params.cleanedText || '').trim();
  const resolvedSubject =
    params.targetSubject || inferSubjectFromSourceText(rawCleaned);
  const subjectMeta = SUBJECT_METADATA[resolvedSubject] || SUBJECT_METADATA.general;

  // Segment the actual source text into verified natural-language statements
  const primaryClauses = (
    params.clauses && params.clauses.length > 0
      ? params.clauses
      : rawCleaned
          .split(/(?<=[.?!;])\s+|\n+/)
          .map((s) => s.replace(/^\d+[\.)]\s*/, '').trim())
  ).filter((s) => isNaturalLanguageClause(s));

  const expandedClauses: string[] = [...primaryClauses];
  if (expandedClauses.length < safeCount) {
    for (const c of primaryClauses) {
      const subParts = c
        .split(/,\s+(?:and|while|whereas|which|where|so|but)\s+|;\s+/i)
        .map((s) => s.trim())
        .filter((s) => isNaturalLanguageClause(s));
      for (const sp of subParts) {
        if (!expandedClauses.includes(sp)) {
          expandedClauses.push(sp);
        }
      }
    }
  }

  if (expandedClauses.length === 0) {
    return [];
  }

  // Extract distinct natural-language key terms and predicate phrases from the actual source document
  const docKeyTerms: string[] = [];
  const docPredicates: string[] = [];

  for (const sentence of expandedClauses) {
    const cleanSent = sentence.replace(/[.?!]+$/, '').trim();
    const relMatch = cleanSent.match(
      /^([^,:;]{3,75}?)\s+(is defined as|refers to|is|are|was|were|means|produces|converts|synthesizes|captures|equals|represents|measures|consists of|requires|enables|prevents|regulates|generates|calculates|determines|states that|occurs when|characterizes|blends|indicates)\s+(.{10,145})$/i
    );
    if (relMatch) {
      const pred = capitalizeFirst(relMatch[3]);
      if (!docPredicates.some((p) => p.toLowerCase() === pred.toLowerCase())) {
        docPredicates.push(pred);
      }
    }

    const words = cleanSent
      .split(/\s+/)
      .map((w) => w.replace(/^[(\[{"'“”‘’]+|[.,;:?!)\]}"'“”‘’]+$/g, ''))
      .filter(
        (w) =>
          w.length >= 4 &&
          isNaturalLanguageWord(w) &&
          !STOP_WORDS.has(w.toLowerCase())
      );

    for (const w of words) {
      if (!docKeyTerms.some((t) => t.toLowerCase() === w.toLowerCase())) {
        docKeyTerms.push(w);
      }
    }
  }

  const generatedDrafts: CustomQuestionDraft[] = [];

  for (let i = 0; i < safeCount; i++) {
    const clause = expandedClauses[i % expandedClauses.length];
    const cleanSent = clause.replace(/[.?!]+$/, '').trim();
    const conciseClause = cleanSent.length > 150 ? `${cleanSent.slice(0, 147)}...` : cleanSent;
    const targetIndex = (i % 4) as 0 | 1 | 2 | 3;

    const passNumber = Math.floor(i / Math.max(1, expandedClauses.length));

    const relMatch =
      passNumber === 0
        ? cleanSent.match(
            /^([^,:;]{3,75}?)\s+(is defined as|refers to|is|are|was|were|means|produces|converts|synthesizes|captures|equals|represents|measures|consists of|requires|enables|prevents|regulates|generates|calculates|determines|states that|occurs when|characterizes|blends|indicates)\s+(.{10,140})$/i
          )
        : null;

    const colonMatch =
      !relMatch && passNumber === 0
        ? cleanSent.match(/^([^:]{3,65}):\s+(.{10,140})$/)
        : null;

    if (relMatch || colonMatch) {
      const subjRaw = (relMatch ? relMatch[1] : colonMatch![1]).trim();
      const verbRaw = relMatch ? relMatch[2].trim().toLowerCase() : 'is described as';
      const predRaw = capitalizeFirst((relMatch ? relMatch[3] : colonMatch![2]).trim());

      const topicWords = subjRaw
        .replace(/^(the|a|an|in|on|at|for|by|when|under|if)\s+/i, '')
        .split(/\s+/)
        .filter((w) => isNaturalLanguageWord(w))
        .slice(0, 3)
        .join(' ');
      const topic = capitalizeFirst(topicWords || subjectMeta.shortLabel).slice(0, 48);

      const prompt =
        verbRaw === 'is' || verbRaw === 'are' || verbRaw === 'was' || verbRaw === 'were'
          ? `According to the source text, what ${verbRaw} ${subjRaw}?`
          : `According to the source text, what does ${subjRaw} ${
              verbRaw.endsWith('s') ? verbRaw.slice(0, -1) : verbRaw
            }?`;

      const otherPredicates = docPredicates.filter(
        (p) => p.toLowerCase() !== predRaw.toLowerCase()
      );
      const otherClauses = expandedClauses
        .map((c) => capitalizeFirst(c.replace(/[.?!]+$/, '').trim()))
        .filter(
          (c) =>
            c.toLowerCase() !== cleanSent.toLowerCase() &&
            c.toLowerCase() !== predRaw.toLowerCase()
        );

      const candidateDistractors = [
        ...otherPredicates,
        ...otherClauses,
        `Unrelated to ${topic} in the source passage`,
        `The opposite of ${predRaw.slice(0, 80)}`,
        `Not supported by the source document`,
      ];

      const options = placeCorrectOptionAt(predRaw, candidateDistractors, targetIndex);

      generatedDrafts.push({
        subject: resolvedSubject,
        topic: topic.length >= 3 ? topic : subjectMeta.shortLabel,
        difficultyTier: params.targetDifficulty,
        prompt: prompt.slice(0, 260),
        options,
        correctIndex: targetIndex,
        explanation: `From the source text: "${conciseClause}."`,
      });
    } else {
      // Key-term comprehension question grounded strictly in verified natural-language words
      const sentenceWords = cleanSent
        .split(/\s+/)
        .map((w) => w.replace(/^[(\[{"'“”‘’]+|[.,;:?!)\]}"'“”‘’]+$/g, ''))
        .filter(
          (w) =>
            w.length >= 4 &&
            isNaturalLanguageWord(w) &&
            !STOP_WORDS.has(w.toLowerCase())
        );

      const chosenTerm =
        sentenceWords.length > 0
          ? sentenceWords[(i + passNumber) % sentenceWords.length]
          : docKeyTerms[i % Math.max(1, docKeyTerms.length)] || subjectMeta.shortLabel;

      const escapedTerm = chosenTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blankedSentence = cleanSent.replace(new RegExp(`\\b${escapedTerm}\\b`, 'i'), '________');

      const prompt =
        blankedSentence !== cleanSent
          ? `Complete the statement from the source text: "${
              blankedSentence.length > 180 ? `${blankedSentence.slice(0, 177)}...` : blankedSentence
            }"`
          : `Which concept is directly discussed in the statement: "${conciseClause}"?`;

      const otherTerms = docKeyTerms.filter(
        (t) => t.toLowerCase() !== chosenTerm.toLowerCase() && isNaturalLanguageWord(t)
      );
      const rotatedTerms = [
        ...otherTerms.slice(i % Math.max(1, otherTerms.length)),
        ...otherTerms.slice(0, i % Math.max(1, otherTerms.length)),
      ];

      const numMatch = chosenTerm.match(/^(\d+(?:\.\d+)?)(.*)$/);
      const numericDistractors = numMatch
        ? [
            `${Math.max(1, Math.round(Number(numMatch[1]) * 0.5))}${numMatch[2]}`,
            `${Math.round(Number(numMatch[1]) * 1.5 + 2)}${numMatch[2]}`,
            `${Math.round(Number(numMatch[1]) * 2 + 5)}${numMatch[2]}`,
          ]
        : [];

      const candidateDistractors = [
        ...numericDistractors,
        ...rotatedTerms,
        'None of these options',
        'Not mentioned in the text',
        'Unsupported assumption',
      ];

      const options = placeCorrectOptionAt(chosenTerm, candidateDistractors, targetIndex);
      const topicWords = sentenceWords
        .filter((w) => /^[A-Za-z]+$/.test(w))
        .slice(0, 2)
        .map((w) => capitalizeFirst(w))
        .join(' ');
      const topicTerm = (topicWords || capitalizeFirst(chosenTerm) || subjectMeta.shortLabel).slice(
        0,
        48
      );

      generatedDrafts.push({
        subject: resolvedSubject,
        topic: topicTerm.length >= 3 ? topicTerm : subjectMeta.shortLabel,
        difficultyTier: params.targetDifficulty,
        prompt: prompt.slice(0, 260),
        options,
        correctIndex: targetIndex,
        explanation: `From the source text: "${conciseClause}."`,
      });
    }
  }

  return generatedDrafts.slice(0, safeCount).map((draft, idx) =>
    buildQuestionItemFromDraft(draft, `extracted-${Date.now()}-${idx + 1}`)
  );
}




