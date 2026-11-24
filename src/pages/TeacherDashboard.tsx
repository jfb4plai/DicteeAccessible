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
        <div className="plai-card">
          <h2 className="text-xl mb-2">Bienvenue ! Voici comment démarrer.</h2>
          <ol style={{ paddingLeft: 20, listStyle: 'decimal' }}>
            <li className="mb-1"><strong>Créer une dictée</strong> : un titre, un niveau et des mots suffisent pour commencer.</li>
            <li className="mb-1"><strong>Régler et choisir les élèves</strong> : des onglets te guident, les codes élèves se créent au passage.</li>
            <li className="mb-1"><strong>Publier</strong> : chaque élève reçoit un lien ou un QR code, puis tu lis ses résultats.</li>
          </ol>
          <p className="help mt-2">Rien n'est visible des élèves tant que tu n'as pas publié. Besoin d'aide ? <a href="/mode-emploi.html">Le mode d'emploi</a> reprend ces étapes.</p>
          <p className="mt-3"><Link to="/enseignant/session/nouvelle" className="plai-btn no-underline inline-flex items-center">Créer ma première dictée</Link></p>
        </div>
      )}
      {sessions?.map(s => (
        <div key={s.id} className="plai-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl">{s.title}</h2>
            <p className="help">
              {s.level} · {s.mode === 'class' ? 'dictée en classe' : 'préparation en autonomie'} · {s.wordCount} mots · {s.pupilCount} élèves · {s.published ? `code ${s.accessCode}` : 'brouillon, pas encore publié'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.published ? (
              <>
                <Link to={`/enseignant/session/${s.id}`} className="plai-btn-ghost no-underline inline-flex items-center">Ouvrir (liens, modifier)</Link>
                <Link to={`/enseignant/resultats/${s.id}`} className="plai-btn-ghost no-underline inline-flex items-center">Voir les résultats</Link>
              </>
            ) : (
              <Link to={`/enseignant/session/${s.id}`} className="plai-btn no-underline inline-flex items-center">Continuer la dictée</Link>
            )}
          </div>
        </div>
      ))}
    </PageShell>
  );
}
