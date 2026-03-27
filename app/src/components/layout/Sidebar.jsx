import { BarChart2, Home, FileText, Target, Clock, Settings, LogOut, Moon, Sun, DollarSign } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart2 },
    { id: 'home', label: 'Resumen', Icon: Home },
    { id: 'history', label: 'Historial', Icon: Clock },
    { id: 'fixed', label: 'Registros', Icon: FileText },
    { id: 'budget', label: 'Presupuesto', Icon: Target },
    { id: 'config', label: 'Configuración', Icon: Settings },
];

export default function Sidebar({ view, onNav }) {
    const { user, signOut } = useAuth();
    const { theme, toggle } = useTheme();
    const avatar = user?.user_metadata?.avatar_url;
    const name = user?.user_metadata?.full_name || user?.email || '';

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <DollarSign size={18} color="#fff" />
                </div>
                <span className="sidebar-logo-text">Mis Finanzas</span>
            </div>

            <div className="sidebar-section">Principal</div>

            {NAV.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    className={`sidebar-nav-item${view === id ? ' active' : ''}`}
                    onClick={() => onNav(id)}
                >
                    <Icon size={17} />
                    {label}
                </button>
            ))}

            <div className="sidebar-footer">
                <button className="sidebar-nav-item" onClick={toggle} style={{ marginBottom: 4 }}>
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                </button>
                <button className="sidebar-nav-item" onClick={signOut} style={{ color: 'var(--danger)' }}>
                    <LogOut size={16} />
                    Cerrar sesión
                </button>
                <div className="sidebar-user" style={{ marginTop: 8 }}>
                    <div className="sidebar-avatar">
                        {avatar
                            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{name[0]?.toUpperCase()}</span>
                        }
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div className="sidebar-user-name">{name.split(' ')[0]}</div>
                        <div className="sidebar-user-email">{user?.email}</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
