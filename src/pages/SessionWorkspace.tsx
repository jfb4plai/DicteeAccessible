import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import TeacherNav from '../components/TeacherNav';
import { countAttempts, getSessionForEdit, listSentences } from '../lib/api';
import { followingTab, nextStep, nextStepMessage, parseTab, tabStatus, TAB_KEYS, TAB_LABELS, type TabKey } from '../lib/workspace';
import ContentTab from './session/ContentTab';
import SettingsTab from './session/SettingsTab';
import SentencesTab from './session/SentencesTab';
import PupilsTab from './session/PupilsTab';
import PublishTab from './session/PublishTab';
import ResultsTab from './session/ResultsTab';
import { factsOf } from './session/facts';
import type { TabProps, WorkspaceData } from './session/common';

const PANELS: Record<TabKey, (p: TabProps) => JSX.Element> = {
  contenu: ContentTab,
  reglages: SettingsTab,
  phrases: SentencesTab,
  eleves: PupilsTab,
  publier: PublishTab,
  resultats: ResultsTab,
};

async function load(id: string): Promise<WorkspaceData> {
  const [session, sentences, attempts] = await Promise.all([getSessionForEdit(id), listSentences(id), countAttempts(id)]);
  return { session, sentences, attempts };
}

// Espace de travail d'une dictée : créer et modifier au même endroit, onglet par onglet.
// Tous les onglets restent affichés (masqués) : changer d'onglet ne fait perdre aucune saisie.
export default function SessionWorkspace() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    load(id).then(setData).catch((e: Error) => setError(e.message));
  }, [id]);

  // Fermer ou recharger l'onglet du navigateur avec une saisie non enregistrée : le navigateur demande confirmation.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const reload = useCallback(async () => {
    const fresh = await load(id);
    setData(fresh);
    return fresh;
  }, [id]);

  const goTo = useCallback((t: TabKey) => { setParams({ onglet: t }, { replace: true }); window.scrollTo({ top: 0 }); }, [setParams]);
  const setDirty = useCallback((d: boolean) => { dirty.current = d; }, []);

  if (!data) {
    return <PageShell actions={<TeacherNav />}>{error ? <p className="plai-error">{error}</p> : <p className="help">Chargement…</p>}</PageShell>;
  }

  const facts = factsOf(data);
  const status = tabStatus(facts);
  const next = nextStep(facts);
  // Sans onglet demandé : on ouvre directement la prochaine étape (ou les liens si la dictée est publiée).
  const requested = params.get('onglet');
  const tab: TabKey = requested ? parseTab(requested) : (next ?? 'publier');
  const warn = data.session.published || data.attempts > 0;

  const props: TabProps = { id, data, reload, goNext: () => goTo(followingTab(tab)), goTo, setDirty };

  return (
    <PageShell wide actions={<TeacherNav />}>
      <p><Link to="/enseignant">← Mes dictées</Link></p>
      <div className="flex flex-wrap items-baseline justify-between gap-2 my-3">
        <h1 className="text-3xl">{data.session.title}</h1>
        <span className="plai-badge">{data.session.published ? `Publiée · code ${data.session.accessCode}` : 'Brouillon : invisible pour les élèves'}</span>
      </div>

      <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>
        <strong>{next === null ? 'Dictée publiée' : 'Prochaine étape'}</strong> : {nextStepMessage(facts)}
        {next !== null && next !== tab && <> <button type="button" className="plai-btn-ghost" onClick={() => goTo(next)}>Y aller</button></>}
      </div>

      {warn && (
        <div className="plai-banner" role="note" style={{ marginBottom: 12 }}>
          <strong>À savoir avant de modifier.</strong> Une dictée générée n'a pas forcément été partagée ; si tu as déjà donné le code ou les liens, les élèves voient les modifications tout de suite.
          {data.attempts > 0 ? ` ${data.attempts} réponse${data.attempts > 1 ? 's' : ''} d'élèves déjà enregistrée${data.attempts > 1 ? 's' : ''}.` : ' Aucune réponse d\'élève enregistrée pour l\'instant.'}
          {' '}Corriger un mot garde ses résultats ; retirer un mot ou une phrase supprime les siens ; retirer un élève lui enlève l'accès.
        </div>
      )}

      <div role="tablist" aria-label="Étapes de la dictée" className="flex flex-wrap gap-2 mb-4">
        {TAB_KEYS.map((k, i) => {
          const done = status[k];
          const active = k === tab;
          return (
            <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={active} aria-controls={`panel-${k}`}
              tabIndex={active ? 0 : -1}
              className={active ? 'plai-btn' : 'plai-btn-ghost'}
              style={{ minHeight: 44 }}
              onClick={() => goTo(k)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight') goTo(TAB_KEYS[(i + 1) % TAB_KEYS.length]);
                if (e.key === 'ArrowLeft') goTo(TAB_KEYS[(i + TAB_KEYS.length - 1) % TAB_KEYS.length]);
              }}>
              <span aria-hidden="true">{done === true ? '✓ ' : ''}</span>{TAB_LABELS[k]}
              {done === true && <span style={{ position: 'absolute', left: -9999 }}> (terminé)</span>}
              {k === 'phrases' && done === null && <span style={{ marginLeft: 4, fontSize: 14, opacity: 0.85 }}>(facultatif)</span>}
            </button>
          );
        })}
      </div>

      {TAB_KEYS.map(k => {
        const Panel = PANELS[k];
        return (
          <section key={k} role="tabpanel" id={`panel-${k}`} aria-labelledby={`tab-${k}`} hidden={k !== tab} className="plai-card">
            <Panel {...props} />
          </section>
        );
      })}
    </PageShell>
  );
}
