import type { ReactNode } from 'react';
import type { DictaSentence } from '../../lib/types';
import type { getSessionForEdit } from '../../lib/api';
import type { TabKey } from '../../lib/workspace';

export type Loaded = Awaited<ReturnType<typeof getSessionForEdit>>;
export type SavedSentence = DictaSentence & { validated: boolean };
export type WorkspaceData = { session: Loaded; sentences: SavedSentence[]; attempts: number };

export type TabProps = {
  id: string;
  data: WorkspaceData;
  reload: () => Promise<WorkspaceData>;
  goNext: () => void;
  goTo: (tab: TabKey) => void;
  setDirty: (dirty: boolean) => void;
};

// Phrase d'accueil de l'onglet : ce qu'on fait ici et pourquoi.
export function TabIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl mb-1">{title}</h2>
      <p className="help">{children}</p>
    </div>
  );
}

export function SaveBar({ busy, onSave, label = 'Enregistrer et continuer', error, info, extra }: {
  busy: boolean; onSave: () => void; label?: string; error?: string; info?: string; extra?: ReactNode;
}) {
  return (
    <div className="mt-4">
      {error && <p className="plai-error" role="alert">{error}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button type="button" className="plai-btn" disabled={busy} onClick={onSave}>{label}</button>
        {extra}
      </div>
    </div>
  );
}
