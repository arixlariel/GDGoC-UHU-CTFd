#!/usr/bin/env python3
"""
Builds a static interactive GitHub Pages preview (_site/) directly from the real
CTFd Jinja2 templates (templates/) and real static assets (static/), mirroring
the full http://188.245.96.96/ experience from top to bottom (Landing Page at /,
Challenges, Scoreboard, Users, Public Profile, Private Profile, Notifications,
Settings, Login, Register, 404).
Hosted at https://arixlariel.github.io/GDGoC-UHU-CTFd/ (independent of gdguhu.com).
"""

import json
import os
import re
import shutil
from types import SimpleNamespace
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup


def minify_css(src: str) -> str:
    src = re.sub(r"/\*[\s\S]*?\*/", "", src)
    src = re.sub(r"\s+", " ", src)
    src = re.sub(r"\s*([{}:;,>~])\s*", r"\1", src)
    src = src.replace(";}", "}")
    return src.strip()


def minify_js_safe(src: str) -> str:
    """Safe line-oriented JS minifier (strips /* */ comments and full-line // comments without breaking regex/strings)."""
    out_lines = []
    in_block = False
    for raw in src.splitlines():
        line = raw.strip()
        if not line:
            continue
        if in_block:
            end = line.find("*/")
            if end != -1:
                in_block = False
                line = line[end + 2:].strip()
                if not line:
                    continue
            else:
                continue
        if line.startswith("/*"):
            end = line.find("*/", 2)
            if end != -1:
                line = line[end + 2:].strip()
                if not line:
                    continue
            else:
                in_block = True
                continue
        if line.startswith("//"):
            continue
        out_lines.append(line)
    return "\n".join(out_lines) + "\n"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TPL_DIR = os.path.join(ROOT, "templates")
STATIC_DIR = os.path.join(ROOT, "static")
OUT_DIR = os.path.join(ROOT, "_site")
BASE_PATH = os.environ.get("PAGES_BASE_PATH", "/GDGoC-UHU-CTFd").rstrip("/")

with open(os.path.join(STATIC_DIR, "manifest.json"), encoding="utf-8") as f:
    MANIFEST = json.load(f)


class MockAssets:
    def css(self, key):
        entry = MANIFEST[key]
        href = f"{BASE_PATH}/static/{entry['file']}"
        return Markup(f'<link rel="stylesheet" href="{href}">')

    def js(self, key, type="module"):
        entry = MANIFEST[key]
        tags = []
        for imp in entry.get("imports", []):
            if imp in MANIFEST:
                imp_file = MANIFEST[imp]["file"]
                tags.append(f'<script type="module" src="{BASE_PATH}/static/{imp_file}"></script>')
        src = f"{BASE_PATH}/static/{entry['file']}"
        if type:
            tags.append(f'<script type="{type}" src="{src}"></script>')
        else:
            tags.append(f'<script src="{src}"></script>')
        return Markup("".join(tags))


class MockField:
    def __init__(self, name, label_text, field_type="text", input_type="text", required=True, description="", value=""):
        self.name = name
        self._label = label_text
        self.field_type = field_type
        self.input_type = input_type
        self.description = description
        self._value = value
        self.flags = SimpleNamespace(required=required)

    def label(self, **kwargs):
        cls = kwargs.get("class", "form-label")
        req = ' <span class="text-danger">*</span>' if self.flags.required else ""
        return Markup(f'<label class="{cls}" for="{self.name}">{self._label}</label>{req}')

    def __call__(self, **kwargs):
        cls = kwargs.get("class", "form-control")
        placeholder = kwargs.get("placeholder", "")
        autocomplete = kwargs.get("autocomplete", "")
        val = kwargs.get("value", self._value)
        if self.field_type == "select":
            if self.name == "language":
                return Markup(
                    f'<select class="{cls}" id="{self.name}" name="{self.name}">'
                    '<option value="es" selected>Español</option>'
                    '<option value="en">English</option>'
                    "</select>"
                )
            if self.name == "country":
                return Markup(
                    f'<select class="{cls}" id="{self.name}" name="{self.name}">'
                    '<option value="ES" selected>Spain</option>'
                    '<option value="PT">Portugal</option>'
                    '<option value="FR">France</option>'
                    "</select>"
                )
            return Markup(
                f'<select class="{cls}" id="{self.name}" name="{self.name}">'
                '<option value="name">Name</option>'
                '<option value="affiliation">Affiliation</option>'
                "</select>"
            )
        if self.field_type == "textarea":
            rows = kwargs.get("rows", "3")
            return Markup(f'<textarea class="{cls}" id="{self.name}" name="{self.name}" rows="{rows}">{val}</textarea>')
        if self.input_type == "submit":
            return Markup(f'<input class="{cls}" id="_submit" name="_submit" type="submit" value="{self._label}">')
        if self.input_type == "hidden":
            return Markup(f'<input id="{self.name}" name="{self.name}" type="hidden" value="demo-nonce">')
        req = " required" if self.flags.required else ""
        ac = f' autocomplete="{autocomplete}"' if autocomplete else ""
        ph = f' placeholder="{placeholder}"' if placeholder else ""
        val_attr = f' value="{val}"' if val else ""
        return Markup(f'<input class="{cls}" id="{self.name}" name="{self.name}" type="{self.input_type}"{val_attr}{ac}{ph}{req}>')


