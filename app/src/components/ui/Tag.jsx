export default function Tag({ label, color, bg, onClick, open, variant }) {
    const variantClass = variant && variant !== 'default' ? ` tag-${variant}` : '';
    const hasLegacy = color !== undefined || bg !== undefined;
    const style = hasLegacy
        ? { background: bg, color, border: open ? `1.5px solid ${color}` : '1px solid var(--rule-2)' }
        : undefined;
    return (
        <span
            onClick={onClick}
            className={`tag${variantClass}${onClick ? ' tag-clickable' : ''}`}
            style={style}
        >
            {label}
            {onClick && <span style={{ fontSize: '8px', opacity: .7 }}>▾</span>}
        </span>
    );
}
