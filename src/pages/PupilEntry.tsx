import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { normalizeCode } from '../lib/apiMapping';

export default function PupilEntry() {
  const [sessionCode, setSessionCode] = useState('');
  const [pupilCode, setPupilCode] = useState('');
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = normalizeCode(sessionCode);
    const p = normalizeCode(pupilCode);
    if (!s || !p) return;
    navigate(`/eleve/jeu?session=${encodeURIComponent(s)}&eleve=${encodeURIComponent(p)}`);
  }

  return (
    <PageShell>
      <h1 className="text-3xl mb-4">Commencer la dictée</h1>
      <form onSubmit={submit} className="plai-card">
        <div className="plai-field">
          <label className="plai-label" htmlFor="session-code">Code de la dictée</label>
          <input id="session-code" className="plai-input" value={sessionCode} onChange={e => setSessionCode(e.target.value)}
            placeholder="Exemple : K7M2QX" autoComplete="off" autoCapitalize="characters" />
          <p className="help">Ton enseignant(e) donne ce code. Il a 6 caractères.</p>
        </div>
        <div className="plai-field">
          <label className="plai-label" htmlFor="pupil-code">Ton code personnel</label>
          <input id="pupil-code" className="plai-input" value={pupilCode} onChange={e => setPupilCode(e.target.value)}
            placeholder="Exemple : E1" autoComplete="off" autoCapitalize="characters" />
          <p className="help">Ce code remplace ton prénom. Il sert à retrouver tes réponses.</p>
        </div>
        <button type="submit" className="plai-btn" disabled={!sessionCode.trim() || !pupilCode.trim()}>Commencer</button>
      </form>
    </PageShell>
  );
}
