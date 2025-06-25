import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: string;
}

export default function ProtectedRoute({ children, requireRole = 'admin' }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (requireRole && user?.role !== requireRole) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2>Access Denied</h2>
        <p>You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
} 