import { useEffect, useMemo, useState } from 'react';
import { generateSentences, listSentences, listSessions, saveSentences } from '../../lib/api';
import { capitalizedWords, containsWord, filterParasites, maxWords, normalizeToken, sentenceTooLong } from '../../lib/sentences';
import { parseWordList } from '../../lib/words';
import type { GenerateInput, Proximity, SentenceFlag } from '../../lib/sentenceGeneration';
import type { SessionListItem } from '../../lib/types';
import { SaveBar, TabIntro, type TabProps } from './common';

type Row = {
  key: string;
  id?: string;
  word: string | null;
  text: string;
  parasitesText: string;
  itemId: string | null;
  validated: boolean;
  generated: boolean;
  flags: SentenceFlag[];
  removed: string[];
};

let keyCounter = 0;
const newKey = () => `r${++keyCounter}`;
const splitParasites = (text: string) => text.split(',').map(p => p.trim()).filter(Boolean);

// Ce qui empêche de valider une phrase proposée par l'IA : le mot cible a disparu, ou elle est trop longue pour le niveau.
// Les phrases écrites par l'enseignant(e) ne sont jamais bloquées : c'est elle ou lui qui décide.
function blockers(row: Row, level: string): string[] {
  const out: string[] = [];
  if (!row.text.trim()) out.push('La phrase est vide.');
  if (row.word && !containsWord(row.text, row.word)) out.push(`Le mot « ${row.word} » n'est pas dans la phrase.`);
  if (row.generated && sentenceTooLong(row.text, level)) out.push(`Phrase trop longue pour ${level} (${maxWords(level)} mots au plus).`);
  return out;
}

