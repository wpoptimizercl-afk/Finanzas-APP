export default function Tag({ label, color, bg, onClick, open }) {
    return (
        <span
            onClick={onClick}
            className={`tag${onClick ? ' tag-clickable' : ''}`}
            style={{
                background: bg,
                color,
                border: open ? `1.5px solid ${color}` : '1px solid var(--rule-2)',
            }}
        >
            {label}
            {onClick && <span style={{ fontSize: '8px', opacity: .7 }}>▾</span>}
        </span>
    );
}
