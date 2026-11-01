import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import PupilLinks from '../components/PupilLinks';
import { createSession, listPupils } from '../lib/api';
import { validateSessionInput } from '../lib/sessionForm';
import type { Contents, Pupil, SessionOptions, Voice } from '../lib/types';

const DEFAULTS: Record<'autonomy' | 'class', SessionOptions> = {
  autonomy: { showCorrect: true, readAloud: true, finalRound: true },
  class: { showCorrect: false, readAloud: true, finalRound: true },
};

export default function NewSession() {
  const navigate = useNavigate();
  const [contents, setContents] = useState<Contents>('words');
  const [voice, setVoice] = useState<Voice>('adrien');
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('P3');
  const [wordsText, setWordsText] = useState('');
  const [mode, setMode] = useState<'autonomy' | 'class'>('class');
  const [options, setOptions] = useState<SessionOptions>(DEFAULTS.class);
  const [pupilIds, setPupilIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ accessCode: string; pupils: Pupil[] } | null>(null);

  useEffect(() => { listPupils().then(setPupils).catch(() => setFailure('Liste des élèves indisponible.')); }, []);

  function chooseMode(m: 'autonomy' | 'class') {
    setMode(m);
    setOptions(DEFAULTS[m]);
  }

  function togglePupil(id: string) {
    setPupilIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailure('');
    const result = validateSessionInput({ title, level, mode, wordsText, contents, voice, pupilIds, options });
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({});
    setDuplicates(result.duplicates);
    setBusy(true);
    try {
      const { id, accessCode } = await createSession(result.value);
      if (result.value.contents !== 'words') {
        navigate(`/enseignant/session/${id}/phrases`); // brouillon : les phrases sont à relire avant publication
        return;
      }
      setCreated({ accessCode, pupils: pupils.filter(p => pupilIds.includes(p.id)) });
    } catch (err) {
      setFailure((err as Error).message);
    }
    setBusy(false);
  }

  if (created) {
    return (
      <PageShell wide actions={<TeacherNav />}>
        <h1 className="text-3xl mb-2">Dictée créée</h1>
        <p className="plai-success">Code de la dictée : <strong style={{ fontSize: 24 }}>{created.accessCode}</strong></p>
        <p className="help mb-4">Donner à chaque élève son lien ou son QR code. Le lien contient seulement le code de la dictée et le code de l'élève, jamais un prénom.</p>
        <PupilLinks accessCode={created.accessCode} pupils={created.pupils} />
        <p className="mt-4"><Link to="/enseignant" className="plai-btn-ghost inline-block no-underline">Retour à mes dictées</Link></p>
      </PageShell>
    );
  }

  return (
    <PageShell actions={<TeacherNav />}>
      <h1 className="text-3xl mb-4">Nouvelle dictée</h1>
      <form onSubmit={submit} noValidate>
        <section className="plai-card">
          <h2 className="text-xl mb-3">1. Les mots</h2>
          <fieldset className="plai-field">
            <legend className="plai-label">Contenu de la dictée</legend>
            {([['words', 'Des mots', "L'élève place les lettres de chaque mot."],
               ['words+sentences', 'Des mots et des phrases', "Les mots d'abord, puis des phrases proposées par l'IA que tu relis et valides."],
               ['sentences', 'Des phrases seulement', "Autodictée : tu écris tes phrases ou l'IA en propose, tu valides chacune."]] as const).map(([value, label, help]) => (
              <label key={value} style={{ display: 'block', marginBottom: 6 }}>
                <input type="radio" name="contents" checked={contents === value} onChange={() => setContents(value)} /> <strong>{label}</strong>
                <span className="help" style={{ display: 'block', marginLeft: 24 }}>{help}</span>
              </label>
            ))}
            {errors.contents && <p className="plai-error">{errors.contents}</p>}
          </fieldset>
          <div className="plai-field">
            <label className="plai-label" htmlFor="title">Titre de la dictée</label>
            <input id="title" className="plai-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Exemple : Dictée de mots du 16/11" />
            <p className="help">Sert à retrouver la dictée dans tes résultats. L'élève ne le voit pas.</p>
            {errors.title && <p className="plai-error">{errors.title}</p>}
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="level">Niveau de la classe</label>
            <select id="level" className="plai-input" value={level} onChange={e => setLevel(e.target.value)}>
              {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(l => <option key={l}>{l}</option>)}
            </select>
            <p className="help">Classe la dictée dans tes résultats et fixe la longueur maximale des phrases proposées par l'IA (P1 : 6 mots, P6 : 16).</p>
            {errors.level && <p className="plai-error">{errors.level}</p>}
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="words">Mots de la dictée</label>
            <textarea id="words" rows={5} className="plai-input" value={wordsText} onChange={e => setWordsText(e.target.value)}
              placeholder="monsieur – droit – lendemain – chaque – paire – boite – quelques" />
            <p className="help">{contents === 'sentences' ? 'Facultatif pour une autodictée : ces mots servent à vérifier que l\'élève les connaît avant les phrases.' : 'Séparer les mots par un tiret entouré d\'espaces, une virgule ou un retour à la ligne. Chaque mot devient un exercice, 40 mots au maximum.'}</p>
            {errors.words && <p className="plai-error">{errors.words}</p>}
            {duplicates.length > 0 && <p className="help">Doublons ignorés : {duplicates.join(', ')}.</p>}
          </div>
        </section>

        <section className="plai-card">
          <h2 className="text-xl mb-3">2. Le type</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-3" role="radiogroup" aria-label="Type de dictée">
            {([['autonomy', 'Préparation en autonomie', "L'élève s'entraîne seule, avec la bonne orthographe disponible."],
               ['class', 'Dictée en classe', 'Résultats enregistrés mot par mot, sans aide à l\'orthographe.']] as const).map(([value, label, help]) => (
              <label key={value} className="plai-card" style={{ borderColor: mode === value ? 'var(--teal)' : undefined, borderWidth: mode === value ? 2 : 1, cursor: 'pointer' }}>
                <input type="radio" name="mode" checked={mode === value} onChange={() => chooseMode(value)} /> <strong>{label}</strong>
                <p className="help">{help}</p>
              </label>
            ))}
          </div>
          <div className="plai-field">
            <label className="plai-label" htmlFor="voice">Voix de lecture</label>
            <select id="voice" className="plai-input" value={voice} onChange={e => setVoice(e.target.value as Voice)}>
              <option value="adrien">Adrien, voix belge</option>
              <option value="jef">Jean-François, voix clonée</option>
              <option value="device">Voix de l'appareil</option>
            </select>
            <p className="help">Adrien lit « nonante » et « septante » comme en Belgique. La voix de l'appareil ne demande aucun service en ligne, mais lit « quatre-vingt-dix » comme en France.</p>
            {errors.voice && <p className="plai-error">{errors.voice}</p>}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', minHeight: 40 }}><strong>Options</strong> (réglées pour le type choisi)</summary>
            <div className="mt-2">
              {([['showCorrect', 'Montrer la bonne orthographe', "Si l'élève l'utilise, le mot est signalé dans tes résultats et revient au dernier tour."],
                 ['readAloud', 'Lire le mot automatiquement', "Le mot est lu dès son arrivée. Le bouton « Écouter le mot » reste toujours disponible."],
                 ['finalRound', 'Dernier tour', "Les mots ratés ou aidés reviennent à la fin, sans aide."]] as const).map(([key, label, help]) => (
                <div key={key} className="plai-field">
                  <label><input type="checkbox" checked={options[key]} onChange={e => setOptions({ ...options, [key]: e.target.checked })} /> <strong>{label}</strong></label>
                  <p className="help">{help}</p>
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="plai-card">
          <h2 className="text-xl mb-3">3. Les élèves et la publication</h2>
          {pupils.length === 0 ? (
            <p className="help">Aucun code élève. <Link to="/enseignant/eleves">Créer des codes élèves</Link> d'abord.</p>
          ) : (
            <fieldset>
              <legend className="plai-label">Élèves concernés</legend>
              <div className="flex flex-wrap gap-3">
                {pupils.map(p => (
                  <label key={p.id}><input type="checkbox" checked={pupilIds.includes(p.id)} onChange={() => togglePupil(p.id)} /> {p.code}</label>
                ))}
              </div>
              <p className="help">Chaque élève choisi reçoit un lien personnel. Les résultats sont enregistrés par code.</p>
            </fieldset>
          )}
          {errors.pupils && <p className="plai-error">{errors.pupils}</p>}
          {failure && <p className="plai-error">{failure}</p>}
          <button type="submit" className="plai-btn mt-3" disabled={busy}>{contents === 'words' ? 'Publier la dictée' : 'Continuer vers les phrases'}</button>
        </section>
      </form>
    </PageShell>
  );
}
