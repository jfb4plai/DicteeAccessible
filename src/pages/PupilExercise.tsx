import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import WordExercise, { type AttemptResult } from '../components/WordExercise';
import SentenceExercise, { type SentenceAttemptResult } from '../components/SentenceExercise';
import { openSession, recordAttempt, recordHelp, recordSentenceAttempt } from '../lib/api';
import { normalizeCode } from '../lib/apiMapping';
import { createPlayer, type Player } from '../lib/audio';
import { applyPendingJobs } from '../lib/pendingRows';
import { nextStep, type Step } from '../lib/progress';
import { createSaveQueue } from '../lib/saveQueue';
import { shuffleArray } from '../lib/utils';
import type { AttemptRow, DictaItem, DictaSentence, OpenedSession, SaveJob as Job } from '../lib/types';

// Envois pas encore partis, gardés dans le navigateur : ils survivent à la fermeture de l'onglet.
function jobStorage(accessCode: string, pupilCode: string) {
  const key = `dicta-file:${normalizeCode(accessCode)}:${normalizeCode(pupilCode)}`;
  return {
    load: (): Job[] => {
      try { return JSON.parse(localStorage.getItem(key) ?? '[]') as Job[]; } catch { return []; }
    },
    save: (jobs: Job[]) => localStorage.setItem(key, JSON.stringify(jobs)),
  };
}

