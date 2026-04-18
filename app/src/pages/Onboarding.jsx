import { useState } from 'react';

const BANKS = ['santander', 'bci', 'chile', 'scotiabank', 'otro'];
const BANK_LABELS = { santander: 'Santander', bci: 'BCI', chile: 'Banco de Chile', scotiabank: 'Scotiabank', otro: 'Otro banco' };
const ACCOUNT_COLORS = { tc: 'var(--red)', cc: 'var(--ink-3)', savings: 'var(--olive)' };

const STEPS = ['bienvenida', 'cuenta', 'listo'];

export default function OnboardingPage({ onSaveAccount, onGoUpload }) {
    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [type, setType] = useState('tc');
    const [bank, setBank] = useState('santander');
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await onSaveAccount({
                name: name.trim(),
                type,
                bank,
                color: ACCOUNT_COLORS[type] || 'var(--ink-4)',
                icon: type === 'cc' ? 'bank' : 'card',
                active: true,
            });
            setStep(2);
        } finally {
            setSaving(false);
        }
    };

    if (step === 0) return (
        <div className="animate-fadeIn" style={{ maxWidth: 420, margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>👋</div>
            <div className="page-title" style={{ marginBottom: 12 }}>Bienvenido a Finanzas App</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                Controla tus gastos subiendo los estados de cuenta de tus tarjetas y cuentas corrientes.
                <br /><br />
                Primero agrega la cuenta principal con la que quieres comenzar.
            </div>
            <button onClick={() => setStep(1)} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                Comenzar →
            </button>
        </div>
    );

    if (step === 1) return (
        <div className="animate-fadeIn" style={{ maxWidth: 420, margin: '0 auto', padding: '2rem 1rem' }}>
            <div style={{ width: 36, height: 36, background: 'var(--olive)', borderRadius: '50%', marginBottom: 12, boxShadow: 'inset 2px -2px 0 rgba(0,0,0,.18)' }} />
            <div className="page-title" style={{ marginBottom: 4 }}>Crear primera cuenta</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>
                Podrás agregar más cuentas después en Configuración.
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 20 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>
                        Nombre de la cuenta
                    </label>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej: Santander TC, Mi BCI CC…"
                        className="input"
                        style={{ width: '100%' }}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>
                        Tipo de cuenta
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[['tc', 'TARJETA CRÉDITO'], ['cc', 'CUENTA CORRIENTE']].map(([v, l]) => (
                            <button key={v} onClick={() => setType(v)} style={{
                                flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)',
                                border: `2px solid ${type === v ? ACCOUNT_COLORS[v] : 'var(--border-medium)'}`,
                                background: type === v ? ACCOUNT_COLORS[v] + '15' : 'var(--bg-hover)',
                                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                color: type === v ? ACCOUNT_COLORS[v] : 'var(--text-secondary)',
                            }}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>
                        Banco
                    </label>
                    <select value={bank} onChange={e => setBank(e.target.value)} className="input" style={{ width: '100%' }}>
                        {BANKS.map(b => <option key={b} value={b}>{BANK_LABELS[b]}</option>)}
                    </select>
                </div>
            </div>

            <button
                onClick={handleCreate}
                disabled={!name.trim() || saving}
                className="btn btn-primary"
                style={{ width: '100%' }}
            >
                {saving ? 'Guardando…' : 'Crear cuenta →'}
            </button>
        </div>
    );

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 420, margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
            <div className="page-title" style={{ marginBottom: 12 }}>¡Listo!</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                Cuenta creada correctamente. Ahora sube tu primer estado de cuenta en PDF para comenzar a analizar tus finanzas.
            </div>
            <button onClick={onGoUpload} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                Subir estado de cuenta
            </button>
        </div>
    );
}
