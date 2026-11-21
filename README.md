# ⚡ Cyber · Tema Oficial para CTFd (GDGoC UHU)

Tema **Cyber** para la plataforma **GDGoC UHU Cyber Trainer** de **Google Developer Groups on Campus — Universidad de Huelva (GDGoC UHU)**, con el mismo estilo **Cyber** unificado que nuestra web de Open Badges ([gdguhu.com](https://gdguhu.com)).

---

## Características

- **100% compatible con CTFd 3.7 / 3.8+** (`core` / `core-beta`, Alpine.js, Apache ECharts, Bootstrap 5 JS y todos los endpoints nativos).
- **Cero compilación en servidor**: todos los assets (`static/manifest.json`, `static/assets/*`, `static/css/cyber.css`, `static/js/cyber.js`) vienen listos para usar con un simple `git clone` / `git pull`.
- **Optimizado para navegación instantánea y cero flash**:
  - Bundle minificado (`cyber.min.css` + `cyber-bundle.min.js`) + CSS crítico inline + fuentes Google Fonts no bloqueantes.
  - Proxy inteligente de `EventSource` (`/events`) que cierra automáticamente los streams SSE al navegar entre apartados para evitar saturación en HTTP/1.1.
  - Animaciones en capa GPU (`will-change: transform`, sin `background-attachment: fixed`) y `content-visibility: auto` en el tablero de retos.
- **Diseño Cyber completo de arriba abajo**:
  - Cabecera sticky *glassmorphism* con barra superior neón multicolor, logo GDGoC UHU, navegación CTF completa (`Users`, `Scoreboard`, `Challenges`, `Notifications`), controles de sesión (`Admin`, `Profile`, `Settings`, `Logout` / `Login` y `Register`), selector de idioma y enlace rápido a `Comunidad` (`gdguhu.com`).
  - Directorio de **Users** ordenado por **Username → Country (bandera con tooltip) → Affiliation → Website preview**.
  - Página de **Settings** unificada (Perfil, Seguridad y Access Tokens en una sola vista limpia sin pestañas innecesarias).
  - Tablero de retos con buscador en vivo, filtros por categoría, barra de progreso y tarjetas con **3D Perspective Tilt + Specular Glare**.

---

## Sincronización automática con la instancia CTFd en producción (GitHub Actions)

Además de poder montarse como tema nativo en servidor, este repositorio incluye un **puente *zero-flicker*** (`static/js/cyber-bridge.js`) y un job automático (`sync-live-ctfd`) en [`.github/workflows/pages.yml`](.github/workflows/pages.yml):

1. Cada `git push` a `main` compila y minifica los assets (`cyber.min.css`, `cyber-bundle.min.js`, logos y favicons) y los despliega en GitHub Pages (`https://arixlariel.github.io/GDGoC-UHU-CTFd/static/...`).
2. Al finalizar el despliegue, [`.github/scripts/sync_ctfd_theme.py`](.github/scripts/sync_ctfd_theme.py) llama a `PATCH /api/v1/configs` mediante los **GitHub Actions Secrets** (`CTFD_URL` y `CTFD_API_TOKEN`) para actualizar `theme_header` con cache-busting (`?v=<commit_sha>`).
3. El puente nunca modifica `/admin` y se desactiva automáticamente si se instala el tema Jinja nativo `cyber` en el servidor.
4. Para desactivar o rotar el acceso en cualquier momento, revoca el token en `/settings#tokens` dentro de CTFd o elimina el secreto `CTFD_API_TOKEN` en GitHub.

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

1. Entra en **`/admin/config`** → pestaña **Theme**.
2. En **Theme**, selecciona **`cyber`**.
3. Pulsa **Update** y vacía **Theme Header** (opcional; el puente ya se desactiva solo).

---

## Vista previa en vivo (GitHub Pages)

Cada `git push` a `main` publica automáticamente la vista previa interactiva en:

- **https://arixlariel.github.io/GDGoC-UHU-CTFd/**

---

## Estructura del repositorio

```text
GDGoC-UHU-CTFd/
├── .github/                       # Workflow de GitHub Pages + minificación + auto-sync CTFd
├── static/
│   ├── manifest.json              # Vite manifest oficial de CTFd core-beta
│   ├── assets/                    # Bundles JS/CSS oficiales de CTFd (Alpine.js, ECharts, Bootstrap)
│   ├── css/cyber.css              # Hoja maestra del estilo Cyber
│   ├── js/cyber.js                # 3D tilt, glare, ECharts Cyber Neon y proxy EventSource
│   ├── js/cyber-bridge.js         # Puente zero-flicker para adaptar el tema `core` en caliente
│   ├── img/                       # Logos y favicons oficiales de GDGoC UHU
│   ├── sounds/                    # Sonidos de notificación de CTFd
│   └── webfonts/                  # Iconografía FontAwesome
└── templates/                     # Plantillas Jinja2 completas de CTFd
```
