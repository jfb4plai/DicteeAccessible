import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function TeacherNav() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <Link to="/enseignant" className="plai-nav-link">Mes dictées</Link>
      <Link to="/enseignant/eleves" className="plai-nav-link">Mes élèves</Link>
      <button type="button" className="plai-nav-link" onClick={async () => { await signOut(); navigate('/'); }}>
        Se déconnecter
      </button>
    </>
  );
}
