import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import TeacherAuth from './pages/TeacherAuth';
import ResetPassword from './pages/ResetPassword';
import TeacherDashboard from './pages/TeacherDashboard';
import PupilsPage from './pages/PupilsPage';
import NewSession from './pages/NewSession';
import SessionResults from './pages/SessionResults';
import SessionWorkspace from './pages/SessionWorkspace';
import PupilEntry from './pages/PupilEntry';
import PupilExercise from './pages/PupilExercise';
import SharedView from './pages/SharedView';

// Anciennes adresses (phrases, modifier) : elles mènent à l'onglet correspondant de l'espace de travail.
function ToTab({ tab }: { tab: string }) {
  const { id = '' } = useParams();
  return <Navigate to={`/enseignant/session/${id}?onglet=${tab}`} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/enseignant/auth" element={<TeacherAuth />} />
          <Route path="/enseignant/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/enseignant" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/enseignant/dashboard" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/enseignant/eleves" element={<ProtectedRoute><PupilsPage /></ProtectedRoute>} />
          <Route path="/enseignant/session/nouvelle" element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
          <Route path="/enseignant/session/:id" element={<ProtectedRoute><SessionWorkspace /></ProtectedRoute>} />
          <Route path="/enseignant/session/:id/phrases" element={<ProtectedRoute><ToTab tab="phrases" /></ProtectedRoute>} />
          <Route path="/enseignant/session/:id/modifier" element={<ProtectedRoute><ToTab tab="contenu" /></ProtectedRoute>} />
          <Route path="/enseignant/resultats/:sessionId" element={<ProtectedRoute><SessionResults /></ProtectedRoute>} />
          <Route path="/eleve" element={<PupilEntry />} />
          <Route path="/eleve/jeu" element={<PupilExercise />} />
          <Route path="/suivi" element={<SharedView />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
