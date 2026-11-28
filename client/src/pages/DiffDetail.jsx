import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api';
import Topbar from '../components/Topbar';

export default function DiffDetail() {
  const { id, diffId } = useParams();
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/repos/${id}/diffs/${diffId}`)
      .then((res) => setDiff(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load this diff.'))
      .finally(() => setLoading(false));
  }, [id, diffId]);

  const regenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      const res = await api.post(`/repos/${id}/diffs/${diffId}/changelog/regenerate`);
      setDiff((current) => ({ ...current, changelog: res.data }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not regenerate the changelog.');
    } finally {
      setRegenerating(false);
    }
  };

  // Breaking changes first
  const changes = diff
    ? [...diff.changes].sort((a, b) =>
        a.severity === b.severity ? 0 : a.severity === 'breaking' ? -1 : 1
      )
    : [];

  return (
    <div className="page">
      <Topbar />
      <main>
        <p>
          <Link to={`/repos/${id}/diffs`} className="link">
            ← Back to changes
          </Link>
        </p>

        {loading && <p className="muted">Loading... (the first view of an older change may take a few seconds)</p>}
        {error && <p className="error">{error}</p>}

        {diff && (
          <>
            <div className="section-head">
              <h2>
                {diff.fromCommitSha.slice(0, 7)} → {diff.toCommitSha.slice(0, 7)}
              </h2>
              <div>
                <span className={`badge ${diff.hasBreaking ? 'badge-breaking' : 'badge-safe'}`}>
                  {diff.hasBreaking ? 'Breaking' : 'Safe'}
                </span>
                <span className="muted small">
                  {' '}
                  {diff.summary.breaking} breaking, {diff.summary.safe} safe
                </span>
              </div>
            </div>

            <h3>Changelog</h3>
            <div className="card markdown">
              <ReactMarkdown>{diff.changelog.text}</ReactMarkdown>
            </div>
            {diff.changelog.source === 'template' && (
              <p className="muted small">
                This summary was generated from a template because the AI writer was not available.{' '}
                <button className="btn secondary" onClick={regenerate} disabled={regenerating}>
                  {regenerating ? 'Trying again...' : 'Try AI again'}
                </button>
              </p>
            )}

            <h3>All changes</h3>
            {changes.length === 0 ? (
              <p className="muted">No API changes in this commit.</p>
            ) : (
              <div className="table-wrap">
                <table className="changes">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Endpoint</th>
                      <th>Where</th>
                      <th>What changed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`badge ${c.severity === 'breaking' ? 'badge-breaking' : 'badge-safe'}`}>
                            {c.severity}
                          </span>
                        </td>
                        <td>
                          <code>{c.endpoint}</code>
                        </td>
                        <td>{c.location}</td>
                        <td>{c.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}