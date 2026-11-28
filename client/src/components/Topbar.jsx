import { useAuth } from '../context/AuthContext';

export default function Topbar() {
  const { user, logout } = useAuth();

  return (
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
  );
}