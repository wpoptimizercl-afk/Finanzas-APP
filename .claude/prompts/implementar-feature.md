# Implementación — [NOMBRE DE LA FEATURE]

## Descripción
[1-3 oraciones describiendo qué hace la feature desde la perspectiva del usuario]

## Contexto técnico
- **Archivos relacionados:** [Lista de archivos que se verán afectados o "identificar"]
- **Dependencias externas:** [APIs, librerías nuevas necesarias, o "ninguna"]
- **Datos involucrados:** [Tablas de Supabase, endpoints, schemas]
- **Feature flag:** [Sí/No — si necesita activarse gradualmente]

## Criterios de aceptación
- [ ] [El usuario puede...]
- [ ] [El sistema debe...]
- [ ] [Cuando X ocurre, entonces Y...]
- [ ] [Edge case: cuando...]
- [ ] [Error case: cuando...]

## Fuera de alcance
- [Qué NO incluir en esta implementación]
- [Qué dejar para una iteración futura]

## Instrucciones para Claude

### Fase 1: Investigación (no escribir código)
- Usa `/docs` para verificar APIs/librerías necesarias
- Revisa el código existente relacionado para entender patrones actuales
- Identifica si hay código reutilizable en el proyecto

### Fase 2: Planificación
- Usa el agente **planner** para crear el plan de implementación
- Desglosa en tareas con complejidad estimada (S/M/L)
- Identifica riesgos y dependencias entre tareas
- **ESPERA MI CONFIRMACIÓN** antes de continuar

### Fase 3: Implementación con TDD
- Usa `/tdd` para cada unidad de trabajo:
  1. Escribe tests primero (RED)
  2. Implementa lo mínimo para pasar (GREEN)
  3. Refactoriza (IMPROVE)
- Lanza agentes en paralelo cuando las tareas sean independientes

### Fase 4: Verificación
Lanza en paralelo:
1. `/verify` — build + lint + tests
2. **code-reviewer** — calidad del código nuevo
3. **security-reviewer** — si la feature maneja input de usuario o datos sensibles

### Fase 5: Cierre
- Muestra resumen de lo implementado vs criterios de aceptación
- Lista cualquier deuda técnica introducida
- **NO hagas commit** — espera mi instrucción

## Preferencias
- **Complejidad:** [Solución simple / Solución robusta y extensible]
- **Tests E2E:** [Sí, para flujos críticos / No necesarios]
- **Documentación:** [Actualizar docs / No necesario]
