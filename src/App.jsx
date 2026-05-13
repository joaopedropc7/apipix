import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import TransactionNew from './pages/TransactionNew';
import TransactionDetail from './pages/TransactionDetail';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Docs from './pages/Docs';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner-border text-primary" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="transactions/new" element={<TransactionNew />} />
            <Route path="transactions/:id" element={<TransactionDetail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="docs" element={<Docs />} />
            <Route path="logs" element={<Logs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
