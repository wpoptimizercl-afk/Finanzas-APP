# Guía de Despliegue: Vercel + Supabase

Sigue estos pasos para poner tu aplicación en producción.

## 1. Configuración de Supabase

1.  Crea un nuevo proyecto en [Supabase](https://supabase.com/).
2.  Ve a **SQL Editor** y crea un "New Query".
3.  Copia y pega el contenido de `supabase_schema.sql` (ubicado en la raíz de este proyecto) y ejecútalo (**Run**). Esto creará todas las tablas y las reglas de seguridad.
4.  Ve a **Project Settings > API** y copia la `URL` y la `anon key`.

## 2. Autenticación con Google

1.  En el dashboard de Supabase, ve a **Authentication > Providers > Google**.
2.  Habilítalo (**Enable**).
3.  Necesitarás un **Client ID** y **Client Secret** de la [Google Cloud Console](https://console.cloud.google.com/).
4.  Asegúrate de configurar la **URL de redirección** que te proporciona Supabase en tu proyecto de Google Cloud.

## 3. Despliegue en Vercel

1.  Sube tu código a un repositorio de GitHub.
2.  En [Vercel](https://vercel.com/), crea un nuevo proyecto apuntando a ese repo.
3.  En la sección de **Environment Variables**, agrega:
    -   `VITE_SUPABASE_URL`: (Tu URL de Supabase)
    -   `VITE_SUPABASE_ANON_KEY`: (Tu anon key de Supabase)
4.  Haz clic en **Deploy**.

## 4. Archivo Local de Configuración

Para probar localmente antes de subir, crea un archivo `.env.local` en la carpeta `app/` con las mismas variables:

```env
VITE_SUPABASE_URL=tu_url_aqui
VITE_SUPABASE_ANON_KEY=tu_key_aqui
```
