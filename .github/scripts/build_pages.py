#!/usr/bin/env python3
"""
Builds a static interactive GitHub Pages preview (_site/) directly from the real
CTFd Jinja2 templates (templates/) and real static assets (static/).
Hosted at https://arixlariel.github.io/GDGoC-UHU-CTFd/ (no CNAME / independent of gdguhu.com).
"""

import json
import os
import shutil
from types import SimpleNamespace
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup

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
    def __init__(self, name, label_text, field_type="text", input_type="text", required=True, description=""):
        self.name = name
        self._label = label_text
        self.field_type = field_type
        self.input_type = input_type
        self.description = description
        self.flags = SimpleNamespace(required=required)

    def label(self, **kwargs):
        cls = kwargs.get("class", "form-label")
        req = ' <span class="text-danger">*</span>' if self.flags.required else ""
        return Markup(f'<label class="{cls}" for="{self.name}">{self._label}</label>{req}')

    def __call__(self, **kwargs):
        cls = kwargs.get("class", "form-control")
        placeholder = kwargs.get("placeholder", "")
        autocomplete = kwargs.get("autocomplete", "")
        if self.field_type == "select":
            return Markup(
                f'<select class="{cls}" id="{self.name}" name="{self.name}">'
                '<option value="name">Name</option>'
                '<option value="affiliation">Affiliation</option>'
                "</select>"
            )
        if self.input_type == "submit":
            return Markup(f'<input class="{cls}" id="_submit" name="_submit" type="submit" value="{self._label}">')
        if self.input_type == "hidden":
            return Markup(f'<input id="{self.name}" name="{self.name}" type="hidden" value="demo-nonce">')
        req = " required" if self.flags.required else ""
        ac = f' autocomplete="{autocomplete}"' if autocomplete else ""
        ph = f' placeholder="{placeholder}"' if placeholder else ""
        return Markup(f'<input class="{cls}" id="{self.name}" name="{self.name}" type="{self.input_type}"{ac}{ph}{req}>')


