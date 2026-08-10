import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectCreate from './pages/ProjectCreate';
import PlanReview from './pages/PlanReview';
import ProjectDetail from './pages/ProjectDetail';
import TeamPage from './pages/TeamPage';
import GitHubPage from './pages/GitHubPage';
import AIInsights from './pages/AIInsights';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080c14]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/github/callback" element={<Navigate to="/github" replace />} />

        {/* Protected workspace routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects" 
          element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/new" 
          element={
            <ProtectedRoute>
              <ProjectCreate />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/review" 
          element={
            <ProtectedRoute>
              <PlanReview />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:id" 
          element={
            <ProtectedRoute>
              <ProjectDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/team" 
          element={
            <ProtectedRoute>
              <TeamPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/github" 
          element={
            <ProtectedRoute>
              <GitHubPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ai-insights" 
          element={
            <ProtectedRoute>
              <AIInsights />
            </ProtectedRoute>
          } 
        />

        {/* Catch all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
