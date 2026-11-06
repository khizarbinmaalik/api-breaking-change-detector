import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>API Guard</h1>
      {user ? (
        <>
          <p>
            Logged in as <strong>{user.username}</strong>
          </p>
          <button onClick={logout}>Log out</button>
        </>
      ) : (
        <>
          <p>Not logged in</p>
          <a href="/api/auth/github">Continue with GitHub</a>
        </>
      )}
    </div>
  );
}
