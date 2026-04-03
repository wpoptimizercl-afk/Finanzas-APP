import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Selector de período del dashboard.
 * value: 'last' | 'avg-N' | '<periodo-string>'
 */
export default function MonthSelector({ value, onChange, windowOptions, periods, latestPeriod }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const isHistorical = value !== 'last' && !value.startsWith('avg-') && value !== latestPeriod;

    const buttonLabel = (() => {
        if (value === 'last') return windowOptions[0]?.label || 'Último mes';
        if (value.startsWith('avg-')) {
            const n = parseInt(value.replace('avg-', ''), 10);
            return windowOptions.find(o => o.value === n)?.label || `Prom. ${n} meses`;
        }
        return value;
    })();

    const selectOption = (val) => { onChange(val); setOpen(false); };

    return (
        <div className="month-sel" ref={ref}>
            <button
                className={`month-sel-btn${isHistorical ? ' month-sel-btn--hist' : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Seleccionar período del dashboard"
            >
                <span className="month-sel-label">{buttonLabel}</span>
                {isHistorical && <span className="month-sel-hist-badge">Histórico</span>}
                <ChevronDown
                    size={12}
                    aria-hidden="true"
                    className={`month-sel-chevron${open ? ' month-sel-chevron--open' : ''}`}
                />
            </button>

            {open && (
                <div className="month-sel-dropdown" role="listbox" aria-label="Opciones de período">
                    <div className="month-sel-section">Vista</div>
                    {windowOptions.map(opt => {
                        const val = opt.value === 1 ? 'last' : `avg-${opt.value}`;
                        const active = value === val;
                        return (
                            <button
                                key={opt.value}
                                role="option"
                                aria-selected={active}
                                className={`month-sel-opt${active ? ' month-sel-opt--active' : ''}`}
                                onClick={() => selectOption(val)}
                            >
                                {opt.label}
                            </button>
                        );
                    })}

                    {periods.length > 0 && (
                        <>
                            <div className="month-sel-divider" />
                            <div className="month-sel-section">Mes específico</div>
                            {[...periods].reverse().map(p => {
                                const active = value === p;
                                return (
                                    <button
                                        key={p}
                                        role="option"
                                        aria-selected={active}
                                        className={`month-sel-opt${active ? ' month-sel-opt--active' : ''}`}
                                        onClick={() => selectOption(p)}
                                    >
                                        <span>{p}</span>
                                        {p === latestPeriod && (
                                            <span className="month-sel-tag-latest">actual</span>
                                        )}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
