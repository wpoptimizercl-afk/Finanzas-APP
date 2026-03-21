export default function Metric({ label, value, color, note }) {
    return (
        <div className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
            {note && <div className="metric-note">{note}</div>}
        </div>
    );
}
