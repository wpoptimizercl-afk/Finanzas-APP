// Vercel serverless function — /api/process-pdf
// Extracts text from PDF using pdf-parse, then calls OpenAI GPT-4o-mini
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import OpenAI from 'openai';

console.log('[API] process-pdf initialized with classic pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Bank-specific prompt builders ────────────────────────────────────
const VALID_CATS = [
    'supermercado', 'minimarket', 'delivery', 'transporte', 'mascotas', 'lavanderia',
    'ropa_moda', 'restaurantes', 'entretenimiento', 'servicios_hogar',
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE EXTRACCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R1. SOLO PERÍODO ACTUAL ("2.PERÍODO ACTUAL"): Ignora la sección "1.PERÍODO ANTERIOR" y sus montos.
    Las cuotas con fechas antiguas (ago/oct/nov/dic del año anterior) que aparecen DENTRO de
    "2.PERÍODO ACTUAL" SÍ deben incluirse — son cobros diferidos del período actual.
R2. OMITIR: La línea "MONTO CANCELADO" (es un pago/abono, no un gasto). También omitir
    "4. INFORMACION COMPRAS EN CUOTAS EN EL PERIODO" (es información, no una transacción separada).
R3. MONEDA EXTRANJERA: Usa SIEMPRE el valor en pesos chilenos (última columna CARGO DEL MES, ej: $9.585), nunca el monto en AR o USD.
R4. CUOTA 00/NN: cuota_actual=0 → NO va en 'transacciones'. SÍ va en 'cuotas_vigentes'.
R5. CUOTA 01/NN o mayor: SÍ se cobra este mes → va en 'transacciones' (monto = VALOR CUOTA MENSUAL) Y en 'cuotas_vigentes'.
R6. SÍ incluye "3. CARGOS, COMISIONES, IMPUESTOS Y ABONOS" como categoría 'cargos_banco'.
R7. TOTAL OPERACIONES: La suma de todos los montos en 'transacciones' DEBE igualar exactamente "1. TOTAL OPERACIONES" del PDF.
    Si la suma no coincide, revisa si omitiste alguna cuota con fecha antigua de la primera página.
R8. El "MONTO TOTAL FACTURADO A PAGAR" va en 'total_facturado'.
R9. Normaliza nombres (mayúsculas → capitalización normal):
    MERPAGO* → MercadoPago*
    PAYU *UBER TRIP / PAYU*AR*UBER → Uber
    JUMBO PENALOLEN → Jumbo Peñalolén
    EKONO SANTA ISABEL → Ekono Santa Isabel
    LIDER.CL → Lider.cl
    INVERSIONES ITALIAN IMPER → Inversiones Italian Imperio
    SUMUP * BONNE SANTE → Bonne Santé
    MERPAGO*SPINOKMP → MercadoPago*Spinokmp
    MERPAGO*BIPQR → MercadoPago*BIP
    ENTEL ONECLICK → Entel
    HELP.HBOMAX.COM → HBO Max
    NUITEE* → Nuitee
    KM1151 APIES → Apies (tienda de conveniencia)
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
- servicios_hogar: agua, luz, gas, Enel, Metrogas, Aguas Andinas, gastos comunes, seguros, Comercial Home Store
- telefonia_internet: Entel (ENTEL ONECLICK), Movistar, WOM, Claro, VTR, HBO Max (HELP.HBOMAX.COM), Google Play, Streaming
- cuotas: compras en cuotas (CUOTA FIJA, N/CUOTAS PRECIO, etc.) cuando cuota_actual >= 1
- cargos_banco: COMISION TC, IMPTO DECRETO LEY, IVA USO INTERNACIONAL, SERVICIO COMPRA INTERNACIONAL
- otros: hoteles (Nuitee), MercadoPago*Yusbe, MercadoPago*DonaBarbara, MercadoPago*JorgelinaOjeda, MercadoPago*OscarOswaldom, Apies (tienda conveniencia), y todo lo que no encaje arriba

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA (JSON EXACTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responde ÚNICAMENTE con este JSON, sin markdown ni texto adicional:
{
  "razonamiento": "TOTAL OPERACIONES leído: X. Suma de mis transacciones: Z. ¿Coincide?: sí/no. Cuotas de fechas antiguas incluidas (página 1): [lista con fecha y nombre]. Cuotas con cuota_actual=0 excluidas de transacciones: [lista].",
  "periodo": "Mes YYYY",
  "periodo_desde": "DD/MM/YYYY",
  "periodo_hasta": "DD/MM/YYYY",
  "total_facturado": 0,
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

const BANK_HINTS = {
    santander_tc: 'Santander Chile tarjeta de crédito. Fecha en formato DD-MM-YYYY. Los cargos aparecen en la columna "Cargos".',
    bci_tc: 'BCI tarjeta de crédito. Los montos en la columna "Monto" con signo positivo son cargos.',
    chile_tc: 'Banco de Chile tarjeta de crédito. Columna "Cargo" contiene los gastos.',
    bci_cc: 'BCI cuenta corriente. Los cargos son los débitos de la cuenta.',
    otro: 'Estado de cuenta bancario chileno genérico.',
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Check API Key
    if (!process.env.OPENAI_API_KEY) {
        console.error('[process-pdf] MISSING OPENAI_API_KEY');
        return res.status(500).json({ error: 'Falta la API Key de OpenAI en Vercel.' });
    }

    try {
        const { pdfBase64, bank = 'santander_tc' } = req.body;
        if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 es requerido' });

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
            throw new Error(`Error al leer el PDF: ${error.message}`);
        }

        if (!pdfText || pdfText.trim().length < 50) {
            return res.status(422).json({ error: 'No se pudo extraer suficiente texto del PDF. Verifica que no sea una imagen escaneada.' });
        }

        // 2. Call OpenAI
        console.log('[process-pdf] Llamando a OpenAI...');
        const bankHint = BANK_HINTS[bank] || BANK_HINTS.otro;
        const userMsg = `Banco/Producto: ${bankHint}\n\nTexto del estado de cuenta:\n\n${pdfText}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
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
        const output = {
            id: `month_${Date.now()}`,
            periodo: data.periodo || 'Desconocido',
            periodo_desde: data.periodo_desde || '',
            periodo_hasta: data.periodo_hasta || '',
            total_facturado: Number(data.total_facturado) || 0,
            transacciones: (data.transacciones || []).map((t, i) => ({
                id: `tx_${i + 1}`,
                fecha: t.fecha,
                descripcion: t.descripcion,
                monto: Math.abs(Number(t.monto) || 0),
                tipo: t.tipo || 'cargo',
                categoria: VALID_CATS.includes(t.categoria) ? t.categoria : 'otros',
                es_cuota: Boolean(t.es_cuota),
                cuota_actual: t.cuota_actual != null ? Number(t.cuota_actual) : null,
                total_cuotas: t.total_cuotas != null ? Number(t.total_cuotas) : null,
            })),
            cuotas_vigentes: (data.cuotas_vigentes || []).map(c => ({
                descripcion: c.descripcion,
                cuota_actual: Number(c.cuota_actual),
                total_cuotas: Number(c.total_cuotas),
                monto_cuota: Number(c.monto_cuota)
            }))
        };

        return res.status(200).json(output);

    } catch (err) {
        console.error('[process-pdf] ERROR FATAL:', err);
        return res.status(500).json({ error: err.message || 'Error interno del servidor al procesar el PDF' });
    }
};
