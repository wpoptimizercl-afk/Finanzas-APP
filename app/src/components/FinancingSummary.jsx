import { getTotalFinancing, getFinancingUtilization, getCreditLineData } from '../utils/calculations';
import { CLP } from '../utils/formatters';
import Tag from './ui/Tag';

const RISK_COLORS = {
    low:    { bar: 'var(--success)',  text: 'var(--success)',  label: 'Uso bajo' },
    medium: { bar: 'var(--warning)',  text: 'var(--warning)',  label: 'Uso moderado' },
    high:   { bar: 'var(--danger)',   text: 'var(--danger)',   label: 'Uso alto' },
    none:   { bar: 'var(--primary)',  text: 'var(--primary)',  label: '' },
};

/**
 * Sección "Total Financiamiento" — muestra deuda TC + Línea de Crédito consolidadas.
 * Solo se renderiza si hay al menos un producto de crédito con datos.
 */
export default function FinancingSummary({ periodo, months }) {
    const { tcDebt, clDebt, total } = getTotalFinancing(periodo, months);
    const { clLimit, utilizationPct, riskLevel } = getFinancingUtilization(periodo, months);
    const clItems = getCreditLineData(periodo, months);

    // No mostrar si no hay deuda de crédito registrada
    const hasTc = tcDebt > 0;
    const hasCl = clDebt > 0 || clItems.length > 0;
    if (!hasTc && !hasCl) return null;

    const risk = RISK_COLORS[riskLevel] || RISK_COLORS.none;

    return (
        <div className="card financing-summary" style={{ padding: '16px', marginBottom: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.2em', fontFamily: 'var(--font-sans)' }}>
                    Total Financiamiento
                </span>
                {hasCl && riskLevel !== 'none' && (
                    <Tag variant={riskLevel === 'high' ? 'red' : riskLevel === 'medium' ? 'amber' : 'olive'} label={risk.label} />
                )}
            </div>

            {/* Deuda total */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: hasCl && clLimit > 0 ? 12 : 6 }}>
                <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.5px', color: 'var(--danger)' }}>
                    {CLP(total)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>deuda total</span>
            </div>

            {/* Barra de utilización de cupo (solo si hay línea de crédito con cupo) */}
            {hasCl && clLimit > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`Utilización del cupo: ${utilizationPct}%`}
                        aria-valuenow={utilizationPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="progress-bar"
                            style={{
                                width: Math.min(utilizationPct, 100) + '%',
                                background: risk.bar,
                                transition: 'width .5s ease',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        <span style={{ color: risk.text, fontWeight: 600 }}>{utilizationPct}% del cupo utilizado</span>
                        <span>cupo {CLP(clLimit)}</span>
                    </div>
                </div>
            )}

            {/* Desglose */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                    Desglose
                </div>

                {hasTc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasCl ? 8 : 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '2px', background: 'var(--ink)' }}></span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>Tarjeta de crédito</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{CLP(tcDebt)}</span>
                    </div>
                )}

                {clItems.map((cl, i) => (
                    <div key={i} style={{ marginBottom: i < clItems.length - 1 ? 6 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '2px', background: 'var(--danger)' }}></span>
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>Línea de crédito</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{CLP(cl.used_amount)}</span>
                        </div>
                        {(cl.approved_limit > 0 || cl.available_amount > 0 || cl.expiry_date) && (
                            <div style={{ paddingLeft: 28, display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                                {cl.approved_limit > 0 && (
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        Cupo: {CLP(cl.approved_limit)}
                                    </span>
                                )}
                                {cl.available_amount > 0 && (
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        Disponible: {CLP(cl.available_amount)}
                                    </span>
                                )}
                                {cl.expiry_date && (
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        Vence: {cl.expiry_date}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
