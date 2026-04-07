# Journey Into Finanzas APP

*Reporte histórico generado el 23 de marzo de 2026 — Análisis completo del desarrollo*

---

## 1. Génesis del Proyecto

Era una tarde de otoño en Chile cuando Edgar abrió su terminal con una pregunta concreta: ¿puede esta aplicación leer estados de cuenta bancarios en PDF? La sesión S1 (3:28p) marcó el punto de partida formal de lo que se convertiría en una tarde intensa de ingeniería, debugging y aprendizaje acelerado.

El contexto es importante para entender la magnitud del logro. Edgar es un desarrollador de nivel intermedio, con raíces sólidas en WordPress y SEO, que está transitando hacia el mundo del desarrollo web moderno con React, Vite y TypeScript. La Finanzas APP no es un proyecto académico ni un tutorial: es una herramienta personal real para procesar sus propios estados de cuenta del Banco Santander Chile, categorizarlos y visualizarlos en un dashboard financiero.

La pregunta inicial de S1 era exploratoria, pero S2 (también a las 3:28p) reveló inmediatamente que el problema era más específico y más profundo: la confusión entre nombres de comercios y palabras clave de tipo de pago en la extracción de datos. En menos de un minuto de diferencia entre sesiones, el proyecto había pasado de la curiosidad general a identificar un bug concreto.

La observación #1 (3:36p) documentó el hallazgo fundamental: el sistema era capaz de procesar PDFs bancarios chilenos, pero la arquitectura de los estados de cuenta de Santander Chile presenta una complejidad que pocos desarrolladores anticiparían. No es un PDF simple con una lista de transacciones. Es un documento con dos períodos (PERÍODO ANTERIOR y PERÍODO ACTUAL), dos tipos de transacciones (TIPO A para cuotas con fechas históricas, TIPO B para compras normales), y múltiples líneas de TOTAL OPERACIONES que aparecen en posiciones engañosas dentro del texto extraído.

---

## 2. Evolución Arquitectural

La arquitectura de Finanzas APP refleja decisiones pragmáticas tomadas por un desarrollador que entiende sus propias limitaciones de presupuesto y tiempo. El stack elegido es React 19 + Vite en el frontend, funciones serverless de Vercel en el backend, Supabase para la base de datos y autenticación, y OpenAI GPT-4o para la inteligencia de extracción.

No hay servidor dedicado. No hay base de datos propia que mantener. No hay modelo de ML personalizado que entrenar. La observación #2 (3:37p) registra una de las primeras decisiones arquitecturales importantes del día: mejorar el prompt del sistema enviado a OpenAI para guiar la extracción. Esta es arquitectura declarativa aplicada a la inteligencia artificial: en lugar de escribir código para parsear PDFs manualmente (frágil, costoso de mantener), se le delega la comprensión semántica al modelo de lenguaje.

Casi simultáneamente, la observación #3 documentó una decisión de peso: el upgrade del modelo de GPT-4o-mini a GPT-4o. Esta no es una decisión trivial, implica un costo de API significativamente mayor por consulta, pero refleja un razonamiento claro: la precisión de la extracción es el corazón del producto. Un error en la extracción corrompe todos los datos downstream.

La observación #4 (3:38p) completó el primer ciclo arquitectural del día: agregar metadatos de cuotas a la respuesta de transacciones. Aquí se ve la arquitectura expandiéndose orgánicamente, no por un plan maestro previo, sino por el entendimiento progresivo de qué datos necesita realmente el sistema.

El archivo app/api/process-pdf.js emerge como el núcleo del sistema: recibe el PDF, usa pdf-parse para extraer el texto crudo, construye un prompt detallado, llama a OpenAI GPT-4o en modo JSON estructurado, y devuelve las transacciones al frontend. La observación #20 (4:18p) reveló un detalle elegante: el componente de Upload usa el operador spread para preservar todos los campos del API response, lo que significa que agregar campos nuevos al backend no requiere cambios en el frontend.

---

## 3. Momentos Clave

El primer momento clave genuino del día ocurrió alrededor de las 4:02p, con las observaciones #5, #6 y #7. Edgar identificó que el prompt de extracción tenía un bug conceptual profundo: las transacciones de tipo TIPO A (cuotas de compras anteriores) aparecen en el período actual del estado de cuenta pero con fechas de agosto a diciembre. El sistema de IA, al ver una fecha de agosto en un documento de marzo, tomaba la decisión "lógica" de excluir esa transacción del período actual.

Pero esa lógica era incorrecta. En la realidad del formato Santander Chile, una cuota de una compra de agosto que se cobra en marzo es perfectamente válida y debe incluirse. El sistema estaba ignorando dinero real.

