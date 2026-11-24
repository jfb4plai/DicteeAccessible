import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPupils, listPupils, setSessionPupils } from '../../lib/api';
import { nextPupilCodes } from '../../lib/codes';
import { groupByClass, NO_CLASS } from '../../lib/pupilGroups';
import type { Pupil } from '../../lib/types';
import { SaveBar, TabIntro, type TabProps } from './common';

export default function PupilsTab({ id, data, reload, goNext, setDirty }: TabProps) {
  const [all, setAll] = useState<Pupil[] | null>(null);
  const [chosen, setChosen] = useState<string[]>(data.session.pupils.map(p => p.id));
  const [newCodes, setNewCodes] = useState('5');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPupils().then(setAll).catch(() => { setAll([]); setError('Liste des élèves indisponible.'); });
  }, []);

  const groups = useMemo(() => groupByClass(all ?? []), [all]);
  const change = (next: string[]) => { setChosen(next); setDirty(true); setError(''); };
  const toggle = (pid: string) => change(chosen.includes(pid) ? chosen.filter(x => x !== pid) : [...chosen, pid]);
  const toggleGroup = (ids: string[]) => change(ids.every(x => chosen.includes(x)) ? chosen.filter(x => !ids.includes(x)) : [...new Set([...chosen, ...ids])]);

  async function addCodes() {
    const n = Math.floor(Number(newCodes));
    if (!Number.isFinite(n) || n < 1 || n > 60) { setError('Choisir un nombre de codes entre 1 et 60.'); return; }
    setBusy(true); setError('');
    try {
      const current = await listPupils();
      const made = await createPupils(nextPupilCodes(current.map(p => p.code), n), data.session.level);
      setAll([...current, ...made]);
      change([...chosen, ...made.map(p => p.id)]);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function save() {
    setError('');
    if (chosen.length === 0) { setError('Choisis au moins un élève pour pouvoir publier.'); return; }
    setBusy(true);
    try {
      await setSessionPupils(id, data.session.pupils.map(p => p.id), chosen);
      await reload();
      setDirty(false);
      goNext();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div>
      <TabIntro title="Les élèves">Qui reçoit la dictée ? Les élèves sont repérés par un code anonyme (E1, E2…), jamais par leur nom. Garde chez toi la correspondance avec les prénoms : l'application ne les connaît pas.</TabIntro>
      {all === null ? <p className="help">Chargement des élèves…</p> : all.length === 0 ? (
        <p className="plai-empty">Aucun code élève pour l'instant. Crée-en ci-dessous : ils seront cochés pour cette dictée.</p>
      ) : (
        <fieldset>
          <legend className="plai-label">Élèves concernés</legend>
          {groups.map(g => {
            const ids = g.pupils.map(p => p.id);
            return (
              <div key={g.label} className="mb-3">
                <label><input type="checkbox" checked={ids.every(x => chosen.includes(x))} onChange={() => toggleGroup(ids)} /> <strong>{g.label === NO_CLASS ? 'Tous les élèves sans classe' : `Toute la classe : ${g.label}`}</strong> <span className="help">({ids.length})</span></label>
                <div className="flex flex-wrap gap-3 mt-1" style={{ marginLeft: 24 }}>
                  {g.pupils.map(p => <label key={p.id}><input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} /> {p.code}</label>)}
                </div>
              </div>
            );
          })}
          <p className="help">Chaque élève coché reçoit un lien personnel (onglet Publier). Un élève décoché perd l'accès à cette dictée ; ses réponses déjà enregistrées restent. Les classes se gèrent dans <Link to="/enseignant/eleves">Mes élèves</Link>.</p>
        </fieldset>
      )}
      <div className="plai-field mt-4">
        <label className="plai-label" htmlFor="newCodes">Créer de nouveaux codes</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="newCodes" className="plai-input" style={{ maxWidth: 120 }} inputMode="numeric" value={newCodes} onChange={e => setNewCodes(e.target.value)} placeholder="5" />
          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => void addCodes()}>Créer les codes</button>
        </div>
        <p className="help">Les codes créés rejoignent la classe « {data.session.level} » (le niveau de la dictée) et sont cochés pour cette dictée.</p>
      </div>
      <SaveBar busy={busy} onSave={() => void save()} error={error} />
    </div>
  );
}
