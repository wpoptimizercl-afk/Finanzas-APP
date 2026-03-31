// Vercel serverless function — /api/process-pdf
// Extracts text from PDF using pdf-parse, then calls OpenAI GPT-4o-mini
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { parseSantanderTC } from './parsers/santander-tc.js';
import { parseSantanderCC } from './parsers/santander-cc.js';

console.log('[API] process-pdf initialized with classic pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Max payload size: ~10MB base64 ≈ ~7.5MB PDF
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

// CORS: restrict to known origins
const IS_PRODUCTION = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development';

const ALLOWED_ORIGINS = [
    process.env.ALLOWED_ORIGIN,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    ...(!IS_PRODUCTION ? ['http://localhost:5173'] : []),
].filter(Boolean);

function getCorsOrigin(reqOrigin) {
    if (!reqOrigin) return null;
    return ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : null;
}

// ── Bank-specific prompt builders ────────────────────────────────────
const VALID_CATS = [
    'supermercado', 'minimarket', 'delivery', 'transporte', 'mascotas', 'lavanderia',
    'ropa_moda', 'restaurantes', 'entretenimiento', 'pago_servicios',
    'telefonia_internet', 'cuotas', 'cargos_banco', 'otros',
];

const SYSTEM_PROMPT = `Eres un extractor experto de estados de cuenta Santander Chile (tarjeta de crédito).
Extraerás TODAS las transacciones del PERÍODO ACTUAL con nombres REALES de comercio, sin inventar ni omitir nada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DE LÍNEAS EN EL PDF SANTANDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El PDF tiene MÚLTIPLES PÁGINAS. Debes procesar ABSOLUTAMENTE TODO el texto sin excepción.
La sección "2.PERÍODO ACTUAL" comienza tras la línea "1. TOTAL OPERACIONES $X" y continúa
en todas las páginas siguientes hasta "3. CARGOS, COMISIONES, IMPUESTOS Y ABONOS".

Hay DOS tipos de líneas de transacción:

TIPO A — Con cuotas (SIN lugar de operación al inicio):
  [FECHA DD/MM/YY] [NOMBRE COMERCIO] [TIPO_CUOTA] [INTERÉS%] [MONTO_ORIGEN] [MONTO_TOTAL] [NN/TT] [CARGO_MES]

TIPO B — Compra normal (CON lugar de operación al inicio):
  [LUGAR] [FECHA DD/MM/YY] [NOMBRE COMERCIO] [CARGO_MES]
  (algunas también tienen: [COMPRAS P.A.T.] o moneda extranjera [AR/USD MONTO_ORIGEN])

⚠️ CRÍTICO — Las líneas TIPO A (cuotas) muchas veces tienen fechas de meses ANTERIORES
   (ej: 21/08/25, 31/10/25, 12/11/25) porque la compra fue en ese mes pero la cuota
   se está cobrando AHORA. Estas líneas SÍ son del período actual — NO las ignores.

Los TIPOS DE CUOTA son palabras clave que aparecen DESPUÉS del nombre del comercio:
  • N/CUOTAS PRECIO
  • CUOTA FIJA
  • TRES CUOTAS PREC
  • DOS CUOTAS PRECI / DOS CUOTAS PREC
  • CUOTA COMERCIO
  • NN CUOTAS COMERC (cualquier número + CUOTAS COMERC)
  • COMPRAS P.A.T.

⚠️ CRÍTICO: Estas palabras son el TIPO DE PAGO, NO el nombre del comercio.
   El nombre del comercio es TODO LO QUE ESTÁ ANTES de esas palabras clave.

Para NºCUOTA (formato NN/TT): NN = cuota actual, TT = total cuotas.
  Ejemplo: "07/12" → cuota_actual=7, total_cuotas=12
  Ejemplo: "02/12" → cuota_actual=2, total_cuotas=12  ← NO confundir con "02/10"
  Ejemplo: "00/03" → cuota_actual=0, total_cuotas=3   ← no se cobra este mes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLOS REALES — FORMATO SANTANDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Línea PDF → Cómo extraer:

"21/08/25 SAN DIEGO LTDA N/CUOTAS PRECIO 0,00 % $ 116.980 $ 116.980 07/12 $9.748"
→ descripcion: "San Diego Ltda"             (fecha 21/08/25 es la compra original, SÍ incluir)
→ tipo_cuota: "N/CUOTAS PRECIO", cuota_actual: 7, total_cuotas: 12, monto_cuota: 9748

"31/10/25 H&M VIVO GALERIA IMPERIO CUOTA FIJA 3,06 % $ 35.950 $ 39.797 03/03 $13.265"
→ descripcion: "H&M Vivo Galería Imperio"   (todo ANTES de "CUOTA FIJA")
→ tipo_cuota: "CUOTA FIJA", cuota_actual: 3, total_cuotas: 3, monto_cuota: 13265

"12/11/25 JYOTIS CUOTA FIJA 3,06 % $ 71.762 $ 78.687 03/03 $26.229"
→ descripcion: "Jyotis"                     (todo ANTES de "CUOTA FIJA")
→ tipo_cuota: "CUOTA FIJA", cuota_actual: 3, total_cuotas: 3, monto_cuota: 26229

"08/12/25 MERCADOPAGO*REEBOKCHILE CUOTA COMERCIO 0,00 % $ 83.288 $ 83.288 02/03 $27.763"
→ descripcion: "MercadoPago*ReebokChile"    (todo ANTES de "CUOTA COMERCIO")
→ tipo_cuota: "CUOTA COMERCIO", cuota_actual: 2, total_cuotas: 3, monto_cuota: 27763

"16/12/25 MERCADOPAGO*MERCADOLIBRE TRES CUOTAS PREC 0,00 % $ 36.850 $ 36.850 03/03 $12.284"
→ descripcion: "MercadoPago*MercadoLibre"   (todo ANTES de "TRES CUOTAS PREC")
→ tipo_cuota: "TRES CUOTAS PREC", cuota_actual: 3, total_cuotas: 3, monto_cuota: 12284

"07/02/26 CANNON VIVO IMPERIO TRES CUOTAS PREC 0,00 % $ 28.990 $ 28.990 01/03 $9.663"
→ descripcion: "Cannon Vivo Imperio"        (todo ANTES de "TRES CUOTAS PREC")
→ tipo_cuota: "TRES CUOTAS PREC", cuota_actual: 1, total_cuotas: 3, monto_cuota: 9663

"24/02/26 CLUB ANIMAL SPA DOS CUOTAS PRECI 0,00 % $ 66.810 $ 66.810 01/02 $33.405"
→ descripcion: "Club Animal SPA"            (todo ANTES de "DOS CUOTAS PRECI")
→ tipo_cuota: "DOS CUOTAS PRECI", cuota_actual: 1, total_cuotas: 2, monto_cuota: 33405

"07/02/26 H&M VIVO GALERIA IMPERIO 03 CUOTAS COMERC 0,00 % $ 53.950 $ 53.950 00/03 $17.983"
→ descripcion: "H&M Vivo Galería Imperio"   (todo ANTES de "03 CUOTAS COMERC")
→ cuota_actual: 0 → NO va en transacciones, SÍ va en cuotas_vigentes con monto_cuota: 17983

"01/01/26 MP *MERCADO LIBRE N/CUOTAS PRECIO 0,00 % $ 100.606 $ 100.606 02/12 $8.384"
→ descripcion: "MP *Mercado Libre"          (todo ANTES de "N/CUOTAS PRECIO")
→ tipo_cuota: "N/CUOTAS PRECIO", cuota_actual: 2, total_cuotas: 12, monto_cuota: 8384
   ⚠️ NºCUOTA es "02/12" → total_cuotas=12, NO 10

"SANTIAGO 30/01/26 MERPAGO*JETSMARTAIRLINESS $295.667"
→ descripcion: "MercadoPago*JetSmart Airlines"  (sin tipo de cuota → compra normal)
→ monto: 295667, categoria: transporte

"LAS CONDES 24/02/26 HELP.HBOMAX.COM HEL COMPRAS P.A.T. $4.795"
→ descripcion: "HBO Max"                    (todo ANTES de "COMPRAS P.A.T.")
→ monto: 4795, categoria: telefonia_internet

"CAP.FEDERAL 14/02/26 LA DORITA 4308 AR 135.520,00 $90.305"
→ descripcion: "La Dorita"                  (LUGAR=CAP.FEDERAL, monto en AR, usar CARGO_MES)
→ monto: 90305, categoria: restaurantes

⚠️ CASO ESPECIAL — mismo comercio al final de página 1 y al inicio de página 2:
"11001SANTIAG 01/04/25 MOVISTAR $464"        ← fin de página 1
"11001SANTIAG 01/04/25 MOVISTAR $11.240"     ← inicio de página 2
→ Son DOS transacciones SEPARADAS (ambas tienen LUGAR+FECHA+DESCRIPCIÓN+MONTO completos)
→ transaccion 1: descripcion "Movistar", monto: 464
→ transaccion 2: descripcion "Movistar", monto: 11240
→ NUNCA fusionar dos filas TIPO B completas aunque sean del mismo comercio y fecha.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE EXTRACCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R0. AUTO-IDENTIFICACIÓN: Si el texto corresponde a una cartola de cuenta corriente
    (contiene columnas CHEQUES/CARGOS/ABONOS/SALDO, o encabezado "CARTOLA" o "CUENTA CORRIENTE"),
    devuelve source_type: "cc". Si es estado de tarjeta de crédito, devuelve source_type: "tc".
R1. SOLO PERÍODO ACTUAL ("2.PERÍODO ACTUAL"): Ignora la sección "1.PERÍODO ANTERIOR" y sus montos.
    Las cuotas con fechas antiguas (ago/oct/nov/dic del año anterior) que aparecen DENTRO de
    "2.PERÍODO ACTUAL" SÍ deben incluirse — son cobros diferidos del período actual.
R2. OMITIR: La línea "MONTO CANCELADO" (es un pago/abono, no un gasto). También omitir
    "4. INFORMACION COMPRAS EN CUOTAS EN EL PERIODO" (es información, no una transacción separada).
R2b. NUNCA deduplicar: si el mismo comercio aparece varias veces en la misma fecha con
    DISTINTOS montos, son cobros separados — extrae CADA línea como transacción independiente.
    Caso típico: salto de página del PDF hace que la misma empresa aparezca al final de una
    página y al inicio de la siguiente. Si los montos son DISTINTOS → dos transacciones reales.
R3. MONEDA EXTRANJERA: Usa SIEMPRE el valor en pesos chilenos (última columna CARGO DEL MES, ej: $9.585), nunca el monto en AR o USD.
R4. CUOTA 00/NN: cuota_actual=0 → NO va en 'transacciones'. SÍ va en 'cuotas_vigentes'.
R5. CUOTA 01/NN o mayor: SÍ se cobra este mes → va en 'transacciones' (monto = VALOR CUOTA MENSUAL) Y en 'cuotas_vigentes'.
R6. SÍ incluye "3. CARGOS, COMISIONES, IMPUESTOS Y ABONOS" como categoría 'cargos_banco'.
    IMPORTANTE: estos cargos NO forman parte de "1. TOTAL OPERACIONES" del PDF. Son cobros
    separados del banco. Inclúyelos en 'transacciones' con categoria='cargos_banco', pero
    la suma de transacciones EXCLUYENDO cargos_banco debe igualar el 'total_operaciones' del PDF.
R7. TOTAL OPERACIONES DEL PERÍODO ACTUAL:
    En el PDF de Santander hay DOS líneas "TOTAL OPERACIONES":
      • La que aparece al FINAL de "1.PERÍODO ANTERIOR" → NO usar, es del mes pasado.
      • La que aparece al FINAL de "2.PERÍODO ACTUAL" (o en el resumen superior del estado)
        → ESTE es el valor correcto. Extráelo y guárdalo en 'total_operaciones'.
    La suma de todos los cargos en 'transacciones' con categoria != 'cargos_banco' DEBE igualar
    ese 'total_operaciones'. Los cargos_banco (sección 3) son ADICIONALES y van sumados aparte.
    Si la suma (sin cargos_banco) es MENOR que total_operaciones: estás omitiendo transacciones
    (verifica cuotas de fechas antiguas). Si es MAYOR: incluiste algo que no corresponde.
R8. El "MONTO TOTAL FACTURADO A PAGAR" va en 'total_facturado'.
R9. Preserva el nombre original del movimiento tal como aparece en el PDF.
    SOLO aplica Title Case (primera letra de cada palabra en mayúscula, resto en minúscula).
    NO reemplaces, acortes ni cambies el contenido.
    Ejemplos correctos:
      PAYU *UBER TRIP → Payu *Uber Trip   (NO "Uber")
      MERPAGO*BIPQR → Merpago*Bipqr       (NO "MercadoPago*BIP")
      HELP.HBOMAX.COM → Help.Hbomax.Com  (NO "HBO Max")
      KM1151 APIES → Km1151 Apies         (NO "Apies")
      JUMBO PENALOLEN → Jumbo Penalolen   (aplica acentos solo si el PDF los tiene)
R10. VERIFICACIÓN OBLIGATORIA antes de responder: Lista mentalmente cada transacción cuota (es_cuota=true)
    y confirma que están todas, incluyendo las de fechas antiguas de la primera página del PDF.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORÍAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- supermercado: Jumbo, Lider, Lider.cl, Ekono, Santa Isabel, Supervecino, Unimarc
- minimarket: Minimarket (cualquiera), AMAWA, TD05 58 MARKET, Distribuidora, El Simmental, D Todo
- delivery: Uber Eats, PedidosYa, Rappi, KFC, Dominos
- transporte: Uber (PAYU *UBER TRIP, PAYU*AR*UBER), Cabify, JetSmart (MERPAGO*JETSMARTAIRLINESS, MERCADOPAGO*JETSET), LATAM, aerolíneas, MercadoPago*BIP (MERPAGO*BIPQR)
- mascotas: Club Animal, Bonne Santé (SUMUP * BONNE SANTE), veterinaria, MAXIK
- lavanderia: Spinokmp, MERPAGO*SPINOKMP
- ropa_moda: H&M, Zara, Falabella, Ripley, Jyotis, San Diego Ltda, Rosarito, Reebok, TRICOT, MercadoPago*ReebokChile
- restaurantes: restaurante, café, DKF Lira, La Dorita (LA DORITA), 2 Animales (2 ANIMALES CATERING), Man Ji, Italian Imperio (INVERSIONES ITALIAN IMPER), Albert Milan Flores, María Almiron
- entretenimiento: Cinemark, Cineplanet, Cinepolis, Fantasilandia, Ticketplus, Netflix, Spotify, WPAY PLUS
- pago_servicios: agua, luz, gas, Enel, Metrogas, Aguas Andinas, gastos comunes, seguros, Comercial Home Store
- telefonia_internet: Entel (ENTEL ONECLICK), Movistar, WOM, Claro, VTR, HBO Max (HELP.HBOMAX.COM), Google Play, Streaming
- cuotas: compras en cuotas (CUOTA FIJA, N/CUOTAS PRECIO, etc.) cuando cuota_actual >= 1
- cargos_banco: COMISION TC, IMPTO DECRETO LEY, IVA USO INTERNACIONAL, SERVICIO COMPRA INTERNACIONAL
- otros: hoteles (Nuitee), MercadoPago*Yusbe, MercadoPago*DonaBarbara, MercadoPago*JorgelinaOjeda, MercadoPago*OscarOswaldom, Apies (tienda conveniencia), y todo lo que no encaje arriba

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA (JSON EXACTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responde ÚNICAMENTE con este JSON, sin markdown ni texto adicional:
{
  "razonamiento": "TOTAL OPERACIONES período actual leído del PDF: X. Suma de mis transacciones: Z. ¿Coincide?: sí/no. Si no: diferencia de W, posibles omisiones. Cuotas de fechas antiguas incluidas (página 1): [lista con fecha y nombre]. Cuotas con cuota_actual=0 excluidas de transacciones: [lista].",
  "periodo": "Mes YYYY",
  "periodo_desde": "DD/MM/YYYY",
  "periodo_hasta": "DD/MM/YYYY",
  "total_operaciones": 0,
  "total_facturado": 0,
  "source_type": "tc",
  "transacciones": [
    {
      "fecha": "DD/MM/YYYY",
      "descripcion": "Nombre Real del Comercio",
      "monto": 0,
      "tipo": "cargo",
      "categoria": "otros",
      "es_cuota": false,
      "cuota_actual": null,
      "total_cuotas": null
    }
  ],
  "cuotas_vigentes": [
    {
      "descripcion": "Nombre Real del Comercio",
      "cuota_actual": 1,
      "total_cuotas": 3,
      "monto_cuota": 0
    }
  ]
}`;

// ── Prompt para Cuenta Corriente Santander ─────────────────────────────────
const SYSTEM_PROMPT_CC = `Eres un extractor experto de cartolas de cuenta corriente Santander Chile.
Extraerás TODOS los movimientos del período con nombres REALES, sin inventar ni omitir nada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DE LA CARTOLA SANTANDER CC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La tabla "DETALLE DE MOVIMIENTOS" tiene 7 columnas:
  [FECHA] [SUCURSAL] [DESCRIPCION] [Nº DCTO] [CHEQUES Y OTROS CARGOS] [DEPOSITOS Y OTROS ABONOS] [SALDO]

Cuando el PDF se convierte a texto plano, las columnas se colapsan en una sola línea.
Cada línea de transacción tiene este patrón general:
  DD/MM  SUCURSAL  [NºDCTO?]  DESCRIPCION  [NºDCTO?]  [MONTO_CARGO?]  [MONTO_ABONO?]  [SALDO?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLA CRÍTICA: IDENTIFICAR Nº DCTO vs MONTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El Nº DCTO es un código numérico de 5-9 dígitos SIN puntos de miles.
Los MONTOS usan punto como separador de miles: "1.449.274" "580.291" "44.333" "912"

Ejemplos de cómo distinguirlos en el texto extraído:
  "0779537005 Transf. COMERCIALIZADORA 600133 1.449.274"
   → 0779537005 = Nº DCTO (no tiene puntos de miles → es código)
   → 600133     = Nº DCTO (no tiene puntos de miles → es código)
   → 1.449.274  = ABONO (tiene puntos de miles → es monto)

  "0264637473 Transf a LAURA VIRGINIA URBI 442567 44.333 8.831"
   → 0264637473 = Nº DCTO (código largo)
   → 442567     = Nº DCTO (código, NO tiene puntos de miles → descartado)
   → 44.333     = CARGO (monto con punto de miles = 44.333 pesos)
   → 8.831      = SALDO (último número = saldo resultante)
   ⚠️ El monto es 44.333 (cuarenta y cuatro mil), NO 444.333 (cuatrocientos cuarenta y cuatro mil)
   ⚠️ NUNCA prepender ni combinar dígitos del Nº DCTO con el monto: "442567" y "44.333" son
      valores completamente separados. El Nº DCTO termina donde termina — su último dígito
      NO forma parte del monto que le sigue.

  "0262646203 Transf a Edgar Eduardo Urbina 250.000"
   → 0262646203 = Nº DCTO
   → 250.000    = CARGO

  "0779537005 Transf. COMERCIALIZADORA 600133 100.000 8.831"
   → 100.000    = ABONO (es transferencia entrante)
   → 8.831      = SALDO

  "0779537005 Transf. COMERCIALIZADORA 600133 912 9.743"
   → 912        = ABONO (monto pequeño sin puntos — puede ser así)
   → 9.743      = SALDO (el saldo DESPUÉS del abono de 912)
   ⚠️ El monto es 912 pesos, NO 9.743 ni ninguna combinación

  "0262646203 Transf. Edgar Eduardo Urbina 500017 66.000"
   → 0262646203 = Nº DCTO (código largo)
   → 500017     = Nº DCTO (código, NO tiene puntos de miles → descartado)
   → 66.000     = ABONO (el dinero ENTRA — Edgar Urbina envía $66.000 a la cuenta)
   ⚠️ "Transf. [NOMBRE]" (SIN la palabra "a") = ABONO entrante — el dinero llega DE esa persona
   ⚠️ NUNCA confundir "500017" con un monto: no tiene puntos de miles → es código de referencia
   ⚠️ Puede haber en la misma fecha un ABONO "Transf. Edgar Eduardo Urbina" ($66.000)
      Y un CARGO "Transf a Edgar Eduardo Urbina" ($372.000) — son dos operaciones distintas

  "Traspaso Internet a T. Crédito 580.291"
   → 580.291    = CARGO (traspaso interno al TC)
   ⚠️ INCLUIR SIEMPRE — aunque no sea gasto real, es un movimiento real de la cuenta

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓMO DISTINGUIR CARGO vs ABONO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Una línea tiene CARGO (columna izquierda) si la descripción contiene:
  • "Transf a [persona]", "Traspaso", "PAGO EN LINEA", "COM.MANTENCION", "Transf a khipu"
  → El dinero SALE de la cuenta.

Una línea tiene ABONO (columna derecha) si la descripción contiene:
  • "Transf. COMERCIALIZADORA", "Transf de [persona]", "Transf. de [empresa]"
  → El dinero ENTRA a la cuenta.

Cuando hay DOS números al final de la línea (después de los Nº DCTO):
  → El PRIMERO es el monto (cargo o abono)
  → El SEGUNDO es el SALDO resultante
  → NUNCA sumes ni combines esos dos números

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICACIÓN POR SALDO CORRIENTE (CRÍTICO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El PDF muestra el saldo acumulado después de cada movimiento (columna SALDO).
Usa eso para validar cada monto ANTES de incluirlo:

  cargo:  saldo_anterior - monto = saldo_mostrado
  abono:  saldo_anterior + monto = saldo_mostrado

Ejemplo con la cartola real (sigue la secuencia de saldos):
  02/02 Servipag (CARGO 62.143)  → sin saldo en la línea, es intermedio
  02/02 Traspaso TC 20.416       → saldo visible: 303.164
    → Reconstrucción hacia atrás: saldo_antes_traspaso = 303.164 + 20.416 = 323.580
    → saldo_antes_servipag       = 323.580 + 62.143 = 385.723
    → Si hubieras leído 362.143: 385.723 - 362.143 = 23.580 - 20.416 = 3.164 ≠ 303.164 → INCORRECTO
    → Conclusión: el monto correcto es 62.143 (el "3" era el último dígito del DCTO 295123)

  03/02 Edgar Urbina (CARGO 250.000) → 303.164 - 250.000 = 53.164  (saldo no aparece en la línea, es intermedio)
  03/02 Laura Urbina (CARGO 44.333) → 53.164 - 44.333 = 8.831  ← el PDF muestra 8.831 ✓
    → Si hubieras leído 444.333: 53.164 - 444.333 = -391.169 ≠ 8.831 → INCORRECTO, corrige a 44.333

Cuando varios movimientos consecutivos no muestran saldo intermedio, trabaja hacia atrás
desde el primer saldo visible para validar cada monto.

Si el saldo resultante no coincide con la aritmética, el monto está MAL LEÍDO.
Revisa si incluiste dígitos del Nº DCTO adyacente. Usa SOLO los dígitos con punto de miles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICACIÓN OBLIGATORIA CONTRA RESUMEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Al final de la cartola hay "INFORMACION DE CUENTA CORRIENTE" con totales exactos:
  SALDO INICIAL | DEPOSITOS | OTROS ABONOS | CHEQUES | OTROS CARGOS | IMPUESTOS | SALDO FINAL

Usa esos valores para verificar tu extracción:
  • Suma de todos tus ABONOS debe = OTROS ABONOS del resumen
  • Suma de todos tus CARGOS debe = OTROS CARGOS del resumen (incluyendo traspasos TC)
  • saldo_inicial = valor SALDO INICIAL del resumen
  • saldo_final   = valor SALDO FINAL del resumen

Si hay diferencia en CARGOS: un monto está mal leído (probablemente fusión con dígito del DCTO).
  Usa la cadena de saldos para encontrar el movimiento erróneo y corregirlo.
  Una diferencia de exactamente N×10^k (ej: 300.000) indica que N dígitos extra del DCTO se pegaron al monto.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE EXTRACCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R0. AUTO-IDENTIFICACIÓN: Si el texto corresponde a un estado de tarjeta de crédito
    (contiene sección "2.PERÍODO ACTUAL", "TOTAL OPERACIONES", "MONTO FACTURADO" o
    similar estructura TC), devuelve source_type: "tc". Si es cartola de cuenta
    corriente (columnas CHEQUES/CARGOS/ABONOS/SALDO, encabezado "CARTOLA"), source_type: "cc".
R1. Extraer ABSOLUTAMENTE TODOS los movimientos de "DETALLE DE MOVIMIENTOS".
    Incluye traspasos a TC, comisiones, y montos pequeños como 912.
R1b. IDENTIFICACIÓN DE MONTO — regla de oro:
    El monto es SIEMPRE un número con este patrón: [dígitos].[3 dígitos] (ej: 44.333, 580.291, 1.449.274).
    Los Nº DCTO (4-9 dígitos SIN punto de miles) NUNCA forman parte del monto.
    El Nº DCTO termina donde empieza el espacio antes del monto — sus dígitos finales NO se pegan al monto.

    Ejemplos CRÍTICOS de separación DCTO → monto:
      "442567 44.333"  → DCTO=442567,  monto=44.333   (NUNCA 444.333)
      "295123 62.143"  → DCTO=295123,  monto=62.143   (NUNCA 362.143 — el "3" final del DCTO NO es prefijo del monto)
      "600133 100.000" → DCTO=600133,  monto=100.000  (NUNCA 3100.000)
      "500017 66.000"  → DCTO=500017,  monto=66.000   (NUNCA 766.000)

    ⚠️ PELIGRO FRECUENTE: si el DCTO termina en dígito Y el monto empieza con dígito parecido,
       la IA puede fusionarlos. Siempre separa en el ESPACIO — el monto arranca después del espacio.

    Verifica usando saldo: saldo_previo - monto_cargo = saldo_siguiente (ver sección VERIFICACIÓN POR SALDO).
R2. NO duplicar movimientos del "Resumen de Comisiones" — son los mismos del detalle.
R3. Usar el AÑO del encabezado para completar fechas: DD/MM → DD/MM/YYYY.
R4. Si en la misma fecha hay un ABONO y un CARGO con el mismo monto numérico,
    son dos transacciones distintas — extrae AMBAS.
    Ejemplo: 04/02 hay Comercializadora ABONO 100.000 y también Edgar Urbina CARGO 100.000 → 2 filas.
R5. "Traspaso Internet a T. Crédito": tipo="traspaso_tc", categoria="traspaso_tc".
    SIEMPRE incluirlo aunque no sea gasto real — es un movimiento real de la cuenta.
R6. Comisiones de mantención: categoria="cargos_banco".
R7. Pagos Servipag, pagos en línea: categoria="pago_servicios".
R8. Transferencias recibidas: tipo="abono", categoria="transferencia_recibida".
R9. Transferencias enviadas a personas: tipo="cargo", categoria="transferencia_enviada".
R9b. Auto-transferencias (ahorro): SOLO aplica a "Transf a [NOMBRE]" (cargo saliente, CON "a").
     Si el nombre del receptor en "Transf a ..." coincide con el titular del PDF
     (ej: "Transf a Edgar Eduardo Urbina" cuando el titular es "URBINA TARAZONA EDGAR EDUARDO"),
     usar tipo="cargo", categoria="ahorro".
     El titular aparece al inicio del PDF en la línea con su nombre en mayúsculas junto al número de cuenta.
     ⚠️ "Transf. [NOMBRE]" (SIN "a", con punto) = ABONO entrante — NO es auto-transferencia.
        Ejemplo: "Transf. Edgar Eduardo Urbina 500017 66.000" → ABONO $66.000, 500017 = Nº DCTO.
     ⚠️ Es perfectamente posible que en la misma fecha existan AMBAS:
        un ABONO "Transf. Edgar Eduardo Urbina $66.000" Y un CARGO "Transf a Edgar Eduardo Urbina $372.000".
        Son dos transacciones completamente distintas — extrae las DOS.
R10. Normaliza nombres (MAYÚSCULAS → capitalización, sin Nº de código):
     "0779537005 Transf. COMERCIALIZADORA 600133" → "Transf. Comercializadora"
     "0262646203 Transf a Edgar Eduardo Urbina"   → "Transf. a Edgar Eduardo Urbina"
     "0264637473 Transf a LAURA VIRGINIA URBI"    → "Transf. a Laura Virginia Urbi"
     "PAGO EN LINEA SERVIPAG"                     → "Pago Servipag"
     "COM.MANTENCION PLAN"                        → "Comisión Mantención Plan"
     "Transf a Khipu CLBS E"                      → "Pago Khipu"
     "0198309303 Transf de CONSTANZA ANDREA"      → "Transf. de Constanza Andrea"
R11. saldo_inicial y saldo_final desde "INFORMACION DE CUENTA CORRIENTE" al pie de la cartola.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓMO ENCONTRAR EL PERÍODO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Busca en el encabezado de la cartola los campos "CARTOLA DESDE ... HASTA ...":
  "CARTOLA 73 30/01/2026 27/02/2026"
  → periodo_desde: "30/01/2026", periodo_hasta: "27/02/2026"
  → El mes del período es el mes de periodo_hasta → Febrero 2026
  → periodo: "Febrero 2026"

También puede aparecer como:
  "PERÍODO DEL 01/02/2026 AL 28/02/2026" → periodo: "Febrero 2026"
  "CARTOLA CUENTA CORRIENTE — FEBRERO 2026" → periodo: "Febrero 2026"

Devuelve SIEMPRE:
  → periodo: "NombreMes YYYY"   (ej: "Febrero 2026")
  → periodo_desde: "DD/MM/YYYY"
  → periodo_hasta: "DD/MM/YYYY"
⚠️ NUNCA devuelvas "Mes YYYY" literal — es el formato de ejemplo, no el valor real.
⚠️ Si no encuentras el mes explícito, deja periodo: "" (vacío).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORÍAS PARA CUENTA CORRIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- transferencia_recibida: depósitos y transferencias entrantes (abonos)
- transferencia_enviada: transferencias enviadas a terceros (personas o empresas distintas al titular)
- pago_servicios: pagos Servipag, pagos en línea, PAC, PAT, servicios
- traspaso_tc: traspasos a tarjeta de crédito del mismo banco
- ahorro: transferencias enviadas al MISMO titular de la cuenta (auto-transferencias a cuenta de ahorro propia)
- cargos_banco: comisiones de mantención, cargos bancarios
- otros: movimientos que no encajen en las anteriores

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA (JSON EXACTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRÍTICO — FORMATO DE MONTOS EN JSON:
   Todos los valores numéricos monetarios (monto, saldo_inicial, saldo_final)
   deben ser NÚMEROS ENTEROS sin puntos ni comas.
   CORRECTO:   "monto": 1525025
   INCORRECTO: "monto": "1.525.025"   ← string con puntos
   INCORRECTO: "monto": 1525.025      ← punto decimal
   El valor 1.525.025 pesos chilenos se escribe como el entero 1525025.
Responde ÚNICAMENTE con este JSON, sin markdown ni texto adicional:
{
  "razonamiento": "Movimientos encontrados: X cargos, Y abonos. Suma cargos: $Z (resumen dice $A → coincide/difiere). Suma abonos: $W (resumen dice $B → coincide/difiere). Diferencias detectadas: [lista o 'ninguna'].",
  "periodo": "Febrero 2026",
  "periodo_desde": "30/01/2026",
  "periodo_hasta": "27/02/2026",
  "saldo_inicial": 1404,
  "saldo_final": 1801,
  "source_type": "cc",
  "transacciones": [
    {
      "fecha": "DD/MM/YYYY",
      "descripcion": "Nombre del movimiento",
      "monto": 0,
      "tipo": "cargo",
      "categoria": "pago_servicios",
      "es_cuota": false,
      "cuota_actual": null,
      "total_cuotas": null
    }
  ],
  "cuotas_vigentes": []
}`;

// Categorías válidas (TC + CC combinadas)
const VALID_CATS_CC = [
    'transferencia_recibida', 'transferencia_enviada', 'pago_servicios',
    'traspaso_tc', 'cargos_banco', 'ahorro', 'otros',
];

const BANK_HINTS = {
    santander_tc: 'Santander Chile tarjeta de crédito. Fecha en formato DD-MM-YYYY. Los cargos aparecen en la columna "Cargos".',
    santander_cc: 'Santander Chile cuenta corriente (cartola). Columnas: FECHA, SUCURSAL, DESCRIPCIÓN, Nº DCTO, CHEQUES Y OTROS CARGOS, DEPÓSITOS Y OTROS ABONOS, SALDO.',
    bci_tc: 'BCI tarjeta de crédito. Los montos en la columna "Monto" con signo positivo son cargos.',
    chile_tc: 'Banco de Chile tarjeta de crédito. Columna "Cargo" contiene los gastos.',
    bci_cc: 'BCI cuenta corriente. Los cargos son los débitos de la cuenta.',
    otro: 'Estado de cuenta bancario chileno genérico.',
};

const VALID_MONTHS_RE = /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}$/i;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function derivePeriodo(rawPeriodo, rawDesde, rawHasta) {
    // 1. Try the value the AI returned directly
    if (VALID_MONTHS_RE.test((rawPeriodo || '').trim())) return rawPeriodo.trim();
    // 2. Fallback: prefer periodo_hasta (fecha de cierre) — los bancos nombran el
    //    extracto por el mes en que cierra el período, no por el de inicio.
    for (const raw of [rawHasta, rawDesde]) {
        if (DATE_RE.test(raw)) {
            const [, m, y] = raw.split('/').map(Number);
            if (m >= 1 && m <= 12 && y >= 2020 && y <= 2099) return `${MONTH_NAMES_ES[m - 1]} ${y}`;
        }
    }
    return 'Desconocido';
}

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

