# ⚡ GDGoC UHU Cyber Trainer · Tema Oficial Cyber para CTFd

Tema **Cyber** oficial de la plataforma **[GDGoC UHU Cyber Trainer](https://gdguhu.com/cybertrainer/)** perteneciente a **Google Developer Group on Campus Huelva University (GDGoC UHU)**, diseñado con paridad visual y de dimensiones exacta con nuestro portal principal ([gdguhu.com](https://gdguhu.com)) y nuestra plataforma de [Open Badges](https://gdguhu.com/openbadges/).

---

## Enlaces oficiales del ecosistema

- **Portal principal**: [https://gdguhu.com](https://gdguhu.com)
- **GDGoC UHU Cyber Trainer (CTFd)**: [https://gdguhu.com/cybertrainer](https://gdguhu.com/cybertrainer/)
- **GDGoC UHU Open Badges**: [https://gdguhu.com/openbadges](https://gdguhu.com/openbadges/)
- **Comunidad oficial (Bevy)**: [Google Developer Group on Campus Huelva University](https://gdg.community.dev/gdg-on-campus-huelva-university-huelva-spain/)

---

## Características principales

- **100% compatible con CTFd 3.7 / 3.8+** (`core` / `core-beta`, Alpine.js, Apache ECharts, Bootstrap 5 JS y todos los endpoints nativos), tanto servido en raíz (`/`) como montado bajo subruta (`/cybertrainer/`).
- **Integración HTTPS bajo `gdguhu.com/cybertrainer`** mediante Cloudflare Worker ([`cloudflare/worker.js`](cloudflare/worker.js)):
  - Reverse proxy en streaming con `HTMLRewriter`, reescritura automática de `window.init.urlRoot`, cabeceras `Location` y `Set-Cookie` (`Secure; SameSite=Lax`), rutas API JSON (`account_url`, `files`, `view`) y passthrough SSE sin buffering para `/events`.
- **Cero compilación en servidor**: todos los assets (`static/manifest.json`, `static/assets/*`, `static/css/cyber.css`, `static/js/cyber.js`) están listos para usar con `git clone` / `git pull`.
- **Optimización de rendimiento y cero flash**:
  - Bundle minificado (`cyber.min.css` + `cyber-bundle.min.js`) + CSS crítico inline + Google Fonts no bloqueantes.
  - Proxy inteligente de `EventSource` (`/events`) que cierra automáticamente los streams SSE al navegar entre apartados.
  - Motor delegado de **3D Perspective Tilt + Specular Glare** idéntico al de Open Badges, sin saltos ni bloqueos de frame.
- **Scoreboard avanzado (Top 15 dinámico)**:
  - Selector interactivo **All-Time** (eje X por número de solves), **This Year** (eje X por semanas `Week N`) y **Last 30 days** (eje X por fechas `Nov 1st`, `Dec 1st`, ...), con botón **Download** (`top15_*.png`).
  - Tabla operativa con `Place`, `Points`, `User`, `Solves`, `Submission accuracy` (`#B366FF`) y `Points efficiency` (`#00FF66`), excluyendo perfiles sin solves.
- **Perfiles, Challenges, Users y Settings**:
  - Perfiles con desglose `earned / max`, tabla de Solves paginada de 15 en 15 (`Load more`), barras 3D simétricas (`Submission Accuracy`, `Points Efficiency`, `Category Breakdown`) y gráfica `Score Over Time` descargable (`sot_<USERNAME>.png`).
  - Modal de retos con pestañas `Description`, `Solves` y `Stats` (`Average Attempts`, `Average Time`, `Average Points`), confirmación al desbloquear pistas y bloques de código limpios.
  - Directorio **Users** con búsqueda en vivo, ordenación por píldoras (`Country` / `Affiliation`) adaptada al idioma activo y persistencia de idioma (`language` cookie 1 año).
  - **Settings** unificado en una sola vista (`Profile`, `Passwords`, `Access Tokens`) con feedback inline sin saltos de layout.

---

## Sincronización automática con la instancia CTFd en producción (GitHub Actions)

Además de poder montarse como tema Jinja nativo en servidor, este repositorio incluye un **puente *zero-flicker*** (`static/js/cyber-bridge.js`) y un job automático (`sync-live-ctfd`) en [`.github/workflows/pages.yml`](.github/workflows/pages.yml):

1. Cada `git push` a `main` compila y minifica los assets (`cyber.min.css`, `cyber-bundle.min.js`, logos y favicons) y los publica en GitHub Pages (`https://arixlariel.github.io/GDGoC-UHU-CTFd/static/...`).
2. Al finalizar el despliegue, [`.github/scripts/sync_ctfd_theme.py`](.github/scripts/sync_ctfd_theme.py) actualiza `theme_header` mediante `PATCH /api/v1/configs` usando los **GitHub Actions Secrets** (`CTFD_URL` y `CTFD_API_TOKEN`) con *cache-busting* (`?v=<commit_sha>`).
3. El puente nunca modifica `/admin` ni `/cybertrainer/admin`, y se desactiva automáticamente si se activa el tema Jinja nativo `cyber` en el servidor.

---

## Instalación en el servidor de CTFd (opcional · tema Jinja nativo `cyber`)

Este repositorio **es directamente una carpeta de tema de CTFd** (`templates/` + `static/`).

### Opción A · CTFd con Docker Compose (recomendada)

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

3. Recrea/reinicia el contenedor:

```bash
docker compose up -d ctfd
```

### Opción B · CTFd instalado desde código fuente

```bash
git clone https://github.com/arixlariel/GDGoC-UHU-CTFd.git CTFd/themes/cyber
```

Y reinicia el servicio de CTFd (`systemctl restart ctfd` o equivalente).

### Activación en el Panel de Administración

1. Entra en **`/cybertrainer/admin/config`** (o `/admin/config`) → pestaña **Theme**.
2. En **Theme**, selecciona **`cyber`**.
3. Pulsa **Update** y vacía **Theme Header** (opcional; el puente se desactiva automáticamente).

---

## Plugin de pistas porcentuales (opcional en servidor)

El directorio [`plugins/cyber_percent_hints/`](plugins/cyber_percent_hints/README.md) contiene un plugin listo para montar en `/opt/CTFd/CTFd/plugins/cyber_percent_hints` que aplica penalizaciones porcentuales dinámicas sobre las pistas por reto.

---

## Estructura del repositorio

```text
GDGoC-UHU-CTFd/
├── .github/                       # Workflow de GitHub Pages + minificación + auto-sync CTFd
├── cloudflare/
│   └── worker.js                  # Cloudflare Worker reverse proxy (gdguhu.com/cybertrainer/*)
├── plugins/
│   └── cyber_percent_hints/       # Plugin opcional de pistas porcentuales en servidor
├── static/
│   ├── manifest.json              # Vite manifest oficial de CTFd core-beta
│   ├── assets/                    # Bundles JS/CSS oficiales de CTFd (Alpine.js, ECharts, Bootstrap)
│   ├── css/cyber.css              # Hoja maestra del estilo Cyber
│   ├── js/cyber.js                # 3D tilt, Top 15 ECharts, perfiles, stats y proxy EventSource
│   ├── js/cyber-bridge.js         # Puente zero-flicker para adaptar el tema `core` en caliente
│   ├── img/                       # Logos y favicons oficiales de GDGoC UHU
│   ├── sounds/                    # Sonidos de notificación de CTFd
│   └── webfonts/                  # Iconografía FontAwesome
└── templates/                     # Plantillas Jinja2 completas de CTFd
```
