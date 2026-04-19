export default function CategoryRow({ color, label, amount, delta, formatCLP }) {
  const deltaClass = delta == null ? '' : delta > 0 ? 'up' : delta < 0 ? 'dn' : '';
  const arrow = delta == null ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
  const deltaText = delta == null || delta === 0 ? '=' : `${arrow}${Math.abs(delta)}%`;
  return (
    <div className="ph-cat">
      <span className="sq" style={{ background: color }} />
      <span className="nm">
        {label} <span className={`d ${deltaClass}`}>{deltaText}</span>
      </span>
      <span className="amt">{formatCLP(amount)}</span>
    </div>
  );
}
