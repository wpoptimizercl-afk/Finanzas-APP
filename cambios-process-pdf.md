# Instrucciones para corregir `api/process-pdf.js`

Hay dos bugs independientes. Aplica los cambios en el orden indicado.

---

## BUG 1 — Formato numérico chileno destruido por `Number()`

### Diagnóstico
La función `normalizeAIResponse` usa `Number(t.monto)` para convertir los montos.
JavaScript interpreta el punto como separador decimal, no como separador de miles.
Resultado: `"1.525.025"` → `Number("1.525.025")` → `NaN` (o `1.525` si el modelo
devuelve el string de otra forma). Esto explica los valores absurdos como `$2` y `$19`.

### Cambio 1a — Agregar helper `parseChileanAmount`

Añadir esta función ANTES de la función `normalizeAIResponse` (aproximadamente línea 465):

```js
/**
 * Parsea un monto en formato chileno (punto = separador de miles)
 * y lo devuelve como número entero.
 * Ejemplos:
 *   "1.525.025" → 1525025
 *   "18.994"    → 18994
 *   "384.495"   → 384495
 *   44333       → 44333   (ya es número, pasa directo)
 *   null / ""   → 0
 */
function parseChileanAmount(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Math.round(value);
    // Eliminar todos los puntos de miles y convertir a entero
    const cleaned = String(value).replace(/\./g, '').replace(/,.*$/, '');
    const result = parseInt(cleaned, 10);
    return isNaN(result) ? 0 : result;
}
```

### Cambio 1b — Reemplazar todos los `Number()` monetarios en `normalizeAIResponse`

En la función `normalizeAIResponse` (líneas ~466-501), reemplazar:

```js
// ANTES
total_operaciones: Number(data.total_operaciones) || 0,
total_facturado: Number(data.total_facturado) || 0,
saldo_inicial: data.saldo_inicial != null ? Number(data.saldo_inicial) : null,
saldo_final: data.saldo_final != null ? Number(data.saldo_final) : null,
```

```js
// DESPUÉS
total_operaciones: parseChileanAmount(data.total_operaciones),
total_facturado: parseChileanAmount(data.total_facturado),
saldo_inicial: data.saldo_inicial != null ? parseChileanAmount(data.saldo_inicial) : null,
saldo_final: data.saldo_final != null ? parseChileanAmount(data.saldo_final) : null,
```

Y dentro del `.map()` de transacciones, reemplazar:

```js
// ANTES
monto: Math.abs(Number(t.monto) || 0),
cuota_actual: t.cuota_actual != null ? Number(t.cuota_actual) : null,
total_cuotas: t.total_cuotas != null ? Number(t.total_cuotas) : null,
```

```js
// DESPUÉS
monto: Math.abs(parseChileanAmount(t.monto)),
cuota_actual: t.cuota_actual != null ? Number(t.cuota_actual) : null,
total_cuotas: t.total_cuotas != null ? Number(t.total_cuotas) : null,
```

Y dentro del `.map()` de cuotas_vigentes, reemplazar:

```js
// ANTES
monto_cuota: Number(c.monto_cuota)
```

```js
// DESPUÉS
monto_cuota: parseChileanAmount(c.monto_cuota)
```

---

## BUG 2 — El razonamiento correcto no protege la extracción estructurada

### Diagnóstico
El campo `razonamiento` del JSON lo genera la IA en la misma llamada antes de escribir
las transacciones. La IA calcula bien los totales ($1.640.880 cargos) pero luego al
generar el array de transacciones comete errores (montos mal, transacciones inventadas
o faltantes). El código actual solo loguea el razonamiento pero nunca lo usa como
guardia de validación.

### Cambio 2 — Agregar función `validateCCTotals` y llamarla tras normalizar

Añadir esta función ANTES del `export default async function handler`:

