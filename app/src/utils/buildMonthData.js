/**
 * buildMonthData — construye el objeto monthData a partir de la respuesta
 * normalizada de la IA, aplicando catRules y separando correctamente
 * gastos reales, abonos e ingresos CC.
 *
 * @param {object} parsed  - Respuesta normalizada de normalizeAIResponse()
 * @param {object} catRules - Mapa { descripcion_lowercase: categoria }
 * @returns {object} monthData listo para persistir en Supabase
 */
export function buildMonthData(parsed, catRules) {
    const isCC = parsed.source_type === 'cc';

    // Categorías que NUNCA pueden ser sobreescritas por catRules
    const protectedCats = isCC
        ? ['traspaso_tc', 'comision_banco']
        : ['cargos_banco'];

    // Categorías que se excluyen del totalCargos (no son gastos reales del usuario)
    const excludedFromTotal = isCC
        ? ['traspaso_tc', 'comision_banco']
        : ['cargos_banco'];

    // Aplicar catRules sin tocar protectedCats
    const transacciones = (parsed.transacciones || []).map(t => {
        if (protectedCats.includes(t.categoria)) return t;
        const key = (t.descripcion || '').toLowerCase().trim();
        return catRules[key] ? { ...t, categoria: catRules[key] } : t;
    });

    // Acumular categorias (solo gastos reales) y calcular totalCargos
    const categorias = {};
    let totalCargos = 0;
    let ingresosCC = 0;

    for (const t of transacciones) {
        // Normalizar monto: la IA puede devolver negativos por error de parseo
        const monto = Math.abs(Number(t.monto) || 0);

        if (t.tipo === 'abono') {
            // Abonos (ingresos) se contabilizan aparte — no son gastos
            ingresosCC += monto;
            continue;
        }

        if (t.tipo === 'traspaso_tc' || t.categoria === 'traspaso_tc') {
            // Traspaso a TC: movimiento interno banco→TC, no es gasto real del usuario
            // Excluido de categorias Y de totalCargos — solo se persiste en transacciones
            continue;
        }

        if (t.tipo === 'cargo') {
            // Acumular en categorias (visible en el breakdown de gastos)
            categorias[t.categoria] = (categorias[t.categoria] || 0) + monto;

            // Excluir comisiones bancarias del total de gastos reales
            if (!excludedFromTotal.includes(t.categoria)) {
                totalCargos += monto;
            }
        }
    }

    const result = {
        ...parsed,
        transacciones,
        categorias,
        total_cargos: totalCargos,
    };

    // ingresos_cc solo existe para registros CC
    if (isCC) {
        result.ingresos_cc = ingresosCC;
    }

    return result;
}
