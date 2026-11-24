import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import PupilLinks from '../components/PupilLinks';
import { countAttempts, getSessionForEdit, listPupils, saveItems, setSessionPupils, updateSessionSettings } from '../lib/api';
import { planWordChanges, validateWordRows, type WordRow } from '../lib/editSession';
import { groupByClass, NO_CLASS } from '../lib/pupilGroups';
import type { Pupil, SessionInput, SessionOptions, Voice } from '../lib/types';

type Loaded = Awaited<ReturnType<typeof getSessionForEdit>>;
type Level = SessionInput['level'];

const OPTION_TEXTS = [
  ['showCorrect', 'Montrer la bonne orthographe', "Si l'élève l'utilise, le mot est signalé dans tes résultats et revient au dernier tour."],
  ['readAloud', 'Lire le mot automatiquement', 'Le mot est lu dès son arrivée. Le bouton « Écouter le mot » reste toujours disponible.'],
  ['finalRound', 'Dernier tour', 'Les mots ratés ou aidés reviennent à la fin, sans aide.'],
] as const;

// Modification d'une dictée déjà créée : réglages, mots, élèves. Les phrases se modifient sur leur propre page.
export default function EditSession() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<Loaded | null>(null);
  const [allPupils, setAllPupils] = useState<Pupil[]>([]);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<Level>('P3');
  const [mode, setMode] = useState<'autonomy' | 'class'>('class');
  const [voice, setVoice] = useState<Voice>('adrien');
  const [parasiteCount, setParasiteCount] = useState(2);
  const [options, setOptions] = useState<SessionOptions>({ showCorrect: false, readAloud: true, finalRound: true });
  const [words, setWords] = useState<WordRow[]>([]);
  const [pupilIds, setPupilIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  function fill(s: Loaded) {
    setSession(s);
    setTitle(s.title);
    setLevel(s.level as Level);
    setMode(s.mode);
    setVoice(s.voice);
    setParasiteCount(s.parasiteCount);
    setOptions(s.options);
    setWords(s.items.map(i => ({ id: i.id, word: i.word })));
    setPupilIds(s.pupils.map(p => p.id));
  }

  useEffect(() => {
    Promise.all([getSessionForEdit(id), listPupils(), countAttempts(id)])
      .then(([s, pupils, n]) => { fill(s); setAllPupils(pupils); setAttempts(n); })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const groups = useMemo(() => groupByClass(allPupils), [allPupils]);

  async function removeWord(index: number) {
    const row = words[index];
    if (row.id) {
      try {
        const n = await countAttempts(id, row.id);
        if (n > 0 && !window.confirm(`Retirer « ${row.word} » supprime aussi ${n} réponse${n > 1 ? 's' : ''} d'élèves enregistrée${n > 1 ? 's' : ''} pour ce mot. Cette suppression est définitive. Continuer ?`)) return;
      } catch (e) { setError((e as Error).message); return; }
    }
    setWords(prev => prev.filter((_, i) => i !== index));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(''); setInfo('');
    if (!title.trim()) { setError('Donne un titre pour retrouver la dictée.'); return; }
    const checked = validateWordRows(words);
    if (!checked.ok) { setError(checked.error); return; }
    if (pupilIds.length === 0) { setError('Garde au moins un élève.'); return; }
    setBusy(true);
    try {
      await updateSessionSettings(id, { title: title.trim(), level, mode, voice, parasiteCount, options });
      await saveItems(id, planWordChanges(session.items, checked.rows));
      await setSessionPupils(id, session.pupils.map(p => p.id), pupilIds);
      const [fresh, n] = await Promise.all([getSessionForEdit(id), countAttempts(id)]);
      fill(fresh); setAttempts(n);
      setInfo('Modifications enregistrées. Les élèves les voient tout de suite.');
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  if (!session) {
    return <PageShell actions={<TeacherNav />}>{error ? <p className="plai-error">{error}</p> : <p className="help">Chargement…</p>}</PageShell>;
  }

  const togglePupil = (pid: string) => setPupilIds(prev => (prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]));

  return (
    <PageShell actions={<TeacherNav />}>
      <p><Link to="/enseignant">← Mes dictées</Link></p>
      <h1 className="text-3xl my-3">Modifier « {session.title} »</h1>

      <div className="plai-banner" role="note" style={{ marginBottom: 16 }}>
        <strong>À lire avant de modifier.</strong>
        <ul style={{ paddingLeft: 20, listStyle: 'disc', marginTop: 4 }}>
          <li>Une dictée générée n'a pas forcément été partagée. Si tu as déjà donné le code ou les liens aux élèves, ils voient les modifications tout de suite, même en plein exercice.</li>
          <li>{attempts === null ? 'Comptage des réponses en cours…' : attempts === 0 ? 'Aucune réponse d\'élève n\'est enregistrée pour l\'instant : modifier ne perd aucun résultat.' : `${attempts} réponse${attempts > 1 ? 's' : ''} d'élèves déjà enregistrée${attempts > 1 ? 's' : ''}.`}</li>
          <li>Corriger l'orthographe d'un mot garde ses résultats. Retirer un mot supprime ses résultats pour tous les élèves.</li>
          <li>Retirer un élève lui enlève l'accès à la dictée ; ses réponses déjà enregistrées restent.</li>
          <li>Changer le type de dictée change le parcours des élèves : à éviter une fois la dictée commencée.</li>
        </ul>
      </div>

      <form onSubmit={save} noValidate>
        <section className="plai-card">
          <h2 className="text-xl mb-3">Réglages</h2>
          <div className="plai-field">
            <label className="plai-label" htmlFor="title">Titre de la dictée</label>
            <input id="title" className="plai-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Dictée du 16/11, les animaux" />
            <p className="help">Visible par toi seulement : sert à retrouver la dictée dans ta liste. Les élèves ne le voient pas.</p>
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="level">Niveau</label>
            <select id="level" className="plai-input" value={level} onChange={e => setLevel(e.target.value as Level)}>
              {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <p className="help">Fixe la longueur maximale des phrases proposées par l'IA. Les phrases déjà écrites ne sont pas modifiées.</p>
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="mode">Type de dictée</label>
            <select id="mode" className="plai-input" value={mode} onChange={e => setMode(e.target.value as 'autonomy' | 'class')}>
              <option value="class">Dictée en classe : résultats enregistrés mot par mot, sans aide à l'orthographe</option>
              <option value="autonomy">Préparation en autonomie : l'élève s'entraîne, la bonne orthographe est disponible</option>
            </select>
            <p className="help">Une dictée en classe laisse un seul essai par phrase ; la préparation en autonomie enchaîne les étapes A, B1 et B2.</p>
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="voice">Voix de lecture</label>
            <select id="voice" className="plai-input" value={voice} onChange={e => setVoice(e.target.value as Voice)}>
              <option value="adrien">Adrien, voix belge</option>
              <option value="jef">Jean-François, voix clonée</option>
              <option value="device">Voix de l'appareil</option>
            </select>
            <p className="help">Après un changement de voix, la première écoute de chaque mot est un peu plus longue le temps de préparer l'audio.</p>
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="parasites">Mots parasites par phrase</label>
            <select id="parasites" className="plai-input" value={parasiteCount} onChange={e => setParasiteCount(Number(e.target.value))}>
              <option value={0}>0 : remettre les mots dans l'ordre, sans mot en trop</option>
              <option value={1}>1 mot en trop</option>
              <option value={2}>2 mots en trop</option>
              <option value={3}>3 mots en trop</option>
            </select>
            <p className="help">Mots en trop mêlés aux tuiles en B2 et en classe. Sans effet si la dictée n'a pas de phrases.</p>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', minHeight: 40 }}><strong>Options</strong></summary>
            <div className="mt-2">
              {OPTION_TEXTS.map(([key, label, help]) => (
                <div key={key} className="plai-field">
                  <label><input type="checkbox" checked={options[key]} onChange={e => setOptions({ ...options, [key]: e.target.checked })} /> <strong>{label}</strong></label>
                  <p className="help">{help}</p>
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="plai-card">
          <h2 className="text-xl mb-3">Les mots ({words.length})</h2>
          <p className="help mb-2">Un mot par ligne. Corriger un mot garde ses résultats ; le bouton « Retirer » supprime le mot et ses résultats. 40 mots au maximum.</p>
          {words.length === 0 && <p className="plai-empty">Aucun mot. Normal pour une autodictée de phrases seulement.</p>}
          {words.map((w, i) => (
            <div key={w.id ?? `n${i}`} className="flex items-center gap-2 mb-2">
              <label className="plai-label" htmlFor={`w-${i}`} style={{ position: 'absolute', left: -9999 }}>Mot {i + 1}</label>
              <input id={`w-${i}`} className="plai-input" value={w.word} placeholder="monsieur"
                onChange={e => setWords(prev => prev.map((x, j) => (j === i ? { ...x, word: e.target.value } : x)))} />
              <button type="button" className="plai-btn-ghost" onClick={() => void removeWord(i)}>Retirer</button>
            </div>
          ))}
          <button type="button" className="plai-btn-ghost mt-2" onClick={() => setWords(prev => [...prev, { word: '' }])}>Ajouter un mot</button>
        </section>

        <section className="plai-card">
          <h2 className="text-xl mb-3">Les élèves</h2>
          {allPupils.length === 0 ? <p className="plai-empty">Aucun code élève.</p> : (
            <fieldset>
              <legend className="plai-label">Élèves concernés</legend>
              {groups.map(g => (
                <div key={g.label} className="mb-3">
                  <strong>{g.label === NO_CLASS ? 'Sans classe' : `Classe : ${g.label}`}</strong>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {g.pupils.map(p => (
                      <label key={p.id}><input type="checkbox" checked={pupilIds.includes(p.id)} onChange={() => togglePupil(p.id)} /> {p.code}</label>
                    ))}
                  </div>
                </div>
              ))}
              <p className="help">Un élève décoché perd l'accès à cette dictée. Un élève ajouté reçoit un lien personnel (affiché plus bas après l'enregistrement).</p>
            </fieldset>
          )}
        </section>

        {error && <p className="plai-error" role="alert">{error}</p>}
        {info && <p className="plai-success" role="status">{info}</p>}
        <div className="flex flex-wrap gap-2 my-3">
          <button type="submit" className="plai-btn" disabled={busy}>Enregistrer les modifications</button>
          <Link to={`/enseignant/session/${id}/phrases`} className="plai-btn-ghost no-underline inline-flex items-center">Modifier les phrases</Link>
          <Link to="/enseignant" className="plai-btn-ghost no-underline inline-flex items-center">Retour à mes dictées</Link>
        </div>
      </form>

      {session.published && (
        <section className="mt-4">
          <h2 className="text-xl mb-2">Code et liens</h2>
          <p className="plai-success">Code de la dictée : <strong style={{ fontSize: 24 }}>{session.accessCode}</strong></p>
          <PupilLinks accessCode={session.accessCode} pupils={session.pupils} />
        </section>
      )}
    </PageShell>
  );
}