La solución en #5-#7 fue elegante: en lugar de escribir código para detectar este patrón, se expandió el prompt con documentación explícita del formato TIPO A/B, ejemplos de notación de cuotas, y reglas de extracción R1-R10 con verificación mandatoria. El campo "reasoning" agregado al esquema JSON fue particularmente astuto: obliga al modelo a articular su propio proceso de pensamiento, lo que hace los errores más detectables.

El segundo momento clave llegó con las observaciones #15-#19 (4:15p-4:18p). El sistema extraía $1,154,840 como total mensual, pero el PDF mostraba claramente $1,273,912. Una diferencia de $119,072 pesos chilenos.

La investigación reveló algo no obvio: los estados de cuenta de Santander Chile contienen dos líneas "TOTAL OPERACIONES" en el texto extraído. La primera corresponde al PERÍODO ANTERIOR. La segunda al PERÍODO ACTUAL. El modelo de lenguaje, sin instrucciones específicas, tomaba la primera que encontraba, que resultaba ser el valor del período anterior.

Este tipo de bug es particularmente difícil porque no produce un error técnico. El sistema funciona perfectamente. Solo alguien que compara manualmente el resultado con el documento físico puede detectarlo.

---

## 4. Patrones de Trabajo

Analizando el timeline completo, emerge un patrón claro: las sesiones son cortas e intencionales. Las 7 sesiones del día cubrieron aproximadamente 52 minutos de trabajo efectivo (3:28p a 4:20p), con cada sesión llegando con un objetivo concreto y saliendo con un resultado medible.

El patrón más notable es la alternancia entre descubrimiento y acción. Cada observación de discovery es seguida rápidamente por changes concretos. No hay sesiones de análisis puro que no lleven a código.

También es notable la frecuencia de los commits y pushes. Las observaciones #8-#9 (4:04p) y #25-#26 (4:19p) muestran que Edgar hace commit y push múltiples veces por tarde. Los cambios no se acumulan en el workspace local hasta el final del día. Cada feature que funciona va a producción.

El patrón de sesiones refleja cómo Edgar trabaja con herramientas de IA: llega con contexto rico y objetivos específicos, no con preguntas vagas. S4 (3:52p) es un ejemplo perfecto: "Mejorar el prompt de extracción PDF para Santander Chile para corregir transacciones de cuotas faltantes". Esa especificidad acelera dramáticamente la velocidad de resolución.

---

## 5. Deuda Técnica

La deuda técnica del proyecto es visible pero manejada conscientemente. El ejemplo más claro es la gestión del prompt de OpenAI en process-pdf.js. Un prompt que comenzó siendo general creció durante el día hasta incluir reglas R1-R10, documentación del formato TIPO A/B, ejemplos de normalización de comercios, y mapeos de categorías expandidos.

Esto funciona, pero crea un archivo de API que concentra demasiada responsabilidad. El prompt es esencialmente documentación de dominio bancario embebida en código de producción. Su longitud creciente eventualmente impactará los costos de tokens del API.

El campo total_facturado merece mención especial: el commit bbed2b2 ("remove total_facturado from db payload to prevent schema cache crash") revela un momento donde la velocidad de desarrollo creó una incompatibilidad con el schema de Supabase. La solución fue remover el campo, resolviendo el crash pero potencialmente dejando un gap en los datos almacenados.

---

## 6. Desafíos y Sagas de Debugging

La saga más compleja del día, capturada en las observaciones #15-#24, ilustra una clase de problema endémica al desarrollo con LLMs: el bug semántico silencioso.

El problema del TOTAL OPERACIONES duplicado no tenía síntomas obvios. No había stack trace. No había error 500. El sistema procesaba el PDF, devolvía JSON válido, mostraba el resultado en el dashboard. La única señal era una discrepancia numérica.

