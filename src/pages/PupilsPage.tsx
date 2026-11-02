import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import { createPupils, listPupils } from '../lib/api';
import { nextPupilCodes } from '../lib/codes';
import type { Pupil } from '../lib/types';

export default function PupilsPage() {
  const [pupils, setPupils] = useState<Pupil[] | null>(null);
  const [count, setCount] = useState('5');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPupils().then(setPupils).catch((e: Error) => setError(e.message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > 60) { setError('Choisir un nombre entre 1 et 60.'); return; }
    setBusy(true);
    setError('');
    try {
      // Liste relue juste avant : l'écran peut être en retard sur la base (chargement lent, autre onglet).
      const current = await listPupils();
      const created = await createPupils(nextPupilCodes(current.map(p => p.code), n));
      setPupils([...current, ...created]);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <PageShell actions={<TeacherNav />}>
      <h1 className="text-3xl mb-2">Mes élèves</h1>
      <p className="help mb-4">Une dictée est donnée à des élèves identifiés par un code anonyme (E1, E2…). Crée les codes ici avant ta première dictée, ou directement dans « Nouvelle dictée » si aucun n'existe encore.</p>

      <form onSubmit={add} className="plai-card mb-4">
        <div className="plai-field">
          <label className="plai-label" htmlFor="count">Nombre de codes à ajouter</label>
          <input id="count" className="plai-input" inputMode="numeric" value={count} onChange={e => setCount(e.target.value)} placeholder="Exemple : 5" />
          <p className="help">Les codes sont anonymes (E1, E2, E3…). Garder chez toi la correspondance avec les prénoms : l'application ne les connaît pas.</p>
        </div>
        <button type="submit" className="plai-btn" disabled={busy}>Ajouter les codes</button>
      </form>

      {error && <p className="plai-error">{error}</p>}
      {pupils?.length === 0 && <p className="plai-empty">Aucun code pour l'instant.</p>}
      <div className="flex flex-wrap gap-2">
        {pupils?.map(p => <span key={p.id} className="plai-badge" style={{ marginBottom: 0 }}>{p.code}</span>)}
      </div>
    </PageShell>
  );
}
