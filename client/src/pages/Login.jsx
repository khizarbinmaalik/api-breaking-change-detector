import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ERRORS = {
  oauth: 'GitHub login failed. Please try again.',
  state: 'Login session expired or was invalid. Please try again.',
};

export default function Login() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const error = ERRORS[params.get('error')];

  if (loading) return <p className="center">Loading...</p>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="card center-card">
      <h1>API Guard</h1>
      <p>Catch breaking API changes before they reach production.</p>
      {error && <p className="error">{error}</p>}
      {/* A normal link, not axios: the browser must navigate to the server, which redirects to GitHub */}
      <a className="btn" href="/api/auth/github">
        Continue with GitHub
      </a>
    </div>
  );
}