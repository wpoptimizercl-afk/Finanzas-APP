import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { BANKS, MONTH_NAMES } from '../lib/constants';

const STATUS = { idle: 'idle', drag: 'drag', queue: 'queue', done: 'done' };

export default function UploadPage({ months, catRules, allCats, onSaveMonth, onGoManual }) {
    const [status, setStatus] = useState(STATUS.idle);
    const [bank, setBank] = useState('santander_tc');
    const [queue, setQueue] = useState([]);
    const [overridePeriod, setOverride] = useState(null);
    const inputRef = useRef();
    const abortMap = useRef({});

    const processFiles = useCallback(async (files) => {
        const items = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (!items.length) return;
        const initial = items.map(f => ({ id: f.name + Date.now(), file: f, status: 'pending', msg: '' }));
        setQueue(initial);
        setStatus(STATUS.queue);

        for (const item of initial) {
            const ctrl = new AbortController();
            abortMap.current[item.id] = ctrl;
            setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'processing', msg: 'Procesando con IA…' } : x));

            try {
                const b64 = await toBase64(item.file);
                const res = await fetch('/api/process-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pdfBase64: b64, bank }),
                    signal: ctrl.signal,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                const parsed = typeof data === 'string' ? JSON.parse(data) : data;

                // Apply catRules to transactions
                const txs = (parsed.transacciones || []).map(t => {
                    const key = (t.descripcion || '').toLowerCase().trim();
                    return catRules[key] ? { ...t, categoria: catRules[key] } : t;
                });

                // Recalculate categorias from transactions
                const cats = {};
                let totalCargos = 0;
                txs.filter(t => t.tipo === 'cargo').forEach(t => { 
                    cats[t.categoria] = (cats[t.categoria] || 0) + t.monto; 
                    totalCargos += t.monto;
                });
                const monthData = { ...parsed, transacciones: txs, categorias: cats, total_cargos: totalCargos };

                // Check for existing period
                const existing = months.find(m => m.periodo === parsed.periodo);
                const saveKey = overridePeriod || parsed.periodo;
                await onSaveMonth({ ...monthData, periodo: saveKey });
                setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'done', msg: existing && !overridePeriod ? 'Actualizado ✓' : 'Guardado ✓', result: monthData } : x));
            } catch (e) {
                if (e.name === 'AbortError') {
                    setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'cancelled', msg: 'Cancelado' } : x));
                } else {
                    setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', msg: e.message || 'Error procesando PDF' } : x));
                }
            }
            delete abortMap.current[item.id];
        }
    }, [bank, catRules, months, onSaveMonth, overridePeriod]);

    const toBase64 = (file) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });

    const handleDrop = e => {
        e.preventDefault(); setStatus(STATUS.idle);
        processFiles(e.dataTransfer.files);
    };

    const hasDone = queue.some(q => q.status === 'done');
    const hasErrors = queue.some(q => q.status === 'error');

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Subir estado de cuenta</div>
                    <div className="page-subtitle">Procesamos el PDF automáticamente con IA</div>
                </div>
            </div>

            {/* Bank selector */}
            <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Banco y producto</label>
                <select value={bank} onChange={e => setBank(e.target.value)} className="input">
                    {BANKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
            </div>

            {/* Manual period override */}
            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Período (opcional, si quieres forzar uno)</label>
                <select value={overridePeriod || ''} onChange={e => setOverride(e.target.value || null)} className="input">
                    <option value="">Detectar automáticamente</option>
                    {[2024, 2025, 2026].flatMap(y => MONTH_NAMES.map(m => `${m} ${y}`)).map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>

            {/* Drop zone */}
            <div
                className={`dropzone${status === STATUS.drag ? ' drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setStatus(STATUS.drag); }}
                onDragLeave={() => setStatus(STATUS.idle)}
                onDrop={handleDrop}
                onClick={() => status !== STATUS.queue && inputRef.current?.click()}
            >
                <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
                <Upload size={32} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                    {status === STATUS.drag ? 'Suelta los archivos aquí' : 'Arrastra o selecciona PDF(s)'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Puedes subir varios meses de una vez
                </div>
            </div>

            {/* Queue */}
            {queue.length > 0 && (
                <div className="card" style={{ padding: 0, marginTop: '1.5rem', overflow: 'hidden' }}>
                    {queue.map((item) => {
                        const isDone = item.status === 'done';
                        const isErr = item.status === 'error';
                        const isPending = item.status === 'pending';
                        const isProc = item.status === 'processing';
                        return (
                            <div key={item.id} className={`queue-item${isProc ? ' active' : ''}`}>
                                <div className={`queue-status-dot`} style={{
                                    background: isDone ? 'var(--success-light)' : isErr ? 'var(--danger-light)' : isProc ? 'var(--primary-light)' : 'var(--bg-hover)',
                                }}>
                                    {isProc ? <span className="queue-spinner" /> : isDone ? <CheckCircle size={16} color="var(--success)" /> : isErr ? <AlertCircle size={16} color="var(--danger)" /> : <FileText size={16} color="var(--text-tertiary)" />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
                                    <div style={{ fontSize: 11, color: isDone ? 'var(--success)' : isErr ? 'var(--danger)' : 'var(--text-tertiary)', marginTop: 2 }}>{item.msg}</div>
                                </div>
                                {isProc && abortMap.current[item.id] && (
                                    <button onClick={() => abortMap.current[item.id]?.abort()} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {(hasDone || hasErrors) && (
                <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
                    <button onClick={() => { setQueue([]); setStatus(STATUS.idle); }} className="btn btn-ghost" style={{ flex: 1 }}>
                        Subir más archivos
                    </button>
                </div>
            )}

            {/* Manual entry shortcut */}
            <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>¿No tienes el PDF o prefieres ingresar manualmente?</div>
                <button onClick={onGoManual} className="btn btn-ghost">✏️ Entrada manual</button>
            </div>
        </div>
    );
}