// ── Normalización (exportada para tests) ─────────────────────────────────────
export function normalizeAIResponse(data) {
    const isCC = data.source_type === 'cc';
    const validCats = isCC ? VALID_CATS_CC : VALID_CATS;
    const rawPeriodo = data.periodo || '';
    const rawDesde = data.periodo_desde || '';
    const rawHasta = data.periodo_hasta || '';
    return {
        id: `month_${Date.now()}`,
        periodo: derivePeriodo(rawPeriodo, rawDesde, rawHasta),
        periodo_desde: DATE_RE.test(rawDesde) ? rawDesde : '',
        periodo_hasta: DATE_RE.test(rawHasta) ? rawHasta : '',
        total_operaciones: parseChileanAmount(data.total_operaciones),
        total_facturado: parseChileanAmount(data.total_facturado),
        // CC-specific fields (optional, won't affect TC)
        source_type: data.source_type || 'tc',
        saldo_inicial: data.saldo_inicial != null ? parseChileanAmount(data.saldo_inicial) : null,
        saldo_final: data.saldo_final != null ? parseChileanAmount(data.saldo_final) : null,
        transacciones: (data.transacciones || []).map((t, i) => ({
            id: `tx_${i + 1}`,
            fecha: t.fecha,
            descripcion: t.descripcion,
            monto: Math.abs(parseChileanAmount(t.monto)),
            tipo: t.tipo || 'cargo',
            categoria: validCats.includes(t.categoria) ? t.categoria : 'otros',
            es_cuota: Boolean(t.es_cuota),
            cuota_actual: t.cuota_actual != null ? Number(t.cuota_actual) : null,
            total_cuotas: t.total_cuotas != null ? Number(t.total_cuotas) : null,
        })),
        cuotas_vigentes: (data.cuotas_vigentes || []).map(c => ({
            descripcion: c.descripcion,
            cuota_actual: Number(c.cuota_actual),
            total_cuotas: Number(c.total_cuotas),
            monto_cuota: parseChileanAmount(c.monto_cuota)
        }))
    };
}

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