def mock_url_for(endpoint, **kwargs):
    if endpoint == "views.themes":
        return f"{BASE_PATH}/static/{kwargs['path']}"
    if endpoint == "views.files":
        return f"{BASE_PATH}/static/{kwargs.get('path', '')}"
    if endpoint == "users.public":
        return f"{BASE_PATH}/users/1/"
    mapping = {
        "views.static_html": f"{BASE_PATH}/",
        "challenges.listing": f"{BASE_PATH}/challenges/",
        "scoreboard.listing": f"{BASE_PATH}/scoreboard/",
        "users.listing": f"{BASE_PATH}/users/",
        "users.private": f"{BASE_PATH}/profile/",
        "teams.listing": f"{BASE_PATH}/scoreboard/",
        "teams.public": f"{BASE_PATH}/scoreboard/",
        "teams.private": f"{BASE_PATH}/scoreboard/",
        "auth.login": f"{BASE_PATH}/login/",
        "auth.register": f"{BASE_PATH}/register/",
        "auth.reset_password": f"{BASE_PATH}/login/",
        "auth.confirm": f"{BASE_PATH}/login/",
        "auth.logout": f"{BASE_PATH}/login/",
        "views.notifications": f"{BASE_PATH}/notifications/",
        "views.settings": f"{BASE_PATH}/settings/",
        "admin.view": f"{BASE_PATH}/settings/",
    }
    return mapping.get(endpoint, f"{BASE_PATH}/")


def pluralize_filter(val, singular="", plural="s"):
    return singular if val == 1 else plural


def isoformat_filter(val):
    return str(val)


MOCK_CHALLENGES = [
    {
        "id": 1,
        "name": "JWT None Bypass",
        "category": "Web",
        "value": 250,
        "solved_by_me": True,
        "solves": 14,
        "tags": [{"value": "jwt"}, {"value": "auth"}, {"value": "easy"}],
        "html": Markup("<p>El panel de administración confía demasiado en el campo <code>alg</code> del token JWT. Consigue acceso de administrador y recupera la flag.</p>"),
        "connection_info": "https://jwt-lab.gdguhu.com",
        "hints": [{"id": 101, "title": "Revisa la cabecera", "cost": 0, "content": "ok", "html": "<p>Decodifica el segmento Base64URL inicial y comprueba qué algoritmo acepta el servidor.</p>"}],
        "files": [],
    },
    {
        "id": 2,
        "name": "Log Injection 101",
        "category": "Web",
        "value": 350,
        "solved_by_me": False,
        "solves": 7,
        "tags": [{"value": "web"}, {"value": "ssti"}, {"value": "medium"}],
        "html": Markup("<p>El visor de registros procesa plantillas sin sanitizar. Encuentra la variable de entorno con el secreto.</p>"),
        "connection_info": "http://188.245.96.96:8002",
        "hints": [{"id": 102, "title": "Motor de plantillas", "cost": 25, "content": None, "html": ""}],
        "files": [],
    },
    {
        "id": 3,
        "name": "RSA Small Exponent",
        "category": "Criptografía",
        "value": 300,
        "solved_by_me": True,
        "solves": 11,
        "tags": [{"value": "rsa"}, {"value": "math"}],
        "html": Markup("<p>Hemos interceptado un mensaje cifrado con exponente público <code>e = 3</code> sin padding. Recupera el texto plano.</p>"),
        "connection_info": "nc ctf.gdguhu.com 1337",
        "hints": [],
        "files": [],
    },
    {
        "id": 4,
        "name": "Ghidra Vault Crackme",
        "category": "Reversing",
        "value": 450,
        "solved_by_me": False,
        "solves": 3,
        "tags": [{"value": "ghidra"}, {"value": "elf"}, {"value": "hard"}],
        "html": Markup("<p>Descompila el binario <code>vault_check</code> en Ghidra y reconstruye la clave XOR que desbloquea la flag.</p>"),
        "connection_info": "nc ctf.gdguhu.com 1338",
        "hints": [],
        "files": [],
    },
    {
        "id": 5,
        "name": "DNS Exfiltration",
        "category": "Forense",
        "value": 200,
        "solved_by_me": False,
        "solves": 9,
        "tags": [{"value": "pcap"}, {"value": "wireshark"}],
        "html": Markup("<p>Analiza la captura de tráfico de red y reconstruye los datos exfiltrados en subdominios DNS.</p>"),
        "connection_info": "",
        "hints": [],
        "files": [],
    },
    {
        "id": 6,
        "name": "PNG Polyglot",
        "category": "Forense",
        "value": 400,
        "solved_by_me": False,
        "solves": 4,
        "tags": [{"value": "stego"}, {"value": "binwalk"}],
        "html": Markup("<p>Esta insignia de GDGoC esconde un archivo comprimido tras el chunk <code>IEND</code>.</p>"),
        "connection_info": "",
        "hints": [],
        "files": [],
    },
]

