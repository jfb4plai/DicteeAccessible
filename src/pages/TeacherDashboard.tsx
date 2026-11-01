import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import { listSessions } from '../lib/api';
import type { SessionListItem } from '../lib/types';

export default function TeacherDashboard() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listSessions().then(setSessions).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <PageShell wide actions={<TeacherNav />}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-3xl">Mes dictées</h1>
        <Link to="/enseignant/session/nouvelle" className="plai-btn no-underline inline-flex items-center">Créer une dictée</Link>
      </div>
      {error && <p className="plai-error">{error}</p>}
      {sessions === null && !error && <p className="help">Chargement…</p>}
      {sessions?.length === 0 && (
        <p className="plai-empty">Aucune dictée pour l'instant. Commencer par créer des codes élèves, puis une dictée.</p>
      )}
      {sessions?.map(s => (
        <div key={s.id} className="plai-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl">{s.title}</h2>
            <p className="help">
              {s.level} · {s.mode === 'class' ? 'dictée en classe' : 'préparation en autonomie'} · {s.wordCount} mots · {s.pupilCount} élèves · code {s.accessCode}
            </p>
          </div>
          <Link to={`/enseignant/resultats/${s.id}`} className="plai-btn-ghost no-underline inline-flex items-center">Voir les résultats</Link>
        </div>
      ))}
    </PageShell>
  );
}
