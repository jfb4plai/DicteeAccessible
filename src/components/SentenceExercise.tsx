import { useEffect, useReducer, useRef } from 'react';
import { sentenceForStage } from '../lib/sentences';
import { createTileExercise, tileReducer } from '../lib/tileExercise';
import { speechService } from '../lib/speech';
import type { DictaSentence } from '../lib/types';

export type SentenceAttemptResult = { answer: string; correct: boolean; listens: number };

type Props = {
  sentence: DictaSentence;
  stage: 'B1' | 'B2';
  mode: 'autonomy' | 'class';
  readAloud: boolean;
  progressLabel: string;
  onAttempt: (r: SentenceAttemptResult) => void;
  onNext: () => void;
};

const RETRY_DELAY_MS = 2000;
const NEXT_DELAY_MS = 2500;

const tileStyle = { minWidth: 64, height: 56, padding: '0 12px', fontSize: 22, fontWeight: 700, borderRadius: 8 } as const;

// Une phrase = un composant. Le parent le remonte (key) à chaque nouvelle phrase ou étape.
// B1 : phrase visible. B2 : phrase cachée, mots parasites mêlés aux tuiles (non marqués).
// En classe : un seul essai, aucune indication de la place des erreurs.
export default function SentenceExercise(p: Props) {
  const [state, dispatch] = useReducer(tileReducer, p.sentence, s => createTileExercise(sentenceForStage(s, p.stage)));
  const listens = useRef(0);
  const reported = useRef(0);
  const single = p.mode === 'class';

  useEffect(() => {
    if (!p.readAloud) return;
    const t = setTimeout(() => { void speechService.speak(p.sentence.text); }, 500);
    return () => clearTimeout(t);
  }, [p.sentence.text, p.readAloud]);

  useEffect(() => {
    if ((state.phase !== 'right' && state.phase !== 'wrong') || state.attemptCount <= reported.current) return;
    reported.current = state.attemptCount;
    const heard = listens.current;
    listens.current = 0;
    p.onAttempt({ answer: state.slots.map(t => t!.text).join(' '), correct: state.phase === 'right', listens: heard });
  }, [state.phase, state.attemptCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === 'wrong') {
      const t = setTimeout(() => (single ? p.onNext() : dispatch({ type: 'retry' })), RETRY_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (state.phase === 'right') {
      const t = setTimeout(p.onNext, NEXT_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function listen() {
    listens.current += 1;
    void speechService.speak(p.sentence.text);
  }

  const locked = state.phase === 'right' || state.phase === 'wrong';

  return (
    <div>
      <p className="help mb-2">{p.progressLabel}</p>
      <ul className="mb-4" style={{ paddingLeft: 20, listStyle: 'disc' }}>
        <li>{p.stage === 'B1' ? 'Lire la phrase.' : 'Écouter la phrase.'}</li>
        <li>Placer les mots dans l'ordre.</li>
        {p.stage === 'B2' && <li>Laisser de côté les mots en trop.</li>}
      </ul>

      {p.stage === 'B1'
        ? <p className="text-2xl mb-3" style={{ fontWeight: 700 }}>{p.sentence.text}</p>
        : <p className="mb-3" style={{ background: '#e5e7eb', borderRadius: 8, padding: 14, textAlign: 'center', fontSize: 20 }}>Phrase cachée. Écouter la phrase si besoin.</p>}

      <div className="mb-4">
        <button type="button" className="plai-btn" onClick={listen}>Écouter la phrase</button>
      </div>

      <div className="flex flex-wrap justify-center gap-2 p-4 bg-white rounded-lg" aria-label="Phrase à construire">
        {state.slots.map((tile, slot) => {
          const wrong = !single && state.phase === 'wrong' && state.wrongIdx.includes(slot);
          const right = state.phase === 'right';
          return (
            <button
              key={slot}
              type="button"
              disabled={locked || !tile}
              onClick={() => dispatch({ type: 'unplace', slot })}
              aria-label={tile ? `Mot ${tile.text}, place ${slot + 1}. Retirer.` : `Place ${slot + 1} vide`}
              style={{
                ...tileStyle, minWidth: 72, background: '#fff',
                color: wrong ? '#dc2626' : right ? '#16a34a' : '#1a1814',
                border: `3px ${tile ? 'solid' : 'dashed'} ${wrong ? '#dc2626' : right ? '#16a34a' : '#9ca3af'}`,
              }}
            >
              {tile?.text ?? ''}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-4" aria-label="Mots à placer">
        {state.pool.map((tile, i) => (
          <button
            key={tile.id}
            type="button"
            disabled={locked}
            onClick={() => dispatch({ type: 'place', poolIndex: i })}
            style={{ ...tileStyle, color: '#fff', background: '#f97316', border: 'none' }}
          >
            {tile.text}
          </button>
        ))}
      </div>

      <div className="text-center mt-4" aria-live="polite">
        {state.phase === 'ready' && <button type="button" className="plai-btn" onClick={() => dispatch({ type: 'validate' })}>Valider la phrase</button>}
        {state.phase === 'right' && <p className="text-xl" style={{ color: '#166534' }}>Bravo, la phrase est juste.</p>}
        {state.phase === 'wrong' && single && <p className="text-xl">Réponse enregistrée.</p>}
        {state.phase === 'wrong' && !single && (
          <div>
            <p className="text-xl mb-2" style={{ color: '#b91c1c' }}>Ce n'est pas encore juste. Réessayer.</p>
            <button type="button" className="plai-btn-ghost" onClick={() => dispatch({ type: 'retry' })}>Réessayer maintenant</button>
          </div>
        )}
        {(state.phase === 'right' || (state.phase === 'wrong' && single)) && (
          <div className="mt-3"><button type="button" className="plai-btn" onClick={p.onNext}>Phrase suivante</button></div>
        )}
      </div>
    </div>
  );
}
