import { useEffect, useReducer, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import LetterBoard from './LetterBoard';
import { createExercise, exerciseReducer } from '../lib/letterExercise';
import { speechService } from '../lib/speech';
import type { Stage } from '../lib/types';

export type AttemptResult = { answer: string; correct: boolean; listens: number; screenshot: string | null };

type Props = {
  word: string;
  stage: Stage;
  canShowCorrect: boolean;
  readAloud: boolean;
  progressLabel: string;
  onAttempt: (r: AttemptResult) => void;
  onHelp: () => void;
  onNext: () => void;
};

const RETRY_DELAY_MS = 2000;
const NEXT_DELAY_MS = 2500;

async function captureWordArea(): Promise<string | null> {
  try {
    const el = document.getElementById('word-area');
    if (!el) return null;
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 1 });
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}

// Un mot = un composant. Le parent le remonte (key) à chaque nouveau mot : état et compteurs repartent de zéro.
export default function WordExercise(p: Props) {
  const [state, dispatch] = useReducer(exerciseReducer, p.word, createExercise);
  const [helpShown, setHelpShown] = useState(false);
  const listens = useRef(0);
  const reported = useRef(0);

  useEffect(() => {
    if (!p.readAloud) return;
    const t = setTimeout(() => { void speechService.speak(p.word); }, 500);
    return () => clearTimeout(t);
  }, [p.word, p.readAloud]);

  useEffect(() => {
    if ((state.phase !== 'right' && state.phase !== 'wrong') || state.attemptCount <= reported.current) return;
    reported.current = state.attemptCount;
    const answer = state.placed.join('');
    const correct = state.phase === 'right';
    const heard = listens.current;
    listens.current = 0;
    const shot = correct ? Promise.resolve(null) : captureWordArea();
    void shot.then(screenshot => p.onAttempt({ answer, correct, listens: heard, screenshot }));
  }, [state.phase, state.attemptCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === 'wrong') {
      const t = setTimeout(() => dispatch({ type: 'retry' }), RETRY_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (state.phase === 'right') {
      const t = setTimeout(p.onNext, NEXT_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function listen() {
    listens.current += 1;
    void speechService.speak(p.word);
  }

  function showCorrect() {
    setHelpShown(true);
    p.onHelp();
  }

  return (
    <div>
      <p className="help mb-2">{p.progressLabel}</p>
      <ul className="mb-4" style={{ paddingLeft: 20, listStyle: 'disc' }}>
        <li>Écouter le mot.</li>
        <li>Placer les lettres dans l'ordre.</li>
      </ul>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" className="plai-btn" onClick={listen}>Écouter le mot</button>
        {p.canShowCorrect && !helpShown && state.phase !== 'right' && (
          <button type="button" className="plai-btn-ghost" onClick={showCorrect}>Montrer la bonne orthographe</button>
        )}
      </div>

      {helpShown && (
        <p className="plai-success" style={{ fontSize: 24 }}>Le mot s'écrit : <strong>{p.word}</strong></p>
      )}

      <LetterBoard
        state={state}
        onPlace={poolIndex => dispatch({ type: 'place', poolIndex })}
        onUnplace={slot => dispatch({ type: 'unplace', slot })}
        onValidate={() => dispatch({ type: 'validate' })}
        onRetry={() => dispatch({ type: 'retry' })}
      />

      {state.phase === 'right' && (
        <div className="text-center mt-4">
          <button type="button" className="plai-btn" onClick={p.onNext}>Mot suivant</button>
        </div>
      )}
    </div>
  );
}
