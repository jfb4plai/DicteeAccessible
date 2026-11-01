import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import WordExercise, { type AttemptResult } from '../components/WordExercise';
import { openSession, recordAttempt, recordHelp } from '../lib/api';
import { nextTask } from '../lib/progress';
import { createSaveQueue } from '../lib/saveQueue';
import { shuffleArray } from '../lib/utils';
import type { AttemptRow, DictaItem, OpenedSession, Stage } from '../lib/types';

type Job =
  | { kind: 'attempt'; itemId: string; stage: Stage; answer: string; listens: number; screenshot: string | null }
  | { kind: 'help'; itemId: string; stage: Stage };

type Task = { stage: 'A' | 'C'; item: DictaItem };

export default function PupilExercise() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const accessCode = params.get('session') ?? '';
  const pupilCode = params.get('eleve') ?? '';

  const [opened, setOpened] = useState<OpenedSession | null>(null);
  const [items, setItems] = useState<DictaItem[]>([]);
  const [current, setCurrent] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const rowsRef = useRef<AttemptRow[]>([]);
  const queueRef = useRef<ReturnType<typeof createSaveQueue<Job>> | null>(null);

  // Ouverture de la dictée. Les lignes déjà enregistrées décident de la suite (reprise après rechargement).
  useEffect(() => {
    if (!accessCode || !pupilCode) { navigate('/eleve'); return; }
    queueRef.current = createSaveQueue<Job>({
      send: job => job.kind === 'help'
        ? recordHelp({ accessCode, pupilCode, itemId: job.itemId, stage: job.stage })
        : recordAttempt({ accessCode, pupilCode, itemId: job.itemId, stage: job.stage, answer: job.answer, listens: job.listens, screenshot: job.screenshot }).then(() => undefined),
      onChange: setPending,
    });
    openSession(accessCode, pupilCode)
      .then(s => {
        const shuffled = shuffleArray(s.items);
        rowsRef.current = s.attempts;
        setOpened(s);
        setItems(shuffled);
        setCurrent(nextTask(shuffled, s.attempts, s.options.finalRound));
      })
      .catch((e: Error) => setError(e.message));
  }, [accessCode, pupilCode, navigate]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if ((queueRef.current?.pending() ?? 0) > 0) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function handleAttempt(task: Task, r: AttemptResult) {
    const attemptNumber = rowsRef.current.filter(
      x => x.itemId === task.item.id && x.stage === task.stage && x.kind === 'attempt',
    ).length + 1;
    rowsRef.current = [
      ...rowsRef.current,
      { itemId: task.item.id, stage: task.stage, kind: 'attempt', attemptNumber, correct: r.correct },
    ];
    queueRef.current?.enqueue({ kind: 'attempt', itemId: task.item.id, stage: task.stage, answer: r.answer, listens: r.listens, screenshot: r.screenshot });
  }

  function handleHelp(task: Task) {
    rowsRef.current = [
      ...rowsRef.current,
      { itemId: task.item.id, stage: task.stage, kind: 'help', attemptNumber: 0, correct: null },
    ];
    queueRef.current?.enqueue({ kind: 'help', itemId: task.item.id, stage: task.stage });
  }

  function handleNext() {
    if (!opened) return;
    setCurrent(nextTask(items, rowsRef.current, opened.options.finalRound));
  }

  if (error) {
    return (
      <PageShell>
        <p className="plai-error">
          {error === 'Code inconnu' ? 'Code inconnu. Vérifier les deux codes avec ton enseignante.' : error}
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
        <p className="mb-4">Merci. Ton enseignante lira tes réponses.</p>
        <Link to="/" className="plai-btn-ghost inline-block no-underline">Revenir à l'accueil</Link>
      </PageShell>
    );
  }

  const doneA = items.filter(i =>
    rowsRef.current.some(r => r.itemId === i.id && r.stage === 'A' && r.kind === 'attempt' && r.correct === true)).length;
  const progressLabel = current.stage === 'A'
    ? `Mot ${Math.min(doneA + 1, items.length)} sur ${items.length}`
    : 'Dernier tour : sans aide';

  return (
    <PageShell>
      {pendingBanner}
      <h1 className="text-2xl mb-3">{opened.title}</h1>
      <WordExercise
        key={`${current.stage}:${current.item.id}`}
        word={current.item.word}
        stage={current.stage}
        canShowCorrect={opened.options.showCorrect && current.stage === 'A'}
        readAloud={opened.options.readAloud}
        progressLabel={progressLabel}
        onAttempt={r => handleAttempt(current, r)}
        onHelp={() => handleHelp(current)}
        onNext={handleNext}
      />
    </PageShell>
  );
}
