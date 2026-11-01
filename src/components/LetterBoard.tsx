import type { ExerciseState } from '../lib/letterExercise';

type Props = {
  state: ExerciseState;
  onPlace: (poolIndex: number) => void;
  onUnplace: (slot: number) => void;
  onValidate: () => void;
  onRetry: () => void;
};

// Cases du mot (zone capturée en cas d'erreur) + lettres à placer. Cibles de 56 px minimum.
export default function LetterBoard({ state, onPlace, onUnplace, onValidate, onRetry }: Props) {
  const locked = state.phase === 'right' || state.phase === 'wrong';

  return (
    <div>
      <div id="word-area" className="flex flex-wrap justify-center gap-2 p-4 bg-white rounded-lg" aria-label="Mot à écrire">
        {state.placed.map((letter, slot) => {
          const prefilled = state.prefilled.includes(slot);
          const wrong = state.phase === 'wrong' && state.wrongIdx.includes(slot);
          const right = state.phase === 'right';
          const color = wrong ? '#dc2626' : right ? '#16a34a' : '#1a1814';
          return (
            <button
              key={slot}
              type="button"
              disabled={locked || prefilled || !letter}
              onClick={() => onUnplace(slot)}
              aria-label={letter ? `Lettre ${letter}, case ${slot + 1}. Retirer.` : `Case ${slot + 1} vide`}
              style={{
                width: 56, height: 64, fontSize: 28, fontWeight: 700, color,
                border: `3px ${letter ? 'solid' : 'dashed'} ${wrong ? '#dc2626' : right ? '#16a34a' : '#9ca3af'}`,
                borderRadius: 8, background: prefilled ? '#f4f2ee' : '#fff',
              }}
            >
              {letter ?? ''}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-4" aria-label="Lettres à placer">
        {state.pool.map((letter, i) => (
          <button
            key={`${letter}-${i}`}
            type="button"
            disabled={locked}
            onClick={() => onPlace(i)}
            style={{ width: 56, height: 64, fontSize: 28, fontWeight: 700, color: '#fff', background: '#f97316', borderRadius: 8, border: 'none' }}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="text-center mt-4" aria-live="polite">
        {state.phase === 'ready' && (
          <button type="button" className="plai-btn" onClick={onValidate}>Valider le mot</button>
        )}
        {state.phase === 'right' && <p className="text-xl" style={{ color: '#166534' }}>Bravo, le mot est juste.</p>}
        {state.phase === 'wrong' && (
          <div>
            <p className="text-xl mb-2" style={{ color: '#b91c1c' }}>Ce n'est pas encore juste. Réessayer.</p>
            <button type="button" className="plai-btn-ghost" onClick={onRetry}>Réessayer maintenant</button>
          </div>
        )}
      </div>
    </div>
  );
}
