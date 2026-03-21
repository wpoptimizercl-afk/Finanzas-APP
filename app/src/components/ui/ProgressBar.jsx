export default function ProgressBar({ value, max, color }) {
    const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div className="progress-track">
            <div className="progress-bar" style={{ width: w + '%', background: color || 'var(--primary)' }} />
        </div>
    );
}
