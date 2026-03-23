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
Cada línea del PDF tiene este orden de campos:
[LUGAR] [FECHA DD/MM/YY] [NOMBRE COMERCIO] [TIPO_CUOTA?] [INTERÉS%?] [MONTO_ORIGEN?] [MONTO_TOTAL?] [NºCUOTA?] [CARGO_MES]

Los TIPOS DE CUOTA son palabras clave que aparecen DESPUÉS del nombre del comercio:
  • N/CUOTAS PRECIO
  • CUOTA FIJA
  • TRES CUOTAS PREC
  • DOS CUOTAS PRECI
  • DOS CUOTAS PREC
  • CUOTA COMERCIO
  • 03 CUOTAS COMERC
  • NN CUOTAS (cualquier número seguido de CUOTAS)
  • COMPRAS P.A.T.

⚠️ CRÍTICO: Estas palabras son el TIPO DE PAGO, NO el nombre del comercio.
   El nombre del comercio es TODO LO QUE ESTÁ ANTES de esas palabras clave.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLOS REALES — FORMATO SANTANDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Línea PDF → Cómo extraer:

"31/10/25 H&M VIVO GALERIA IMPERIO CUOTA FIJA 3,06 % $ 35.950 $ 39.797 03/03 $13.265"
→ descripcion: "H&M Vivo Galería Imperio"   (todo ANTES de "CUOTA FIJA")
→ tipo_cuota: "CUOTA FIJA", cuota_actual: 3, total_cuotas: 3, monto_cuota: 13265

"12/11/25 JYOTIS CUOTA FIJA 3,06 % $ 71.762 $ 78.687 03/03 $26.229"
→ descripcion: "Jyotis"                     (todo ANTES de "CUOTA FIJA")
→ tipo_cuota: "CUOTA FIJA", cuota_actual: 3, total_cuotas: 3, monto_cuota: 26229

"08/12/25 MERCADOPAGO*REEBOKCHILE CUOTA COMERCIO 0,00 % $ 83.288 $ 83.288 02/03 $27.763"
→ descripcion: "MercadoPago*ReebokChile"    (todo ANTES de "CUOTA COMERCIO")
→ tipo_cuota: "CUOTA COMERCIO", cuota_actual: 2, total_cuotas: 3, monto_cuota: 27763

"07/02/26 CANNON VIVO IMPERIO TRES CUOTAS PREC 0,00 % $ 28.990 $ 28.990 01/03 $9.663"
→ descripcion: "Cannon Vivo Imperio"        (todo ANTES de "TRES CUOTAS PREC")
→ tipo_cuota: "TRES CUOTAS PREC", cuota_actual: 1, total_cuotas: 3, monto_cuota: 9663

"24/02/26 CLUB ANIMAL SPA DOS CUOTAS PRECI 0,00 % $ 66.810 $ 66.810 01/02 $33.405"
→ descripcion: "Club Animal SPA"            (todo ANTES de "DOS CUOTAS PRECI")
→ tipo_cuota: "DOS CUOTAS PRECI", cuota_actual: 1, total_cuotas: 2, monto_cuota: 33405

"07/02/26 H&M VIVO GALERIA IMPERIO 03 CUOTAS COMERC 0,00 % $ 53.950 $ 53.950 00/03 $17.983"
→ descripcion: "H&M Vivo Galería Imperio"   (todo ANTES de "03 CUOTAS COMERC")
→ cuota_actual: 0 → NO va en transacciones, SÍ va en cuotas_vigentes

"01/01/26 MP *MERCADO LIBRE N/CUOTAS PRECIO 0,00 % $ 100.606 $ 100.606 02/12 $8.384"
→ descripcion: "MP *Mercado Libre"          (todo ANTES de "N/CUOTAS PRECIO")
→ tipo_cuota: "N/CUOTAS PRECIO", cuota_actual: 2, total_cuotas: 12, monto_cuota: 8384

"SANTIAGO 30/01/26 MERPAGO*JETSMARTAIRLINESS $295.667"
→ descripcion: "MercadoPago*JetSmart Airlines"  (sin tipo de cuota → compra normal)
→ monto: 295667, categoria: transporte

