import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import { createSession } from '../lib/api';
import { validateSessionInput } from '../lib/sessionForm';
import type { Contents } from '../lib/types';

// Départ d'une dictée : le strict nécessaire. Le reste (réglages, phrases, élèves, publication) se fait ensuite, onglet par onglet.
export default function NewSession() {
  const navigate = useNavigate();
  const [contents, setContents] = useState<Contents>('words');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('P3');
  const [wordsText, setWordsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailure('');
    const result = validateSessionInput({
      title, level, mode: 'class', wordsText, contents, voice: 'adrien', pupilIds: [],
      options: { showCorrect: false, readAloud: true, finalRound: true },
    }, false);
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({});
    setDuplicates(result.duplicates);
    setBusy(true);
    try {
      const { id } = await createSession(result.value);
      navigate(`/enseignant/session/${id}?onglet=${contents === 'sentences' ? 'phrases' : 'reglages'}`);
    } catch (err) {
      setFailure((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <PageShell actions={<TeacherNav />}>
      <p><Link to="/enseignant">← Mes dictées</Link></p>
      <h1 className="text-3xl my-3">Nouvelle dictée</h1>
      <p className="help mb-4">Trois informations suffisent pour commencer. Ensuite, un espace en onglets te guide : réglages, phrases, élèves, puis publication. Rien n'est visible des élèves avant la publication.</p>
      <form onSubmit={submit} noValidate>
        <section className="plai-card">
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
            <p className="help" style={{ fontWeight: 700, marginBottom: 6 }}>{contents === 'sentences' ? "Facultatif pour une autodictée : ces mots servent à vérifier que l'élève les connaît avant les phrases." : "Séparer les mots par un tiret entouré d'espaces, une virgule ou un retour à la ligne. Chaque mot devient un exercice, 40 mots au maximum. Tu pourras les corriger ensuite."}</p>
            <textarea id="words" rows={5} className="plai-input" value={wordsText} onChange={e => setWordsText(e.target.value)}
              placeholder="monsieur – droit – lendemain – chaque – paire – boite – quelques" />
            {errors.words && <p className="plai-error">{errors.words}</p>}
            {duplicates.length > 0 && <p className="help">Doublons ignorés : {duplicates.join(', ')}.</p>}
          </div>
          {failure && <p className="plai-error" role="alert">{failure}</p>}
          <button type="submit" className="plai-btn" disabled={busy}>Créer la dictée et continuer</button>
        </section>
      </form>
    </PageShell>
  );
}
