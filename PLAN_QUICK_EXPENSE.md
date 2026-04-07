# Plan: Carga Rápida de Gastos Temporales

**Estado:** Pendiente de aprobación  
**Creado:** 2026-04-02  
**Objetivo:** Registrar gastos al momento de hacerlos, con limpieza automática al subir estado de cuenta

---

## Contexto

Actualmente los gastos solo se registran cuando el banco emite el estado de cuenta PDF. Esto deja un "punto ciego" durante el mes en curso. Esta feature permite registrar gastos al momento de hacerlos, con limpieza automática al subir el estado de cuenta real.

## Arquitectura de la solución

**Estrategia clave:** Reutilizar la tabla `transactions` existente con un flag `is_temporary`. Los gastos temporales se vinculan a un "mes placeholder" que se crea automáticamente si no existe uno para el período+cuenta actual. Cuando se sube un PDF real, `saveMonth()` ya hace UPSERT del mes + DELETE de transacciones viejas + INSERT de nuevas — esto **limpia automáticamente** los temporales sin código adicional. Solo necesitamos contar cuántos se eliminaron para el toast.

---

## Fase 1: Migración SQL

**Archivo nuevo:** `supabase_migration_quick_expense.sql` (raíz del repo)

```sql
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_temporary
  ON public.transactions (is_temporary) WHERE is_temporary = true;
```

- Sin cambios a RLS (la policy existente "Own transactions" ya cubre la nueva columna)
- Sin cambios a la tabla `months`

---

## Fase 2: Hook de datos (`useFinanceData.js`)

**Archivo:** `app/src/hooks/useFinanceData.js`

### 2a. Agregar `saveTemporaryTransaction()`

Después de `saveMonth` (línea ~146). Lógica:

1. Derivar `periodo` actual usando `MONTH_NAMES` de `constants.js` (formato: `"Abril 2026"`)
2. Derivar `fecha` como `DD/MM/YYYY` (formato estándar del codebase)
3. Buscar month existente para `(account_id, periodo)` en estado local
4. Si no existe → crear placeholder month via `supabase.from('months').upsert()` con `total_cargos: 0`, `categorias: {}`, `cuotas_vigentes: []`
5. Insertar transacción con `is_temporary: true`, `tipo: 'cargo'`
6. Actualizar estado local (months, total_cargos, categorias)

### 2b. Agregar `deleteTransaction()`

Para eliminar gastos temporales individualmente. Recibe `(txId, monthId)`, elimina de Supabase y actualiza estado local recalculando totales.

### 2c. Modificar `saveMonth()` para retornar conteo de temporales

Antes del DELETE existente (línea 127), hacer un `SELECT count` con `is_temporary = true` en el month que se está reemplazando. Retornar `{ tempCount }` desde la función.

### 2d. Agregar ambas funciones al `return` (línea 371)

```js
return { ..., saveTemporaryTransaction, deleteTransaction };
```

---

## Fase 3: Componente QuickExpenseModal

**Archivo nuevo:** `app/src/components/QuickExpenseModal.jsx`

### Campos:
- **Monto** — reutilizar `CurrencyInput` existente con prop `large`
- **Medio de pago** — `<select>` con `accounts` (mostrar `name` + `type`)
- **Categoría** — `<select>` con `allCats` (filtrar `traspaso_tc` y `transferencia_recibida`)
- **Descripción** — `<input>` opcional, placeholder "Ej: Almuerzo"

### UX:
- Header con icono `Zap` (lucide) + título "Gasto rápido"
- Badge info: "temporal — Se reemplaza al subir el estado de cuenta"
- Botón "Registrar gasto" (btn-primary, full width)
- Cerrar con Escape o click en backdrop
- Loading state en botón mientras guarda
- Validación: monto > 0, account requerido

### Patrones a reutilizar:
- Clases CSS: `.modal-backdrop`, `.modal`, `.input`, `.btn`, `.btn-primary`
- Componente: `CurrencyInput` con prop `large` para input grande
- Variables CSS: `--warning`, `--warning-light`, `--warning-border` para badge temporal

---

## Fase 4: FAB + integración en App.jsx

**Archivo:** `app/src/App.jsx`

### 4a. FAB (Floating Action Button)
- Posición: fixed, sobre BottomNav en mobile, esquina inferior derecha en desktop
- Icono `Plus` de lucide-react
- Solo visible cuando `ready && accounts.length > 0`
- Abre `QuickExpenseModal` via estado `showQuickExpense`

### 4b. Wiring
- Destructurar `saveTemporaryTransaction` y `deleteTransaction` de `useFinanceData()`
- Crear `handleSaveTemporary` wrapper con toast: `toast('Gasto registrado', 'success')`
- Crear `handleDeleteTransaction` wrapper con toast: `toast('Gasto temporal eliminado', 'default')`
- Pasar `handleDeleteTransaction` a `HistoryPage`

