import { CLP } from '../../utils/formatters';

export default function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            {label && <div className="chart-tooltip-title">{label}</div>}
            {payload.map((p, i) => (
                <div key={i} className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: p.color }} />
                    <span>{p.name}:</span>
                    <span className="chart-tooltip-val">{CLP(p.value)}</span>
                </div>
            ))}
        </div>
    );
}
