import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
};

// Cadre commun : navigation (logo 32 px de haut, largeur auto), conteneur, pied de page (logo 40 px).
export default function PageShell({ children, actions, wide }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="plai-nav">
        <Link to="/" className="plai-nav-logo">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
          <span>DictéeAccessible</span>
        </Link>
        <nav className="plai-nav-actions">{actions}</nav>
      </header>
      <main className={`${wide ? 'plai-container-wide' : 'plai-container'} flex-1 w-full py-6`}>{children}</main>
      <footer className="plai-footer">
        <img src="/plai-logo.jpg" alt="" style={{ height: 40, width: 'auto', margin: '0 auto 8px' }} />
        <p>Pôle Liégeois d'Accompagnement vers une École Inclusive</p>
      </footer>
    </div>
  );
}
