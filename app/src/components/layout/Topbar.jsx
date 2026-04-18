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
                <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, letterSpacing: '.08em', fontSize: 13, textTransform: 'uppercase' }}>
                    <div style={{ width: 14, height: 14, background: 'var(--olive)', borderRadius: '50%', display: 'inline-block', position: 'relative', boxShadow: 'inset 2px -2px 0 rgba(0,0,0,.18)' }}>
                        <div style={{ position: 'absolute', top: 3, left: 4, width: 3, height: 3, background: 'rgba(255,255,255,.35)', borderRadius: '50%' }} />
                    </div>
                    <span>{LABELS[view] || 'App6tuna'}</span>
                </div>
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
