import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function CategoryPicker({ current, allCats, onSelect, onClose, anchorRef }) {
    const dropRef = useRef(null);
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        if (!anchorRef?.current) return;
        const r = anchorRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const right = window.innerWidth - r.right;
        setPos(
            vh - r.bottom > 220
                ? { top: r.bottom + 6, right }
                : { bottom: vh - r.top + 6, right }
        );
    }, []);

    useEffect(() => {
        const h = e => {
            if (!anchorRef?.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose, anchorRef]);

    return createPortal(
        <div
            ref={dropRef}
            onClick={e => e.stopPropagation()}
            className="dropdown"
            style={{ minWidth: 210, position: 'fixed', ...(pos ?? { top: -9999, right: 0 }) }}
        >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px 8px' }}>
                Categoría
            </div>
            {Object.entries(allCats).map(([k, v]) => (
                <button
                    key={k}
                    className={`dropdown-item${k === current ? ' active' : ''}`}
                    onClick={() => { onSelect(k); onClose(); }}
                    style={k === current ? { background: v.bg, color: v.color } : {}}
                >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0, display: 'inline-block' }} />
                    {v.label}
                    {k === current && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 4, paddingTop: 4 }}>
                <button className="dropdown-item" onClick={onClose} style={{ color: 'var(--text-tertiary)', justifyContent: 'center', fontSize: 11 }}>
                    Cancelar
                </button>
            </div>
        </div>,
        document.body
    );
}

export function ClickableTag({ label, color, bg, categoria, txId, periodo, onRecategorize, allCats }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
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
                    anchorRef={ref}
                />
            )}
        </div>
    );
}
