import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';

export default function Home() {
  return (
    <PageShell>
      <h1 className="text-3xl mb-2">DictéeAccessible</h1>
      <p className="help mb-6">Des dictées à placer sur tablette ou ordinateur. Chaque réponse est enregistrée pour que l'enseignant(e) la relise.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/enseignant" className="plai-card block no-underline" style={{ color: 'inherit', background: '#e1f5ee', border: '2px solid #1d9e75' }}>
          <h2 className="text-xl mb-1" style={{ color: '#0f6e56' }}>Espace enseignant(e)</h2>
          <p className="help">Créer une dictée, donner un lien à chaque élève, lire les résultats.</p>
        </Link>
        <Link to="/eleve" className="plai-card block no-underline" style={{ color: 'inherit', background: '#fff1e0', border: '2px solid #f97316' }}>
          <h2 className="text-xl mb-1" style={{ color: '#9a3412' }}>Espace élève</h2>
          <p className="help">Entrer le code de la dictée et son code personnel pour commencer.</p>
        </Link>
      </div>
    </PageShell>
  );
}
