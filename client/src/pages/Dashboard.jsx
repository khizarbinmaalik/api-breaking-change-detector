import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import RepoPicker from '../components/RepoPicker';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    api
      .get('/repos')
      .then((res) => setRepos(res.data))
      .catch(() => setError('Could not load your repositories.'))
      .finally(() => setLoading(false));
  }, []);

  const disconnect = async (id) => {
    if (!window.confirm('Disconnect this repository?')) return;
    try {
      await api.delete(`/repos/${id}`);
      setRepos((current) => current.filter((r) => r._id !== id));
    } catch {
      setError('Could not disconnect the repository.');
    }
  };

  const handleConnected = (repo) => {
    setRepos((current) => [repo, ...current]);
    setShowPicker(false);
  };

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
        <div className="section-head">
          <h2>Connected repositories</h2>
          <button className="btn" onClick={() => setShowPicker((s) => !s)}>
            {showPicker ? 'Cancel' : 'Connect a repository'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {showPicker && (
          <RepoPicker connectedIds={repos.map((r) => r.githubRepoId)} onConnected={handleConnected} />
        )}

        {loading ? (
          <p className="muted">Loading...</p>
        ) : repos.length === 0 ? (
          <p className="muted">No repositories connected yet.</p>
        ) : (
          <ul className="repo-list">
            {repos.map((repo) => (
              <li key={repo._id} className="repo-item">
                <div>
                  <strong>{repo.fullName}</strong>
                  <div className="muted small">
                    Spec: {repo.specFilePath} on {repo.defaultBranch}
                  </div>
                </div>
                <button className="btn secondary" onClick={() => disconnect(repo._id)}>
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}