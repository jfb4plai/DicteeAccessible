import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function TeacherNav() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      {user?.email && <span className="plai-nav-account" title={user.email}><span className="sr-only">Connecté(e) avec </span>{user.email}</span>}
      <Link to="/enseignant/eleves" className="plai-nav-link">Mes élèves</Link>
      <Link to="/enseignant" className="plai-nav-link">Mes dictées</Link>
      <button type="button" className="plai-nav-link" onClick={async () => { await signOut(); navigate('/'); }}>
        Se déconnecter
      </button>
    </>
  );
}