# Portada completa fiel de arriba abajo a http://188.245.96.96/ adaptada a Cyber Neon
HOME_CONTENT = Markup("""
<div class="container my-3">
  <!-- HERO PRINCIPAL -->
  <div class="gdg-hero text-center">
    <div class="gdg-pill-badge">
      <span class="palette-dots">
        <span class="palette-dot dot-burdeos"></span>
        <span class="palette-dot dot-turquesa"></span>
        <span class="palette-dot dot-mostaza"></span>
      </span>
      <span>Google Developer Groups on Campus · Universidad de Huelva</span>
    </div>

    <h1 class="display-4 fw-bold mb-3">
      CyberTrainer <span class="theme-accent-text">CTF 2026</span>
    </h1>

    <p class="lead mx-auto mb-4 theme-text-secondary" style="max-width: 760px; font-size: 1.12rem;">
      Plataforma oficial de entrenamiento y competición en ciberseguridad impulsada por <strong class="theme-text-primary">GDG on Campus UHU</strong>.
      Resuelve retos de <em>Criptografía, Web, Forense, Reversing y Misc</em>.
    </p>

    <!-- FORMATO DE FLAG -->
    <div>
      <div class="small text-uppercase fw-bold theme-text-secondary" style="font-size: 0.78rem; letter-spacing: 0.06em;">Formato Oficial de Flag</div>
      <div class="flag-box">CLUB{ejemplo_de_flag_1337}</div>
    </div>

    <!-- CUENTA ATRÁS -->
    <div>
      <div class="countdown-box">
        <div id="countdown-status" class="small text-uppercase fw-bold" style="color: #FFE600; letter-spacing: 0.05em;">
          ⏳ TIEMPO RESTANTE PARA EL INICIO:
        </div>
        <div class="countdown-grid" id="countdown-timer">
          <div class="countdown-item"><div class="countdown-num" id="cd-days">00</div><div class="countdown-label">Días</div></div>
          <div class="countdown-item"><div class="countdown-num" id="cd-hours">00</div><div class="countdown-label">Horas</div></div>
          <div class="countdown-item"><div class="countdown-num" id="cd-mins">00</div><div class="countdown-label">Minutos</div></div>
          <div class="countdown-item"><div class="countdown-num" id="cd-secs">00</div><div class="countdown-label">Segundos</div></div>
        </div>
      </div>
    </div>

    <!-- BOTONES DE ACCIÓN -->
    <div class="d-flex justify-content-center gap-3 flex-wrap mt-4">
      <a href="__BASE__/register/" class="btn btn-primary btn-lg px-4 fw-bold">🚀 Registrarse</a>
      <a href="__BASE__/challenges/" class="theme-pill-btn px-4 py-2" style="font-size: 0.95rem;">🎯 Ver Retos</a>
      <a href="__BASE__/scoreboard/" class="theme-pill-btn px-4 py-2" style="font-size: 0.95rem;">🏆 Scoreboard</a>
      <a href="https://gdguhu.com" target="_blank" rel="noopener noreferrer" class="theme-pill-btn px-4 py-2" style="font-size: 0.95rem;">🌐 gdguhu.com</a>
    </div>
  </div>

  <!-- TARJETAS DE CATEGORÍAS -->
  <div class="row mt-4 g-4">
    <div class="col-md-4 col-sm-6">
      <div class="feature-card border-burdeos">
        <div class="icon-bubble bubble-burdeos">🔐</div>
        <h5 class="fw-bold mb-2 theme-text-primary">Criptografía &amp; Reversing</h5>
        <p class="small mb-0 theme-text-secondary">RSA, Diffie-Hellman, cifrados afines, LCG, descompilación en C/Ghidra y validadores binarios.</p>
      </div>
    </div>
    <div class="col-md-4 col-sm-6">
      <div class="feature-card border-turquesa">
        <div class="icon-bubble bubble-turquesa">🌐</div>
        <h5 class="fw-bold mb-2 theme-text-primary">Web &amp; Protocolos</h5>
        <p class="small mb-0 theme-text-secondary">Auditoría de cookies, tokens JWT sin firma, inyecciones en logs, evasión de expresiones regulares y APIs.</p>
      </div>
    </div>
    <div class="col-md-4 col-sm-12">
      <div class="feature-card border-mostaza">
        <div class="icon-bubble bubble-mostaza">🕵️</div>
        <h5 class="fw-bold mb-2 theme-text-primary">Forense &amp; Estego</h5>
        <p class="small mb-0 theme-text-secondary">Capturas PCAP de Wireshark, exfiltración DNS, archivos políglotas, cabeceras PNG y memoria.</p>
      </div>
    </div>
  </div>

  <!-- REGLAS & CRONOGRAMA -->
  <div class="row mt-3 g-4">
    <div class="col-md-7">
      <div class="feature-card border-turquesa">
        <h4 class="fw-bold mb-3 theme-text-primary">📜 Reglas de la Competición &amp; Fair Play</h4>
        <ul class="mb-0 ps-3 theme-text-secondary" style="line-height: 1.85;">
          <li><strong class="theme-text-primary">Prohibido atacar la infraestructura:</strong> No realices ataques DoS/DDoS, fuzzing masivo ni escaneos agresivos contra el servidor de CTFd.</li>
          <li><strong class="theme-text-primary">No compartir flags ni soluciones:</strong> La competición evalúa el aprendizaje propio. Compartir flags acarrea descalificación directa.</li>
          <li><strong class="theme-text-primary">Puntuación Dinámica:</strong> El valor en puntos decae según las resoluciones, premiando retos complejos o ser el primero en resolver.</li>
          <li><strong class="theme-text-primary">Scoreboard Brackets:</strong> Elige tu categoría correspondiente al crear tu cuenta para competir en tu tabla oficial.</li>
        </ul>
      </div>
    </div>

    <div class="col-md-5">
      <div class="feature-card border-burdeos d-flex flex-column justify-content-between">
        <div>
          <h4 class="fw-bold mb-3 theme-text-primary">⏱️ Cronograma &amp; Comunidad</h4>
          <table class="table table-borderless table-sm mb-3">
            <tbody>
              <tr>
                <td>🟢 <strong>Registro:</strong></td>
                <td class="text-end fw-bold" style="color: #00F0FF;">Abierto con Código</td>
              </tr>
              <tr>
                <td>🚀 <strong>Inicio Oficial:</strong></td>
                <td class="text-end fw-bold theme-text-primary">Viernes 18:00h</td>
              </tr>
              <tr>
                <td>❄️ <strong>Scoreboard Freeze:</strong></td>
                <td class="text-end fw-bold" style="color: #FFE600;">Domingo 17:00h</td>
              </tr>
              <tr>
                <td>🏁 <strong>Cierre del CTF:</strong></td>
                <td class="text-end fw-bold" style="color: #FF007F;">Domingo 18:00h</td>
              </tr>
            </tbody>
          </table>
        </div>
        <a href="https://gdguhu.com" target="_blank" rel="noopener noreferrer" class="btn btn-primary w-100 fw-bold mt-2">
          Visitar GDG on Campus UHU
        </a>
      </div>
    </div>
  </div>
</div>

<script>
  (function () {
    const START_DATE  = new Date("2026-11-20T18:00:00").getTime();
    const FREEZE_DATE = new Date("2026-11-22T17:00:00").getTime();
    const END_DATE    = new Date("2026-11-22T18:00:00").getTime();

    function updateCountdown() {
      const now = new Date().getTime();
      let target = START_DATE;
      const statusEl = document.getElementById("countdown-status");
      if (!statusEl) return;

      if (now < START_DATE) {
        target = START_DATE;
        statusEl.innerText = "⏳ TIEMPO RESTANTE PARA EL INICIO:";
        statusEl.style.color = "#FFE600";
      } else if (now < FREEZE_DATE) {
        target = FREEZE_DATE;
        statusEl.innerText = "🔥 CTF EN CURSO · TIEMPO HASTA CONGELAR MARCADOR (FREEZE):";
        statusEl.style.color = "#00F0FF";
      } else if (now < END_DATE) {
        target = END_DATE;
        statusEl.innerText = "❄️ MARCADOR CONGELADO · TIEMPO PARA EL CIERRE FINAL:";
        statusEl.style.color = "#FF007F";
      } else {
        statusEl.innerText = "🏁 LA COMPETICIÓN HA FINALIZADO · ¡GRACIAS POR PARTICIPAR!";
        statusEl.style.color = "#FF007F";
        return;
      }

      const diff = Math.max(0, target - now);
      document.getElementById("cd-days").innerText  = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(2, "0");
      document.getElementById("cd-hours").innerText = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, "0");
      document.getElementById("cd-mins").innerText  = String(Math.floor((diff / 1000 / 60)) % 60).padStart(2, "0");
      document.getElementById("cd-secs").innerText  = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
    }
    setInterval(updateCountdown, 1000);
    updateCountdown();
  })();
</script>
""".replace("__BASE__", BASE_PATH))


