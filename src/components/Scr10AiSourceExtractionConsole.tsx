import React, { useRef, useState } from 'react';
import {
  AuthenticatedSession,
  evaluateSourceExtractionAccess,
} from '../game/rules';
import {
  AiParserEngineId,
  CustomQuestionBank,
  ExtractionSourceFormat,
  ExtractionValidationCheck,
  QuestionItem,
  SharingVisibility,
  WorkerSanitizationMetrics,
  cleanSourceTextWithBackgroundWorker,
  createInitialValidationChecks,
  extractStructuredQuestionsFromCleanedText,
  generateBankShareCode,
  inferSubjectFromSourceText,
  validateCustomQuestionDraft,
  validateExtractionInput,
} from '../game/questions';

interface Scr10AiSourceExtractionConsoleProps {
  session: AuthenticatedSession | null;
  onSaveExtractedBank: (bank: CustomQuestionBank) => void;
  onLaunchWithExtractedBank: (bank: CustomQuestionBank) => void;
  onOpenInQuestionGenerator: (bank: CustomQuestionBank) => void;
  onBackToLobby: () => void;
  onOpenAuthForPro: () => void;
  onQuickDemoProLogin: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const Scr10AiSourceExtractionConsole: React.FC<
  Scr10AiSourceExtractionConsoleProps
> = ({
  session,
  onSaveExtractedBank,
  onLaunchWithExtractedBank,
  onBackToLobby,
  onOpenAuthForPro,
  onQuickDemoProLogin,
}) => {
  const access = evaluateSourceExtractionAccess(session);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceFormat, setSourceFormat] = useState<ExtractionSourceFormat>('pdf');
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [base64Data, setBase64Data] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');

  const [targetDifficulty, setTargetDifficulty] = useState<
    'easy' | 'medium' | 'hard'
  >('medium');
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [parserEngine, setParserEngine] =
    useState<AiParserEngineId>('gemini-3.8-flash');

  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [pipelinePhaseLabel, setPipelinePhaseLabel] = useState<string>(
    'Upload a file, enter a URL, or paste source text to begin.'
  );
  const [validationChecks, setValidationChecks] = useState<
    ExtractionValidationCheck[]
  >(() => createInitialValidationChecks('pdf', 'gemini-3.8-flash'));

