import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap any page that needs a logged-in user. Everyone else gets sent to /login.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="center">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}