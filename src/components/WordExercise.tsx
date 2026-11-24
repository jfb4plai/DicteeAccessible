import { useEffect, useReducer, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import LetterBoard from './LetterBoard';
import { createExercise, exerciseReducer } from '../lib/letterExercise';
import { SPEED_DEFAULT, SPEED_FASTER, SPEED_SLOWEST } from '../lib/speed';
import { pickParasiteLetters, type LetterProximity } from '../lib/parasiteLetters';
import type { Stage } from '../lib/types';

export type AttemptResult = { answer: string; correct: boolean; listens: number; screenshot: string | null };

type Props = {
  word: string;
  letterParasites: { count: number; proximity: LetterProximity };
  stage: Stage;
  canShowCorrect: boolean;
  readAloud: boolean;
  progressLabel: string;
  speak: (rate?: number) => Promise<void>;
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
  const [state, dispatch] = useReducer(exerciseReducer, p.word, w => createExercise(w, Math.random, pickParasiteLetters(w, p.letterParasites.count, p.letterParasites.proximity)));
  const [helpShown, setHelpShown] = useState(false);
  const listens = useRef(0);
  const reported = useRef(0);

  useEffect(() => {
    if (!p.readAloud) return;
    const t = setTimeout(() => { void p.speak(SPEED_FASTER); }, 500); // lecture automatique : vitesse naturelle, comme avant
    return () => clearTimeout(t);
  }, [p.word, p.readAloud]);

  useEffect(() => {
    if ((state.phase !== 'right' && state.phase !== 'wrong') || state.attemptCount <= reported.current) return;
    reported.current = state.attemptCount;
    const answer = state.placed.join('');
    const correct = state.phase === 'right';
    const heard = listens.current;
    listens.current = 0;
    // Pas de capture au dernier tour : l'enregistrement doit précéder le passage au mot suivant.
    const shot = correct || p.stage === 'C' ? Promise.resolve(null) : captureWordArea();
    void shot.then(screenshot => p.onAttempt({ answer, correct, listens: heard, screenshot }));
  }, [state.phase, state.attemptCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === 'wrong') {
      // Dernier tour : le mot est enregistré tel quel, on passe au suivant sans second essai.
      const t = setTimeout(() => (p.stage === 'C' ? p.onNext() : dispatch({ type: 'retry' })), RETRY_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (state.phase === 'right') {
      const t = setTimeout(p.onNext, NEXT_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function listen(rate = SPEED_DEFAULT) {
    listens.current += 1;
    void p.speak(rate);
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
        <button type="button" className="plai-btn" onClick={() => listen()}>Écouter le mot</button>
        <button type="button" className="plai-btn-ghost ml-2" onClick={() => listen(SPEED_FASTER)}>Un peu plus vite</button>
        <button type="button" className="plai-btn-ghost ml-2" onClick={() => listen(SPEED_SLOWEST)}>Très lentement</button>
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
        neutral={p.stage === 'C'}
      />

      {(state.phase === 'right' || (state.phase === 'wrong' && p.stage === 'C')) && (
        <div className="text-center mt-4">
          <button type="button" className="plai-btn" onClick={p.onNext}>Mot suivant</button>
        </div>
      )}
    </div>
  );
}
