import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard', group: 'MENU' },
  { to: '/transactions', icon: 'bi-arrow-left-right', label: 'Transações' },
  { to: '/settings', icon: 'bi-gear', label: 'Configurações', group: 'SISTEMA' },
  { to: '/docs', icon: 'bi-book', label: 'Documentação' },
  { to: '/logs', icon: 'bi-terminal', label: 'Logs' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div>
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="logo-mark"><i className="bi bi-qr-code-scan" /></div>
          <div>
            <span className="logo-title">PIX Admin</span>
            <span className="logo-sub">SuitPay Integration</span>
          </div>
        </div>

        <div className="sidebar-nav">
          {links.map(({ to, icon, label, group }) => (
            <div key={to}>
              {group && <div className="nav-label mt-2">{group}</div>}
              <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <i className={`bi ${icon}`} /><span>{label}</span>
              </NavLink>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-avatar"><i className="bi bi-person-fill" /></div>
          <div>
            <div className="user-name">{user?.username}</div>
            <div className="user-role">Administrador</div>
          </div>
          <button className="btn-logout" onClick={logout} title="Sair">
            <i className="bi bi-box-arrow-right" />
          </button>
        </div>
      </nav>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