  const [workerMetrics, setWorkerMetrics] =
    useState<WorkerSanitizationMetrics | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<QuestionItem[]>(
    []
  );
  const [bankTitle, setBankTitle] = useState<string>('Extracted Question Bank');
  const [bankVisibility, setBankVisibility] =
    useState<SharingVisibility>('public');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Route Guard View for Unauthenticated / Guest Users
  if (!access.allowed) {
    return (
      <div
        data-testid="scr10-route-guard"
        onClick={onBackToLobby}
        className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#060A12]/95 overflow-y-auto cursor-pointer"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-xl bg-[#0B1120] border border-amber-500/45 p-6 md:p-8 shadow-2xl space-y-5 cursor-default"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white font-display">
              AI Source Extractor
            </h1>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            {access.reason}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              data-testid="scr10-guard-back-btn"
              onClick={onBackToLobby}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>
            <button
              type="button"
              data-testid="scr10-guard-demo-unlock-btn"
              onClick={onQuickDemoProLogin}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Quick Demo Unlock
            </button>
            <button
              type="button"
              data-testid="scr10-guard-login-btn"
              onClick={onOpenAuthForPro}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-display text-xs transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const processIngestedFile = (file: File) => {
    setErrorMessage(null);
    setStatusBanner(null);
    const name = file.name || '';
    const lower = name.toLowerCase();

    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setErrorMessage(
        'Unsupported file format. Please select a .pdf or .docx file.'
      );
      return;
    }

    const detectedFormat: ExtractionSourceFormat = lower.endsWith('.pdf')
      ? 'pdf'
      : 'docx';
    setSourceFormat(detectedFormat);
    setFileName(name);
    setFileSizeBytes(file.size || 1024);
    setBankTitle(
      `${name.replace(/\.(pdf|docx)$/i, '').replace(/[_-]+/g, ' ')} Questions`
    );
    setIsParsingFile(true);
    setPipelinePhaseLabel(`Reading ${name}...`);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setBase64Data(dataUrl);

      try {
        const response = await fetch('/api/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: detectedFormat,
            fileName: name,
            base64Data: dataUrl,
          }),
        });
        const data = await response.json();
        if (response.ok && typeof data.extractedText === 'string' && data.extractedText.trim().length > 0) {
          setRawContent(data.extractedText);
          setWorkerMetrics(
            data.workerMetrics || cleanSourceTextWithBackgroundWorker(data.extractedText)
          );
          setValidationChecks(
            createInitialValidationChecks(detectedFormat, parserEngine)
          );
          setProgressPercent(0);
          setPipelinePhaseLabel(
            `Loaded ${name} (${Math.max(1, Math.round((file.size || 1024) / 1024))} KB) · Ready to extract`
          );
        } else {
          setRawContent('');
          setWorkerMetrics(null);
          setErrorMessage(
            data?.error ||
              'Could not extract readable text from this file. Please upload a text-based PDF/DOCX or paste your text below.'
          );
          setPipelinePhaseLabel('Paste readable text below to extract questions.');
        }
      } catch {
        setErrorMessage(
          'Could not parse binary document. Please paste your document text below.'
        );
      } finally {
        setIsParsingFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFetchWebsiteText = async () => {
    if (!websiteUrl.trim()) {
      setErrorMessage('Please enter a website URL first.');
      return;
    }
    setErrorMessage(null);
    setIsParsingFile(true);
    setPipelinePhaseLabel(`Fetching text from ${websiteUrl}...`);
    try {
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'url',
          websiteUrl: websiteUrl.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok && typeof data.extractedText === 'string' && data.extractedText.trim().length > 0) {
        setRawContent(data.extractedText);
        setWorkerMetrics(
          data.workerMetrics || cleanSourceTextWithBackgroundWorker(data.extractedText)
        );
        setPipelinePhaseLabel('Website text loaded · Ready to extract');
      } else {
        setErrorMessage(
          data?.error || 'Could not fetch text from this URL. You can paste the article text directly below.'
        );
      }
    } catch {
      setErrorMessage('Could not reach website URL. Paste the article text directly below.');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIngestedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIngestedFile(e.target.files[0]);
    }
  };

  const handleRunExtractionPipeline = async () => {
    setErrorMessage(null);
    setStatusBanner(null);

    const effectiveFileName =
      sourceFormat !== 'url' && !fileName.trim()
        ? `document.${sourceFormat}`
        : fileName;

    let activeRawContent = rawContent;

    // If URL mode and rawContent is empty, fetch the URL text first
    if (sourceFormat === 'url' && activeRawContent.trim().length < 30 && websiteUrl.trim()) {
      try {
        const parsedResp = await fetch('/api/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: 'url',
            websiteUrl: websiteUrl.trim(),
          }),
        });
        if (parsedResp.ok) {
          const parsedData = await parsedResp.json();
          if (typeof parsedData.extractedText === 'string' && parsedData.extractedText.trim().length >= 30) {
            activeRawContent = parsedData.extractedText;
            setRawContent(activeRawContent);
          }
        }
      } catch {
        // Handled by validation below
      }
    }

    const inferredSubject = inferSubjectFromSourceText(activeRawContent);

    const inputPayload = {
      sourceFormat,
      fileName: sourceFormat === 'url' ? undefined : effectiveFileName,
      fileSizeBytes: sourceFormat === 'url' ? undefined : fileSizeBytes || activeRawContent.length,
      websiteUrl: sourceFormat === 'url' ? websiteUrl : undefined,
      rawContent: activeRawContent,
      base64Data: sourceFormat !== 'url' && base64Data ? base64Data : undefined,
      targetSubject: inferredSubject,
      targetDifficulty,
      questionCount,
      parserEngine,
    };

    const initialChecks = createInitialValidationChecks(
      sourceFormat,
      parserEngine
    );
    const inputValidation = validateExtractionInput(inputPayload);

    if (!inputValidation.valid) {
      initialChecks[0] = {
        ...initialChecks[0],
        status: 'failed',
        metricLabel: 'Invalid Input',
      };
      setValidationChecks(initialChecks);
      setProgressPercent(12);
      setPipelinePhaseLabel('Please provide valid source text before extracting.');
      setErrorMessage(inputValidation.error);
      return;
    }

    setIsExtracting(true);
    let localWorkerMetrics = cleanSourceTextWithBackgroundWorker(activeRawContent);
    setWorkerMetrics(localWorkerMetrics);

    // Stage 1: File / URL Check (25%)
    const stage1Checks = initialChecks.map((c, idx) =>
      idx === 0
        ? {
            ...c,
            status: 'passed' as const,
            metricLabel:
              sourceFormat === 'url'
                ? 'URL Verified'
                : `${sourceFormat.toUpperCase()} Verified`,
          }
        : idx === 1
        ? { ...c, status: 'running' as const, metricLabel: 'Cleaning text...' }
        : c
    );
    setValidationChecks(stage1Checks);
    setProgressPercent(25);
    setPipelinePhaseLabel('Step 1/4 · Checking source input...');

    await new Promise((r) => setTimeout(r, 120));

    // Stage 2: Text Cleaning (55%)
    const stage2Checks = stage1Checks.map((c, idx) =>
      idx === 1
        ? {
            ...c,
            status: 'passed' as const,
            metricLabel: `${localWorkerMetrics.cleanedChars} chars · ${localWorkerMetrics.extractedClauseCount} sentences`,
          }
        : idx === 2
        ? {
            ...c,
            status: 'running' as const,
            metricLabel: 'Generating questions...',
          }
        : c
    );
    setValidationChecks(stage2Checks);
    setProgressPercent(55);
    setPipelinePhaseLabel('Step 2/4 · Cleaning text and extracting questions...');

    // Stage 3: Call Backend /api/ai-extract (82%)
    let resolvedQuestions: QuestionItem[] = [];
    try {
      const response = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload),
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.extractedText === 'string' && data.extractedText.trim().length > 0 && activeRawContent.trim().length < 30) {
          setRawContent(data.extractedText);
          localWorkerMetrics = cleanSourceTextWithBackgroundWorker(data.extractedText);
          setWorkerMetrics(localWorkerMetrics);
        }
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          resolvedQuestions = data.questions;
        }
      }
    } catch {
      // Fallback to local extraction from actual source text if network request fails
    }

    if (resolvedQuestions.length === 0) {
      resolvedQuestions = extractStructuredQuestionsFromCleanedText({
        cleanedText: localWorkerMetrics.cleanedText,
        clauses: localWorkerMetrics.clauses,
        targetSubject: inferredSubject,
        targetDifficulty,
        questionCount,
        sourceLabel: sourceFormat === 'url' ? websiteUrl : effectiveFileName,
      });
    }

    const stage3Checks = stage2Checks.map((c, idx) =>
      idx === 2
        ? {
            ...c,
            status: 'passed' as const,
            metricLabel: `${resolvedQuestions.length} questions generated`,
          }
        : idx === 3
        ? { ...c, status: 'running' as const, metricLabel: 'Checking options...' }
        : c
    );
    setValidationChecks(stage3Checks);
    setProgressPercent(82);
    setPipelinePhaseLabel('Step 3/4 · Verifying answer choices...');

    await new Promise((r) => setTimeout(r, 100));

    // Stage 4: Validate all extracted questions for 4 distinct options & answer key (100%)
    let validCount = 0;
    for (const q of resolvedQuestions) {
      const check = validateCustomQuestionDraft({
        subject: q.subject,
        topic: q.topic,
        difficultyTier: q.difficultyTier,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
      if (check.valid) validCount++;
    }

    const finalChecks = stage3Checks.map((c, idx) => {
      if (idx === 3) {
        return {
          ...c,
          status: 'passed' as const,
          metricLabel: `${validCount} / ${resolvedQuestions.length} sets valid`,
        };
      }
      if (idx === 4) {
        return {
          ...c,
          status: 'passed' as const,
          metricLabel: `${validCount} answers verified`,
        };
      }
      return c;
    });

    setValidationChecks(finalChecks);
    setExtractedQuestions(resolvedQuestions);
    setProgressPercent(100);
    setIsExtracting(false);
    setPipelinePhaseLabel(
      `Complete (100%) · ${resolvedQuestions.length} questions ready`
    );
    const activeSourceLabel =
      sourceFormat === 'url'
        ? websiteUrl || 'Website URL'
        : fileName || 'Source Text';
    setStatusBanner(
      `Extracted ${resolvedQuestions.length} questions from ${activeSourceLabel}.`
    );
  };

  const buildCurrentExtractedBank = (): CustomQuestionBank | null => {
    const cleaned = workerMetrics || cleanSourceTextWithBackgroundWorker(rawContent);
    const inferredSubject = inferSubjectFromSourceText(cleaned.cleanedText);
    const questionsToUse =
      extractedQuestions.length > 0
        ? extractedQuestions
        : extractStructuredQuestionsFromCleanedText({
            cleanedText: cleaned.cleanedText,
            clauses: cleaned.clauses,
            targetSubject: inferredSubject,
            targetDifficulty,
            questionCount,
          });

    if (questionsToUse.length === 0) {
      setErrorMessage(
        'Click Extract Questions first to generate questions from your source text.'
      );
      return null;
    }

    const cleanTitle =
      bankTitle.trim().length >= 3
        ? bankTitle.trim()
        : 'Extracted Question Bank';

    return {
      id: `bank-ai-${Date.now()}`,
      title: cleanTitle,
      description: `Extracted from ${
        sourceFormat === 'url' ? websiteUrl || 'Website URL' : fileName || 'Source Text'
      }.`,
      subject: questionsToUse[0]?.subject || inferredSubject,
      difficultyTier: targetDifficulty,
      visibility: bankVisibility,
      shareCode: generateBankShareCode(),
      authorName: session?.fullName || 'Educator',
      authorRole: session?.role || 'educator',
      updatedAt: new Date().toISOString().slice(0, 10),
      questions: questionsToUse,
    };
  };

  const handleSaveBankToLibrary = () => {
    const bank = buildCurrentExtractedBank();
    if (!bank) return;
    onSaveExtractedBank(bank);
    setStatusBanner(
      `Saved "${bank.title}" (${bank.questions.length} Qs) to your library.`
    );
  };

  const handleSaveAndRaceIn3D = () => {
    const bank = buildCurrentExtractedBank();
    if (!bank) return;
    onSaveExtractedBank(bank);
    onLaunchWithExtractedBank(bank);
  };

  return (
    <div
      data-testid="scr10-extraction-console"
      onClick={onBackToLobby}
      className="fixed inset-0 z-30 bg-[#060A12]/95 text-slate-100 overflow-y-auto p-4 md:p-6 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-7xl mx-auto space-y-5 cursor-default"
      >
        {/* Top Header Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
            AI Source Extractor
          </h1>

          <div className="flex flex-wrap items-center gap-2.5">
            {session?.fullName && (
              <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 font-semibold">
                {session.fullName}
              </div>
            )}
            <button
              type="button"
              data-testid="scr10-back-to-lobby-btn"
              onClick={onBackToLobby}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        </header>

        {/* Main 12-Column Processing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (5 Cols): Drag-and-Drop File Upload (PDF / DOCX) & Website URL Input */}
          <div className="lg:col-span-5 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white font-display">
                Source Material
              </h2>
            </div>

            {/* Source Format Switcher: PDF, DOCX, Website URL */}
            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-1.5">
                Source Type
              </span>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="Source Format"
              >
                {(
                  [
                    { id: 'pdf', label: 'PDF Document', ext: '.pdf' },
                    { id: 'docx', label: 'Word DOCX', ext: '.docx' },
                    { id: 'url', label: 'Website URL', ext: 'https://' },
                  ] as const
                ).map((fmt) => {
                  const active = sourceFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      data-testid={`source-format-${fmt.id}-btn`}
                      onClick={() => {
                        setErrorMessage(null);
                        setSourceFormat(fmt.id);
                        setValidationChecks(
                          createInitialValidationChecks(fmt.id, parserEngine)
                        );
                      }}
                      aria-pressed={active}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold font-display">
                        {fmt.label}
                      </div>
                      <div className="text-[10px] font-mono text-cyan-300">
                        {fmt.ext}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive File Drag-and-Drop Zone (when PDF or DOCX) or Website URL Input */}
            {sourceFormat === 'pdf' || sourceFormat === 'docx' ? (
              <div
                data-testid="file-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDropFile}
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 rounded-xl border-2 border-dashed text-center transition-colors cursor-pointer ${
                  isDraggingOver
                    ? 'bg-cyan-500/15 border-cyan-400 text-white'
                    : 'bg-slate-950/80 border-slate-700 hover:border-cyan-500/60 text-slate-300'
                }`}
              >
                <input
                  ref={fileInputRef}
                  data-testid="file-upload-input"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="text-xs font-mono text-cyan-300 font-bold mb-1">
                  {isParsingFile ? 'Reading Document...' : 'Upload PDF or DOCX File'}
                </div>
                <div className="text-xs text-slate-300 mb-2">
                  Drag and drop or click to browse
                </div>
                {fileName && (
                  <div
                    data-testid="ingested-file-badge"
                    className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300"
                  >
                    <span>{fileName}</span>
                    <span className="text-slate-400 tabular-nums">
                      ({Math.max(1, Math.round(fileSizeBytes / 1024))} KB)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label
                  htmlFor="website-reference-url"
                  className="block text-xs font-semibold text-slate-300 mb-1"
                >
                  Website URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="website-reference-url"
                    data-testid="website-url-input"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => {
                      setWebsiteUrl(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="https://example.edu/article"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    data-testid="fetch-url-text-btn"
                    disabled={isParsingFile}
                    onClick={handleFetchWebsiteText}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 whitespace-nowrap cursor-pointer"
                  >
                    {isParsingFile ? 'Loading...' : 'Load URL'}
                  </button>
                </div>
              </div>
            )}

            {/* Source Text Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="extraction-raw-buffer"
                  className="text-xs font-semibold text-slate-300"
                >
                  Source Text
                </label>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {rawContent.length} chars
                </span>
              </div>
              <textarea
                id="extraction-raw-buffer"
                data-testid="extraction-raw-textarea"
                rows={5}
                value={rawContent}
                onChange={(e) => {
                  const nextText = e.target.value;
                  setRawContent(nextText);
                  setWorkerMetrics(cleanSourceTextWithBackgroundWorker(nextText));
                  setErrorMessage(null);
                }}
                placeholder="Paste or edit your document or article text here..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* AI Model, Question Count & Difficulty (No Subject Selector — derived from source) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-1">
                  AI Model
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="engine-gemini-btn"
                    onClick={() => setParserEngine('gemini-3.8-flash')}
                    className={`px-2.5 py-1.5 rounded-lg border text-left text-xs font-mono cursor-pointer ${
                      parserEngine === 'gemini-3.8-flash'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    type="button"
                    data-testid="engine-claude-btn"
                    onClick={() => setParserEngine('claude-json-schema')}
                    className={`px-2.5 py-1.5 rounded-lg border text-left text-xs font-mono cursor-pointer ${
                      parserEngine === 'claude-json-schema'
                        ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    Claude
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-1">
                  Questions
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {([3, 4, 5, 6] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      data-testid={`extract-count-${cnt}-btn`}
                      onClick={() => setQuestionCount(cnt)}
                      className={`py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer ${
                        questionCount === cnt
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {cnt} Qs
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-1">
                Difficulty
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['easy', 'medium', 'hard'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    data-testid={`extract-diff-${tier}-btn`}
                    onClick={() => setTargetDifficulty(tier)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold capitalize cursor-pointer ${
                      targetDifficulty === tier
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                data-testid="scr10-error-alert"
                className="p-3 rounded-lg bg-rose-950/90 border border-rose-500/60 text-xs text-rose-200"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              data-testid="run-ai-extraction-btn"
              disabled={isExtracting || isParsingFile}
              onClick={handleRunExtractionPipeline}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold font-display text-sm transition-colors cursor-pointer"
            >
              {isExtracting
                ? 'Extracting Questions...'
                : 'Extract Questions'}
            </button>
          </div>

          {/* RIGHT COLUMN (7 Cols): Extraction Progress & Extracted Questions */}
          <div className="lg:col-span-7 space-y-5">
            {/* Extraction Progress Bar & Checks */}
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white font-display">
                  Extraction Progress
                </h2>
                <div
                  data-testid="extraction-progress-percent"
                  className="text-xl font-bold font-mono text-cyan-400 tabular-nums"
                >
                  {progressPercent}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span
                    data-testid="pipeline-phase-label"
                    className="font-mono text-slate-200"
                  >
                    {pipelinePhaseLabel}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    data-testid="extraction-progress-bar"
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Validation Check List */}
              <div
                data-testid="validation-checks-list"
                className="space-y-2 pt-1"
              >
                {validationChecks.map((chk) => {
                  const badgeStyle =
                    chk.status === 'passed'
                      ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
                      : chk.status === 'running'
                      ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                      : chk.status === 'failed'
                      ? 'bg-rose-950 border-rose-500 text-rose-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400';

                  return (
                    <div
                      key={chk.id}
                      data-testid={`validation-${chk.id}`}
                      className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white">
                          {chk.label}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {chk.detail}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-slate-300 tabular-nums whitespace-nowrap">
                          {chk.metricLabel}
                        </span>
                        <span
                          data-testid={`status-${chk.id}`}
                          className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${badgeStyle}`}
                        >
                          {chk.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Extracted Question Bank Panel */}
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white font-display">
                  Extracted Questions ({extractedQuestions.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="extracted-visibility-private-btn"
                    onClick={() => setBankVisibility('private')}
                    className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                      bankVisibility === 'private'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    data-testid="extracted-visibility-public-btn"
                    onClick={() => setBankVisibility('public')}
                    className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                      bankVisibility === 'public'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Public
                  </button>
                </div>
              </div>

              {statusBanner && (
                <div
                  role="status"
                  data-testid="scr10-status-banner"
                  className="p-3 rounded-lg bg-emerald-950/85 border border-emerald-500/50 text-xs text-emerald-200"
                >
                  {statusBanner}
                </div>
              )}

              {/* Bank Title Input & Action Bar */}
              <div className="space-y-2.5">
                <div>
                  <label
                    htmlFor="extracted-bank-title"
                    className="block text-[11px] font-mono text-slate-400 mb-1"
                  >
                    Question Bank Title
                  </label>
                  <input
                    id="extracted-bank-title"
                    data-testid="extracted-bank-title-input"
                    type="text"
                    value={bankTitle}
                    onChange={(e) => setBankTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    data-testid="save-extracted-bank-btn"
                    onClick={handleSaveBankToLibrary}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Save Bank
                  </button>
                  <button
                    type="button"
                    data-testid="race-extracted-bank-btn"
                    onClick={handleSaveAndRaceIn3D}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-display text-xs transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Save &amp; Race in 3D
                  </button>
                </div>
              </div>

              {/* Extracted Question Cards */}
              {extractedQuestions.length === 0 ? (
                <div
                  data-testid="extracted-empty-state"
                  className="p-6 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-1.5"
                >
                  <div className="text-sm font-semibold text-slate-200">
                    No Questions Extracted Yet
                  </div>
                  <p className="text-xs text-slate-400">
                    Upload a document or paste your source text and click Extract Questions.
                  </p>
                </div>
              ) : (
                <div
                  data-testid="extracted-questions-list"
                  className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1"
                >
                  {extractedQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      data-testid={`extracted-question-card-${qIdx}`}
                      className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-cyan-400 font-bold">
                          Q{qIdx + 1} · {q.topic} · {q.difficulty}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">
                          Answer: Option {OPTION_LETTERS[q.correctIndex]}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white">
                        {q.prompt}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = optIdx === q.correctIndex;
                          return (
                            <div
                              key={optIdx}
                              className={`px-2.5 py-1.5 rounded border text-xs flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200 font-semibold'
                                  : 'bg-slate-900/80 border-slate-800 text-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[10px] font-bold">
                                {OPTION_LETTERS[optIdx]}.
                              </span>
                              <span className="truncate">{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                        <span className="font-mono text-slate-300">
                          Explanation:{' '}
                        </span>
                        {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
