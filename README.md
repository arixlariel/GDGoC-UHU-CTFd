# ⚡ GDGoC UHU · Tema Oficial Cyber para CTFd

Tema personalizado **Cyber Neon** para la plataforma **CyberTrainer CTF** de **Google Developer Groups on Campus — Universidad de Huelva (GDGoC UHU)**, diseñado con exactamente la misma estética visual que el modo *Cyber* de nuestra web oficial de certificados ([gdguhu.com](https://gdguhu.com)).

---

## Características

- **100% compatible con CTFd 3.7 / 3.8+** (`core` / `core-beta`, Alpine.js, Apache ECharts, Bootstrap 5 JS y todos los endpoints nativos).
- **Cero compilación en servidor**: todos los assets (`static/manifest.json`, `static/assets/*`, `static/css/gdgoc-cyber.css`, `static/js/gdgoc-cyber.js`) ya vienen listos para usar con un simple `git clone` / `git pull`.
- **Estética Cyber exclusiva de Open Badges**:
  - Fondo animado con rejilla perspectiva neón, línea láser *scanline* y tokens flotantes (`#theme-fx-container`), respetando `prefers-reduced-motion`.
  - Cabecera sticky *glassmorphism* con barra superior neón multicolor, logo oficial GDGoC UHU, navegación CTF, selector de idioma y enlace rápido a `gdguhu.com`.
  - Tarjetas de retos con efecto **3D Perspective Tilt + Specular Glare**, buscador en vivo, filtro por categoría, botón de *Ocultar resueltos* y barra de progreso del jugador.
  - Modal de reto Cyber con pestañas neón, pistas desplegables, bloques de conexión estilo terminal, feedback visual en colores neón y soporte para ratings/soluciones/compartir.
  - Gráficas Apache ECharts de Scoreboard, Usuarios y Equipos estilizadas automáticamente en paleta Cyber Neon (`window.scoreboardChartOptions`).
  - **Compatibilidad automática con la portada existente** (`/`): remapea las clases `.gdg-hero`, `.flag-box`, `.countdown-box`, `.feature-card` y desactiva el viejo CSS inline `#gdg-custom-theme` si todavía está en *Theme Header*.

---

## Instalación en el servidor de CTFd (para el administrador)

Este repositorio **es directamente una carpeta de tema de CTFd** (`templates/` + `static/`).

### Opción A · CTFd con Docker Compose (recomendada)

1. Clona este repositorio en el servidor junto a tu `docker-compose.yml`:

```bash
git clone https://github.com/arixlariel/GDGoC-UHU-CTFd.git themes/gdgoc-cyber
```

2. Añade el volumen de solo lectura al servicio `ctfd` en tu `docker-compose.yml`:

```yaml
services:
  ctfd:
    image: ctfd/ctfd:latest
    volumes:
      - ./themes/gdgoc-cyber:/opt/CTFd/CTFd/themes/gdgoc-cyber:ro
```

3. Recrea/reinicia el contenedor:

```bash
docker compose up -d ctfd
```

### Opción B · CTFd instalado directamente desde código fuente

```bash
git clone https://github.com/arixlariel/GDGoC-UHU-CTFd.git CTFd/themes/gdgoc-cyber
```

Y reinicia el servicio de CTFd (`systemctl restart ctfd` o equivalente).

---

## Activación en el Panel de Administración

1. Entra en **`/admin/config`** → pestaña **Theme**.
2. En el desplegable **Theme**, selecciona **`gdgoc-cyber`** (el nombre de la carpeta donde clonaste el repo).
3. Pulsa **Update**.
4. *(Opcional, recomendado)* En **Theme Header**, puedes vaciar el bloque antiguo `<style id="gdg-custom-theme">...</style>` para dejar el HTML aún más limpio (aunque el tema ya lo desactiva automáticamente para evitar conflictos).

---

## Cómo actualizar el tema en el futuro (`git pull`)

Cada vez que se suban mejoras de diseño o nuevas funcionalidades a este repositorio, solo hay que ejecutar en el servidor:

```bash
cd themes/gdgoc-cyber
git pull
docker compose restart ctfd
```

*(Si no usas Docker, haz `git pull` dentro de `CTFd/themes/gdgoc-cyber` y reinicia el servicio de CTFd).*

---

## Vista previa en vivo (GitHub Pages)

Cada `git push` a `main` publica automáticamente una vista previa interactiva (usando directamente las plantillas reales de `templates/` y `static/`) en:

- **https://arixlariel.github.io/GDGoC-UHU-CTFd/**

*(Este entorno en `github.io` es independiente de `gdguhu.com` y sirve solo para revisar el diseño visual del tema; el dominio final bajo `gdguhu.com` apunta al servidor CTFd real mediante Cloudflare).*

---

## Estructura del repositorio

```text
GDGoC-UHU-CTFd/
├── .github/                       # Workflow de GitHub Pages para previsualizar el tema en github.io
├── static/
│   ├── manifest.json              # Vite manifest oficial de CTFd core-beta
│   ├── assets/                    # Bundles JS/CSS oficiales de CTFd (Alpine.js, ECharts, Bootstrap)
│   ├── css/gdgoc-cyber.css        # Hoja maestra del diseño Cyber GDGoC UHU
│   ├── js/gdgoc-cyber.js          # 3D tilt, glare, ECharts Cyber Neon y utilidades UI
│   ├── img/                       # Logos y favicons oficiales de GDGoC UHU
│   ├── sounds/                    # Sonidos de notificación de CTFd
│   └── webfonts/                  # Iconografía FontAwesome
└── templates/                     # Plantillas Jinja2 completas de CTFd (base, challenges, challenge, scoreboard, login, register, settings, users, teams, errors...)
```