export default async function handler(req, res) {
    // CORS — restricted to known origins
    const origin = req.headers?.origin;
    const corsOrigin = getCorsOrigin(origin);
    if (corsOrigin) {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') return res.status(corsOrigin ? 200 : 403).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Check API Key
    if (!process.env.OPENAI_API_KEY) {
        console.error('[process-pdf] MISSING OPENAI_API_KEY');
        return res.status(500).json({ error: 'Falta la API Key de OpenAI en Vercel.' });
    }

    // Auth — verify Supabase JWT (fail-closed: block if env vars missing)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error('[process-pdf] MISSING SUPABASE_URL or SUPABASE_ANON_KEY — auth cannot proceed');
        return res.status(503).json({ error: 'Configuración de autenticación incompleta.' });
    }

    const authHeader = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticación requerido.' });
    }
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (error || !data?.user) {
            console.error('[process-pdf] Auth failed:', error?.message);
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }
        console.log(`[process-pdf] Authenticated user: ${data.user.id}`);
    } catch (authErr) {
        console.error('[process-pdf] Auth error:', authErr);
        return res.status(401).json({ error: 'Error verificando autenticación.' });
    }

    try {
        const { pdfBase64, bank = 'santander_tc' } = req.body;
        if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 es requerido' });

        // Validate payload size
        if (pdfBase64.length > MAX_PAYLOAD_BYTES) {
            return res.status(413).json({ error: 'El PDF es demasiado grande. Máximo ~7.5MB.' });
        }

        console.log('[process-pdf] Iniciando extraccion de PDF (v1.1.1)...');

        // 1. Extract text from PDF
        const buffer = Buffer.from(pdfBase64, 'base64');

        let pdfText = '';
        try {
            const data = await pdf(buffer);
            pdfText = data.text;
            console.log(`[process-pdf] Texto extraído (${pdfText?.length || 0} caracteres)`);
        } catch (error) {
            console.error('[process-pdf] Error en pdf-parse:', error);
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected')) {
                return res.status(422).json({ error: 'PDF_ENCRYPTED' });
            }
            throw new Error(`Error al leer el PDF: ${error.message}`);
        }

        if (!pdfText || pdfText.trim().length < 50) {
            return res.status(422).json({ error: 'No se pudo extraer suficiente texto del PDF. Verifica que no sea una imagen escaneada.' });
        }

        // 2. Parser determinístico (Santander TC/CC) — fallback a IA si falla
        const USE_DETERMINISTIC = process.env.USE_DETERMINISTIC_PARSER !== 'false';
        if (USE_DETERMINISTIC && (bank === 'santander_tc' || bank === 'santander_cc')) {
            try {
                const parser = bank === 'santander_tc' ? parseSantanderTC : parseSantanderCC;
                const parsed = parser(pdfText);
                if (!parsed.transacciones?.length) throw new Error('PARSER_EMPTY_RESULT');
                const output = normalizeAIResponse(parsed);
                console.log(`[process-pdf] Parser determinístico OK: ${output.transacciones.length} transacciones`);
                return res.status(200).json(output);
            } catch (err) {
                console.warn('[process-pdf] Parser determinístico falló, usando IA:', err.message);
                // Fall through to OpenAI
            }
        }

        // 3. Call OpenAI — route to correct prompt based on bank type
        const isCC = bank === 'santander_cc';
        const systemPrompt = isCC ? SYSTEM_PROMPT_CC : SYSTEM_PROMPT;
        console.log(`[process-pdf] Llamando a OpenAI (${isCC ? 'cuenta corriente' : 'tarjeta crédito'})...`);
        const bankHint = BANK_HINTS[bank] || BANK_HINTS.otro;
        const userMsg = `Banco/Producto: ${bankHint}\n\nTexto del estado de cuenta:\n\n${pdfText}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMsg },
            ],
            response_format: { type: "json_object" }, // Simple JSON mode for reliability
            temperature: 0,
        });

        const msg = completion.choices[0];
        const content = msg?.message?.content;

        if (!content) throw new Error('OpenAI no devolvió respuesta');

        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            console.error('[process-pdf] JSON Error:', content);
            throw new Error('La IA no devolvió un formato válido');
        }

        // 3. Normalize for frontend
        const output = normalizeAIResponse(data);

        // Detectar mismatch en ambas direcciones
        if (data.source_type === 'cc' && !isCC) {
            console.warn('[process-pdf] MISMATCH: PDF es CC pero cuenta seleccionada es TC');
            return res.status(422).json({
                error: 'ACCOUNT_TYPE_MISMATCH',
                detected: 'cc',
                message: 'Este PDF es una cartola de cuenta corriente.',
            });
        }
        if (data.source_type === 'tc' && isCC) {
            console.warn('[process-pdf] MISMATCH: PDF es TC pero cuenta seleccionada es CC');
            return res.status(422).json({
                error: 'ACCOUNT_TYPE_MISMATCH',
                detected: 'tc',
                message: 'Este PDF es un estado de tarjeta de crédito.',
            });
        }

        // Log razonamiento para diagnóstico de diferencias
        if (data.razonamiento) {
            console.log('[process-pdf] RAZONAMIENTO IA:', data.razonamiento);
        }
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
        } else {
            // TC logging (unchanged)
            const sumSinBanco = output.transacciones
                .filter(t => t.tipo === 'cargo' && t.categoria !== 'cargos_banco')
                .reduce((s, t) => s + t.monto, 0);
            console.log(`[process-pdf] total_operaciones PDF: ${output.total_operaciones} | suma extraída (sin banco): ${sumSinBanco} | diff: ${output.total_operaciones - sumSinBanco}`);
            const txsSinBanco = output.transacciones.filter(t => t.tipo === 'cargo' && t.categoria !== 'cargos_banco');
            console.log('[process-pdf] TRANSACCIONES (sin banco):', JSON.stringify(txsSinBanco.map(t => ({ d: t.descripcion, m: t.monto }))));
            const txsBanco = output.transacciones.filter(t => t.categoria === 'cargos_banco');
            console.log('[process-pdf] CARGOS BANCO:', JSON.stringify(txsBanco.map(t => ({ d: t.descripcion, m: t.monto }))));
        }

        return res.status(200).json(output);

    } catch (err) {
        console.error('[process-pdf] ERROR FATAL:', err);
        return res.status(500).json({ error: err.message || 'Error interno del servidor al procesar el PDF' });
    }
};
