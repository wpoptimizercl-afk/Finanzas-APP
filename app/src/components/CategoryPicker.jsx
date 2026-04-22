import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function CategoryPicker({ current, allCats, onSelect, onClose }) {
    useEffect(() => {
        const h = e => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);

    return createPortal(
        <div className="bottom-sheet-backdrop" onClick={onClose}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="bottom-sheet-handle" />
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 20px 8px' }}>
                    Cambiar categoría
                </div>
                {Object.entries(allCats).map(([k, v]) => (
                    <button
                        key={k}
                        className={`bottom-sheet-item${k === current ? ' active' : ''}`}
                        onClick={() => { onSelect(k); onClose(); }}
                        style={k === current ? { background: v.bg, color: v.color } : {}}
                    >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                        {v.label}
                        {k === current && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                    </button>
                ))}
                <div style={{ padding: '12px 16px 8px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '13px',
                            border: '1px solid var(--rule)',
                            background: 'transparent',
                            borderRadius: 'var(--radius-lg)',
                            color: 'var(--text-secondary)',
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export function ClickableTag({ label, color, bg, categoria, txId, periodo, onRecategorize, allCats }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ position: 'relative' }}>
            <span
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                className="tag tag-clickable"
                style={{
                    background: bg, color,
                    border: open ? `1.5px solid ${color}` : '1.5px solid transparent',
                }}
            >
                {label}
                <span style={{ fontSize: '8px', opacity: .7 }}>▾</span>
            </span>
            {open && (
                <CategoryPicker
                    current={categoria}
                    allCats={allCats}
                    onSelect={cat => onRecategorize(periodo, txId, cat)}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}