def mock_url_for(endpoint, **kwargs):
    if endpoint == "views.themes":
        return f"{BASE_PATH}/static/{kwargs['path']}"
    if endpoint == "views.files":
        return f"{BASE_PATH}/static/{kwargs.get('path', '')}"
    mapping = {
        "views.static_html": f"{BASE_PATH}/home/",
        "challenges.listing": f"{BASE_PATH}/",
        "scoreboard.listing": f"{BASE_PATH}/scoreboard/",
        "users.listing": f"{BASE_PATH}/users/",
        "users.public": f"{BASE_PATH}/users/",
        "users.private": f"{BASE_PATH}/users/",
        "teams.listing": f"{BASE_PATH}/scoreboard/",
        "teams.public": f"{BASE_PATH}/scoreboard/",
        "teams.private": f"{BASE_PATH}/scoreboard/",
        "auth.login": f"{BASE_PATH}/login/",
        "auth.register": f"{BASE_PATH}/register/",
        "auth.reset_password": f"{BASE_PATH}/login/",
        "auth.confirm": f"{BASE_PATH}/login/",
        "auth.logout": f"{BASE_PATH}/",
        "views.notifications": f"{BASE_PATH}/notifications/",
        "views.settings": f"{BASE_PATH}/login/",
        "admin.view": f"{BASE_PATH}/",
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
        "name": "LCG Predictor",
        "category": "Criptografía",
        "value": 450,
        "solved_by_me": False,
        "solves": 3,
        "tags": [{"value": "prng"}, {"value": "hard"}],
        "html": Markup("<p>El generador de tokens usa un Linear Congruential Generator clásico. Predice el siguiente código de recuperación.</p>"),
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

HOME_CONTENT = Markup("""
<div class="container my-4">
  <div class="gdg-hero text-center p-4 p-md-5 rounded-4">
    <div class="gdg-pill-badge px-3 py-2 rounded-pill d-inline-flex align-items-center gap-2 mb-3">
      <span class="cyber-dots">
        <span class="cyber-dot cyber-dot--1"></span>
        <span class="cyber-dot cyber-dot--2"></span>
        <span class="cyber-dot cyber-dot--3"></span>
      </span>
      <span>Google Developer Groups on Campus · Universidad de Huelva</span>
    </div>
    <h1 class="display-4 fw-bold mb-3 theme-text-primary">
      CyberTrainer <span class="theme-accent-text">CTF 2026</span>
    </h1>
    <p class="lead mx-auto mb-4 theme-text-secondary" style="max-width:760px;">
      Plataforma oficial de entrenamiento y competición en ciberseguridad impulsada por <strong>GDG on Campus UHU</strong>.
      Resuelve retos de <em>Criptografía, Web, Forense, Reversing y Misc</em>.
    </p>
    <div>
      <div class="small text-uppercase fw-bold theme-text-secondary" style="font-size:0.78rem; letter-spacing:0.05em;">Formato Oficial de Flag</div>
      <div class="flag-box px-4 py-2 rounded-3 d-inline-block font-mono fw-bold my-3">CLUB{ejemplo_de_flag_1337}</div>
    </div>
    <div class="d-flex justify-content-center gap-3 flex-wrap mt-3">
      <a href="__BASE__/register/" class="btn btn-primary btn-lg px-4">🚀 Registrarse</a>
      <a href="__BASE__/" class="theme-pill-btn px-4 py-2">🎯 Ver Retos</a>
      <a href="__BASE__/scoreboard/" class="theme-pill-btn px-4 py-2">🏆 Scoreboard</a>
      <a href="https://gdguhu.com" target="_blank" rel="noopener noreferrer" class="theme-pill-btn px-4 py-2">🌐 gdguhu.com</a>
    </div>
  </div>

  <div class="row mt-4 g-4">
    <div class="col-md-4">
      <div class="feature-card p-4 rounded-4 h-100">
        <h5 class="fw-bold mb-2 theme-text-primary">🔐 Criptografía &amp; Reversing</h5>
        <p class="small mb-0 theme-text-secondary">RSA, Diffie-Hellman, cifrados afines, LCG, descompilación en C/Ghidra y validadores binarios.</p>
      </div>
    </div>
    <div class="col-md-4">
      <div class="feature-card p-4 rounded-4 h-100">
        <h5 class="fw-bold mb-2 theme-text-primary">🌐 Web &amp; Protocolos</h5>
        <p class="small mb-0 theme-text-secondary">Auditoría de cookies, tokens JWT sin firma, inyecciones en logs, evasión de expresiones regulares y APIs.</p>
      </div>
    </div>
    <div class="col-md-4">
      <div class="feature-card p-4 rounded-4 h-100">
        <h5 class="fw-bold mb-2 theme-text-primary">🕵️ Forense &amp; Estego</h5>
        <p class="small mb-0 theme-text-secondary">Capturas PCAP de Wireshark, exfiltración DNS, archivos políglotas, cabeceras PNG y memoria.</p>
      </div>
    </div>
  </div>
</div>
""".replace("__BASE__", BASE_PATH))


def build():
    if os.path.exists(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR, exist_ok=True)
    shutil.copytree(STATIC_DIR, os.path.join(OUT_DIR, "static"))

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

    base_ctx = {
        "title": "CyberTrainer GDGoC UHU",
        "meta": "",
        "Assets": MockAssets(),
        "url_for": mock_url_for,
        "get_locale": lambda: "es",
        "authed": lambda: False,
        "is_admin": lambda: False,
        "registration_visible": lambda: True,
        "scores_visible": lambda: True,
        "can_send_mail": lambda: False,
        "get_mode_as_word": lambda capitalize=False: "User" if capitalize else "user",
        "lookup_country_code": lambda code: code,
        "Configs": SimpleNamespace(
            ctf_name="CyberTrainer GDGoC UHU",
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
        "Session": SimpleNamespace(id=0, nonce="demo-csrf-nonce"),
        "User": SimpleNamespace(name=None, email=None, verified=None),
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
        ),
    }

    # Pre-render the real templates/challenge.html for each mock challenge
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

    # Write mock API JS for the GitHub Pages live preview
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
    {{ pos: 1, account_id: 1, account_url: BASE + "/users/", name: "0xHuelva_Root", score: 1450, bracket_id: 1, bracket_name: "ETSI UHU" }},
    {{ pos: 2, account_id: 2, account_url: BASE + "/users/", name: "cyber_tartessos", score: 1200, bracket_id: 1, bracket_name: "ETSI UHU" }},
    {{ pos: 3, account_id: 3, account_url: BASE + "/users/", name: "neo_gdg", score: 950, bracket_id: 2, bracket_name: "Invitado" }},
    {{ pos: 4, account_id: 4, account_url: BASE + "/users/", name: "pwn_andaluz", score: 700, bracket_id: 1, bracket_name: "ETSI UHU" }}
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

  function jsonResp(obj) {{
    return Promise.resolve(new Response(JSON.stringify(obj), {{
      status: 200,
      headers: {{ "Content-Type": "application/json" }}
    }}));
  }}

  // Avoid SSE /events 404 noise on static GitHub Pages
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
        {{ account_id: 1, name: "0xHuelva_Root", account_url: BASE + "/users/", date: "2026-11-20T18:15:00Z" }},
        {{ account_id: 2, name: "cyber_tartessos", account_url: BASE + "/users/", date: "2026-11-20T18:30:00Z" }}
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

    def write_page(rel_path, tpl_name, **extra):
        full = os.path.join(OUT_DIR, rel_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        html = env.get_template(tpl_name).render(**base_ctx, **extra)
        with open(full, "w", encoding="utf-8") as f:
            f.write(html)

    mock_users = SimpleNamespace(
        items=[
            SimpleNamespace(id=1, name="0xHuelva_Root", bracket_id=1, bracket=SimpleNamespace(name="ETSI UHU"), oauth_id=None, website="https://gdguhu.com", affiliation="Universidad de Huelva", country="ES"),
            SimpleNamespace(id=2, name="cyber_tartessos", bracket_id=1, bracket=SimpleNamespace(name="ETSI UHU"), oauth_id=None, website=None, affiliation="ETSI · Ingeniería Informática", country="ES"),
            SimpleNamespace(id=3, name="neo_gdg", bracket_id=2, bracket=SimpleNamespace(name="Invitado"), oauth_id=None, website=None, affiliation="GDG on Campus", country="ES"),
        ],
        page=1,
        pages=1,
        total=3,
        next_num=None,
    )

    write_page("index.html", "challenges.html")
    write_page("challenges/index.html", "challenges.html")
    write_page("scoreboard/index.html", "scoreboard.html")
    write_page("login/index.html", "login.html", name="", password="")
    write_page("register/index.html", "register.html", name="", email="", password="")
    write_page("users/index.html", "users/users.html", users=mock_users, q=None, field=None, prev_page="#", next_page="#")
    write_page("notifications/index.html", "notifications.html", notifications=[])
    write_page("home/index.html", "page.html", content=HOME_CONTENT)
    write_page("404.html", "errors/404.html")
    # Ensure GitHub Pages does not run Jekyll
    open(os.path.join(OUT_DIR, ".nojekyll"), "w").close()
    print("Built GitHub Pages preview into _site/ successfully.")


if __name__ == "__main__":
    build()
