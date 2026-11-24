import { useState } from 'react';
import { countAttempts, saveItems, updateSessionSettings } from '../../lib/api';
import { planWordChanges, validateWordRows, type WordRow } from '../../lib/editSession';
import type { SessionInput } from '../../lib/types';
import { SaveBar, TabIntro, type TabProps } from './common';

type Level = SessionInput['level'];

export default function ContentTab({ id, data, reload, goNext, setDirty }: TabProps) {
  const s = data.session;
  const [title, setTitle] = useState(s.title);
  const [level, setLevel] = useState<Level>(s.level as Level);
  const [words, setWords] = useState<WordRow[]>(s.items.map(i => ({ id: i.id, word: i.word })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const touch = () => setDirty(true);

  async function removeWord(index: number) {
    const row = words[index];
    if (row.id) {
      try {
        const n = await countAttempts(id, row.id);
        if (n > 0 && !window.confirm(`Retirer « ${row.word} » supprime aussi ${n} réponse${n > 1 ? 's' : ''} d'élèves enregistrée${n > 1 ? 's' : ''} pour ce mot. Cette suppression est définitive. Continuer ?`)) return;
      } catch (e) { setError((e as Error).message); return; }
    }
    setWords(prev => prev.filter((_, i) => i !== index));
    touch();
  }

  async function save() {
    setError('');
    if (!title.trim()) { setError('Donne un titre pour retrouver la dictée.'); return; }
    const checked = validateWordRows(words);
    if (!checked.ok) { setError(checked.error); return; }
    if (checked.rows.length === 0 && data.sentences.length === 0) {
      setError("Ajoute au moins un mot, ou passe à l'onglet Phrases pour écrire une autodictée.");
      return;
    }
    setBusy(true);
    try {
      await updateSessionSettings(id, { title: title.trim(), level });
      await saveItems(id, planWordChanges(s.items, checked.rows));
      const fresh = await reload();
      setWords(fresh.session.items.map(i => ({ id: i.id, word: i.word })));
      setDirty(false);
      goNext();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <div>
      <TabIntro title="Le contenu de la dictée">Le titre, le niveau et les mots. Tu peux revenir ici à tout moment pour corriger un mot : ses résultats sont gardés.</TabIntro>
      <div className="plai-field">
        <label className="plai-label" htmlFor="title">Titre de la dictée</label>
        <input id="title" className="plai-input" value={title} onChange={e => { setTitle(e.target.value); touch(); }} placeholder="Dictée du 16/11, les animaux" />
        <p className="help">Sert à retrouver la dictée dans ta liste. Les élèves ne le voient pas.</p>
      </div>
      <div className="plai-field">
        <label className="plai-label" htmlFor="level">Niveau</label>
        <select id="level" className="plai-input" value={level} onChange={e => { setLevel(e.target.value as Level); touch(); }}>
          {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <p className="help">Fixe la longueur maximale des phrases proposées par l'IA. Les phrases déjà écrites ne changent pas.</p>
      </div>
      <h3 className="text-xl mb-1">Les mots ({words.length})</h3>
      <p className="help mb-2">Un mot par ligne, 40 au maximum. Corriger un mot garde ses résultats ; « Retirer » supprime le mot et ses résultats.</p>
      {words.length === 0 && <p className="plai-empty">Aucun mot. C'est normal pour une autodictée de phrases seulement.</p>}
      {words.map((w, i) => (
        <div key={w.id ?? `n${i}`} className="flex items-center gap-2 mb-2">
          <label htmlFor={`w-${i}`} style={{ position: 'absolute', left: -9999 }}>Mot {i + 1}</label>
          <input id={`w-${i}`} className="plai-input" value={w.word} placeholder="monsieur"
            onChange={e => { setWords(prev => prev.map((x, j) => (j === i ? { ...x, word: e.target.value } : x))); touch(); }} />
          <button type="button" className="plai-btn-ghost" onClick={() => void removeWord(i)}>Retirer</button>
        </div>
      ))}
      <button type="button" className="plai-btn-ghost mt-1" onClick={() => { setWords(prev => [...prev, { word: '' }]); touch(); }}>Ajouter un mot</button>
      <SaveBar busy={busy} onSave={() => void save()} error={error} />
    </div>
  );
}
