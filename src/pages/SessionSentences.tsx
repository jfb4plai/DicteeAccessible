import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import PupilLinks from '../components/PupilLinks';
import { generateSentences, getSessionForEdit, listSentences, listSessions, publishSession, saveSentences, setParasiteCount } from '../lib/api';
import { capitalizedWords, containsWord, filterParasites, maxWords, normalizeToken, sentenceTooLong } from '../lib/sentences';
import { parseWordList } from '../lib/words';
import { warmSession } from '../lib/warmSession';
import type { GenerateInput, Proximity, SentenceFlag } from '../lib/sentenceGeneration';
import type { SessionListItem } from '../lib/types';

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
type Session = Awaited<ReturnType<typeof getSessionForEdit>>;

let keyCounter = 0;
const newKey = () => `r${++keyCounter}`;
const splitParasites = (text: string) => text.split(',').map(p => p.trim()).filter(Boolean);

// Ce qui empêche de valider une phrase proposée par l'IA : le mot cible a disparu (y compris après rechargement), ou elle est trop longue pour le niveau.
// Les phrases écrites par l'enseignant(e) ne sont jamais bloquées : c'est elle ou lui qui décide.
function blockers(row: Row, level: string): string[] {
  const out: string[] = [];
  if (!row.text.trim()) out.push('La phrase est vide.');
  if (row.word && !containsWord(row.text, row.word)) out.push(`Le mot « ${row.word} » n'est pas dans la phrase.`);
  if (row.generated && sentenceTooLong(row.text, level)) out.push(`Phrase trop longue pour ${level} (${maxWords(level)} mots au plus).`);
  return out;
}