La investigación (observación #16, 4:15p) requirió entender la estructura interna del PDF de Santander Chile a nivel textual: cómo pdf-parse lineariza el documento, en qué orden aparecen las secciones, y cómo GPT-4o procesa texto lineal cuando hay ambigüedad en la instrucción.

La solución tuvo tres componentes: (1) actualizar la Regla R7 del prompt para especificar que el valor correcto es el de "2.PERÍODO ACTUAL", (2) agregar el campo total_operaciones al esquema JSON para hacer el valor extraído auditable, y (3) implementar validación en el frontend que muestra una advertencia visual con ícono AlertCircle en ámbar cuando hay discrepancia mayor a $100 (observaciones #21-#23).

La decisión de validar en el frontend además de mejorar el prompt es arquitecturalmente madura. Los prompts son probabilísticos. Un prompt mejorado reduce la probabilidad de error pero no la elimina. La capa de validación convierte un error silencioso en una advertencia visible.

---

## 7. Memoria y Continuidad

El sistema de memoria persistente jugó un rol arquitectural en esta tarde de trabajo. Las 7 sesiones se desarrollaron en menos de una hora, pero cada una llegó con contexto completo del estado anterior. Las observaciones acumuladas (#1-#26) funcionaron como un log de decisiones que eliminó la necesidad de re-explicar el contexto en cada sesión.

Las sesiones S6 y S7 son el ejemplo más claro: S7 (4:20p) inicia con el problema exacto cuantificado ("$1,154,840 extraído vs $1,273,912 en el PDF"), lo que significa que la memoria preservó no solo el hecho de que había un bug, sino la evidencia numérica específica. Sin ese contexto persistente, S7 habría necesitado varios minutos solo para reconstruir el estado del problema.

Las 11,152 tokens leídas del sistema de memoria frente a las ~173,765 tokens de trabajo de discovery representan la eficiencia real del sistema: el contexto comprimido permite hacer preguntas específicas que generan respuestas de alta densidad informacional.

---

## 8. Economía de Tokens y ROI

| Métrica | Valor |
|---|---|
| Observaciones totales | 26 |
| Sesiones | 7 |
| Tokens leídos (memoria) | ~11,152 |
| Tokens de trabajo (discovery) | ~173,765 |
| Ratio de ahorro | ~94% |
| Promedio tokens leídos / observación | ~430 |
| Promedio tokens discovery / observación | ~6,683 |
| Multiplicador discovery/read | ~15.6x |

Por cada token que el sistema leyó del almacenamiento de memoria, generó 15.6 tokens de trabajo útil. Para un desarrollador que trabaja en un proyecto personal fuera de horario laboral, esta economía tiene implicaciones directas en el costo mensual y en la velocidad de desarrollo sostenible.

| Período | Sesiones | Observaciones | Tokens Discovery | Ahorro estimado |
|---|---|---|---|---|
| 2026-03 | 7 | 26 | ~173,765 | ~162,613 tokens (~94%) |

---

## 9. Estadísticas del Timeline

- **Rango de fechas**: 23 de marzo de 2026 (todo en un solo día)
- **Duración efectiva**: ~52 minutos (3:28p a 4:20p)
- **Sesiones**: 7 (promedio: ~7.4 minutos por sesión)
- **Observaciones**: 26 en total
- **Distribución por tipo**: 10 changes, 6 discoveries, 4 features, 3 bugfixes, 7 session goals
- **Commits a producción**: al menos 4
- **Archivos principales tocados**: app/api/process-pdf.js, app/src/pages/Upload.jsx, app/src/styles/components.css
- **Upgrades de modelo LLM**: 1 (GPT-4o-mini a GPT-4o)
- **Features shipped a producción**: 2 mayores
- **Bugs críticos resueltos**: 2

---

## 10. Lecciones y Meta-Observaciones

**Sobre trabajar con LLMs como infraestructura**: Los bugs de prompt son tan reales como los bugs de código. La observación #15 demostró que GPT-4o puede "funcionar correctamente" y producir resultados incorrectos simultáneamente, si el prompt es ambiguo respecto a qué valor extraer cuando hay múltiples candidatos válidos en el texto.

**Sobre la especificidad del dominio**: El formato de los estados de cuenta de Santander Chile no es algo que un modelo general puede manejar correctamente sin documentación explícita. Las 10 reglas de extracción (R1-R10), los ejemplos de TIPO A/B, y la distinción entre PERÍODO ANTERIOR y PERÍODO ACTUAL son conocimiento de dominio que tuvo que ser destilado y codificado en el prompt. Este proceso de destilación es el trabajo real del proyecto, no la ingeniería de la infraestructura.

**Sobre el valor de las capas de validación**: Un prompt mejorado reduce la probabilidad de error pero no la elimina. La capa de validación en el frontend convierte un error silencioso en una advertencia visible, que es dramáticamente mejor desde la perspectiva del usuario.

**Sobre el ritmo de desarrollo sostenible**: 52 minutos de trabajo efectivo distribuidos en 7 sesiones con 4 commits a producción es un ritmo notable. No es velocidad heroica, es consistencia disciplinada. Cada sesión tiene un objetivo, produce un resultado, y cierra limpiamente.

**Sobre la arquitectura como conversación**: La observación más profunda del día es que process-pdf.js es fundamentalmente un archivo de conversación, un prompt disfrazado de código. El sistema funciona porque se le explicó correctamente al modelo qué hacer, no porque el código sea sofisticado. En el desarrollo con LLMs, la claridad de la instrucción es la habilidad técnica más valiosa.

---

*Reporte generado a partir de 26 observaciones comprimidas en claude-mem, representando aproximadamente 173,765 tokens de trabajo de discovery condensados en ~11,152 tokens de memoria legible, una compresión del 94% que hizo posible este análisis narrativo completo.*
