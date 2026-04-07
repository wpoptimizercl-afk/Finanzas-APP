# Diseño UX/UI — [NOMBRE DE LA FEATURE]

## Contexto
- **Qué existe hoy:** [Describe la pantalla/componente actual o "es nuevo"]
- **Problema de UX:** [Qué problema tiene el usuario o qué necesita]
- **Referencia visual:** [Link a Figma/screenshot/sitio de inspiración, o "sin referencia"]

## Objetivo
[Describe en 1-2 oraciones qué debe lograr el usuario con esta pantalla/componente]

## Requisitos de diseño
- **Tipo:** [Pantalla completa / Componente / Modal / Flujo multi-paso]
- **Dispositivos:** [Desktop / Mobile / Ambos]
- **Estado de datos:** [Qué datos muestra, de dónde vienen]
- **Estados UI requeridos:**
  - Empty state (sin datos)
  - Loading state
  - Error state
  - Estado con datos
  - [Otros estados específicos]

## Comportamiento esperado
1. [Paso 1 — qué hace el usuario]
2. [Paso 2 — qué responde la UI]
3. [Paso 3 — resultado final]

## Restricciones
- **Stack visual:** [Tailwind / CSS Modules / componentes existentes del proyecto]
- **Consistencia:** Respetar paleta de colores y tipografía existente del proyecto
- **Accesibilidad:** [Requisitos específicos o "estándar WCAG AA"]
- **Animaciones:** [Sí con Framer Motion / Transiciones CSS simples / Sin animaciones]

## Instrucciones para Claude
1. Usa `/docs` para verificar API de componentes/librerías UI que vayas a usar
2. Revisa los componentes existentes del proyecto antes de crear nuevos
3. Propón la estructura de componentes y su composición antes de implementar
4. Implementa mobile-first si aplica a ambos dispositivos
5. Muéstrame el diseño propuesto (estructura + estados) y **espera mi confirmación** antes de escribir código
6. Después de implementar, usa `/verify` para validar build
