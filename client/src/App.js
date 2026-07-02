import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Contributions from './pages/Contributions';
import PeerReview from './pages/PeerReview';
import Collaboration from './pages/Collaboration';
import Alerts from './pages/Alerts';
import Users from './pages/Users';
import './styles/main.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

const SupervisorRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'Supervisor') {
    return <Navigate to="/dashboard" />;
  }
  return children;
};

const ProjectManagerRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'Member') {
    return <Navigate to="/dashboard" />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/projects" element={<ProjectManagerRoute><Projects /></ProjectManagerRoute>} />
          <Route path="/tasks" element={<ProjectManagerRoute><Tasks /></ProjectManagerRoute>} />
          <Route path="/contributions" element={<PrivateRoute><Contributions /></PrivateRoute>} />
          <Route path="/peer-review" element={<PrivateRoute><PeerReview /></PrivateRoute>} />
          <Route path="/collaboration" element={<PrivateRoute><Collaboration /></PrivateRoute>} />
          <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
          <Route path="/users" element={<SupervisorRoute><Users /></SupervisorRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