### 4c. Toast de limpieza en `handleSaveMonth`
- `saveMonth()` ahora retorna `{ tempCount }`
- Si `tempCount > 0`: toast con `"Mes guardado · X gasto(s) temporal(es) reemplazado(s)"` (duración 4s)

---

## Fase 5: CSS del FAB

**Archivo:** `app/src/styles/components.css` (al final)

```css
.fab {
    position: fixed;
    bottom: calc(var(--bottomnav-height) + 16px);
    right: 20px;
    width: 56px; height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--primary-hover, #047857));
    color: #fff; border: none;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(5,150,105,.4);
    z-index: 45; cursor: pointer;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.fab:hover { transform: scale(1.08); }
.fab:active { transform: scale(0.95); }
@media (min-width: 768px) { .fab { bottom: 32px; right: 32px; } }
```

z-index 45 queda debajo del BottomNav (50) y del modal backdrop (200+).

---

## Fase 6: Diferenciación visual en History.jsx

**Archivo:** `app/src/pages/History.jsx`

### 6a. Badge "temporal" en tx-row (línea ~389)
Después del `<span>{t.fecha}</span>`, agregar condicionalmente:

```jsx
{t.is_temporary && (
    <span style={{
        fontSize: 9, fontWeight: 700, padding: '1px 6px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--warning-light)', color: 'var(--warning)',
        border: '1px solid var(--warning-border)', whiteSpace: 'nowrap',
    }}>temporal</span>
)}
```

Sigue el mismo patrón visual del badge de cuenta existente (línea 391).

### 6b. Botón eliminar para temporales (línea ~405)
Junto al `tx-amount`, agregar icono `Trash2` visible solo para `is_temporary`:

```jsx
{t.is_temporary && (
    <button onClick={() => deleteTransaction(t.id, t.month_id)}
        style={{ color: 'var(--text-tertiary)', padding: 4 }}
        title="Eliminar gasto temporal">
        <Trash2 size={13} />
    </button>
)}
```

### 6c. Props
- Aceptar `deleteTransaction` como prop nueva
- Importar `Trash2` de lucide-react

---

## Fase 7: Indicador en Home.jsx

**Archivo:** `app/src/pages/Home.jsx`

Agregar un tag/badge debajo del selector de período cuando el mes actual tiene gastos temporales:

```jsx
{tempCount > 0 && (
    <span style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)',
        background: 'var(--warning-light)', color: 'var(--warning)',
        fontWeight: 600
    }}>
        {tempCount} gasto{tempCount > 1 ? 's' : ''} temporal{tempCount > 1 ? 'es' : ''}
    </span>
)}
```

Donde `tempCount` se calcula contando transacciones con `is_temporary === true` del período visible.

---

## Edge Cases

| Caso | Comportamiento |
|------|---------------|
| PDF sin gastos temporales | Toast normal "Mes guardado correctamente" |
| Eliminar temporal manualmente | Botón Trash2 en History, recalcula totales |
| Temporales en resúmenes | Sí, incluidos en totales (diferenciados visualmente) |
| Mes placeholder sin PDF real | Funciona normalmente, se reemplaza al subir PDF |
| Múltiples temporales mismo período | Todos se vinculan al mismo mes placeholder |

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `supabase_migration_quick_expense.sql` | **Crear** — migración SQL |
| `app/src/hooks/useFinanceData.js` | **Modificar** — agregar 2 funciones + retorno de tempCount |
| `app/src/components/QuickExpenseModal.jsx` | **Crear** — modal de carga rápida |
| `app/src/App.jsx` | **Modificar** — FAB, modal, wiring de handlers |
| `app/src/styles/components.css` | **Modificar** — agregar CSS del FAB |
| `app/src/pages/History.jsx` | **Modificar** — badge temporal + botón eliminar |
| `app/src/pages/Home.jsx` | **Modificar** — indicador de temporales |

---

## Verificación

1. **Migración**: Ejecutar SQL en Supabase SQL Editor, verificar columna con `SELECT * FROM transactions LIMIT 1`
2. **Crear gasto temporal**: Abrir modal → llenar monto + cuenta → guardar → verificar toast + aparece en History con badge "temporal"
3. **Verificar en Home**: El gasto temporal aparece en totales del mes con indicador visual
4. **Eliminar manual**: Click en Trash2 en History → gasto desaparece, totales se actualizan
5. **Limpieza automática**: Subir PDF del mismo período+cuenta → toast indica cuántos temporales se reemplazaron → los temporales desaparecen, reemplazados por transacciones reales del PDF
6. **Edge case vacío**: Subir PDF de período sin temporales → toast normal sin mención de temporales