export default function SessionSentences() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [wordsText, setWordsText] = useState('');
  const [rule, setRule] = useState('');
  const [context, setContext] = useState('');
  const [proximity, setProximity] = useState<Proximity | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [published, setPublished] = useState(false);
  const [reopened, setReopened] = useState(false); // dictée publiée dont on rouvre les phrases
  const [others, setOthers] = useState<SessionListItem[]>([]);
  const [fromId, setFromId] = useState('');
  const [savedSentences, setSavedSentences] = useState<{ id: string; text: string; parasites: string[] }[]>([]);

  useEffect(() => {
    Promise.all([getSessionForEdit(id), listSentences(id)])
      .then(([s, sentences]) => {
        setSession(s);
        setPublished(s.published);
        setSavedSentences(sentences);
        setWordsText(s.items.map(i => i.word).join('\n'));
        setRows(sentences.map(x => ({
          key: newKey(), id: x.id, word: s.items.find(i => i.id === x.itemId)?.word ?? null, text: x.text,
          parasitesText: x.parasites.join(', '), itemId: x.itemId, validated: x.validated, generated: false, flags: [], removed: [],
        })));
      })
      .catch((e: Error) => setError(e.message));
    listSessions().then(all => setOthers(all.filter(x => x.id !== id))).catch(() => setOthers([]));
  }, [id]);

  const level = session?.level ?? 'P3';
  const allValidated = rows.length > 0 && rows.every(r => r.validated && blockers(r, level).length === 0);
  const unvalidated = useMemo(() => rows.filter(r => !r.validated).length, [rows]);

  function update(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function propose() {
    if (!session) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const { words } = parseWordList(wordsText);
      const result = await generateSentences({
        words, level: session.level as GenerateInput['level'],
        ...(rule.trim() && { rule: rule.trim() }), ...(context.trim() && { context: context.trim() }),
        ...(proximity && { proximity }),
      });
      const added: Row[] = result.sentences.map(s => ({
        key: newKey(), word: s.word, text: s.text, parasitesText: s.parasites.join(', '),
        itemId: session.items.find(i => normalizeToken(i.word) === normalizeToken(s.word))?.id ?? null,
        validated: false, generated: true, flags: s.flags, removed: s.removedParasites,
      }));
      setRows(prev => [...prev, ...added]);
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
      setInfo(`${added.length} phrases reprises. Écris d'autres mots parasites, relis chaque phrase puis valide-la.`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function changeParasiteCount(n: number) {
    if (!session) return;
    const previous = session.parasiteCount;
    setSession({ ...session, parasiteCount: n });
    try { await setParasiteCount(id, n); setError(''); }
    catch (e) { setSession(s => (s ? { ...s, parasiteCount: previous } : s)); setError((e as Error).message); }
  }

  function addOwn() {
    setRows(prev => [...prev, { key: newKey(), word: null, text: '', parasitesText: '', itemId: null, validated: false, generated: false, flags: [], removed: [] }]);
  }

  const toSave = () => rows.map(r => ({
    ...(r.id && { id: r.id }),
    text: r.text.trim(),
    parasites: filterParasites(r.text, splitParasites(r.parasitesText)).kept,
    itemId: r.itemId,
    validated: r.validated,
  }));

  async function saveDraft() {
    if (rows.some(r => !r.text.trim())) { setError('Complète ou supprime les phrases vides.'); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      await saveSentences(id, toSave());
      const fresh = await listSentences(id);
      // Les identifiants des nouvelles phrases sont connus après l'enregistrement : on les rattache dans l'ordre.
      setRows(prev => prev.map((r, i) => ({ ...r, id: fresh[i]?.id ?? r.id })));
      setInfo('Brouillon enregistré.');
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function publish() {
    if (rows.some(r => !r.text.trim())) { setError('Complète ou supprime les phrases vides.'); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      await saveSentences(id, toSave());
      await publishSession(id);
      setSavedSentences(await listSentences(id)); // la page publiée montre les phrases enregistrées
      void warmSession(id); // audio prêt avant l'arrivée de la classe
      setPublished(true);
      setReopened(false);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (!session) {
    return <PageShell actions={<TeacherNav />}>{error ? <p className="plai-error">{error}</p> : <p className="help">Chargement…</p>}</PageShell>;
  }

  if (published && !reopened) {
    return (
      <PageShell wide actions={<TeacherNav />}>
        <h1 className="text-3xl mb-2">Dictée publiée</h1>
        <p className="plai-success">Code de la dictée : <strong style={{ fontSize: 24 }}>{session.accessCode}</strong></p>
        <p className="help mb-4">Donner à chaque élève son lien ou son QR code.</p>
        <PupilLinks accessCode={session.accessCode} pupils={session.pupils} />
        <h2 className="text-xl mt-6 mb-2">Phrases de la dictée</h2>
        {savedSentences.length === 0 && <p className="help">Cette dictée n'a pas de phrases.</p>}
        {savedSentences.map(x => (
          <div key={x.id} className="plai-card">
            <strong>{x.text}</strong>
            <p className="help">Parasites : {x.parasites.length > 0 ? x.parasites.join(', ') : 'aucun'}</p>
          </div>
        ))}
        <p className="mt-4 flex flex-wrap gap-2">
          <Link to={`/enseignant/session/${id}/modifier`} className="plai-btn inline-block no-underline">Modifier la dictée</Link>
          <button type="button" className="plai-btn-ghost" onClick={() => setReopened(true)}>Modifier les phrases</button>
          <Link to="/enseignant" className="plai-btn-ghost inline-block no-underline">Retour à mes dictées</Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell wide actions={<TeacherNav />}>
      <p><Link to="/enseignant">← Mes dictées</Link></p>
      <h1 className="text-3xl my-3">Phrases de « {session.title} »</h1>
      {published && (
        <p className="plai-banner" role="note">
          Cette dictée est publiée. Une dictée générée n'a pas forcément été partagée, mais si elle l'est, les élèves voient chaque phrase validée dès qu'elle est enregistrée. Une phrase supprimée emporte ses résultats.
        </p>
      )}
      <p className="help mb-4">
        {session.mode === 'class'
          ? 'Dictée en classe : chaque phrase est dictée une seule fois, sans indication de l\'endroit des erreurs.'
          : 'Préparation en autonomie : l\'élève voit la phrase (B1), puis la reconstitue de mémoire (B2) avec des mots parasites.'}
      </p>

      <section className="plai-card">
        <h2 className="text-xl mb-3">Proposer des phrases avec l'IA</h2>
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
        <button type="button" className="plai-btn" disabled={busy} onClick={propose}>Proposer des phrases</button>
      </section>

      <section className="plai-card">
        <h2 className="text-xl mb-3">Les phrases de la dictée</h2>
        <div className="plai-field">
          <label className="plai-label" htmlFor="parasite-count">Mots parasites par phrase</label>
          <select id="parasite-count" className="plai-input" value={session.parasiteCount} onChange={e => void changeParasiteCount(Number(e.target.value))}>
            <option value={0}>0 : sans mot en trop</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <p className="help">Nombre de parasites mêlés aux tuiles en B2 et en classe. S'applique tout de suite, sans republier : les premiers de la liste de chaque phrase sont utilisés. La phrase visible (B1) n'en a jamais.</p>
        </div>
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
                onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))}>Supprimer</button>
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
              <button type="button" className="plai-btn-ghost" disabled={busy || !fromId} onClick={reuse}>Reprendre</button>
            </div>
          )}
        </div>
        <p className="help mt-2">Pour une dictée en classe, reprends les phrases de la préparation et écris d'autres parasites.</p>
      </section>

      {error && <p className="plai-error">{error}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}
      <div className="flex flex-wrap gap-3 items-center mt-3">
        <button type="button" className="plai-btn-ghost" disabled={busy} onClick={saveDraft}>{published ? 'Enregistrer' : 'Enregistrer le brouillon'}</button>
        <button type="button" className="plai-btn" disabled={busy || !allValidated} onClick={publish}>{published ? 'Enregistrer et terminer' : 'Publier la dictée'}</button>
      </div>
      <p className="help mt-2">
        {rows.length === 0 ? 'Ajoute au moins une phrase pour publier.' : unvalidated > 0 ? `Rien n'est publié tant que tu n'as pas validé chaque phrase (${unvalidated} à valider).` : 'Toutes les phrases sont validées.'}
      </p>
    </PageShell>
  );
}
