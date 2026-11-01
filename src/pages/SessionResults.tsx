import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import { getPupilAttempts, getResults, saveComment } from '../lib/api';
import { summarizeItem, summarizeSession, type ItemSummary } from '../lib/progress';
import type { AttemptRow } from '../lib/types';

type Results = Awaited<ReturnType<typeof getResults>>;

export default function SessionResults() {
  const { sessionId = '' } = useParams();
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const [pupilId, setPupilId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<AttemptRow[] | null>(null);
  const [body, setBody] = useState('');
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    getResults(sessionId).then(setData).catch((e: Error) => setError(e.message));
  }, [sessionId]);

  // Vue de classe : une ligne par élève.
  const classRows = useMemo(() => {
    if (!data) return [];
    return data.pupils.map(p => {
      const rows = data.attempts.filter(a => a.pupilId === p.id);
      const sums = data.items.map(i => summarizeItem(i, rows, data.options.finalRound));
      return { pupil: p, ...summarizeSession(sums), started: rows.length > 0 };
    });
  }, [data]);

  function openPupil(id: string) {
    setPupilId(id);
    setDetailRows(null);
    setSaved('');
    const c = data?.comments.find(x => x.pupilId === id);
    setBody(c?.body ?? '');
    setVisible(c?.visible ?? false);
    getPupilAttempts(sessionId, id).then(setDetailRows).catch((e: Error) => setError(e.message));
  }

  const summaries: ItemSummary[] = useMemo(() => {
    if (!data || !detailRows) return [];
    return data.items.map(i => summarizeItem(i, detailRows, data.options.finalRound));
  }, [data, detailRows]);

  async function save() {
    if (!pupilId) return;
    try {
      await saveComment(sessionId, { pupilId, body, visible });
      setSaved('Commentaire enregistré.');
    } catch (e) {
      setSaved((e as Error).message);
    }
  }

  const pupil = data?.pupils.find(p => p.id === pupilId);
  const totals = summarizeSession(summaries);

  return (
    <PageShell wide actions={<TeacherNav />}>
      <p><Link to="/enseignant">← Mes dictées</Link></p>
      {error && <p className="plai-error">{error}</p>}
      {!data && !error && <p className="help">Chargement…</p>}

      {data && (
        <>
          <h1 className="text-3xl my-3">{data.title}</h1>

          <section className="plai-card">
            <h2 className="text-xl mb-2">Les élèves</h2>
            {classRows.length === 0 && <p className="plai-empty">Aucun élève rattaché à cette dictée.</p>}
            {classRows.map(r => (
              <div key={r.pupil.id} className="flex flex-wrap items-center justify-between gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <strong>{r.pupil.code}</strong>
                <span>
                  {r.started ? `${r.firstTry} sur ${r.total} réussis du premier coup · ${r.toReview} à revoir` : 'Aucune réponse enregistrée'}
                </span>
                <button type="button" className="plai-btn-ghost" onClick={() => openPupil(r.pupil.id)}>Ouvrir</button>
              </div>
            ))}
          </section>

          {pupil && (
            <section className="plai-card">
              <h2 className="text-xl mb-2">Élève {pupil.code}</h2>
              {!detailRows && <p className="help">Chargement…</p>}
              {detailRows && detailRows.length === 0 && <p className="plai-empty">Aucune réponse enregistrée pour cet élève.</p>}
              {detailRows && detailRows.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-3 mb-3">
                    <div className="plai-card"><strong style={{ fontSize: 24 }}>{totals.firstTry} sur {totals.total}</strong><p className="help">réussis du premier coup (information, pas une note)</p></div>
                    <div className="plai-card"><strong style={{ fontSize: 24 }}>{totals.toReview} à revoir</strong><p className="help">aide utilisée, repris ou non maîtrisé</p></div>
                  </div>
                  {summaries.map(s => (
                    <details key={s.itemId} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                      <summary style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`dot dot-${s.status}`} aria-hidden="true" />
                        <strong style={{ minWidth: 120 }}>{s.word}</strong>
                        <span>{s.label}</span>
                      </summary>
                      <div className="help" style={{ margin: '8px 0 4px 26px' }}>
                        <p><strong>Écrit au 1er essai :</strong> {s.firstAnswer ?? 'aucun'}</p>
                        <p><strong>Essais :</strong> {s.attemptsA} · <strong>Écoutes :</strong> {s.listens}{s.helpUsed ? ' · bonne orthographe montrée' : ''}</p>
                        {s.screenshots.map((src, i) => <img key={i} src={src} alt={`Capture de l'erreur ${i + 1} pour ${s.word}`} style={{ maxWidth: 360, border: '1px solid var(--border)', marginTop: 6 }} />)}
                      </div>
                    </details>
                  ))}
                </>
              )}

              <div className="plai-field mt-4">
                <label className="plai-label" htmlFor="comment">Ton commentaire pour cette dictée</label>
                <textarea id="comment" rows={3} className="plai-input" value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Exemple : confond « lendemain » avec une forme en -in ; reprendre « chaussure » cette semaine." />
                <p className="help">C'est toi qui interprètes ces résultats. L'application ne donne ni note ni conclusion sur l'élève.</p>
              </div>
              <label><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> <strong>Visible par les personnes autorisées</strong></label>
              <p className="help">Par défaut, le commentaire reste privé. Les personnes autorisées pourront le lire quand l'accès externe sera disponible.</p>
              <button type="button" className="plai-btn mt-2" onClick={save}>Enregistrer le commentaire</button>
              {saved && <p className="help" role="status">{saved}</p>}
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}
