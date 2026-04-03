import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import CurrencyInput from './ui/CurrencyInput';

const EXCLUDED_CATS = ['traspaso_tc', 'transferencia_recibida'];

export default function QuickExpenseModal({ accounts, allCats, onSave, onClose }) {
    const [monto, setMonto] = useState('');
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [categoria, setCategoria] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loading, setLoading] = useState(false);

    const filteredCats = Object.entries(allCats).filter(([k]) => !EXCLUDED_CATS.includes(k));

    useEffect(() => {
        if (filteredCats.length && !categoria) setCategoria(filteredCats[0][0]);
    }, []);

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleSave = async () => {
        if (!monto || Number(monto) <= 0 || !accountId) return;
        setLoading(true);
        try {
            await onSave({ monto: Number(monto), account_id: accountId, categoria, descripcion });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Zap size={18} color="var(--primary)" />
                    <span className="modal-title" style={{ margin: 0 }}>Gasto rápido</span>
                </div>

                <div style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: 'var(--warning-light)', color: 'var(--warning)',
                    border: '1px solid var(--warning-border)',
                    marginBottom: 16, display: 'inline-block',
                }}>
                    temporal — Se reemplaza al subir el estado de cuenta
                </div>

                {/* Monto */}
                <div className="input" style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <CurrencyInput large value={monto} onChange={setMonto} onSave={handleSave} />
                </div>

                {/* Medio de pago */}
                <select
                    className="input"
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    style={{ width: '100%', marginBottom: 10 }}
                >
                    {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} · {a.type}</option>
                    ))}
                </select>

                {/* Categoría */}
                <select
                    className="input"
                    value={categoria}
                    onChange={e => setCategoria(e.target.value)}
                    style={{ width: '100%', marginBottom: 10 }}
                >
                    {filteredCats.map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>

                {/* Descripción */}
                <input
                    className="input"
                    type="text"
                    placeholder="Descripción (ej: Almuerzo)"
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    style={{ width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
                />

                <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={handleSave}
                    disabled={loading || !monto || Number(monto) <= 0 || !accountId}
                >
                    {loading ? 'Guardando…' : 'Registrar gasto'}
                </button>
            </div>
        </div>
    );
}
