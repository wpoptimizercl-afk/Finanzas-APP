import { useMemo } from 'react';
import { CLP } from '../utils/formatters';

/**
 * Widget que muestra cuántas cuotas TC terminan en el último período cargado
 * y cuánto dinero se libera a partir del mes siguiente.
 * Solo se renderiza si hay al menos una cuota terminando.
 */
export default function EndingInstallmentsWidget({ months }) {
    const { endingCuotas, liberado } = useMemo(() => {
        const tcMonths = (months || []).filter(m => m.source_type === 'tc');
        if (!tcMonths.length) return { endingCuotas: [], liberado: 0 };

        // Período TC más reciente
        const latestPeriod = tcMonths[tcMonths.length - 1].periodo;
        const allCuotas = tcMonths
            .filter(m => m.periodo === latestPeriod)
            .flatMap(m => m.cuotas_vigentes || []);

        // Cuota termina este mes si cuota_actual === total_cuotas
        const ending = allCuotas.filter(
            c => (c.cuota_actual || 0) > 0 && (c.cuota_actual || 0) >= (c.total_cuotas || 1)
        );

        const liberado = ending.reduce((s, c) => s + (c.monto_cuota || 0), 0);
        return { endingCuotas: ending, liberado };
    }, [months]);

    if (!endingCuotas.length) return null;

    const count = endingCuotas.length;
    const headline = count === 1
        ? '1 cuota termina este mes'
        : `${count} cuotas terminan este mes`;

    return (
        <div style={{
            background: 'var(--success-light)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: '1.5rem',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                        {headline}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        Liberás <strong>{CLP(liberado)}/mes</strong> a partir del próximo mes
                    </div>
                </div>
                <div style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--success)',
                    letterSpacing: '-.3px',
                    flexShrink: 0,
                }}>
                    +{CLP(liberado)}
                </div>
            </div>

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {endingCuotas.map((c, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'var(--success)',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 8,
                                fontWeight: 700,
                                flexShrink: 0,
                            }}>✓</span>
                            {c.descripcion}
                        </span>
                        <span style={{ fontWeight: 600, flexShrink: 0 }}>{CLP(c.monto_cuota)}/mes</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
