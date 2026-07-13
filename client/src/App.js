import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Contributions from './pages/Contributions';
import PeerReview from './pages/PeerReview';
import Notifications from './pages/Notifications';
import Users from './pages/Users';
import ProfileSetup from './pages/ProfileSetup';
import Units from './pages/Units';
import RoomWorkspace from './pages/RoomWorkspace';
import RoomManager from './pages/RoomManager';
import './styles/main.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'Supervisor') {
    return <Navigate to="/dashboard" />;
  }
  return children;
};

const UnitRoomsEntry = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return user.role === 'Supervisor' ? <RoomManager /> : <Units />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/projects" element={<PrivateRoute><Navigate to="/units" replace /></PrivateRoute>} />
          <Route path="/tasks" element={<PrivateRoute><Navigate to="/dashboard" replace /></PrivateRoute>} />
          <Route path="/contributions" element={<PrivateRoute><Contributions /></PrivateRoute>} />
          <Route path="/peer-review" element={<PrivateRoute><PeerReview /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/collaboration" element={<PrivateRoute><Navigate to="/room-workspace" replace /></PrivateRoute>} />
          <Route path="/room-workspace" element={<PrivateRoute><RoomWorkspace /></PrivateRoute>} />
          <Route path="/assignments" element={<PrivateRoute><Navigate to="/dashboard" replace /></PrivateRoute>} />
          <Route path="/alerts" element={<PrivateRoute><Navigate to="/contributions" replace /></PrivateRoute>} />
          <Route path="/profile-setup" element={<PrivateRoute><ProfileSetup /></PrivateRoute>} />
          <Route path="/units" element={<PrivateRoute><UnitRoomsEntry /></PrivateRoute>} />
          <Route path="/rooms" element={<AdminRoute><Navigate to="/units" replace /></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
