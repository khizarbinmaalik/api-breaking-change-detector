import { useEffect, useState } from 'react';
import api from '../api';

export default function RepoPicker({ connectedIds, onConnected }) {
  const [githubRepos, setGithubRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specPath, setSpecPath] = useState('openapi.yaml');
  const [connectingId, setConnectingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/github/repos')
      .then((res) => setGithubRepos(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load your GitHub repositories.'))
      .finally(() => setLoading(false));
  }, []);

  const connect = async (repo) => {
    setError('');
    setConnectingId(repo.githubRepoId);
    try {
      const res = await api.post('/repos', {
        owner: repo.owner,
        name: repo.name,
        specFilePath: specPath,
      });
      onConnected(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect the repository.');
    } finally {
      setConnectingId(null);
    }
  };

  const visible = githubRepos.filter(
    (r) =>
      !connectedIds.includes(r.githubRepoId) &&
      r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="card picker">
      <div className="field">
        <label htmlFor="specPath">Path of the OpenAPI spec file in the repository</label>
        <input id="specPath" value={specPath} onChange={(e) => setSpecPath(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="search">Search your repositories</label>
        <input
          id="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a repository name..."
        />
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading your GitHub repositories...</p>}
      {!loading && visible.length === 0 && <p className="muted">No repositories to show.</p>}

      <ul className="repo-list">
        {visible.map((repo) => (
          <li key={repo.githubRepoId} className="repo-item">
            <div>
              <strong>{repo.fullName}</strong>
              {repo.private && <span className="badge">private</span>}
              {repo.description && <div className="muted small">{repo.description}</div>}
            </div>
            <button
              className="btn"
              disabled={connectingId !== null}
              onClick={() => connect(repo)}
            >
              {connectingId === repo.githubRepoId ? 'Connecting...' : 'Connect'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}