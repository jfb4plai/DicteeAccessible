import { useState } from 'react';
import { updateSessionSettings } from '../../lib/api';
import type { SessionOptions, Voice } from '../../lib/types';
import { SaveBar, TabIntro, type TabProps } from './common';

const DEFAULTS: Record<'autonomy' | 'class', SessionOptions> = {
  autonomy: { showCorrect: true, readAloud: true, finalRound: true },
  class: { showCorrect: false, readAloud: true, finalRound: true },
};

const OPTION_TEXTS = [
  ['showCorrect', 'Montrer la bonne orthographe', "Si l'élève l'utilise, le mot est signalé dans tes résultats et revient au dernier tour."],
  ['readAloud', 'Lire le mot automatiquement', 'Le mot est lu dès son arrivée. Le bouton « Écouter le mot » reste toujours disponible.'],
  ['finalRound', 'Dernier tour', 'Les mots ratés ou aidés reviennent à la fin, sans aide.'],
] as const;

export default function SettingsTab({ id, data, reload, goNext, setDirty }: TabProps) {
  const s = data.session;
  const [mode, setMode] = useState<'autonomy' | 'class'>(s.mode);
  const [voice, setVoice] = useState<Voice>(s.voice);
  const [parasiteCount, setParasiteCount] = useState(s.parasiteCount);
  const [options, setOptions] = useState<SessionOptions>(s.options);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const touch = () => setDirty(true);

  async function save() {
    setError('');
    setBusy(true);
    try {
      await updateSessionSettings(id, { mode, voice, parasiteCount, options });
      await reload();
      setDirty(false);
      goNext();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <div>
      <TabIntro title="Les réglages">Comment la dictée se passe pour l'élève. Les valeurs proposées conviennent à une première dictée : tu peux passer directement à la suite.</TabIntro>
      <fieldset className="plai-field">
        <legend className="plai-label">Type de dictée</legend>
        <div className="grid md:grid-cols-2 gap-3" role="radiogroup" aria-label="Type de dictée">
          {([['autonomy', 'Préparation en autonomie', "L'élève s'entraîne seule, avec la bonne orthographe disponible."],
             ['class', 'Dictée en classe', "Résultats enregistrés mot par mot, sans aide à l'orthographe."]] as const).map(([value, label, help]) => (
            <label key={value} className="plai-card" style={{ borderColor: mode === value ? 'var(--teal)' : undefined, borderWidth: mode === value ? 2 : 1, cursor: 'pointer' }}>
              <input type="radio" name="mode" checked={mode === value} onChange={() => { setMode(value); setOptions(DEFAULTS[value]); touch(); }} /> <strong>{label}</strong>
              <p className="help">{help}</p>
            </label>
          ))}
        </div>
        <p className="help">Changer de type règle aussi les options ci-dessous. À éviter une fois la dictée commencée : le parcours des élèves change.</p>
      </fieldset>
      <div className="plai-field">
        <label className="plai-label" htmlFor="voice">Voix de lecture</label>
        <select id="voice" className="plai-input" value={voice} onChange={e => { setVoice(e.target.value as Voice); touch(); }}>
          <option value="adrien">Adrien, voix belge</option>
          <option value="jef">Jean-François, voix clonée</option>
          <option value="device">Voix de l'appareil</option>
        </select>
        <p className="help">Adrien lit « nonante » et « septante » comme en Belgique. La voix de l'appareil ne demande aucun service en ligne, mais sa prononciation dépend de l'appareil.</p>
      </div>
      <div className="plai-field">
        <label className="plai-label" htmlFor="parasites">Mots parasites par phrase</label>
        <select id="parasites" className="plai-input" value={parasiteCount} onChange={e => { setParasiteCount(Number(e.target.value)); touch(); }}>
          <option value={0}>0 : remettre les mots dans l'ordre, sans mot en trop</option>
          <option value={1}>1 mot en trop</option>
          <option value={2}>2 mots en trop</option>
          <option value={3}>3 mots en trop</option>
        </select>
        <p className="help">Mots en trop mêlés aux tuiles quand l'élève reconstruit une phrase de mémoire (B2 et dictée en classe). Sans effet si la dictée n'a pas de phrases.</p>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', minHeight: 40 }}><strong>Options</strong> (réglées pour le type choisi)</summary>
        <div className="mt-2">
          {OPTION_TEXTS.map(([key, label, help]) => (
            <div key={key} className="plai-field">
              <label><input type="checkbox" checked={options[key]} onChange={e => { setOptions({ ...options, [key]: e.target.checked }); touch(); }} /> <strong>{label}</strong></label>
              <p className="help">{help}</p>
            </div>
          ))}
        </div>
      </details>
      <SaveBar busy={busy} onSave={() => void save()} error={error} />
    </div>
  );
}
