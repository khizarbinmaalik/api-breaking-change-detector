import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import Topbar from '../components/Topbar';

export default function RepoDiffs() {
  const { id } = useParams();
  const [repo, setRepo] = useState(null);
  const [diffs, setDiffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    // The repo list gives us the repo's name; the diffs route gives us the changes
    Promise.all([api.get('/repos'), api.get(`/repos/${id}/diffs`)])
      .then(([reposRes, diffsRes]) => {
        setRepo(reposRes.data.find((r) => r._id === id) || null);
        setDiffs(diffsRes.data);
      })
      .catch((err) =>
        setError(err.response?.data?.message || 'Could not load the changes for this repository.')
      )
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="page">
      <Topbar />
      <main>
        <p>
          <Link to="/dashboard" className="link">
            ← Back to repositories
          </Link>
        </p>
        <div className="section-head">
          <h2>{repo ? repo.fullName : 'Repository'}</h2>
        </div>

        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Loading...</p>}

        {!loading && !error && diffs.length === 0 && (
          <p className="muted">
            No changes detected yet. A change appears here after you push an edit to the spec file
            on the default branch (the first push only saves a starting point to compare against).
          </p>
        )}

        <ul className="repo-list">
          {diffs.map((d) => (
            <li key={d._id}>
              <Link to={`/repos/${id}/diffs/${d._id}`} className="repo-item diff-item">
                <div>
                  <strong>
                    {d.fromCommitSha.slice(0, 7)} → {d.toCommitSha.slice(0, 7)}
                  </strong>
                  <div className="muted small">{new Date(d.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <span className={`badge ${d.hasBreaking ? 'badge-breaking' : 'badge-safe'}`}>
                    {d.hasBreaking ? 'Breaking' : 'Safe'}
                  </span>
                  <span className="muted small">
                    {' '}
                    {d.summary.breaking} breaking, {d.summary.safe} safe
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}