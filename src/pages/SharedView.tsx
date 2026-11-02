import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { viewShare } from '../lib/api';
import { summarizeItem, summarizeSentence, summarizeSession } from '../lib/progress';
import { parseShareToken } from '../lib/shareLink';
import { INVALID_SHARE_MESSAGE, wordsToReview, type SharedSession, type SharedView as View } from '../lib/sharedView';

// Page publique en lecture seule : le jeton vient du fragment de l'adresse (#t=…), jamais de la query string.
function useMeta(name: string, content: string) {
  useEffect(() => {
    const el = document.createElement('meta');
    el.name = name;
    el.content = content;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [name, content]);
}

function SessionCard({ session }: { session: SharedSession }) {
  const items = useMemo(() => session.items.map(i => summarizeItem(i, session.attempts, session.finalRound)), [session]);
  const sentences = useMemo(() => session.sentences.map(s => summarizeSentence(s, session.attempts, session.mode)), [session]);
  const totals = summarizeSession(items);
  return (
    <section className="plai-card">
      <h2 className="text-xl mb-1">{session.title}</h2>
      <p className="help mb-2">{session.level} · {new Date(session.createdAt).toLocaleDateString('fr-BE')} · {totals.firstTry} sur {totals.total} réussis du premier coup · {totals.toReview} à revoir</p>
      {items.map(s => (
        <details key={s.itemId} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <summary style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`dot dot-${s.status}`} aria-hidden="true" />
            <strong style={{ minWidth: 120 }}>{s.word}</strong>
            <span>{s.label}</span>
          </summary>
          <div className="help" style={{ margin: '8px 0 4px 26px' }}>
            <p><strong>Écrit au 1er essai :</strong> {s.firstAnswer ?? 'aucun'}</p>
            <p><strong>Essais :</strong> {s.attemptsA} · <strong>Écoutes :</strong> {s.listens}{s.helpUsed ? ' · bonne orthographe montrée' : ''}</p>
          </div>
        </details>
      ))}
      {sentences.length > 0 && <h3 className="text-lg mt-3 mb-1">Phrases</h3>}
      {sentences.map(s => (
        <details key={s.sentenceId} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <summary style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`dot dot-${s.status}`} aria-hidden="true" />
            <strong>{s.text}</strong>
            <span>{s.label}</span>
          </summary>
          <div className="help" style={{ margin: '8px 0 4px 26px' }}>
            <p><strong>Écrit au 1er essai :</strong> {s.firstAnswer ?? 'aucun'}</p>
            <p><strong>Essais en B2 :</strong> {s.attempts}</p>
          </div>
        </details>
      ))}
      {session.comment && (
        <div className="mt-3">
          <h3 className="text-lg mb-1">Commentaire de l'enseignant(e)</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{session.comment}</p>
        </div>
      )}
    </section>
  );
}

export default function SharedView() {
  useMeta('robots', 'noindex');
  useMeta('referrer', 'no-referrer');
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = parseShareToken(window.location.hash);
    if (!token) { setError(INVALID_SHARE_MESSAGE); return; } // aucun appel réseau pour un lien incomplet
    viewShare(token).then(setView).catch((e: Error) => setError(e.message));
  }, []);

  const review = useMemo(() => (view ? wordsToReview(view) : []), [view]);

  return (
    <PageShell wide>
      {error && <p className="plai-error">{error}</p>}
      {!view && !error && <p className="help">Chargement…</p>}
      {view && (
        <>
          <h1 className="text-3xl mb-2">Résultats de l'élève {view.pupilCode}</h1>
          <p className="plai-banner mb-4">Lecture seule. Les résultats sont une information, pas une note. L'élève n'est connu que par son code.</p>

          {view.sessions.length === 0 ? (
            <p className="plai-empty">Aucun résultat enregistré pour l'instant.</p>
          ) : (
            <>
              <section className="plai-card">
                <h2 className="text-xl mb-2">À revoir</h2>
                {review.length === 0 ? (
                  <p className="help">Rien à revoir pour l'instant.</p>
                ) : (
                  <ul style={{ paddingLeft: 20 }}>
                    {review.map(r => <li key={`${r.sessionId}-${r.word}`}><strong>{r.word}</strong> <span className="help">({r.sessionTitle})</span></li>)}
                  </ul>
                )}
              </section>
              {view.sessions.map(s => <SessionCard key={s.id} session={s} />)}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
