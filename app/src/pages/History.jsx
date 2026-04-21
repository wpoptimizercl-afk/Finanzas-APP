import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSm, Search, Trash2, SlidersHorizontal, X, Tag, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { CategoryPicker } from '../components/CategoryPicker';
import { CLP } from '../utils/formatters';

function RecategorizeButton({ categoria, txId, txDesc, periodo, onRecategorize, allCats }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                aria-label="Recategorizar transacción"
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    margin: '-6px -4px',
                    padding: 6,
                    border: 'none',
                    background: open ? 'var(--primary-light)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    color: open ? 'var(--primary)' : 'var(--text-tertiary)',
                    transition: 'background 150ms, color 150ms',
                    touchAction: 'manipulation',
                }}
            >
                <Tag size={12} strokeWidth={2} />
            </button>
            {open && (
                <CategoryPicker
                    current={categoria}
                    allCats={allCats}
                    onSelect={cat => { onRecategorize(periodo, txId, cat, txDesc); setOpen(false); }}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}

export default function HistoryPage({ allMonths, uniqueSortedPeriods, accounts, allCats, deleteMonth, recategorizeMonth, deleteTransaction }) {
    const [selIdx, setSelIdx] = useState(() => Math.max(0, uniqueSortedPeriods.length - 1));
    const [query, setQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [delModal, setDelModal] = useState(false);
    const [activeSourceId, setActiveSourceId] = useState(null); // null = todas
    const [collapsedCats, setCollapsedCats] = useState({});
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [catSort, setCatSort] = useState({ by: 'name', dir: 'asc' });

    const idx = uniqueSortedPeriods.length > 0 ? Math.min(selIdx, uniqueSortedPeriods.length - 1) : 0;
    const periodo = uniqueSortedPeriods[idx] || null;
    const sources = allMonths.filter(m => m.periodo === periodo);
    const primarySource = sources[0] || null;

    const toggleCat = (cat) => setCollapsedCats(prev => {
        const next = { ...prev };
        if (next[cat] === false) delete next[cat];
        else next[cat] = false;
        return next;
    });

    // Reset filters when changing period
    useEffect(() => {
        setDateRange({ start: '', end: '' });
        setActiveSourceId(null);
        setCollapsedCats({});
    }, [selIdx]);

    useEffect(() => {
        if (uniqueSortedPeriods.length > 0 && selIdx >= uniqueSortedPeriods.length) {
            setSelIdx(uniqueSortedPeriods.length - 1);
        }
    }, [uniqueSortedPeriods.length, selIdx]);

    const parseTxDate = (dStr) => {
        if (!dStr) return null;
        if (dStr.includes('-')) {
            const [y, m, d] = dStr.split('-').map(Number);
            if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
            return new Date(y, m - 1, d);
        }
        const [d, m, y] = dStr.split('/').map(Number);
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        return new Date(y, m - 1, d);
    };

    const formatInputDate = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('/');
        if (parts.length !== 3) return '';
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    // Rango efectivo de todas las fuentes del período (no solo primarySource)
    const effectivePeriodFrom = sources.reduce((min, s) => {
        if (!s.periodo_desde) return min;
        const d = formatInputDate(s.periodo_desde);
        return (!min || d < min) ? d : min;
    }, '');
    const effectivePeriodTo = sources.reduce((max, s) => {
        if (!s.periodo_hasta) return max;
        const d = formatInputDate(s.periodo_hasta);
        return (!max || d > max) ? d : max;
    }, '');

    // All transactions from all sources for this period, with account metadata
    const allTxs = useMemo(() => sources.flatMap(s => {
        const account = accounts.find(a => a.id === s.account_id);
        return (s.transacciones || []).map(t => ({
            ...t,
            _sourceId: s.id,
            _accountName: account?.name || (s.source_type === 'cc' ? 'Cuenta Corriente' : 'Tarjeta'),
            _accountColor: account?.color || (s.source_type === 'cc' ? 'var(--ink-3)' : 'var(--red)'),
            _isCC: s.source_type === 'cc',
        }));
    }), [sources, accounts]);

    const txsForFilter = activeSourceId ? allTxs.filter(t => t._sourceId === activeSourceId) : allTxs;

    const filtered = useMemo(() => {
        let res = txsForFilter;
        if (query.trim()) {
            const q = query.toLowerCase();
            res = res.filter(t => (t.descripcion || '').toLowerCase().includes(q) || (t.categoria || '').toLowerCase().includes(q));
        }
        if (dateRange.start) {
            const s = new Date(dateRange.start + 'T00:00:00');
            res = res.filter(t => { const d = parseTxDate(t.fecha); return d === null || d >= s; });
        }
        if (dateRange.end) {
            const e = new Date(dateRange.end + 'T23:59:59');
            res = res.filter(t => { const d = parseTxDate(t.fecha); return d === null || d <= e; });
        }
        return res;
    }, [txsForFilter, query, dateRange]);

    const hasIngresos = useMemo(() => allTxs.some(t => t.tipo === 'abono' && t.tipo !== 'traspaso_tc' && t.categoria !== 'traspaso_tc'), [allTxs]);

    const byCategory = useMemo(() => {
        const sortEntries = (m) => Object.entries(m).sort((a, b) => {
            if (catSort.by === 'value') {
                const va = a[1].reduce((s, t) => s + t.monto, 0);
                const vb = b[1].reduce((s, t) => s + t.monto, 0);
                return catSort.dir === 'asc' ? va - vb : vb - va;
            }
            const la = allCats[a[0]]?.label || a[0];
            const lb = allCats[b[0]]?.label || b[0];
            return catSort.dir === 'asc' ? la.localeCompare(lb, 'es') : lb.localeCompare(la, 'es');
        });
        const eMap = {}, iMap = {}, tMap = {}, aMap = {};
        filtered.forEach(t => {
            if (t.tipo === 'traspaso_tc' || t.categoria === 'traspaso_tc') {
                (tMap['traspaso_tc'] = tMap['traspaso_tc'] || []).push(t);
                return;
            }
            if (t.categoria === 'ahorro') {
                (aMap['ahorro'] = aMap['ahorro'] || []).push(t);
                return;
            }
            const k = t.categoria || 'otros';
            if (t.tipo === 'cargo') (eMap[k] = eMap[k] || []).push(t);
            else if (t.tipo === 'abono') (iMap[k] = iMap[k] || []).push(t);
        });
        if (!hasIngresos) return { egresos: sortEntries(eMap), ingresos: [], traspasos: sortEntries(tMap), ahorros: sortEntries(aMap) };
        return { egresos: sortEntries(eMap), ingresos: sortEntries(iMap), traspasos: sortEntries(tMap), ahorros: sortEntries(aMap) };
    }, [filtered, hasIngresos, allCats, catSort]);

    const totalEgresos = byCategory.egresos.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0);
    const totalIngresos = byCategory.ingresos.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0);

    if (!uniqueSortedPeriods.length) return (
        <div className="animate-fadeIn">
            <div className="empty-state">
                <div className="empty-state-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
                <div className="empty-state-title">Sin historial</div>
                <div className="empty-state-desc">Sube estados de cuenta para ver el historial de tus transacciones.</div>
            </div>
        </div>
    );

    return (
        <>
        <div className="animate-fadeIn">
            {/* Period nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setSelIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: idx === 0 ? 'var(--bg-input)' : 'var(--bg-card)', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: idx === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{ minWidth: 140 }}>
                        <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-.3px', fontFamily: 'var(--font-mono)' }}>{periodo}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{primarySource?.periodo_desde} — {primarySource?.periodo_hasta}</div>
                    </div>
                    <button onClick={() => setSelIdx(i => Math.min(uniqueSortedPeriods.length - 1, i + 1))} disabled={idx === uniqueSortedPeriods.length - 1}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: idx === uniqueSortedPeriods.length - 1 ? 'var(--bg-input)' : 'var(--bg-card)', cursor: idx === uniqueSortedPeriods.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: idx === uniqueSortedPeriods.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setDelModal(true)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', flexShrink: 0 }}>
                    <Trash2 size={15} />
                </button>
            </div>

            {/* Account filter chips */}
            {sources.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveSourceId(null)}
                        className={`tag${activeSourceId === null ? ' tag-ink' : ''}`}
                        style={{ cursor: 'pointer', fontWeight: activeSourceId === null ? 600 : 400 }}
                    >
                        Todas
                    </button>
                    {[...sources].sort((a, b) => {
                        const nameA = (accounts.find(ac => ac.id === a.account_id)?.name || (a.source_type === 'cc' ? 'CC' : 'TC')).toLowerCase();
                        const nameB = (accounts.find(ac => ac.id === b.account_id)?.name || (b.source_type === 'cc' ? 'CC' : 'TC')).toLowerCase();
                        return nameA.localeCompare(nameB, 'es');
                    }).map(s => {
                        const acc = accounts.find(a => a.id === s.account_id);
                        const name = acc?.name || (s.source_type === 'cc' ? 'CC' : 'TC');
                        const color = acc?.color || (s.source_type === 'cc' ? 'var(--ink-3)' : 'var(--red)');
                        const isActive = activeSourceId === s.id;
                        const variantClass = isActive ? ` tag-${s.source_type === 'cc' ? 'olive' : 'red'}` : '';
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveSourceId(isActive ? null : s.id)}
                                className={`tag${variantClass}`}
                                style={{ cursor: 'pointer', fontWeight: isActive ? 600 : 400 }}
                            >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                {name}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Filters bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: showDateFilter ? '0.5rem' : '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input
                        placeholder="Buscar transacciones…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="input"
                        style={{ paddingLeft: 34 }}
                    />
                </div>
                <button
                    onClick={() => setShowDateFilter(v => !v)}
                    className="btn-icon btn-sm"
                    style={{
                        borderColor: (showDateFilter || dateRange.start || dateRange.end) ? 'var(--primary)' : undefined,
                        color: (showDateFilter || dateRange.start || dateRange.end) ? 'var(--primary)' : undefined,
                        background: (dateRange.start || dateRange.end) ? 'var(--primary-light)' : undefined,
                    }}
                    title="Filtrar por fecha"
                >
                    <SlidersHorizontal size={15} />
                </button>
            </div>

            {showDateFilter && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: '1rem', padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 2, flexShrink: 0 }}>Desde</span>
                    <input type="date" value={dateRange.start}
                        min={effectivePeriodFrom}
                        max={effectivePeriodTo}
                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="input" style={{ flex: 1, fontSize: 12, padding: '7px 10px' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>hasta</span>
                    <input type="date" value={dateRange.end}
                        min={effectivePeriodFrom}
                        max={effectivePeriodTo}
                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="input" style={{ flex: 1, fontSize: 12, padding: '7px 10px' }} />
                    {(dateRange.start || dateRange.end) && (
                        <button onClick={() => setDateRange({ start: '', end: '' })} className="btn-icon btn-sm" title="Limpiar">
                            <X size={13} />
                        </button>
                    )}
                </div>
            )}

            {/* Summary grid */}
            <div style={{ marginBottom: '1.25rem' }}>
                {(() => {
                    const hasTraspasos = byCategory.traspasos?.length > 0;
                    const hasAhorros = byCategory.ahorros?.length > 0;
                    const stats = [
                        { label: 'Egresos', value: CLP(totalEgresos), sub: `${byCategory.egresos.reduce((s, [, l]) => s + l.length, 0)} mov.`, color: 'var(--danger)' },
                        { label: 'Ingresos', value: CLP(totalIngresos), sub: `${byCategory.ingresos.reduce((s, [, l]) => s + l.length, 0)} mov.`, color: 'var(--success)' },
                        ...(hasTraspasos ? [{ label: 'Pagos TC', value: CLP(byCategory.traspasos.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0)), sub: `${byCategory.traspasos.reduce((s, [, l]) => s + l.length, 0)} mov.`, color: 'var(--text-secondary)' }] : []),
                        ...(hasAhorros ? [{ label: 'Ahorro', value: CLP(byCategory.ahorros.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0)), sub: `${byCategory.ahorros.reduce((s, [, l]) => s + l.length, 0)} mov.`, color: 'var(--success)' }] : []),
                    ];
                    const cols = stats.length === 4 ? 4 : stats.length === 3 ? 3 : 2;
                    return (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1px', background: 'var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                            {stats.map(s => (
                                <div key={s.label} style={{ background: 'var(--bg-card)', padding: '8px 10px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: .7 }}>{s.sub}</div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
                {query && (
                    <div style={{ marginTop: 6 }}>
                        <button onClick={() => setQuery('')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <X size={11} />{query}
                        </button>
                    </div>
                )}
            </div>

            {/* Category sort controls */}
            {(byCategory.egresos.length > 0 || byCategory.ingresos.length > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>Categorías</span>
                    {[{ key: 'name', label: 'Nombre' }, { key: 'value', label: 'Valor' }].map(({ key, label }) => {
                        const isActive = catSort.by === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setCatSort(prev => prev.by === key ? { by: key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by: key, dir: 'asc' })}
                                aria-label={`Ordenar por ${label}${isActive ? (catSort.dir === 'asc' ? ', ascendente' : ', descendente') : ''}`}
                                className={`tag${isActive ? ' tag-ink' : ''}`}
                                style={{ cursor: 'pointer', fontWeight: isActive ? 600 : 400 }}
                            >
                                {label}
                                {isActive
                                    ? (catSort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
                                    : <ArrowUpDown size={10} style={{ opacity: 0.35 }} />
                                }
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Transaction groups */}
            {(() => {
                const renderGroup = (entries) => entries.map(([cat, txList]) => {
                    const catObj = allCats[cat] || { label: cat, color: '#888', bg: '#F3F4F6' };
                    const catTotal = txList.reduce((s, t) => s + t.monto, 0);
                    const isCollapsed = collapsedCats[cat] !== false;
                    const label = catObj.label.charAt(0).toUpperCase() + catObj.label.slice(1).toLowerCase();
                    return (
                        <div key={cat} style={{ marginBottom: '0.75rem' }}>
                            <div onClick={() => toggleCat(cat)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', cursor: 'pointer', userSelect: 'none', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: catObj.color, display: 'block', flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{CLP(catTotal)}</span>
                                    {isCollapsed
                                        ? <ChevronRightSm size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                        : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                    }
                                </div>
                            </div>
                            {!isCollapsed && (
                                <div className="card" style={{ padding: 0, overflow: 'visible', marginTop: 2 }}>
                                    {txList.slice().sort((a, b) => {
                                        const da = parseTxDate(a.fecha);
                                        const db = parseTxDate(b.fecha);
                                        if (!da && !db) return 0;
                                        if (!da) return 1;
                                        if (!db) return -1;
                                        return da - db;
                                    }).map((t) => (
                                        <div key={t.id} className="tx-row">
                                            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                                                <div className="tx-desc">{t.descripcion}</div>
                                                <div className="tx-date" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                                    <span>{t.fecha}</span>
                                                    {t.is_temporary && (
                                                        <span style={{
                                                            fontSize: 9, fontWeight: 700, padding: '1px 6px',
                                                            borderRadius: 'var(--radius-full)',
                                                            background: 'var(--warning-light)', color: 'var(--warning)',
                                                            border: '1px solid var(--warning-border)', whiteSpace: 'nowrap',
                                                        }}>temporal</span>
                                                    )}
                                                    {sources.length > 1 && (
                                                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: `${t._accountColor}18`, color: t._accountColor, fontWeight: 600, border: `1px solid ${t._accountColor}30` }}>
                                                            {t._accountName}
                                                        </span>
                                                    )}
                                                    <RecategorizeButton
                                                        categoria={t.categoria}
                                                        txId={t.id}
                                                        txDesc={t.descripcion}
                                                        periodo={periodo}
                                                        onRecategorize={recategorizeMonth}
                                                        allCats={allCats}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {t.is_temporary && deleteTransaction && (
                                                    <button
                                                        onClick={() => deleteTransaction(t.id, t.month_id)}
                                                        style={{ color: 'var(--text-tertiary)', padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                                        title="Eliminar gasto temporal"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                                <div className="tx-amount">{CLP(t.monto)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                });

                const SectionLabel = ({ label, color, mt = 0 }) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: mt }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '.04em' }}>{label}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                    </div>
                );

                if (!hasIngresos) return renderGroup(byCategory.egresos);

                return (
                    <>
                        {byCategory.egresos.length > 0 && (
                            <>
                                <SectionLabel label="Egresos" color="var(--danger)" />
                                {renderGroup(byCategory.egresos)}
                            </>
                        )}
                        {byCategory.ingresos.length > 0 && (
                            <>
                                <SectionLabel label="Ingresos del período" color="var(--success)" mt={byCategory.egresos.length > 0 ? 8 : 0} />
                                {renderGroup(byCategory.ingresos)}
                            </>
                        )}
                        {byCategory.traspasos?.length > 0 && (
                            <>
                                <SectionLabel label="Pagos tarjeta de crédito" color="var(--text-tertiary)" mt={8} />
                                {renderGroup(byCategory.traspasos)}
                            </>
                        )}
                        {byCategory.ahorros?.length > 0 && (
                            <>
                                <SectionLabel label="Ahorro / inversión" color="var(--success)" mt={8} />
                                {renderGroup(byCategory.ahorros)}
                            </>
                        )}
                    </>
                );
            })()}

            {allTxs.length > 0 && byCategory.egresos.length === 0 && byCategory.ingresos.length === 0 && !byCategory.traspasos?.length && !byCategory.ahorros?.length && query && (
                <div className="empty-state" style={{ paddingTop: '2rem' }}>
                    <div className="empty-state-title">Sin resultados</div>
                    <div className="empty-state-desc">"{query}" no coincide con ninguna transacción.</div>
                </div>
            )}
        </div>
        {delModal && (() => {
            const activeSource = sources.find(s => s.id === activeSourceId);
            const activeAcc = activeSource ? accounts.find(a => a.id === activeSource.account_id) : null;
            const activeName = activeAcc?.name || (activeSource?.source_type === 'cc' ? 'CC' : 'TC');
            const desc = activeSourceId
                ? `¿Seguro que quieres eliminar ${periodo} de "${activeName}"? Solo se borrará esa cuenta.`
                : `¿Seguro que quieres eliminar ${periodo}? Se borrará el historial de todas las cuentas de ese mes.`;
            return (
                <Modal title="Eliminar período" desc={desc}
                    confirmLabel="Eliminar"
                    onConfirm={async () => {
                        const p = periodo;
                        const mid = activeSourceId;
                        setDelModal(false);
                        if (p) await deleteMonth(p, mid);
                    }}
                    onCancel={() => setDelModal(false)} />
            );
        })()}
        </>
    );
}