export default function SentencesTab({ id, data, reload, goNext, goTo, setDirty }: TabProps) {
  const session = data.session;
  const level = session.level;
  const [rows, setRows] = useState<Row[]>(() => data.sentences.map(x => ({
    key: newKey(), id: x.id, word: session.items.find(i => i.id === x.itemId)?.word ?? null, text: x.text,
    parasitesText: x.parasites.join(', '), itemId: x.itemId, validated: x.validated, generated: false, flags: [], removed: [],
  })));
  const [wordsText, setWordsText] = useState(session.items.map(i => i.word).join('\n'));
  const [rule, setRule] = useState('');
  const [context, setContext] = useState('');
  const [proximity, setProximity] = useState<Proximity | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [others, setOthers] = useState<SessionListItem[]>([]);
  const [fromId, setFromId] = useState('');

  useEffect(() => {
    listSessions().then(all => setOthers(all.filter(x => x.id !== id))).catch(() => setOthers([]));
  }, [id]);

  const unvalidated = useMemo(() => rows.filter(r => !r.validated).length, [rows]);

  function update(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  async function propose() {
    setBusy(true); setError(''); setInfo('');
    try {
      const { words } = parseWordList(wordsText);
      const result = await generateSentences({
        words, level: level as GenerateInput['level'],
        ...(rule.trim() && { rule: rule.trim() }), ...(context.trim() && { context: context.trim() }),
        ...(proximity && { proximity }),
      });
      const added: Row[] = result.sentences.map(s => ({
        key: newKey(), word: s.word, text: s.text, parasitesText: s.parasites.join(', '),
        itemId: session.items.find(i => normalizeToken(i.word) === normalizeToken(s.word))?.id ?? null,
        validated: false, generated: true, flags: s.flags, removed: s.removedParasites,
      }));
      setRows(prev => [...prev, ...added]);
      setDirty(true);
      setInfo(result.missing.length > 0 ? `Pas de phrase proposée pour : ${result.missing.join(', ')}. Écris-la toi-même.` : `${added.length} phrases proposées. Relis-les une par une.`);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function reuse() {
    if (!fromId) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const old = await listSentences(fromId);
      // Mêmes phrases, mais les parasites sont à refaire : en classe, ils doivent différer de ceux de la préparation.
      const added: Row[] = old.map(x => ({
        key: newKey(), word: null, text: x.text, parasitesText: '', itemId: null,
        validated: false, generated: false, flags: [], removed: [],
      }));
      setRows(prev => [...prev, ...added]);
      setDirty(true);
      setInfo(`${added.length} phrases reprises. Écris d'autres mots parasites, relis chaque phrase puis valide-la.`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  function addOwn() {
    setRows(prev => [...prev, { key: newKey(), word: null, text: '', parasitesText: '', itemId: null, validated: false, generated: false, flags: [], removed: [] }]);
    setDirty(true);
  }

  const toSave = () => rows.map(r => ({
    ...(r.id && { id: r.id }),
    text: r.text.trim(),
    parasites: filterParasites(r.text, splitParasites(r.parasitesText)).kept,
    itemId: r.itemId,
    validated: r.validated,
  }));

  async function save(thenContinue: boolean) {
    if (rows.some(r => !r.text.trim())) { setError('Complète ou supprime les phrases vides.'); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      await saveSentences(id, toSave());
      const fresh = await listSentences(id);
      // Les identifiants des nouvelles phrases sont connus après l'enregistrement : on les rattache dans l'ordre.
      setRows(prev => prev.map((r, i) => ({ ...r, id: fresh[i]?.id ?? r.id })));
      await reload();
      setDirty(false);
      if (thenContinue) goNext(); else setInfo('Phrases enregistrées.');
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div>
      <TabIntro title="Les phrases (facultatif)">
        Pour une dictée de phrases ou une autodictée. {session.mode === 'class'
          ? "En classe, chaque phrase est dictée une seule fois, sans indication de l'endroit des erreurs."
          : "En préparation en autonomie, l'élève voit la phrase (B1), puis la reconstitue de mémoire (B2) avec des mots parasites."}
        {' '}Rien n'est visible des élèves tant que chaque phrase n'est pas validée par toi. Pas de phrases ? Passe directement à l'étape suivante.
      </TabIntro>

      <section className="plai-card">
        <h3 className="text-xl mb-3">Proposer des phrases avec l'IA</h3>
        <div className="plai-field">
          <label className="plai-label" htmlFor="gen-words">Mots pour lesquels proposer une phrase</label>
          <textarea id="gen-words" rows={4} className="plai-input" value={wordsText} onChange={e => setWordsText(e.target.value)}
            placeholder="soufflé – ramasser – feuilles" />
          <p className="help">Une phrase est proposée par mot. Modifie la liste si tu veux des phrases pour d'autres mots (40 au plus).</p>
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="gen-rule">Règle travaillée (facultatif)</label>
          <input id="gen-rule" className="plai-input" value={rule} onChange={e => setRule(e.target.value)} placeholder="é ou er" />
          <p className="help">Oriente les mots parasites : avec « é ou er », ce sont d'autres formes du même verbe.</p>
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="gen-context">Contexte de ta classe (facultatif)</label>
          <input id="gen-context" className="plai-input" value={context} onChange={e => setContext(e.target.value)} placeholder="la classe prépare une sortie au parc de la Boverie" />
          <p className="help">Les phrases reprennent ton vocabulaire et tes situations, pas des phrases génériques. N'écris aucun prénom d'élève : ce texte est envoyé à un service d'IA.</p>
          {capitalizedWords(context).length > 0 && (
            <p className="plai-error">À vérifier : « {capitalizedWords(context).join(', ')} ». Un nom de lieu est possible, jamais un prénom d'élève.</p>
          )}
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="gen-proximity">Parasites proches (facultatif)</label>
          <select id="gen-proximity" className="plai-input" value={proximity} onChange={e => setProximity(e.target.value as Proximity | '')}>
            <option value="">Sans consigne particulière</option>
            <option value="phonetic">Proches par le son (pain, pin)</option>
            <option value="spelling">Proches par les lettres (chat, chas)</option>
            <option value="both">Proches par le son et par les lettres</option>
          </select>
          <p className="help">Demande à l'IA des parasites qui ressemblent aux mots de la phrase. Le programme ne peut pas vérifier cette ressemblance : relis chaque parasite. Il vérifie seulement qu'il n'est pas déjà dans la phrase.</p>
        </div>
        <button type="button" className="plai-btn" disabled={busy} onClick={() => void propose()}>Proposer des phrases</button>
      </section>

      <section className="plai-card">
        <h3 className="text-xl mb-3">Les phrases de la dictée</h3>
        <p className="help mb-2">
          Nombre de parasites utilisés par phrase : {session.parasiteCount}. Ce nombre se règle dans l'onglet <button type="button" className="plai-btn-ghost" style={{ minHeight: 0, padding: '0 8px' }} onClick={() => goTo('reglages')}>Réglages</button> ; les premiers de la liste de chaque phrase sont utilisés.
        </p>
        {rows.length === 0 && <p className="plai-empty">Aucune phrase pour l'instant. Propose-en avec l'IA ou écris la tienne.</p>}
        {rows.map((r, n) => {
          const blocked = blockers(r, level);
          const liveFlags = r.flags.filter(f => f === 'prenom_probable');
          return (
            <div key={r.key} className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="plai-field">
                <label className="plai-label" htmlFor={`text-${r.key}`}>Phrase {n + 1}{r.word ? ` (mot : ${r.word})` : ''}</label>
                <textarea id={`text-${r.key}`} rows={2} className="plai-input" value={r.text}
                  onChange={e => update(r.key, { text: e.target.value, validated: false })}
                  placeholder="Le vent a soufflé fort." />
                <p className="help">Modifier la phrase annule sa validation : relis-la puis valide-la de nouveau.</p>
              </div>
              <div className="plai-field">
                <label className="plai-label" htmlFor={`par-${r.key}`}>Mots parasites, séparés par des virgules</label>
                <input id={`par-${r.key}`} className="plai-input" value={r.parasitesText}
                  onChange={e => update(r.key, { parasitesText: e.target.value, validated: false })} placeholder="souffler, soufflez" />
                <p className="help">Ajoutés aux mots de la phrase en B2 pour obliger à choisir ; les {session.parasiteCount} premiers sont utilisés (3 au plus enregistrés). Un parasite égal à un mot de la phrase est retiré.</p>
                {r.removed.length > 0 && <p className="help">Retiré(s) automatiquement : {r.removed.join(', ')}.</p>}
              </div>
              {blocked.map(b => <p key={b} className="plai-error">{b}</p>)}
              {liveFlags.length > 0 && <p className="help">À vérifier : un nom propre semble présent. Aucun prénom d'élève ne doit figurer dans une phrase.</p>}
              <label>
                <input type="checkbox" checked={r.validated} disabled={blocked.length > 0}
                  onChange={e => update(r.key, { validated: e.target.checked })} /> <strong>Je valide cette phrase</strong>
              </label>
              <button type="button" className="plai-btn-ghost" style={{ marginLeft: 12 }}
                onClick={() => { setRows(prev => prev.filter(x => x.key !== r.key)); setDirty(true); }}>Supprimer</button>
            </div>
          );
        })}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <button type="button" className="plai-btn-ghost" onClick={addOwn}>Ajouter ma phrase</button>
          {others.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="plai-label" htmlFor="reuse">Reprendre les phrases d'une autre dictée</label>
                <select id="reuse" className="plai-input" value={fromId} onChange={e => setFromId(e.target.value)}>
                  <option value="">Choisir une dictée</option>
                  {others.map(o => <option key={o.id} value={o.id}>{o.title} ({o.level})</option>)}
                </select>
              </div>
              <button type="button" className="plai-btn-ghost" disabled={busy || !fromId} onClick={() => void reuse()}>Reprendre</button>
            </div>
          )}
        </div>
        <p className="help mt-2">Pour une dictée en classe, reprends les phrases de la préparation et écris d'autres parasites.</p>
      </section>

      <p className="help mt-3">
        {rows.length === 0 ? 'Aucune phrase : cette étape est facultative.' : unvalidated > 0 ? `${unvalidated} phrase${unvalidated > 1 ? 's' : ''} à valider avant de publier.` : 'Toutes les phrases sont validées.'}
      </p>
      <SaveBar
        busy={busy}
        onSave={() => void save(true)}
        error={error}
        info={info}
        extra={rows.length === 0
          ? <button type="button" className="plai-btn-ghost" onClick={goNext}>Passer cette étape</button>
          : <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => void save(false)}>Enregistrer sans continuer</button>}
      />
    </div>
  );
}
