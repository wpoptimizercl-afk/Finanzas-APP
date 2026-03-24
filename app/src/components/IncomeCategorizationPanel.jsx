import { useState, useEffect } from 'react';
import { INCOME_CATS_BUILTIN, INCOME_CAT_COLORS } from '../lib/constants';
import { CLP } from '../utils/formatters';

export default function IncomeCategorizationPanel({ items, periodo, incomeCategories, onSaveItems, onSaveCategory, onDismiss }) {
    const allCats = [...INCOME_CATS_BUILTIN, ...(incomeCategories || [])];

    const [selected, setSelected] = useState(() => new Set(items.map(i => i.id)));
    const [cats, setCats] = useState({});
    const [showNewCat, setShowNewCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [colorIdx, setColorIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [savingCat, setSavingCat] = useState(false);

    // Asignar default: mayor monto → Sueldo, resto → Otros
    useEffect(() => {
        const maxId = [...items].sort((a, b) => b.monto - a.monto)[0]?.id;
        const defaults = {};
        items.forEach(i => { defaults[i.id] = i.id === maxId ? 'sueldo' : 'otros'; });
        setCats(defaults);
    }, []);

    const toggleItem = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const setCat = (itemId, catId) => setCats(prev => ({ ...prev, [itemId]: catId }));

    const total = items
        .filter(i => selected.has(i.id))
        .reduce((s, i) => s + i.monto, 0);

    const handleSave = async () => {
        const toSave = items
            .filter(i => selected.has(i.id))
            .map(i => ({ name: i.descripcion, amount: i.monto, categoria_ingreso: cats[i.id] || 'otros' }));
        if (!toSave.length) { onDismiss(); return; }
        setSaving(true);
        try { await onSaveItems(periodo, toSave); }
        finally { setSaving(false); }
    };

    const handleCreateCat = async () => {
        const nombre = newCatName.trim();
        if (!nombre) return;
        setSavingCat(true);
        try {
            await onSaveCategory({ nombre, color: INCOME_CAT_COLORS[colorIdx] });
            setNewCatName('');
            setShowNewCat(false);
        } finally { setSavingCat(false); }
    };

    return (
        <div className="card" style={{ marginTop: '1.25rem', border: '1px solid var(--success-border, #059669)', padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', background: 'var(--success-light, rgba(5,150,105,0.08))', borderBottom: '1px solid var(--success-border, #059669)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success, #059669)' }}>
                    Ingresos detectados — {periodo}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {items.length} transferencias recibidas · Selecciona y categoriza antes de guardar
                </div>
            </div>

            {/* Items */}
            <div style={{ padding: '8px 0' }}>
                {items.map((item, idx) => {
                    const isSelected = selected.has(item.id);
                    const activeCat = cats[item.id] || 'otros';
                    return (
                        <div
                            key={item.id}
                            style={{
                                padding: '10px 16px',
                                borderBottom: idx < items.length - 1 ? '1px solid var(--border-light)' : 'none',
                                opacity: isSelected ? 1 : 0.45,
                                transition: 'opacity 0.15s',
                            }}
                        >
                            {/* Row: checkbox + descripcion + monto */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <button
                                    onClick={() => toggleItem(item.id)}
                                    style={{
                                        width: 20, height: 20, minWidth: 20, borderRadius: 4,
                                        border: isSelected ? '2px solid var(--success, #059669)' : '2px solid var(--border)',
                                        background: isSelected ? 'var(--success, #059669)' : 'transparent',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                    aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                                >
                                    {isSelected && (
                                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                            <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </button>
                                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.descripcion}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success, #059669)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                    {CLP(item.monto)}
                                </span>
                            </div>

                            {/* Category chips */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 30 }}>
                                {allCats.map(cat => {
                                    const isActive = activeCat === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => isSelected && setCat(item.id, cat.id)}
                                            disabled={!isSelected}
                                            style={{
                                                fontSize: 11, fontWeight: isActive ? 600 : 400,
                                                padding: '3px 10px', borderRadius: 20,
                                                border: `1.5px solid ${isActive ? cat.color : 'var(--border)'}`,
                                                background: isActive ? cat.color + '22' : 'transparent',
                                                color: isActive ? cat.color : 'var(--text-secondary)',
                                                cursor: isSelected ? 'pointer' : 'default',
                                                transition: 'all 0.12s',
                                                minHeight: 28,
                                            }}
                                        >
                                            {cat.nombre}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Nueva categoría */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-light)' }}>
                {!showNewCat ? (
                    <button
                        onClick={() => setShowNewCat(true)}
                        style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                    >
                        + Nueva categoría
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateCat()}
                            placeholder="Nombre de categoría..."
                            style={{
                                flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 6,
                                border: '1px solid var(--border)', background: 'var(--surface-raised)',
                                color: 'var(--text-primary)',
                            }}
                            autoFocus
                        />
                        {/* Color cycler */}
                        <button
                            onClick={() => setColorIdx(i => (i + 1) % INCOME_CAT_COLORS.length)}
                            style={{
                                width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)',
                                background: INCOME_CAT_COLORS[colorIdx], cursor: 'pointer', flexShrink: 0,
                            }}
                            title="Cambiar color"
                        />
                        <button
                            onClick={handleCreateCat}
                            disabled={savingCat || !newCatName.trim()}
                            className="btn btn-primary btn-sm"
                            style={{ flexShrink: 0 }}
                        >
                            {savingCat ? '...' : 'Crear'}
                        </button>
                        <button onClick={() => { setShowNewCat(false); setNewCatName(''); }} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>✕</button>
                    </div>
                )}
            </div>

            {/* Footer: total + CTAs */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'var(--surface-raised, var(--surface))', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total seleccionado</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--success, #059669)', fontVariantNumeric: 'tabular-nums' }}>
                        {CLP(total)}
                    </div>
                </div>
                <button onClick={onDismiss} className="btn btn-ghost btn-sm">Ignorar</button>
                <button
                    onClick={handleSave}
                    disabled={saving || selected.size === 0}
                    className="btn btn-primary btn-sm"
                >
                    {saving ? 'Guardando...' : `Registrar ${selected.size > 0 ? `(${selected.size})` : ''}`}
                </button>
            </div>
        </div>
    );
}
