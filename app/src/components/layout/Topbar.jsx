import { Moon, Sun, DollarSign, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const LABELS = {
    dashboard: 'Dashboard', home: 'Resumen', fixed: 'Registros',
    budget: 'Presupuesto', history: 'Historial', config: 'Configuración',
};

export default function Topbar({ view }) {
    const { theme, toggle } = useTheme();
    const { signOut } = useAuth();

    return (
        <header className="topbar">
            <div className="topbar-logo">
                <div className="topbar-logo-icon">
                    <DollarSign size={16} color="#163300" />
                </div>
                <span className="topbar-title">{LABELS[view] || 'Mis Finanzas'}</span>
            </div>
            <div className="topbar-actions">
                <button className="btn-icon" onClick={toggle} aria-label="Toggle theme">
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <button className="btn-icon" onClick={signOut} aria-label="Sign out" style={{ color: 'var(--danger)' }}>
                    <LogOut size={16} />
                </button>
            </div>
        </header>
    );
}
