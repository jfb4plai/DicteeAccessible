import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#0f6e56] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/enseignant/auth" replace />;
  }

  return <>{children}</>;
}
