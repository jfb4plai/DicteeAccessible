import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';

export default function Home() {
  return (
    <PageShell>
      <h1 className="text-3xl mb-2">DictéeAccessible</h1>
      <p className="help mb-6">Des dictées à placer sur tablette ou ordinateur. Chaque réponse est enregistrée pour que l'enseignante la relise.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/enseignant" className="plai-card block no-underline" style={{ color: 'inherit' }}>
          <h2 className="text-xl mb-1">Espace enseignante</h2>
          <p className="help">Créer une dictée, donner un lien à chaque élève, lire les résultats.</p>
        </Link>
        <Link to="/eleve" className="plai-card block no-underline" style={{ color: 'inherit' }}>
          <h2 className="text-xl mb-1">Espace élève</h2>
          <p className="help">Entrer le code de la dictée et son code personnel pour commencer.</p>
        </Link>
      </div>
    </PageShell>
  );
}
