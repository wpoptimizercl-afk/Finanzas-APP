export default function Metric({ label, value, color, note, highlight }) {
    return (
        <div className={`metric-card${highlight ? ' metric-highlight' : ''}`}>
            <div className="metric-label">{label}</div>
            <div className="metric-value" style={{ color: highlight ? 'var(--olive-ink)' : (color || 'var(--text-primary)') }}>{value}</div>
            {note && <div className="metric-note">{note}</div>}
        </div>
    );
}
