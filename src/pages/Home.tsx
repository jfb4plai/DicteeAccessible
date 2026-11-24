import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import '../home.css';

export default function Home() {
  return (
    <PageShell>
      <div className="home">
      <span className="home-pill">Un outil du Pôle de la Ville de Liège (PLAI)</span>
      <h1 className="home-title">Des dictées sur tablette pour que chaque élève <b>écrive à son rythme</b></h1>
      <p className="home-lead">
        Créer une dictée de mots ou de phrases. Donner un lien ou un QR code à chaque élève. L'élève écoute le mot ou la phrase,
        puis remet les lettres ou les mots dans l'ordre. Chaque réponse est enregistrée pour que l'enseignant(e) la relise.
      </p>

      <div className="home-bens">
        <div className="home-ben"><span className="ic" aria-hidden="true">✍️</span><h3>Créer vite</h3><p>Une liste de mots, ou des phrases proposées par l'IA que tu relis et corriges avant de les publier.</p></div>
        <div className="home-ben"><span className="ic" aria-hidden="true">🔑</span><h3>Élèves sans compte</h3><p>Un lien ou un QR code par élève. Les élèves sont repérés par un code anonyme, jamais par leur nom.</p></div>
        <div className="home-ben"><span className="ic" aria-hidden="true">📊</span><h3>Lire les résultats</h3><p>Pour chaque élève, mot par mot et phrase par phrase : réussi, raté ou aidé.</p></div>
      </div>

      <div className="home-choose">
        <h2>Qui es-tu ?</h2>
        <div className="home-entries">
          <Link to="/enseignant" className="home-entry t">
            <span className="ic" aria-hidden="true">🧑‍🏫</span><strong>Je suis enseignant·e</strong>
            <span className="s">Créer une dictée, donner un lien à chaque élève, lire les résultats.</span>
            <span className="go">Me connecter ou créer un compte →</span>
          </Link>
          <Link to="/eleve" className="home-entry e">
            <span className="ic" aria-hidden="true">🎒</span><strong>Je suis élève</strong>
            <span className="s">Mon enseignant·e m'a donné un code. Pas besoin de compte.</span>
            <span className="go">Entrer mon code →</span>
          </Link>
        </div>
      </div>

      <p className="home-first">Première visite ? <a href="/mode-emploi.html">Lire le mode d'emploi pour l'enseignant(e)</a>.</p>
      </div>
    </PageShell>
  );
}
