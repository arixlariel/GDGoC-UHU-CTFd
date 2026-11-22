# GDGoC Universidad de Huelva — Cyber Trainer (`gdguhu.com/cybertrainer`)

Bienvenido al repositorio oficial del tema **Cyber** y la capa de sincronización en producción de **GDGoC UHU Cyber Trainer** ([`https://gdguhu.com/cybertrainer/`](https://gdguhu.com/cybertrainer/)), la plataforma de entrenamiento y competición en ciberseguridad CTF de **Google Developer Group on Campus Huelva University (GDGoC UHU)** sobre **CTFd**.

---

## Índice

1. [Integración dentro del ecosistema `gdguhu.com`](#1-integración-dentro-del-ecosistema-gdguhucom)
2. [Características principales](#2-características-principales)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [Sincronización automática con la instancia CTFd en producción](#4-sincronización-automática-con-la-instancia-ctfd-en-producción)
5. [Instalación como tema Jinja nativo en servidor (opcional)](#5-instalación-como-tema-jinja-nativo-en-servidor-opcional)
6. [Plugin de pistas porcentuales (opcional)](#6-plugin-de-pistas-porcentuales-opcional)

---

## 1. Integración dentro del ecosistema `gdguhu.com`

Cyber Trainer está diseñado con paridad visual, tipográfica y de dimensiones exacta con nuestra portada oficial y Open Badges:

| Enlace oficial | Servicio | Repositorio |
| :--- | :--- | :--- |
| **`https://gdguhu.com/`** | **Portal principal y Edge Gateway Multi-Zone** (Vercel + Cloudflare DNS) | [`GDGoC-UHU-Web`](https://github.com/arixlariel/GDGoC-UHU-Web) |
| **`https://gdguhu.com/cybertrainer/`** | **GDGoC UHU Cyber Trainer** (CTFd servido vía proxy HTTPS en Vercel Edge Middleware) | **`GDGoC-UHU-CTFd`** *(este repositorio)* |
| **`https://gdguhu.com/openbadges/`** | **Certificados Digitales Open Badges 2.0 & 3.0** | [`GDGoC-UHU-OpenBadges`](https://github.com/arixlariel/GDGoC-UHU-OpenBadges) |
| **Comunidad oficial (Bevy)** | Eventos y registro oficial del capítulo | [gdg.community.dev](https://gdg.community.dev/gdg-on-campus-huelva-university-huelva-spain/) |

> El tráfico HTTPS de `https://gdguhu.com/cybertrainer/*` se enruta mediante el **Vercel Edge Routing Middleware** de `GDGoC-UHU-Web` contra el servidor CTFd origen (`origin-ctf.gdguhu.com`), con reescritura transparente de `window.init.urlRoot`, cabeceras `Location` y `Set-Cookie`, rutas JSON de la API, streaming SSE (`/events`) y protección automática con pantalla de mantenimiento Cyber ante caídas `502`/`503`/`504`.

---

## 2. Características principales

- **100% compatible con CTFd 3.7 / 3.8+** (`core` / `core-beta`, Alpine.js, Apache ECharts y Bootstrap 5 JS), tanto servido en raíz (`/`) como montado bajo subruta (`/cybertrainer/`).
- **Rendimiento optimizado y cero parpadeos (*Zero-Flicker*)**:
  - Bundle minificado (`cyber.min.css` + `cyber-bundle.min.js`) servido desde GitHub Pages con *cache-busting* (`?v=<commit_sha>`).
  - CSS crítico inline desde `t = 0 ms` (incluyendo ocultación `[x-cloak]` para evitar parpadeos de alertas en `/settings`) y Google Fonts no bloqueantes.
  - Menú móvil desplegable puro en GPU sin glitches y proxy de `EventSource` (`/events`) que cierra streams SSE al cambiar de sección.
  - Motor delegado de **3D Perspective Tilt + Specular Glare** con protección de fluidez durante el scroll.
- **Open Graph `1200×630` propio**:
  - Metadatos sociales vinculados a `https://gdguhu.com/og/cybertrainer.png` para vistas previas nítidas en LinkedIn, WhatsApp, Telegram y Discord.
- **Scoreboard avanzado (Top 15 dinámico)**:
  - Selector interactivo **All-Time**, **This Year** y **Last 30 days**, con descarga directa de la gráfica (`top15_*.png`) sin solapamiento en móvil ni escritorio.
  - Tabla con `Place`, `Points`, `User`, `Solves`, `Submission accuracy` (`#B366FF`) y `Points efficiency` (`#00FF66`).
- **Perfiles, Challenges, Users, Settings y 404 Cyber**:
  - Perfiles con desglose `earned / max`, tabla de Solves paginada de 15 en 15 (`Load more`), barras 3D simétricas (`Submission Accuracy`, `Points Efficiency`, `Category Breakdown`) y gráfica `Score Over Time` descargable (`sot_<USERNAME>.png`), totalmente funcionales también en móvil.
  - Modal de retos con pestañas `Description`, `Solves` y `Stats`, confirmación al desbloquear pistas y formato en bloque para fragmentos `<code>` largos o multilínea.
  - Directorio **Users** con scroll horizontal completo en móvil, búsqueda en vivo, ordenación por píldoras y persistencia de idioma (`language` cookie 1 año).
  - **Settings** unificado en una sola vista (`Profile`, `Passwords`, `Access Tokens`) y páginas de error **404 / 403 / 429 / 500** totalmente estilizadas en neón Cyber 3D.

---

## 3. Estructura de Archivos

```text
Cyber Trainer/
├── .github/
│   ├── scripts/
│   │   ├── build_pages.py               <-- Genera preview estática y bundles minificados en CI
│   │   └── sync_ctfd_theme.py           <-- Sincroniza theme_header, OG y portada vía API CTFd
│   └── workflows/
│       └── pages.yml                    <-- Despliegue a GitHub Pages + sync automático a CTFd
├── cloudflare/
│   └── worker.js                        <-- Referencia legada del proxy anterior en Cloudflare
├── plugins/
│   └── cyber_percent_hints/             <-- Plugin opcional de pistas porcentuales en servidor
├── static/
│   ├── manifest.json                    <-- Vite manifest oficial de CTFd core-beta
│   ├── assets/                          <-- Bundles JS/CSS oficiales de CTFd (Alpine, ECharts, BS5)
│   ├── css/cyber.css                    <-- Hoja maestra del estilo Cyber
│   ├── js/cyber.js                      <-- 3D tilt, Top 15 ECharts, perfiles, stats y menú móvil
│   ├── js/cyber-bridge.js               <-- Puente zero-flicker para adaptar el tema `core` en vivo
│   ├── img/                             <-- Logos y favicons oficiales de GDGoC UHU
│   ├── sounds/                          <-- Sonidos de notificación de CTFd
│   └── webfonts/                        <-- Iconografía FontAwesome
└── templates/                           <-- Plantillas Jinja2 completas de CTFd
```

---

## 4. Sincronización automática con la instancia CTFd en producción

Además de poder montarse como tema Jinja nativo en servidor, este repositorio incluye un **puente *zero-flicker*** (`static/js/cyber-bridge.js`) y el job automático `sync-live-ctfd` en `.github/workflows/pages.yml`:

1. Cada `git push` a `main` compila y minifica los assets (`cyber.min.css`, `cyber-bundle.min.js`, logos y favicons) y los publica en GitHub Pages (`https://arixlariel.github.io/GDGoC-UHU-CTFd/static/...`).
2. Al finalizar el despliegue, `.github/scripts/sync_ctfd_theme.py` conecta mediante los **GitHub Actions Secrets** (`CTFD_URL` y `CTFD_API_TOKEN`):
   - Actualiza `theme_header` (`PATCH /api/v1/configs`) con CSS crítico inline, metadatos Open Graph y *cache-busting* (`?v=<commit_sha>`).
   - Aplica sincronizaciones idempotentes de textos de la portada (`PATCH /api/v1/pages/<id>`).
3. El puente nunca modifica `/admin` ni `/cybertrainer/admin`, y se desactiva automáticamente si se activa el tema Jinja nativo `cyber` en el servidor.

---

## 5. Instalación como tema Jinja nativo en servidor (opcional)

Este repositorio **es directamente una carpeta de tema de CTFd** (`templates/` + `static/`), lista para usar sin compilación en servidor.

### --- Opción A: CTFd con Docker Compose (recomendada)

1. Clona este repositorio junto a tu `docker-compose.yml`:
```bash
git clone https://github.com/arixlariel/GDGoC-UHU-CTFd.git themes/cyber
```

2. Añade el volumen de solo lectura al servicio `ctfd` en tu `docker-compose.yml`:
```yaml
services:
  ctfd:
    image: ctfd/ctfd:latest
    volumes:
      - ./themes/cyber:/opt/CTFd/CTFd/themes/cyber:ro
```

3. Reinicia el contenedor:
```bash
docker compose up -d ctfd
```

### --- Opción B: CTFd instalado desde código fuente

```bash
git clone https://github.com/arixlariel/GDGoC-UHU-CTFd.git CTFd/themes/cyber
```
Y reinicia el servicio de CTFd (`systemctl restart ctfd` o equivalente).

### --- Activación en el Panel de Administración
1. Entra en **`/cybertrainer/admin/config`** (o `/admin/config`) → pestaña **Theme**
2. Selecciona **`cyber`** y pulsa **Update**
3. Vacía **Theme Header** (opcional; el puente se desactiva automáticamente al detectar el tema nativo)

---

## 6. Plugin de pistas porcentuales (opcional)

El directorio [`plugins/cyber_percent_hints/`](plugins/cyber_percent_hints/README.md) contiene un plugin listo para montar en `/opt/CTFd/CTFd/plugins/cyber_percent_hints` que aplica penalizaciones porcentuales dinámicas sobre las pistas por reto.
