import { BarChart2, Home, FileText, Target, Clock, Settings } from 'lucide-react';

const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart2 },
    { id: 'home', label: 'Resumen', Icon: Home },
    { id: 'history', label: 'Historial', Icon: Clock },
    { id: 'fixed', label: 'Registros', Icon: FileText },
    { id: 'budget', label: 'Presupuesto', Icon: Target },
    { id: 'config', label: 'Config', Icon: Settings },
];

export default function BottomNav({ view, onNav }) {
    return (
        <nav className="bottom-nav">
            {NAV.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    className={`bottom-nav-item${view === id ? ' active' : ''}`}
                    onClick={() => onNav(id)}
                >
                    <Icon size={20} strokeWidth={view === id ? 2.5 : 2} />
                    <span className="bottom-nav-label">{label}</span>
                    <span className="bottom-nav-dot" />
                </button>
            ))}
        </nav>
    );
}
