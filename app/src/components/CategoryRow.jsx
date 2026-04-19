export default function CategoryRow({ color, label, amount, delta, formatCLP }) {
  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'dn' : '';
  const deltaText = delta == null ? null : delta === 0 ? '=' : `${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}%`;
  return (
    <div className="ph-cat">
      <span className="sq" style={{ background: color }} />
      <span className="nm">
        {label}{deltaText != null && <span className={`d ${deltaClass}`}>{deltaText}</span>}
      </span>
      <span className="amt">{formatCLP(amount)}</span>
    </div>
  );
}