export default function PupilExercise() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const accessCode = params.get('session') ?? '';
  const pupilCode = params.get('eleve') ?? '';

  const [opened, setOpened] = useState<OpenedSession | null>(null);
  const [items, setItems] = useState<DictaItem[]>([]);
  const [sentences, setSentences] = useState<DictaSentence[]>([]);
  const [current, setCurrent] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const rowsRef = useRef<AttemptRow[]>([]);
  const queueRef = useRef<ReturnType<typeof createSaveQueue<Job>> | null>(null);
  const playerRef = useRef<Player | null>(null);

  // Ouverture de la dictée. Les lignes déjà enregistrées décident de la suite (reprise après rechargement).
  useEffect(() => {
    if (!accessCode || !pupilCode) { navigate('/eleve'); return; }
    const storage = jobStorage(accessCode, pupilCode);
    let cancelled = false; // évite deux files sur la même mémoire (double montage)
    openSession(accessCode, pupilCode)
      .then(s => {
        if (cancelled) return;
        const shuffled = shuffleArray(s.items);
        // Les lignes du serveur ne contiennent pas encore les envois en attente : on les ajoute avant de choisir la suite.
        const rows = applyPendingJobs(s.attempts, storage.load(), shuffled, s.sentences);
        queueRef.current = createSaveQueue<Job>({
          send: job => {
            if (job.kind === 'help') return recordHelp({ accessCode, pupilCode, itemId: job.itemId, stage: job.stage });
            if (job.kind === 'sentence') {
              return recordSentenceAttempt({ accessCode, pupilCode, sentenceId: job.sentenceId, stage: job.stage, answer: job.answer, listens: job.listens }).then(() => undefined);
            }
            return recordAttempt({ accessCode, pupilCode, itemId: job.itemId, stage: job.stage, answer: job.answer, listens: job.listens, screenshot: job.screenshot }).then(() => undefined);
          },
          onChange: setPending,
          storage,
        });
        rowsRef.current = rows;
        playerRef.current = createPlayer({ accessCode, voice: s.voice });
        void playerRef.current.prepare(shuffled, s.sentences);
        setOpened(s);
        setItems(shuffled);
        setSentences(s.sentences);
        setCurrent(nextStep({ items: shuffled, sentences: s.sentences, rows, mode: s.mode, finalRound: s.options.finalRound }));
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [accessCode, pupilCode, navigate]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if ((queueRef.current?.pending() ?? 0) > 0) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function handleAttempt(step: Step, r: AttemptResult) {
    const item = step.item!;
    const attemptNumber = rowsRef.current.filter(
      x => x.itemId === item.id && x.stage === step.stage && x.kind === 'attempt',
    ).length + 1;
    rowsRef.current = [
      ...rowsRef.current,
      { itemId: item.id, stage: step.stage, kind: 'attempt', attemptNumber, correct: r.correct },
    ];
    queueRef.current?.enqueue({ kind: 'attempt', itemId: item.id, stage: step.stage, answer: r.answer, listens: r.listens, screenshot: r.screenshot });
  }

  function handleHelp(step: Step) {
    const item = step.item!;
    rowsRef.current = [
      ...rowsRef.current,
      { itemId: item.id, stage: step.stage, kind: 'help', attemptNumber: 0, correct: null },
    ];
    queueRef.current?.enqueue({ kind: 'help', itemId: item.id, stage: step.stage });
  }

  function handleSentenceAttempt(step: Step, r: SentenceAttemptResult) {
    const sentence = step.sentence!;
    const stage = step.stage as 'B1' | 'B2';
    const attemptNumber = rowsRef.current.filter(
      x => x.sentenceId === sentence.id && x.stage === stage && x.kind === 'attempt',
    ).length + 1;
    rowsRef.current = [
      ...rowsRef.current,
      { itemId: '', sentenceId: sentence.id, stage, kind: 'attempt', attemptNumber, correct: r.correct },
    ];
    queueRef.current?.enqueue({ kind: 'sentence', sentenceId: sentence.id, stage, answer: r.answer, listens: r.listens });
  }

  function handleNext() {
    if (!opened) return;
    setCurrent(nextStep({ items, sentences, rows: rowsRef.current, mode: opened.mode, finalRound: opened.options.finalRound }));
  }

  if (error) {
    return (
      <PageShell>
        <p className="plai-error">
          {error === 'Code inconnu' ? 'Code inconnu. Vérifier les deux codes avec ton enseignant(e).' : error}
        </p>
        <Link to="/eleve" className="plai-btn-ghost inline-block no-underline">Revenir aux codes</Link>
      </PageShell>
    );
  }
  if (!opened) return <PageShell><p className="help">Chargement de la dictée…</p></PageShell>;

  const pendingBanner = pending > 0 && (
    <p className="plai-error" role="status">Enregistrement en attente. Garder cette page ouverte.</p>
  );

  if (!current) {
    return (
      <PageShell>
        {pendingBanner}
        <h1 className="text-3xl mb-2">Dictée terminée</h1>
        <p className="mb-4">Merci. Ton enseignant(e) lira tes réponses.</p>
        <Link to="/" className="plai-btn-ghost inline-block no-underline">Revenir à l'accueil</Link>
      </PageShell>
    );
  }

  const key = `${current.stage}:${current.item?.id ?? current.sentence?.id}`;

  if (current.sentence && (current.stage === 'B1' || current.stage === 'B2')) {
    const stage = current.stage;
    const done = sentences.filter(s => rowsRef.current.some(
      r => r.sentenceId === s.id && r.stage === stage && r.kind === 'attempt' && (opened.mode === 'class' || r.correct === true),
    )).length;
    return (
      <PageShell>
        {pendingBanner}
        <SentenceExercise
          key={key}
          sentence={current.sentence}
          stage={stage}
          mode={opened.mode}
          readAloud={opened.options.readAloud}
          progressLabel={`Phrase ${Math.min(done + 1, sentences.length)} sur ${sentences.length}`}
          speak={() => playerRef.current!.playSentence(current.sentence!)}
          onAttempt={r => handleSentenceAttempt(current, r)}
          onNext={handleNext}
        />
      </PageShell>
    );
  }

  const item = current.item!;
  const doneA = items.filter(i =>
    rowsRef.current.some(r => r.itemId === i.id && r.stage === 'A' && r.kind === 'attempt' && r.correct === true)).length;
  const progressLabel = current.stage === 'A'
    ? `Mot ${Math.min(doneA + 1, items.length)} sur ${items.length}`
    : 'Dernier tour : sans aide';

  return (
    <PageShell>
      {pendingBanner}
      <WordExercise
        key={key}
        word={item.word}
        stage={current.stage}
        canShowCorrect={opened.options.showCorrect && current.stage === 'A'}
        readAloud={opened.options.readAloud}
        progressLabel={progressLabel}
        speak={() => playerRef.current!.playWord(item)}
        onAttempt={r => handleAttempt(current, r)}
        onHelp={() => handleHelp(current)}
        onNext={handleNext}
      />
    </PageShell>
  );
}
