import { useState } from 'react';
import PupilLinks from '../../components/PupilLinks';
import { publishSession } from '../../lib/api';
import { publishBlockers, TAB_LABELS } from '../../lib/workspace';
import { warmSession } from '../../lib/warmSession';
import { TabIntro, type TabProps } from './common';
import { factsOf } from './facts';

export default function PublishTab({ id, data, reload, goTo }: TabProps) {
  const s = data.session;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blockers = publishBlockers(factsOf(data));

  async function publish() {
    setBusy(true); setError('');
    try {
      await publishSession(id);
      void warmSession(id); // audio prêt avant l'arrivée de la classe
      await reload();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (s.published) {
    return (
      <div>
        <TabIntro title="Dictée publiée">Les élèves peuvent commencer. Donne à chacun son lien ou son QR code : ils contiennent le code de la dictée et le code de l'élève, jamais un prénom.</TabIntro>
        <p className="plai-success">Code de la dictée : <strong style={{ fontSize: 24 }}>{s.accessCode}</strong></p>
        <div className="mt-3"><PupilLinks accessCode={s.accessCode} pupils={s.pupils} /></div>
        <p className="help mt-3">Tu peux encore modifier la dictée depuis les autres onglets : les élèves voient les changements tout de suite. Les résultats arrivent dans l'onglet « Résultats ».</p>
      </div>
    );
  }

  return (
    <div>
      <TabIntro title="Publier la dictée">Dernière étape. Tant que la dictée n'est pas publiée, aucun élève ne la voit. Une fois publiée, elle reçoit un code et chaque élève un lien personnel.</TabIntro>
      {blockers.length > 0 ? (
        <div className="plai-card">
          <p className="plai-label">Il reste à faire avant de publier</p>
          <ul style={{ paddingLeft: 20, listStyle: 'disc' }}>
            {blockers.map(b => (
              <li key={b.tab} className="mb-1">
                {b.message}{' '}
                <button type="button" className="plai-btn-ghost" onClick={() => goTo(b.tab)}>Aller à « {TAB_LABELS[b.tab]} »</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="plai-success">Tout est prêt : {s.items.length} mot{s.items.length > 1 ? 's' : ''}, {data.sentences.length} phrase{data.sentences.length > 1 ? 's' : ''}, {s.pupils.length} élève{s.pupils.length > 1 ? 's' : ''}.</p>
      )}
      {error && <p className="plai-error" role="alert">{error}</p>}
      <button type="button" className="plai-btn mt-3" disabled={busy || blockers.length > 0} onClick={() => void publish()}>Publier la dictée</button>
    </div>
  );
}
