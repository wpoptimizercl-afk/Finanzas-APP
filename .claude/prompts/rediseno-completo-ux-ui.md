# Rediseño completo UX/UI — [NOMBRE DEL PROYECTO]

## Contexto del proyecto
- **Qué hace la app:** [Descripción breve del propósito de la app]
- **Usuarios objetivo:** [Quiénes usan la app, perfil demográfico, nivel técnico]
- **Problemas actuales de UX:** [Qué no funciona bien, quejas de usuarios, fricciones conocidas]
- **Qué sí funciona bien:** [Qué mantener del diseño actual]
- **Stack visual actual:** [Tailwind / CSS Modules / librería de componentes / etc.]

## Visión del rediseño
- **Estilo deseado:** [Minimalista / Dashboard corporativo / Playful / Fintech moderno / "propón opciones"]
- **Apps de referencia:** [Lista de apps que te gustan visualmente, o "sin referencias"]
- **Paleta de colores:** [Colores de marca existentes / "propón paleta" / link a referencia]
- **Tipografía:** [Font actual / "propón opciones"]
- **Tono visual:** [Serio y profesional / Amigable y accesible / Técnico y denso / "propón"]

## Instrucciones para Claude

### Fase 0: Exploración del proyecto
1. Explora el codebase completo para entender:
   - Todas las pantallas y rutas existentes
   - Componentes compartidos y sistema de diseño actual
   - Flujos de usuario completos (de inicio a fin)
   - Paleta de colores, tipografía y espaciado actuales
   - Responsive behavior actual
2. Genera un **mapa de pantallas** con todas las vistas y sus relaciones

### Fase 1: Diagnóstico UX (preguntas antes de diseñar)
Antes de proponer nada, hazme estas preguntas agrupadas por tema. No avances hasta tener mis respuestas:

**Sobre los usuarios:**
- ¿Quién usa la app? ¿Con qué frecuencia?
- ¿Desde qué dispositivo principalmente (desktop/mobile/tablet)?
- ¿Qué tarea es la más frecuente? ¿Y la más importante?

**Sobre el diseño actual:**
- ¿Qué pantallas te frustran más?
- ¿Hay elementos que los usuarios no entienden?
- ¿Hay funcionalidades que nadie usa?

**Sobre la visión:**
- ¿Hay alguna app (no necesariamente del mismo rubro) cuyo diseño admires?
- ¿Prefieres densidad de información o espacios amplios?
- ¿La app debe sentirse como herramienta profesional o app consumer?

### Fase 2: Propuesta de diseño (Claude aporta ideas)
Con mis respuestas y tu análisis del codebase, genera una propuesta que incluya:

1. **Sistema de diseño propuesto:**
   - Paleta de colores (primaria, secundaria, semánticos, neutrales) con justificación
   - Tipografía (headings, body, monospace) con jerarquía visual
   - Espaciado y grid system
   - Border radius, sombras, y estilo de componentes
   - Dark mode / Light mode / ambos

2. **Propuesta por pantalla:**
   Para cada pantalla existente propón:
   - Layout nuevo con justificación UX
   - Mejoras de información hierarchy
   - Interacciones y microanimaciones relevantes
   - Estados (empty, loading, error, populated)
   - Mejoras de accesibilidad

3. **Ideas propias de Claude:**
   - Sugiere mejoras UX que no te pedí pero que identifiques como oportunidades
   - Propón pantallas o componentes nuevos si mejoran la experiencia
   - Recomienda patrones UX de apps similares exitosas
   - Identifica flujos que se pueden simplificar o eliminar pasos

4. **Navegación y arquitectura de información:**
   - Propón estructura de navegación optimizada
   - Agrupa funcionalidades de forma lógica
   - Propón shortcuts para acciones frecuentes

### Fase 3: Revisión iterativa
- Presenta la propuesta completa organizada por pantalla
- **ESPERA MI FEEDBACK** por cada sección
- Itera sobre mis comentarios antes de avanzar a implementación
- Marca qué cambios son quick wins vs cambios estructurales

### Fase 4: Implementación progresiva
Una vez aprobado el diseño:
1. Empieza por el **sistema de diseño** (tokens, variables, componentes base)
2. Luego aplica pantalla por pantalla en orden de impacto
3. Usa `/verify` después de cada pantalla para validar build
4. Muestra antes/después de cada pantalla modificada

## Restricciones
- **NO implementar nada** hasta que apruebe la propuesta completa
- **Mantener funcionalidad existente** — solo cambiar presentación y UX
- **Mobile-first** si la app se usa en móvil
- **Accesibilidad:** WCAG AA mínimo (contraste, focus states, aria labels)
- **Performance:** No agregar dependencias pesadas sin justificación
