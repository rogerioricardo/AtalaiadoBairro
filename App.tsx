
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Alerts from './pages/Alerts';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import MapPage from './pages/MapPage';
import IntegratorUsers from './pages/IntegratorUsers';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/cameras" element={
        <ProtectedRoute>
          <Cameras />
        </ProtectedRoute>
      } />

      <Route path="/alerts" element={
        <ProtectedRoute>
          <Alerts />
        </ProtectedRoute>
      } />

      <Route path="/chat" element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />

      <Route path="/map" element={
        <ProtectedRoute>
          <MapPage />
        </ProtectedRoute>
      } />

      <Route path="/integrator/users" element={
        <ProtectedRoute>
          <IntegratorUsers />
        </ProtectedRoute>
      } />
      
      {/* Admin specific routes would be here, mapped to existing pages for now */}
      <Route path="/admin/bairros" element={<ProtectedRoute><Cameras /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