"LAS CONDES 24/02/26 HELP.HBOMAX.COM HEL COMPRAS P.A.T. $4.795"
→ descripcion: "HBO Max"                    (todo ANTES de "COMPRAS P.A.T.")
→ monto: 4795, categoria: telefonia_internet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE EXTRACCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R1. SOLO PERÍODO ACTUAL ("2.PERÍODO ACTUAL"): Ignora completamente la sección "1.PERÍODO ANTERIOR".
R2. NO incluyas la línea "MONTO CANCELADO" (es un pago/abono, no un gasto).
R3. MONEDA EXTRANJERA: Usa SIEMPRE el valor en pesos chilenos (la última columna CARGO DEL MES, ej: $9.585), nunca el monto en AR o USD.
R4. CUOTA 00/NN: cuota_actual=0 significa que este mes NO se cobra. NO va en 'transacciones'. SÍ va en 'cuotas_vigentes'.
R5. CUOTA 01/NN o mayor: SÍ se cobra este mes. Va en 'transacciones' (monto = VALOR CUOTA MENSUAL) Y en 'cuotas_vigentes'.
R6. SÍ incluye "3. CARGOS, COMISIONES, IMPUESTOS Y ABONOS" como categoría 'cargos_banco'.
R7. TOTAL OPERACIONES: La suma de todos los montos en 'transacciones' DEBE igualar exactamente el número en "1. TOTAL OPERACIONES" del PDF.
R8. El "MONTO TOTAL FACTURADO A PAGAR" va en 'total_facturado'. Es distinto al TOTAL OPERACIONES (incluye cuotas prev. + cargos).
R9. Normaliza nombres: capitaliza correctamente (ej: "JUMBO PENALOLEN" → "Jumbo Peñalolen"), expande abreviaciones conocidas (MERPAGO* → MercadoPago*, PAYU*AR*UBER → Uber Argentina).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORÍAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- supermercado: Jumbo, Lider, Ekono, Santa Isabel, Supervecino, Unimarc
- minimarket: Minimarket (cualquiera), AMAWA, TD05 58 MARKET, Distribuidora
- delivery: Uber Eats, PedidosYa, Rappi, KFC, Dominos
- transporte: Uber Trip, Cabify, JetSmart, LATAM, aerolíneas, MERPAGO*BIPQR (bip!), BIP
- mascotas: Club Animal, Bonne Sante, veterinaria, MAXIK
- lavanderia: Spinokmp, MERPAGO*SPINOKMP
- ropa_moda: H&M, Zara, Falabella, Ripley, Jyotis, San Diego Ltda, Rosarito, Reebok, TRICOT
- restaurantes: restaurante, café, DKF Lira, La Dorita, 2 Animales, Man Ji, Italian Imper, Albert Milan Flores, María Almiron
- entretenimiento: Cinemark, Cineplanet, Cinepolis, Fantasilandia, Ticketplus, Netflix, Spotify, WPAY PLUS
- servicios_hogar: agua, luz, gas, Enel, Metrogas, Aguas Andinas, gastos comunes, seguros
- telefonia_internet: Entel, Movistar, WOM, Claro, VTR, HBO Max, Google Play, Streaming, HELP.HBOMAX
- cuotas: compras en cuotas (CUOTA FIJA, N/CUOTAS PRECIO, etc.) cuando cuota_actual >= 1
- cargos_banco: COMISION TC, IMPTO DECRETO LEY, IVA USO INTERNACIONAL, SERVICIO COMPRA INTERNACIONAL
- otros: todo lo que no encaje arriba (incluyendo Nuitee/hoteles, comercios varios)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA (JSON EXACTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responde ÚNICAMENTE con este JSON, sin markdown ni texto adicional:
{
  "razonamiento": "TOTAL OPERACIONES leído del PDF: X. MONTO FACTURADO leído: Y. Suma de mis transacciones: Z. Coincide con TOTAL OPERACIONES: sí/no. Cuotas con cuota_actual=0 excluidas de transacciones: [lista].",
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
