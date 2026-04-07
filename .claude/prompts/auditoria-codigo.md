# Auditoría exhaustiva de código — [NOMBRE DEL PROYECTO]

## Contexto
- **Proyecto:** [Nombre o descripción breve del proyecto]
- **Áreas de enfoque:** [Todo el proyecto / Módulo específico / Archivos específicos]
- **Preocupaciones conocidas:** [Bugs reportados, deuda técnica, áreas frágiles, o "ninguna"]
- **Último audit:** [Fecha o "primera vez"]

## Fase 1: Diagnóstico (en paralelo)
Lanza estos agentes en paralelo:
1. **build-error-resolver** — Identifica todos los errores de build y TypeScript
2. **code-reviewer** — Revisa calidad, patrones, dead code, y mantenibilidad
3. **security-reviewer** — Detecta vulnerabilidades, secrets expuestos, inputs sin validar
4. **typescript-reviewer** — Revisa type safety, async patterns, y código idiomático

## Fase 2: Verificación
Ejecuta `/verify` para correr build, lint, y tests. Consolida los resultados con los hallazgos de Fase 1.

## Fase 3: Reporte
Genera un reporte único consolidado con TODOS los problemas encontrados, clasificados así:
- 🔴 CRITICAL — Rompe build, vulnerabilidad de seguridad, pérdida de datos
- 🟠 HIGH — Bugs latentes, race conditions, errores de lógica
- 🟡 MEDIUM — Code smells, duplicación, patrones incorrectos
- 🔵 LOW — Mejoras menores, naming, consistencia

Para cada problema incluye:
- Archivo y línea
- Descripción del problema
- Impacto si no se corrige

## Fase 4: Plan de corrección
Usa el agente **planner** para crear un plan de corrección priorizado:
- Agrupa por criticidad (CRITICAL primero)
- Estima complejidad de cada fix (S/M/L)
- Identifica dependencias entre fixes
- Propón un orden de ejecución óptimo

## Restricciones
- **NO corrijas nada todavía.** Solo diagnostica, reporta, y planifica.
- **Espera mi confirmación** antes de hacer cualquier cambio.
