import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="topbar">
        <strong>API Guard</strong>
        <div className="user">
          <img src={user.avatarUrl} alt="" width="28" height="28" />
          <span>{user.username}</span>
          <button className="btn secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main>
        <h2>Connected repositories</h2>
        <p className="muted">No repositories connected yet. Connecting repos is coming in Phase 2.</p>
      </main>
    </div>
  );
}