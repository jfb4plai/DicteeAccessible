import { useEffect, useRef, useState } from 'react';
import { createShare, listShares, revokeShare } from '../lib/api';
import { buildInviteMailto, buildShareUrl, defaultShareExpiry } from '../lib/shareLink';
import type { Pupil, ShareInfo } from '../lib/types';

const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromDateInput = (v: string): Date | null => {
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d, 23, 59, 59);
  return v && !Number.isNaN(date.getTime()) ? date : null;
};
const frDate = (iso: string) => new Date(iso).toLocaleDateString('fr-BE');

function state(s: ShareInfo): string {
  if (s.revokedAt) return 'retirée';
  if (new Date(s.expiresAt) <= new Date()) return 'expirée';
  return `active jusqu'au ${frDate(s.expiresAt)}`;
}

// Invitations en lecture seule : un lien par personne et par élève, créé ici, envoyé par l'enseignant(e) elle-même.
export default function ShareInvites({ pupils }: { pupils: Pupil[] }) {
  const [pupilId, setPupilId] = useState(pupils[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [expires, setExpires] = useState(() => toDateInput(defaultShareExpiry(new Date())));
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [created, setCreated] = useState<{ url: string; label: string; pupilCode: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const linkField = useRef<HTMLInputElement>(null);
  const currentPupil = useRef(pupilId); // élève affiché maintenant : une réponse arrivée pour un autre élève est ignorée
  currentPupil.current = pupilId;

  const pupil = pupils.find(p => p.id === pupilId);

  useEffect(() => {
    if (!pupils.some(p => p.id === pupilId)) setPupilId(pupils[0]?.id ?? '');
  }, [pupils, pupilId]);

  useEffect(() => {
    setCreated(null);
    setCopied('');
    setError('');
    setShares([]);
    if (!pupilId) return;
    let cancelled = false;
    listShares(pupilId).then(l => { if (!cancelled) setShares(l); }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [pupilId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!label.trim()) { setError("Donne un nom d'usage à la personne invitée."); return; }
    const end = fromDateInput(expires);
    if (!end) { setError("Choisis la date de fin de l'accès."); return; }
    const forPupil = pupilId;
    const forCode = pupil?.code ?? '';
    setBusy(true);
    try {
      const { token } = await createShare(forPupil, label, end);
      const list = await listShares(forPupil);
      if (currentPupil.current === forPupil) {
        setCreated({ url: buildShareUrl(window.location.origin, token), label: label.trim(), pupilCode: forCode });
        setLabel('');
        setCopied('');
        setShares(list);
      }
    } catch (err) {
      if (currentPupil.current === forPupil) setError((err as Error).message);
    }
    setBusy(false);
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied('Lien copié.');
    } catch {
      linkField.current?.select(); // presse-papiers refusé : le lien est sélectionné, Ctrl+C le copie
      setCopied('Copie automatique impossible : le lien est sélectionné, utiliser Ctrl+C.');
    }
  }

  async function revoke(id: string) {
    setError('');
    const forPupil = pupilId;
    try {
      await revokeShare(id);
      const list = await listShares(forPupil);
      if (currentPupil.current === forPupil) setShares(list);
    } catch (err) {
      if (currentPupil.current === forPupil) setError((err as Error).message);
    }
  }

  return (
    <section className="plai-card mt-4">
      <h2 className="text-xl mb-2">Inviter une personne à suivre un élève</h2>
      <p className="help mb-3">L'ergothérapeute ou un parent peut consulter en lecture seule les résultats d'un seul élève, sous son code anonyme. Tu crées un lien et tu l'envoies toi-même : l'application n'envoie rien.</p>

      <form onSubmit={create}>
        <div className="plai-field">
          <label className="plai-label" htmlFor="share-pupil">Élève concerné</label>
          <select id="share-pupil" className="plai-input" value={pupilId} onChange={e => setPupilId(e.target.value)}>
            {pupils.map(p => <option key={p.id} value={p.id}>{p.code}{p.classLabel ? ` (${p.classLabel})` : ''}</option>)}
          </select>
          <p className="help">La personne invitée ne verra que cet élève, jamais les autres.</p>
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="share-label">Nom d'usage de la personne invitée</label>
          <input id="share-label" className="plai-input" maxLength={60} value={label} onChange={e => setLabel(e.target.value)} placeholder="Exemple : Ergo, Mme Dupont" />
          <p className="help">Sert seulement à t'y retrouver dans la liste des invitations. Ne jamais y mettre le prénom d'un élève.</p>
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="share-expires">Fin de l'accès</label>
          <input id="share-expires" type="date" className="plai-input" required min={toDateInput(new Date())} value={expires} onChange={e => setExpires(e.target.value)} />
          <p className="help">Après cette date, le lien cesse de fonctionner. Par défaut, la fin de l'année scolaire (31 août). Tu peux retirer l'accès à tout moment avant.</p>
        </div>
        <button type="submit" className="plai-btn" disabled={busy || !pupilId}>Créer le lien</button>
      </form>

      {error && <p className="plai-error mt-2">{error}</p>}

      {created && (
        <div className="plai-card mt-3" role="status" style={{ borderColor: 'var(--teal)', borderWidth: 2 }}>
          <h3 className="text-lg mb-1">Lien pour « {created.label} », élève {created.pupilCode}</h3>
          <input ref={linkField} readOnly className="plai-input" value={created.url} onFocus={e => e.currentTarget.select()} aria-label="Lien d'invitation" />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="plai-btn" onClick={copy}>Copier le lien</button>
            <a className="plai-btn-ghost inline-block no-underline" href={buildInviteMailto(created.url, created.label)}>Écrire un e-mail</a>
          </div>
          {copied && <p className="help mt-1">{copied}</p>}
          <p className="help mt-2"><strong>Ce lien ne sera plus affiché.</strong> Qui le possède voit les résultats de cet élève. L'application n'envoie rien : c'est toi qui le transmets.</p>
        </div>
      )}

      <h3 className="text-lg mt-4 mb-1">Invitations de {pupil?.code ?? 'cet élève'}</h3>
      {shares.length === 0 && <p className="plai-empty">Aucune invitation pour cet élève.</p>}
      {shares.map(s => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span>
            <strong>{s.label}</strong> · {state(s)}
            <span className="help" style={{ display: 'block' }}>{s.lastUsedAt ? `Dernière consultation : ${frDate(s.lastUsedAt)}` : 'Jamais consultée'}</span>
          </span>
          {!s.revokedAt && new Date(s.expiresAt) > new Date() && (
            <button type="button" className="plai-btn-ghost" onClick={() => revoke(s.id)} aria-label={`Retirer l'accès de ${s.label}`}>Retirer l'accès</button>
          )}
        </div>
      ))}
    </section>
  );
}
