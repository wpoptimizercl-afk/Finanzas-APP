export default function Tag({ label, color, bg, onClick, open, variant, style: extraStyle }) {
    const variantClass = variant && variant !== 'default' ? ` tag-${variant}` : '';
    const hasLegacy = color !== undefined || bg !== undefined;
    const baseStyle = hasLegacy
        ? { background: bg, color, border: open ? `1.5px solid ${color}` : '1px solid var(--rule-2)' }
        : undefined;
    const style = (baseStyle || extraStyle) ? { ...baseStyle, ...extraStyle } : undefined;
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