def build():
    if os.path.exists(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR, exist_ok=True)
    shutil.copytree(STATIC_DIR, os.path.join(OUT_DIR, "static"))

    # Generate minified single-request production assets for live CTFd (`cyber.min.css` & `cyber-bundle.min.js`)
    with open(os.path.join(STATIC_DIR, "css/cyber.css"), encoding="utf-8") as f:
        css_min = minify_css(f.read())
    with open(os.path.join(OUT_DIR, "static/css/cyber.min.css"), "w", encoding="utf-8") as f:
        f.write(css_min)

    with open(os.path.join(STATIC_DIR, "js/cyber-bridge.js"), encoding="utf-8") as f:
        bridge_js = f.read()
    with open(os.path.join(STATIC_DIR, "js/cyber.js"), encoding="utf-8") as f:
        cyber_js = f.read()
    bundle_min = minify_js_safe(bridge_js) + "\n" + minify_js_safe(cyber_js)
    with open(os.path.join(OUT_DIR, "static/js/cyber-bundle.min.js"), "w", encoding="utf-8") as f:
        f.write(bundle_min)
    print(f"Generated cyber.min.css ({len(css_min)} B) and cyber-bundle.min.js ({len(bundle_min)} B)")

    env = Environment(
        loader=FileSystemLoader(TPL_DIR),
        extensions=["jinja2.ext.i18n"],
        autoescape=True,
    )
    env.install_gettext_callables(
        gettext=lambda s: s,
        ngettext=lambda s, p, n: s if n == 1 else p,
        newstyle=True,
    )
    env.filters["pluralize"] = pluralize_filter
    env.filters["isoformat"] = isoformat_filter

    mock_api_tag = Markup(f'<script src="{BASE_PATH}/static/js/pages-mock-api.js"></script>')

    def make_ctx(authed_state=True, admin_state=True):
        return {
            "title": "GDGoC UHU CyberTrainer",
            "meta": "",
            "Assets": MockAssets(),
            "url_for": mock_url_for,
            "get_locale": lambda: "en",
            "authed": lambda: authed_state,
            "is_admin": lambda: admin_state,
            "registration_visible": lambda: True,
            "scores_visible": lambda: True,
            "can_send_mail": lambda: False,
            "get_mode_as_word": lambda capitalize=False: "User" if capitalize else "user",
            "lookup_country_code": lambda code: {"ES": "Spain", "PT": "Portugal"}.get(code, code),
            "Configs": SimpleNamespace(
                ctf_name="GDGoC UHU CyberTrainer",
                ctf_logo=None,
                ctf_small_icon=None,
                user_mode="users",
                account_visibility="public",
                score_visibility="public",
                start=None,
                end=None,
                theme_settings={},
                theme_header=mock_api_tag,
                theme_footer="",
                view_self_submissions=False,
                social_shares=False,
                challenge_ratings="disabled",
                tos_or_privacy=False,
            ),
            "Session": SimpleNamespace(id=1 if authed_state else 0, nonce="demo-csrf-nonce"),
            "User": SimpleNamespace(
                name="0xHuelva_Root" if authed_state else None,
                email="root@gdguhu.com" if authed_state else None,
                verified=True if authed_state else None,
            ),
            "Team": SimpleNamespace(id=None, name=None),
            "Plugins": SimpleNamespace(styles="", scripts="", user_menu_pages=[]),
            "Languages": SimpleNamespace(names={"es": "Español", "en": "English"}),
            "request": SimpleNamespace(script_root=BASE_PATH, args={}),
            "integrations": SimpleNamespace(mlc=lambda: False),
            "infos": [],
            "errors": [],
            "Forms": SimpleNamespace(
                auth=SimpleNamespace(
                    LoginForm=lambda: SimpleNamespace(
                        name=MockField("name", "User Name or Email"),
                        password=MockField("password", "Password", input_type="password"),
                        submit=MockField("_submit", "Submit", input_type="submit"),
                        nonce=MockField("nonce", "", input_type="hidden"),
                    ),
                    RegistrationForm=lambda: SimpleNamespace(
                        name=MockField("name", "User Name"),
                        email=MockField("email", "Email", input_type="email"),
                        password=MockField("password", "Password", input_type="password"),
                        extra=[MockField("registration_code", "Registration Code", description="Registration code required to create account")],
                        submit=MockField("_submit", "Submit", input_type="submit"),
                        nonce=MockField("nonce", "", input_type="hidden"),
                    ),
                ),
                users=SimpleNamespace(
                    PublicUserSearchForm=lambda field=None, q=None: SimpleNamespace(
                        field=MockField("field", "Field", field_type="select", required=False),
                        q=MockField("q", "Search", required=False, description="Search for matching users"),
                    ),
                ),
                self=SimpleNamespace(
                    SettingsForm=lambda language="en", country="ES": SimpleNamespace(
                        name=MockField("name", "Username", value="0xHuelva_Root"),
                        email=MockField("email", "Email", input_type="email", value="root@gdguhu.com"),
                        language=MockField("language", "Preferred Language", field_type="select", required=False),
                        confirm=MockField("confirm", "Current Password", input_type="password", required=False),
                        password=MockField("password", "New Password", input_type="password", required=False),
                        affiliation=MockField("affiliation", "Affiliation", required=False, value="Universidad de Huelva"),
                        website=MockField("website", "Website", required=False, value="https://gdguhu.com"),
                        country=MockField("country", "Country", field_type="select", required=False),
                        extra=[],
                        submit=MockField("_submit", "Submit", input_type="submit"),
                    ),
                    TokensForm=lambda: SimpleNamespace(
                        expiration=MockField("expiration", "Expiration", input_type="date", required=False),
                        description=MockField("description", "Description", field_type="textarea", required=False),
                        submit=MockField("_submit", "Generate", input_type="submit"),
                    ),
                ),
            ),
        }

    base_ctx = make_ctx(authed_state=True, admin_state=True)
    guest_ctx = make_ctx(authed_state=False, admin_state=False)

    # Pre-render templates/challenge.html for each mock challenge
    chal_tpl = env.get_template("challenge.html")
    rendered_views = {}
    for ch in MOCK_CHALLENGES:
        chal_obj = SimpleNamespace(
            id=ch["id"],
            name=ch["name"],
            value=ch["value"],
            html=ch["html"],
            connection_info=ch["connection_info"],
            byline="",
            solution_id=None,
        )
        hints_objs = [SimpleNamespace(**h) for h in ch["hints"]]
        rendered_views[ch["id"]] = chal_tpl.render(
            **base_ctx,
            challenge=chal_obj,
            tags=[t["value"] for t in ch["tags"]],
            hints=hints_objs,
            files=ch["files"],
            solves=ch["solves"],
            max_attempts=0,
            attempts=0,
            rating=None,
            ratings=SimpleNamespace(average=None, count=0),
        )

    mock_api_js = f"""
(function () {{
  "use strict";
  var BASE = {json.dumps(BASE_PATH)};
  var CHALLENGES = {json.dumps([
      {
          "id": c["id"],
          "name": c["name"],
          "category": c["category"],
          "value": c["value"],
          "solved_by_me": c["solved_by_me"],
          "solves": c["solves"],
          "tags": c["tags"],
          "type": "standard",
      }
      for c in MOCK_CHALLENGES
  ], ensure_ascii=False)};
  var VIEWS = {json.dumps(rendered_views, ensure_ascii=False)};
  var STANDINGS = [
    {{ pos: 1, account_id: 1, account_url: BASE + "/users/1/", name: "0xHuelva_Root", score: 1450, bracket_id: 1, bracket_name: "ETSI UHU" }},
    {{ pos: 2, account_id: 2, account_url: BASE + "/users/1/", name: "cyber_tartessos", score: 1200, bracket_id: 1, bracket_name: "ETSI UHU" }},
    {{ pos: 3, account_id: 3, account_url: BASE + "/users/1/", name: "neo_gdg", score: 950, bracket_id: 2, bracket_name: "Invitado" }},
    {{ pos: 4, account_id: 4, account_url: BASE + "/users/1/", name: "pwn_andaluz", score: 700, bracket_id: 1, bracket_name: "ETSI UHU" }}
  ];
  var TOP_GRAPH = {{
    "1": {{ id: 1, name: "0xHuelva_Root", solves: [
      {{ value: 250, date: "2026-11-20T18:15:00Z" }},
      {{ value: 300, date: "2026-11-20T19:00:00Z" }},
      {{ value: 450, date: "2026-11-20T20:20:00Z" }},
      {{ value: 450, date: "2026-11-20T21:40:00Z" }}
    ] }},
    "2": {{ id: 2, name: "cyber_tartessos", solves: [
      {{ value: 250, date: "2026-11-20T18:30:00Z" }},
      {{ value: 350, date: "2026-11-20T19:40:00Z" }},
      {{ value: 300, date: "2026-11-20T20:50:00Z" }},
      {{ value: 300, date: "2026-11-20T22:10:00Z" }}
    ] }},
    "3": {{ id: 3, name: "neo_gdg", solves: [
      {{ value: 200, date: "2026-11-20T18:45:00Z" }},
      {{ value: 350, date: "2026-11-20T20:10:00Z" }},
      {{ value: 400, date: "2026-11-20T21:55:00Z" }}
    ] }}
  }};
  var USER_SOLVES = [
    {{ challenge_id: 1, challenge: {{ id: 1, name: "JWT None Bypass", category: "Web", value: 250 }}, date: "2026-11-20T18:15:00Z", type: "correct" }},
    {{ challenge_id: 3, challenge: {{ id: 3, name: "RSA Small Exponent", category: "Criptografía", value: 300 }}, date: "2026-11-20T19:00:00Z", type: "correct" }},
    {{ challenge_id: 4, challenge: {{ id: 4, name: "Ghidra Vault Crackme", category: "Reversing", value: 450 }}, date: "2026-11-20T20:20:00Z", type: "correct" }},
    {{ challenge_id: 6, challenge: {{ id: 6, name: "PNG Polyglot", category: "Forense", value: 450 }}, date: "2026-11-20T21:40:00Z", type: "correct" }}
  ];
  var USER_FAILS = [
    {{ challenge_id: 2, date: "2026-11-20T19:15:00Z", type: "incorrect" }}
  ];

  function jsonResp(obj) {{
    return Promise.resolve(new Response(JSON.stringify(obj), {{
      status: 200,
      headers: {{ "Content-Type": "application/json" }}
    }}));
  }}

  if (typeof window.EventSource !== "undefined") {{
    window.EventSource = function () {{
      return {{ addEventListener: function () {{}}, close: function () {{}} }};
    }};
  }}

  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {{
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.indexOf("/api/v1/") === -1) return origFetch(input, init);

    if (/\\/api\\/v1\\/challenges\\/attempt/.test(url)) {{
      var body = {{}};
      try {{ body = JSON.parse((init && init.body) || "{{}}"); }} catch (e) {{}}
      var sub = (body.submission || "").trim();
      var cid = Number(body.challenge_id);
      var ch = CHALLENGES.find(function (c) {{ return c.id === cid; }});
      if (ch && ch.solved_by_me) {{
        return jsonResp({{ success: true, data: {{ status: "already_solved", message: "You already solved this" }} }});
      }}
      if (sub.indexOf("CLUB{{") === 0 && sub.slice(-1) === "}}") {{
        if (ch) {{ ch.solved_by_me = true; ch.solves += 1; }}
        return jsonResp({{ success: true, data: {{ status: "correct", message: "Correct" }} }});
      }}
      return jsonResp({{ success: true, data: {{ status: "incorrect", message: "Incorrect — prueba formato CLUB{{...}}" }} }});
    }}

    var mSolves = url.match(/\\/api\\/v1\\/challenges\\/(\\d+)\\/solves/);
    if (mSolves) {{
      return jsonResp({{ success: true, data: [
        {{ account_id: 1, name: "0xHuelva_Root", account_url: BASE + "/users/1/", date: "2026-11-20T18:15:00Z" }},
        {{ account_id: 2, name: "cyber_tartessos", account_url: BASE + "/users/1/", date: "2026-11-20T18:30:00Z" }}
      ] }});
    }}

    var mChal = url.match(/\\/api\\/v1\\/challenges\\/(\\d+)/);
    if (mChal) {{
      var id = Number(mChal[1]);
      var found = CHALLENGES.find(function (c) {{ return c.id === id; }});
      if (found) {{
        return jsonResp({{ success: true, data: Object.assign({{}}, found, {{ view: VIEWS[id] || "" }}) }});
      }}
    }}

    if (/\\/api\\/v1\\/challenges(?:\\?|$)/.test(url)) {{
      return jsonResp({{ success: true, data: CHALLENGES }});
    }}

    if (/\\/api\\/v1\\/scoreboard\\/top\\//.test(url)) {{
      return jsonResp({{ success: true, data: TOP_GRAPH }});
    }}

    if (/\\/api\\/v1\\/scoreboard(?:\\?|$)/.test(url)) {{
      return jsonResp({{ success: true, data: STANDINGS }});
    }}

    if (/\\/api\\/v1\\/brackets/.test(url)) {{
      return jsonResp({{ success: true, data: [
        {{ id: 1, name: "ETSI UHU", type: "users" }},
        {{ id: 2, name: "Invitado", type: "users" }}
      ] }});
    }}

    if (/\\/api\\/v1\\/users\\/(?:me|\\d+)\\/solves/.test(url)) {{
      return jsonResp({{ success: true, data: USER_SOLVES }});
    }}
    if (/\\/api\\/v1\\/users\\/(?:me|\\d+)\\/fails/.test(url)) {{
      return jsonResp({{ success: true, data: USER_FAILS }});
    }}
    if (/\\/api\\/v1\\/users\\/(?:me|\\d+)\\/awards/.test(url)) {{
      return jsonResp({{ success: true, data: [] }});
    }}

    var mHint = url.match(/\\/api\\/v1\\/hints\\/(\\d+)/);
    if (mHint) {{
      return jsonResp({{ success: true, data: {{ id: Number(mHint[1]), cost: 25, content: "ok", html: "<p>Prueba expresiones <code>{{{{7*7}}}}</code> en el parámetro del visor.</p>" }} }});
    }}

    return jsonResp({{ success: true, data: [] }});
  }};
}})();
"""
    with open(os.path.join(OUT_DIR, "static/js/pages-mock-api.js"), "w", encoding="utf-8") as f:
        f.write(mock_api_js)

    def write_page(rel_path, tpl_name, ctx=None, **extra):
        full = os.path.join(OUT_DIR, rel_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        html = env.get_template(tpl_name).render(**(ctx or base_ctx), **extra)
        with open(full, "w", encoding="utf-8") as f:
            f.write(html)

    mock_solves = [
        SimpleNamespace(challenge=SimpleNamespace(id=1, name="JWT None Bypass", category="Web", value=250), date="2026-11-20T18:15:00Z"),
        SimpleNamespace(challenge=SimpleNamespace(id=3, name="RSA Small Exponent", category="Criptografía", value=300), date="2026-11-20T19:00:00Z"),
        SimpleNamespace(challenge=SimpleNamespace(id=4, name="Ghidra Vault Crackme", category="Reversing", value=450), date="2026-11-20T20:20:00Z"),
        SimpleNamespace(challenge=SimpleNamespace(id=6, name="PNG Polyglot", category="Forense", value=450), date="2026-11-20T21:40:00Z"),
    ]
    mock_awards = [
        SimpleNamespace(name="First Blood · Reversing", category="Bonus", description="Primera resolución del reto Ghidra Vault Crackme", icon="shield", value=50),
    ]
    mock_profile_user = SimpleNamespace(
        id=1,
        name="0xHuelva_Root",
        team_id=None,
        team=None,
        oauth_id=None,
        affiliation="Universidad de Huelva · ETSI",
        country="ES",
        bracket_id=1,
        bracket=SimpleNamespace(name="ETSI UHU"),
        fields=[],
        website="https://gdguhu.com",
        solves=mock_solves,
        awards=mock_awards,
    )
    mock_profile_account = SimpleNamespace(
        place="1st",
        score=1450,
        get_score=lambda admin=False: 1450,
    )

    mock_users = SimpleNamespace(
        items=[
            SimpleNamespace(id=1, name="0xHuelva_Root", bracket_id=1, bracket=SimpleNamespace(name="ETSI UHU"), oauth_id=None, website="https://github.com/arixlariel", affiliation="Google Developer Group on Campus UHU", country="ES"),
            SimpleNamespace(id=2, name="cyber_tartessos", bracket_id=1, bracket=SimpleNamespace(name="ETSI UHU"), oauth_id=None, website="https://gdguhu.com", affiliation="ETSI · Ingeniería Informática", country="ES"),
            SimpleNamespace(id=3, name="neo_gdg", bracket_id=2, bracket=SimpleNamespace(name="Invitado"), oauth_id=None, website=None, affiliation="Universidad de Huelva", country="PT"),
        ],
        page=1,
        pages=1,
        total=3,
        next_num=None,
    )

    mock_notifications = [
        SimpleNamespace(
            title="🚀 ¡Arranca CyberTrainer CTF 2026!",
            date="2026-11-20T18:00:00Z",
            html=Markup("<p>Ya están activos todos los retos de <strong>Criptografía, Reversing con Ghidra, Web y Forense</strong>. Recuerda el formato oficial de flag: <code>CLUB{...}</code>.</p>"),
        ),
        SimpleNamespace(
            title="⚡ Nueva pista desbloqueada en Log Injection 101",
            date="2026-11-21T11:30:00Z",
            html=Markup("<p>Hemos añadido una pista gratuita para orientar la detección del motor de plantillas. ¡Mucho ánimo a todos los participantes!</p>"),
        ),
    ]

    mock_tokens = [
        SimpleNamespace(id=1, created="2026-11-20T17:00:00Z", expiration="2026-12-20T17:00:00Z", description="CLI Sync GDGoC"),
    ]

    # Full website preview matching http://188.245.96.96/ from top to bottom
    write_page("index.html", "page.html", content=HOME_CONTENT)
    write_page("home/index.html", "page.html", content=HOME_CONTENT)
    write_page("challenges/index.html", "challenges.html")
    write_page("scoreboard/index.html", "scoreboard.html")
    write_page("users/index.html", "users/users.html", users=mock_users, q=None, field=None, prev_page="#", next_page="#")
    write_page("users/1/index.html", "users/public.html", user=mock_profile_user, account=mock_profile_account)
    write_page("profile/index.html", "users/private.html", user=mock_profile_user, account=mock_profile_account)
    write_page(
        "settings/index.html",
        "settings.html",
        name="0xHuelva_Root",
        email="root@gdguhu.com",
        language="es",
        affiliation="Universidad de Huelva · ETSI",
        website="https://gdguhu.com",
        country="ES",
        tokens=mock_tokens,
    )
    write_page("notifications/index.html", "notifications.html", notifications=mock_notifications)
    # Render Login & Register with guest navbar so Login/Register buttons can also be inspected directly
    write_page("login/index.html", "login.html", ctx=guest_ctx, name="", password="")
    write_page("register/index.html", "register.html", ctx=guest_ctx, name="", email="", password="")
    write_page("404.html", "errors/404.html")
    open(os.path.join(OUT_DIR, ".nojekyll"), "w").close()
    print("Built full GitHub Pages preview into _site/ successfully.")


if __name__ == "__main__":
    build()