```js
/**
 * Valida que la suma de transacciones extraídas coincida con los totales
 * que la propia IA declaró en su razonamiento.
 * Devuelve un objeto con los resultados de la validación para loguear.
 */
function validateCCTotals(output, razonamiento) {
    const cargos = output.transacciones.filter(t => t.tipo === 'cargo');
    const abonos = output.transacciones.filter(t => t.tipo === 'abono');
    const sumCargos = cargos.reduce((s, t) => s + t.monto, 0);
    const sumAbonos = abonos.reduce((s, t) => s + t.monto, 0);

    // Intentar extraer totales del texto de razonamiento
    // Ejemplo: "Suma cargos: $1.640.880 (resumen dice $1.640.880 → coincide)"
    const cargoMatch = razonamiento?.match(/suma cargos[^$]*\$([\d.]+)/i);
    const abonoMatch = razonamiento?.match(/suma abonos[^$]*\$([\d.]+)/i);

    const expectedCargos = cargoMatch ? parseChileanAmount(cargoMatch[1]) : null;
    const expectedAbonos = abonoMatch ? parseChileanAmount(abonoMatch[1]) : null;

    const cargoMismatch = expectedCargos !== null && sumCargos !== expectedCargos;
    const abonoMismatch = expectedAbonos !== null && sumAbonos !== expectedAbonos;

    return {
        sumCargos,
        sumAbonos,
        expectedCargos,
        expectedAbonos,
        cargoMismatch,
        abonoMismatch,
        ok: !cargoMismatch && !abonoMismatch,
    };
}
```

Luego, en el `handler`, REEMPLAZAR el bloque de logging CC (líneas ~629-635):

```js
// ANTES
if (isCC) {
    const cargos = output.transacciones.filter(t => t.tipo === 'cargo');
    const abonos = output.transacciones.filter(t => t.tipo === 'abono');
    const sumCargos = cargos.reduce((s, t) => s + t.monto, 0);
    const sumAbonos = abonos.reduce((s, t) => s + t.monto, 0);
    console.log(`[process-pdf] CC: ${cargos.length} cargos ($${sumCargos}), ${abonos.length} abonos ($${sumAbonos}), saldo: ${output.saldo_inicial} → ${output.saldo_final}`);
}
```

```js
// DESPUÉS
if (isCC) {
    const cargos = output.transacciones.filter(t => t.tipo === 'cargo');
    const abonos = output.transacciones.filter(t => t.tipo === 'abono');
    const validation = validateCCTotals(output, data.razonamiento);

    console.log(`[process-pdf] CC: ${cargos.length} cargos ($${validation.sumCargos}), ${abonos.length} abonos ($${validation.sumAbonos}), saldo: ${output.saldo_inicial} → ${output.saldo_final}`);

    if (!validation.ok) {
        if (validation.cargoMismatch) {
            console.warn(`[process-pdf] ⚠️ MISMATCH CARGOS: extraído $${validation.sumCargos} vs esperado $${validation.expectedCargos} (diff: ${validation.sumCargos - validation.expectedCargos})`);
        }
        if (validation.abonoMismatch) {
            console.warn(`[process-pdf] ⚠️ MISMATCH ABONOS: extraído $${validation.sumAbonos} vs esperado $${validation.expectedAbonos} (diff: ${validation.sumAbonos - validation.expectedAbonos})`);
        }
        // El output igual se devuelve al frontend, pero el warning en logs
        // permite detectar el problema sin bloquear al usuario.
        // En el futuro se puede convertir en un error 422 si se desea.
    } else {
        console.log(`[process-pdf] ✅ Totales CC validados correctamente`);
    }
}
```

---

## Cambio 3 — Reforzar el prompt de CC con instrucción de formato numérico

En `SYSTEM_PROMPT_CC`, dentro del bloque `FORMATO DE RESPUESTA (JSON EXACTO)`
(aproximadamente línea 408), agregar esta instrucción ANTES de la línea
`Responde ÚNICAMENTE con este JSON`:

```
⚠️ CRÍTICO — FORMATO DE MONTOS EN JSON:
   Todos los valores numéricos monetarios (monto, saldo_inicial, saldo_final)
   deben ser NÚMEROS ENTEROS sin puntos ni comas.
   CORRECTO:   "monto": 1525025
   INCORRECTO: "monto": "1.525.025"   ← string con puntos
   INCORRECTO: "monto": 1525.025      ← punto decimal
   El valor 1.525.025 pesos chilenos se escribe como el entero 1525025.
```

---

## Resumen de archivos modificados

Solo se modifica `api/process-pdf.js`:

| Cambio | Líneas aprox. | Tipo |
|--------|--------------|------|
| Agregar `parseChileanAmount()` | Antes de línea 465 | Nueva función |
| Reemplazar `Number()` en `normalizeAIResponse` | 477-498 | Refactor |
| Agregar `validateCCTotals()` | Antes de línea 503 | Nueva función |
| Reemplazar bloque logging CC | 629-635 | Refactor + nueva lógica |
| Instrucción numérica en `SYSTEM_PROMPT_CC` | ~408 | Prompt engineering |
