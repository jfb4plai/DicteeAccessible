import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import TeacherAuth from './pages/TeacherAuth';
import ResetPassword from './pages/ResetPassword';
import TeacherDashboard from './pages/TeacherDashboard';
import PupilsPage from './pages/PupilsPage';
import NewSession from './pages/NewSession';
import SessionResults from './pages/SessionResults';
import PupilEntry from './pages/PupilEntry';
import PupilExercise from './pages/PupilExercise';

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
          <Route path="/enseignant/resultats/:sessionId" element={<ProtectedRoute><SessionResults /></ProtectedRoute>} />
          <Route path="/eleve" element={<PupilEntry />} />
          <Route path="/eleve/jeu" element={<PupilExercise />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
