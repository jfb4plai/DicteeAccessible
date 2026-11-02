import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import ShareInvites from '../components/ShareInvites';
import { createPupils, deletePupil, getPupilImpact, listPupils, setPupilClass } from '../lib/api';
import { nextPupilCodes } from '../lib/codes';
import { groupByClass, MAX_CLASS_LABEL, normalizeClassLabel, NO_CLASS } from '../lib/pupilGroups';
import type { Pupil } from '../lib/types';

export default function PupilsPage() {
  const [pupils, setPupils] = useState<Pupil[] | null>(null);
  const [count, setCount] = useState('5');
  const [classLabel, setClassLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<{ pupil: Pupil; attempts: number; sessions: number } | null>(null);

  useEffect(() => {
    listPupils().then(setPupils).catch((e: Error) => setError(e.message));
  }, []);

  const groups = useMemo(() => groupByClass(pupils ?? []), [pupils]);
  const knownClasses = groups.map(g => g.label).filter(l => l !== NO_CLASS);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > 60) { setError('Choisir un nombre entre 1 et 60.'); return; }
    setBusy(true);
    setError('');
    try {
      // Liste relue juste avant : l'écran peut être en retard sur la base (chargement lent, autre onglet).
      const current = await listPupils();
      const created = await createPupils(nextPupilCodes(current.map(p => p.code), n), classLabel);
      setPupils([...current, ...created]);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function changeClass(p: Pupil, value: string) {
    const label = normalizeClassLabel(value);
    if (label === (p.classLabel ?? '')) return;
    setError('');
    try {
      await setPupilClass(p.id, label);
      setPupils(list => (list ?? []).map(x => (x.id === p.id ? { ...x, classLabel: label } : x)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function askDelete(p: Pupil) {
    setError('');
    try {
      setConfirming({ pupil: p, ...(await getPupilImpact(p.id)) });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function confirmDelete() {
    if (!confirming) return;
    setBusy(true);
    try {
      await deletePupil(confirming.pupil.id);
      setPupils(list => (list ?? []).filter(x => x.id !== confirming.pupil.id));
      setConfirming(null);
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
          <label className="plai-label" htmlFor="class">Classe de ces élèves</label>
          <input id="class" className="plai-input" list="known-classes" maxLength={MAX_CLASS_LABEL} value={classLabel} onChange={e => setClassLabel(e.target.value)} placeholder="Exemple : P3" />
          <datalist id="known-classes">{knownClasses.map(c => <option key={c} value={c} />)}</datalist>
          <p className="help">Un nom de groupe pour retrouver tes élèves (« P3 », « P4 », « P3 B »). Jamais un prénom. Facultatif : sans classe, les codes sont rangés à part. Tu pourras la changer élève par élève.</p>
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="count">Nombre de codes à ajouter</label>
          <input id="count" className="plai-input" inputMode="numeric" value={count} onChange={e => setCount(e.target.value)} placeholder="Exemple : 5" />
          <p className="help">Les codes sont anonymes (E1, E2, E3…) et se suivent sur tout ton compte, toutes classes confondues. Garder chez toi la correspondance avec les prénoms : l'application ne les connaît pas.</p>
        </div>
        <button type="submit" className="plai-btn" disabled={busy}>Ajouter les codes</button>
      </form>

      {error && <p className="plai-error">{error}</p>}
      {pupils?.length === 0 && <p className="plai-empty">Aucun code pour l'instant.</p>}

      {confirming && (
        <div className="plai-card mb-4" role="alertdialog" aria-labelledby="del-title" style={{ borderColor: '#b42318', borderWidth: 2 }}>
          <h2 id="del-title" className="text-xl mb-2">Supprimer {confirming.pupil.code} ?</h2>
          <p>
            {confirming.attempts} réponse{confirming.attempts > 1 ? 's' : ''} et {confirming.sessions} dictée{confirming.sessions > 1 ? 's' : ''} liée{confirming.sessions > 1 ? 's' : ''} seront effacées, avec les commentaires et les invitations de cet élève. Les dictées elles-mêmes restent.
          </p>
          <p className="help">C'est définitif : il n'y a pas de retour en arrière.</p>
          <div className="flex gap-2 mt-2">
            <button type="button" className="plai-btn" style={{ background: '#b42318' }} disabled={busy} onClick={confirmDelete}>Oui, supprimer {confirming.pupil.code}</button>
            <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(null)}>Annuler</button>
          </div>
        </div>
      )}

      {groups.map(g => (
        <section key={g.label} className="plai-card mb-3">
          <h2 className="text-xl mb-2">{g.label} <span className="help">({g.pupils.length})</span></h2>
          {g.pupils.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <strong style={{ minWidth: 56 }}>{p.code}</strong>
              <label className="help" htmlFor={`cl-${p.id}`}>Classe</label>
              <input id={`cl-${p.id}`} className="plai-input" style={{ maxWidth: 160 }} list="known-classes" maxLength={MAX_CLASS_LABEL}
                defaultValue={p.classLabel ?? ''} key={`${p.id}-${p.classLabel ?? ''}`} placeholder="Exemple : P3"
                onBlur={e => changeClass(p, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              <button type="button" className="plai-btn-ghost" onClick={() => askDelete(p)} aria-label={`Supprimer ${p.code}`}>Supprimer</button>
            </div>
          ))}
        </section>
      ))}

      {pupils && pupils.length > 0 && <ShareInvites pupils={pupils} />}
    </PageShell>
  );
}
