import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RepoDiffs from "./pages/RepoDiffs";
import DiffDetail from "./pages/DiffDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repos/:id/diffs"
        element={
          <ProtectedRoute>
            <RepoDiffs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repos/:id/diffs/:diffId"
        element={
          <ProtectedRoute>
            <DiffDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
