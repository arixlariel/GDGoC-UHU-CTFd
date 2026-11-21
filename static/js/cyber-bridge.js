/* ============================================================================
   GDG on Campus Universidad de Huelva · CTFd `core` → Cyber Theme Bridge
   - Cero flash (actualiza <nav>, <main> y <footer> antes de módulos JS)
   - Proxy diferido de EventSource (/events) que cierra streams al navegar
   - Navbar simétrico (38px uniformes, tooltips Cyber consistentes, Comunidad a color)
   - Cajas más amplias, sin barras multicolor sobre tarjetas, tilt 3D uniforme
   - Tabla /users: Username · Country (bandera + tooltip) · Affiliation · Website preview
   - /settings unificado y multilingüe (Profile → Passwords → Access Tokens en 3 cajas 3D)
   - /login y /register con "Username" unificado y subtítulo claro en Registration Code
   ============================================================================ */

(function () {
  "use strict";

  // Guardia absoluta: nunca tocar el panel de administración de CTFd
  if (window.location.pathname.indexOf("/admin") === 0) {
    document.documentElement.classList.remove("cyber-bridging");
    return;
  }

  var ASSET_BASE = (
    window.CYBER_ASSET_BASE ||
    window.GDGOC_ASSET_BASE ||
    "https://arixlariel.github.io/GDGoC-UHU-CTFd/static"
  ).replace(/\/+$/, "");
  var ASSET_VER = window.CYBER_ASSET_VER || window.GDGOC_ASSET_VER || "";
  var ASSET_Q = ASSET_VER ? "?v=" + ASSET_VER : "";

  function assetUrl(rel) {
    return ASSET_BASE + "/" + rel.replace(/^\/+/, "") + ASSET_Q;
  }

  // 1. Forzar Cyber Dark inmediatamente y bloquear cualquier intento de modo claro
  function enforceCyberMode() {
    var root = document.documentElement;
    if (root.getAttribute("data-theme") !== "cyber") {
      root.setAttribute("data-theme", "cyber");
    }
    if (root.getAttribute("data-bs-theme") !== "dark") {
      root.setAttribute("data-bs-theme", "dark");
    }
    try {
      if (window.localStorage && localStorage.getItem("theme") !== "dark") {
        localStorage.setItem("theme", "dark");
      }
    } catch (_) {}
  }

  enforceCyberMode();

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(enforceCyberMode).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bs-theme", "data-theme"],
    });
  }

  // 1b. Persistencia real de idioma (cookie 1 año path=/ sincronizada con localStorage)
  function syncLanguagePersistence() {
    try {
      var saved = window.localStorage && localStorage.getItem("language");
      if (saved && /^[a-zA-Z_-]{2,12}$/.test(saved)) {
        document.cookie =
          "language=" + encodeURIComponent(saved) + "; path=/; max-age=31536000; SameSite=Lax";
        var activeEl = document.querySelector('form[x-data="LanguageForm"] .dropdown-item.bg-primary[value]');
        var rendered = activeEl ? activeEl.getAttribute("value") : null;
        if (rendered && rendered !== saved && window.sessionStorage) {
          var guardKey = "cyber_lang_reloaded_" + saved;
          if (!sessionStorage.getItem(guardKey)) {
            sessionStorage.setItem(guardKey, "1");
            window.location.reload();
            return;
          }
        }
      }
      document.addEventListener(
        "click",
        function (e) {
          var item =
            e.target && e.target.closest
              ? e.target.closest('form[x-data="LanguageForm"] .dropdown-item[value]')
              : null;
          if (!item) return;
          var val = item.getAttribute("value");
          if (val) {
            try {
              localStorage.setItem("language", val);
              document.cookie =
                "language=" + encodeURIComponent(val) + "; path=/; max-age=31536000; SameSite=Lax";
            } catch (_) {}
          }
        },
        true
      );
    } catch (_) {}
  }

  // 2. Proxy de EventSource: evita que /events (SSE) sature HTTP/1.1 al cambiar rápido de apartado
  if (!window.__cyberEventSourcePatched && typeof window.EventSource === "function") {
    window.__cyberEventSourcePatched = true;
    var NativeES = window.EventSource;
    var activeStreams = [];

    function closeAllStreams() {
      for (var i = 0; i < activeStreams.length; i++) {
        try {
          activeStreams[i].close();
        } catch (_) {}
      }
      activeStreams.length = 0;
    }

    function ManagedEventSource(url, config) {
      var self = this;
      this.url = url;
      this.withCredentials = Boolean(config && config.withCredentials);
      this.readyState = 0;
      this._closed = false;
      this._real = null;
      this._listeners = [];
      this._timer = setTimeout(function () {
        self._timer = null;
        if (self._closed || document.visibilityState === "hidden") return;
        try {
          var real = config ? new NativeES(url, config) : new NativeES(url);
          self._real = real;
          self.readyState = real.readyState;
          if (typeof self.onopen === "function") real.onopen = self.onopen;
          if (typeof self.onmessage === "function") real.onmessage = self.onmessage;
          if (typeof self.onerror === "function") real.onerror = self.onerror;
          for (var j = 0; j < self._listeners.length; j++) {
            var item = self._listeners[j];
            real.addEventListener(item[0], item[1], item[2]);
          }
          self._listeners.length = 0;
        } catch (_) {}
      }, 350);
      activeStreams.push(this);
    }

    ManagedEventSource.CONNECTING = 0;
    ManagedEventSource.OPEN = 1;
    ManagedEventSource.CLOSED = 2;

    ManagedEventSource.prototype.addEventListener = function (type, fn, opts) {
      if (this._closed) return;
      if (this._real) this._real.addEventListener(type, fn, opts);
      else this._listeners.push([type, fn, opts]);
    };

    ManagedEventSource.prototype.removeEventListener = function (type, fn, opts) {
      if (this._real) this._real.removeEventListener(type, fn, opts);
      else {
        this._listeners = this._listeners.filter(function (item) {
          return item[0] !== type || item[1] !== fn;
        });
      }
    };

    ManagedEventSource.prototype.close = function () {
      this._closed = true;
      this.readyState = 2;
      if (this._timer !== null) {
        clearTimeout(this._timer);
        this._timer = null;
      }
      if (this._real) {
        try {
          this._real.close();
        } catch (_) {}
        this._real = null;
      }
    };

    window.EventSource = ManagedEventSource;

    document.addEventListener(
      "click",
      function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
        var href = a.getAttribute("href") || "";
        if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;
        try {
          var dest = new URL(a.href, window.location.origin);
          if (dest.origin === window.location.origin) closeAllStreams();
        } catch (_) {}
      },
      true
    );

    document.addEventListener("submit", closeAllStreams, true);
    window.addEventListener("pagehide", closeAllStreams);
    window.addEventListener("beforeunload", closeAllStreams);
  }

  function getUrlRoot() {
    return ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
  }

  function normPath(href) {
    try {
      var u = new URL(href, window.location.origin);
      if (u.origin !== window.location.origin) return null;
      var root = getUrlRoot();
      var p = u.pathname;
      if (root && p.indexOf(root) === 0) p = p.slice(root.length) || "/";
      return p.replace(/\/+$/, "") || "/";
    } catch (_) {
      return null;
    }
  }

  function cleanLabel(el, fallback) {
    if (!el) return fallback;
    var clone = el.cloneNode(true);
    clone.querySelectorAll(".badge, .badge-notification, i, svg").forEach(function (n) {
      n.remove();
    });
    var text = (clone.textContent || "").replace(/\s+/g, " ").trim();
    return text || fallback;
  }

  function setCyberTooltip(el, text) {
    if (!el || !text) return;
    el.removeAttribute("title");
    if (el.getAttribute("data-bs-toggle") === "tooltip") {
      el.removeAttribute("data-bs-toggle");
      el.removeAttribute("data-bs-placement");
    }
    el.setAttribute("data-cyber-tooltip", text);
    el.setAttribute("aria-label", text);
  }

  function getActiveLocale() {
    var activeLang = document.querySelector('form[x-data="LanguageForm"] .dropdown-item.bg-primary[value]');
    if (activeLang) return (activeLang.getAttribute("value") || "en").toLowerCase();
    return ((document.documentElement.getAttribute("lang") || "en").split("-")[0]).toLowerCase();
  }

  function formatWebsitePreview(rawUrl) {
    try {
      var u = new URL(rawUrl);
      var host = u.hostname.replace(/^www\./i, "");
      var path = (u.pathname || "").replace(/\/+$/, "");
      var preview = host + (path && path !== "/" ? path : "");
      return preview.length > 34 ? preview.slice(0, 33) + "…" : preview;
    } catch (_) {
      return rawUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "").slice(0, 34);
    }
  }

  function makeTiltable(card, maxTilt) {
    if (!card) return;
    card.classList.add("tilt-card");
    card.setAttribute("data-tilt-max", String(maxTilt || 0.9));
    if (!card.querySelector(":scope > .tilt-glare")) {
      var glare = document.createElement("div");
      glare.className = "tilt-glare";
      glare.setAttribute("aria-hidden", "true");
      card.insertBefore(glare, card.firstChild);
    }
  }

  // 3. Fondo animado Cyber (#theme-fx-container)
  function injectBackgroundFx() {
    if (!document.body || document.getElementById("theme-fx-container")) return;
    var fx = document.createElement("div");
    fx.id = "theme-fx-container";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML =
      '<div class="fx-cyber-grid"></div>' +
      '<div class="fx-cyber-scanline"></div>' +
      '<span class="fx-cyber-token fx-cyber-token--1">0xFA92_FLAG //⚡</span>' +
      '<span class="fx-cyber-token fx-cyber-token--2">&lt;CYBER_TRAINER_CTF /&gt;</span>' +
      '<span class="fx-cyber-token fx-cyber-token--3">ROOT::ACCESS_GRANTED</span>' +
      '<span class="fx-cyber-token fx-cyber-token--4">[GDG_UHU::CYBER_NODE]</span>';
    document.body.insertBefore(fx, document.body.firstChild);
  }

  // 4. Upgrade inmediato del Navbar de `core` a `<header class="theme-header">`
  var navUpgraded = false;

  function highlightActiveNav() {
    var cur = normPath(window.location.href) || "/";
    document
      .querySelectorAll(".theme-header a.nav-link[href], .theme-header a.theme-pill-btn[href]")
      .forEach(function (link) {
        link.classList.remove("active");
        var lp = normPath(link.href);
        if (!lp) return;
        if (lp === cur) {
          link.classList.add("active");
        } else if (lp !== "/" && cur.indexOf(lp + "/") === 0) {
          link.classList.add("active");
        }
      });
  }

  function upgradeNavbar() {
    if (navUpgraded || document.querySelector("header.theme-header")) {
      navUpgraded = true;
      return true;
    }
    var nav = document.querySelector("body > nav.navbar");
    if (!nav) return false;
    var collapse = nav.querySelector(".navbar-collapse");
    if (!collapse) return false;
    var uls = collapse.querySelectorAll(":scope > ul.navbar-nav");
    if (uls.length < 2) return false;
    if (!nav.nextSibling && document.readyState === "loading") return false;

    navUpgraded = true;
    injectBackgroundFx();

    var header = document.createElement("header");
    header.className = "theme-header";

    var strip = document.createElement("div");
    strip.className = "theme-top-strip";
    strip.setAttribute("aria-hidden", "true");
    header.appendChild(strip);

    nav.parentNode.insertBefore(header, nav);
    header.appendChild(nav);

    nav.classList.remove("fixed-top", "bg-dark", "navbar-expand-md");
    nav.classList.add("navbar-expand-lg", "navbar-dark");

    var brand = nav.querySelector(".navbar-brand");
    if (brand) {
      brand.classList.add("gdg-brand-link");
      var existingImg = brand.querySelector("img");
      var logoSrc = existingImg ? existingImg.getAttribute("src") : assetUrl("img/gdgoc-uhu-logo-sm.webp");
      brand.innerHTML =
        '<div class="gdg-brand-logo-wrap">' +
        '<img src="' + logoSrc + '" alt="GDG on Campus Universidad de Huelva" width="44" height="44" decoding="async">' +
        "</div>" +
        '<div class="text-truncate">' +
        '<div class="gdg-brand-title text-truncate">GDGoC UHU</div>' +
        '<div class="gdg-brand-subtitle text-truncate">Cyber Trainer</div>' +
        "</div>";
    }

    var leftUl = uls[0];
    var rightUl = uls[1];

    var hr = collapse.querySelector(":scope > hr");
    if (hr) hr.className = "d-lg-none my-3";

    var leftIcons = {
      "/users": "fas fa-user-astronaut fa-fw",
      "/teams": "fas fa-users fa-fw",
      "/scoreboard": "fas fa-trophy fa-fw",
      "/challenges": "fas fa-flag fa-fw",
    };

    var unreadBadge = null;
    var notifHref = getUrlRoot() + "/notifications";
    var notifLabel = "Notifications";

    Array.prototype.slice.call(rightUl.children).forEach(function (li) {
      var a = li.querySelector("a[href]");
      if (a && normPath(a.href) === "/notifications") {
        notifHref = a.getAttribute("href") || notifHref;
        notifLabel = cleanLabel(a, "Notifications");
        var badge = a.querySelector("[x-text*='unread_count'], .badge-notification");
        if (badge) {
          badge.className = "badge rounded-pill badge-notification ms-1";
          badge.style.display = "none";
          unreadBadge = badge;
        }
        li.remove();
      }
    });

    leftUl.className = "navbar-nav me-auto ms-lg-3 mt-3 mt-lg-0 gap-1 align-items-lg-center";
    var hasNotifications = false;
    Array.prototype.slice.call(leftUl.querySelectorAll(":scope > li > a.nav-link")).forEach(function (a) {
      a.removeAttribute("title");
      a.removeAttribute("data-bs-toggle");
      var p = normPath(a.href);
      if (p === "/notifications") hasNotifications = true;
      var iconCls = leftIcons[p];
      if (iconCls) {
        var txt = cleanLabel(a, a.textContent.trim());
        a.className = "nav-link";
        a.innerHTML = '<i class="' + iconCls + '"></i><span></span>';
        a.querySelector("span").textContent = txt;
      }
    });

    if (!hasNotifications) {
      var notifLi = document.createElement("li");
      notifLi.className = "nav-item";
      var notifA = document.createElement("a");
      notifA.className = "nav-link position-relative";
      notifA.href = notifHref;
      notifA.innerHTML = '<i class="fas fa-bell fa-fw"></i><span></span>';
      notifA.querySelector("span").textContent = notifLabel;
      if (unreadBadge) notifA.appendChild(unreadBadge);
      notifLi.appendChild(notifA);
      leftUl.appendChild(notifLi);
    }

    rightUl.className = "navbar-nav ms-lg-auto align-items-lg-center gap-2 pb-2 pb-lg-0";

    var loginLi = null;
    var registerLi = null;

    Array.prototype.slice.call(rightUl.children).forEach(function (li) {
      if (li.querySelector(".theme-switch")) {
        li.remove();
        return;
      }

      if (li.classList.contains("dropdown")) {
        var btn = li.querySelector("button.dropdown-toggle");
        if (btn) {
          btn.className = "theme-pill-btn theme-pill-btn--icon dropdown-toggle w-100 w-lg-auto";
          btn.setAttribute("data-bs-toggle", "dropdown");
          setCyberTooltip(btn, "Language");
          btn.innerHTML =
            '<i class="fas fa-language"></i>' +
            '<span class="d-lg-none">Language</span>';
        }
        return;
      }

      var a = li.querySelector("a[href]");
      if (!a) return;
      var p = normPath(a.href);
      var lbl = cleanLabel(a, "");

      if (p === "/admin") {
        // Solo visible cuando CTFd lo renderiza para cuentas admin; solo icono en escritorio
        a.className = "theme-pill-btn theme-pill-btn--icon theme-pill-btn--admin w-100 w-lg-auto";
        setCyberTooltip(a, lbl || "Admin Panel");
        a.innerHTML = '<i class="fas fa-wrench fa-fw"></i><span class="d-lg-none"></span>';
        a.querySelector("span").textContent = lbl || "Admin";
      } else if (p === "/team") {
        a.className = "theme-pill-btn theme-pill-btn--icon w-100 w-lg-auto";
        setCyberTooltip(a, lbl || "Team");
        a.innerHTML = '<i class="fas fa-users fa-fw"></i><span class="d-lg-none"></span>';
        a.querySelector("span").textContent = lbl || "Team";
      } else if (p === "/user") {
        // Solo icono en escritorio, igual que el resto de botones de cuenta
        a.className = "theme-pill-btn theme-pill-btn--icon w-100 w-lg-auto";
        setCyberTooltip(a, lbl || "Profile");
        a.innerHTML = '<i class="fas fa-user-circle fa-fw"></i><span class="d-lg-none"></span>';
        a.querySelector("span").textContent = lbl || "Profile";
      } else if (p === "/settings") {
        a.className = "theme-pill-btn theme-pill-btn--icon w-100 w-lg-auto";
        setCyberTooltip(a, lbl || "Settings");
        a.innerHTML = '<i class="fas fa-cogs fa-fw"></i><span class="d-lg-none"></span>';
        a.querySelector("span").textContent = lbl || "Settings";
      } else if (p === "/logout") {
        a.className = "theme-pill-btn theme-pill-btn--icon w-100 w-lg-auto";
        setCyberTooltip(a, lbl || "Logout");
        a.innerHTML = '<i class="fas fa-power-off fa-fw"></i><span class="d-lg-none"></span>';
        a.querySelector("span").textContent = lbl || "Logout";
      } else if (p === "/login") {
        loginLi = li;
        a.className = "theme-pill-btn theme-pill-btn--login w-100 w-lg-auto";
        setCyberTooltip(a, "Login or Register");
        a.innerHTML = '<i class="fas fa-key"></i><span></span>';
        a.querySelector("span").textContent = lbl || "Login";
      } else if (p === "/register") {
        // Sin sesión solo mostramos Login en la barra; Register es accesible debajo del formulario de Login
        registerLi = li;
        li.remove();
      }
    });

    if (!rightUl.querySelector('a.theme-pill-btn--community')) {
      var comLi = document.createElement("li");
      comLi.className = "nav-item";
      comLi.innerHTML =
        '<a href="https://gdg.community.dev/gdg-on-campus-huelva-university-huelva-spain/" target="_blank" rel="noopener noreferrer" ' +
        'class="theme-pill-btn theme-pill-btn--community w-100 w-lg-auto" ' +
        'data-cyber-tooltip="Web oficial del GDGoC UHU" aria-label="Web oficial del GDGoC UHU">' +
        '<span>Comunidad</span>' +
        '<i class="fas fa-external-link-alt" style="font-size: 0.7rem;"></i>' +
        "</a>";
      rightUl.appendChild(comLi);
    }

    highlightActiveNav();
    return true;
  }

  // Observador temprano: actualiza <nav> al parsearse y termina <main>+<footer> al aparecer </footer>
  var earlyObs = null;
  var bridgeCompleted = false;

  if (document.readyState === "loading" && typeof MutationObserver !== "undefined") {
    earlyObs = new MutationObserver(function () {
      upgradeNavbar();
      var foot = document.querySelector("body > footer.footer");
      if (foot && foot.nextSibling) {
        finishBridge();
      }
    });
    earlyObs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // 5. Upgrade del Footer de `core` al Footer oficial Cyber
  function upgradeFooter() {
    if (document.querySelector("footer.theme-footer")) return;
    var oldFooter = document.querySelector("footer.footer");
    var footer = document.createElement("footer");
    footer.className = "theme-footer";
    footer.innerHTML =
      '<div class="container">' +
      '  <div class="theme-footer-inner">' +
      '    <div class="theme-footer-brand">' +
      '      <img src="' + assetUrl("img/gdgoc-uhu-logo-sm.webp") + '" alt="GDG on Campus UHU" width="40" height="40" loading="lazy" decoding="async">' +
      '      <div>' +
      '        <div class="fw-bold theme-text-primary" style="font-size: 0.9rem;">GDGoC UHU</div>' +
      '        <div class="theme-text-secondary" style="font-size: 0.76rem;">Cyber Trainer</div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="theme-footer-links">' +
      '      <a href="https://ctfd.io" target="_blank" rel="noopener noreferrer" class="footer-link-muted">Powered by CTFd</a>' +
      '      <span style="opacity: 0.4;">·</span>' +
      '      <a href="https://gdg.community.dev/gdg-on-campus-huelva-university-huelva-spain/" target="_blank" rel="noopener noreferrer" class="footer-link-accent">Comunidad</a>' +
      '      <span style="opacity: 0.4;">·</span>' +
      '      <a href="https://www.linkedin.com/company/gdgoc-huelva" target="_blank" rel="noopener noreferrer" class="footer-link-accent">LinkedIn</a>' +
      '      <span style="opacity: 0.4;">·</span>' +
      '      <a href="https://www.instagram.com/gdgoc.huelva/" target="_blank" rel="noopener noreferrer" class="footer-link-accent">Instagram</a>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (oldFooter && oldFooter.parentNode) {
      oldFooter.parentNode.replaceChild(footer, oldFooter);
    } else if (document.body) {
      document.body.appendChild(footer);
    }
  }

  function wrapInThemeCard(el, extraClasses) {
    if (!el || el.closest(".theme-card")) return null;
    var card = document.createElement("div");
    card.className = "theme-card " + (extraClasses || "p-4");
    el.parentNode.insertBefore(card, el);
    card.appendChild(el);
    return card;
  }

  function wrapChildrenInThemeCard(parent, extraClasses) {
    if (!parent || parent.querySelector(":scope > .theme-card")) return null;
    var card = document.createElement("div");
    card.className = "theme-card " + (extraClasses || "p-4 p-sm-5");
    while (parent.firstChild) {
      card.appendChild(parent.firstChild);
    }
    parent.appendChild(card);
    return card;
  }

  function wrapTablesInCyberWrap(root) {
    (root || document).querySelectorAll("main table.table").forEach(function (tbl) {
      if (tbl.closest(".cyber-table-wrap") || tbl.closest(".feature-card") || tbl.closest(".modal")) return;
      var wrap = document.createElement("div");
      wrap.className = "cyber-table-wrap";
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
  }

  function normalizeUsernameLabels(root) {
    var locale = getActiveLocale();
    if (locale !== "en" && locale.indexOf("en") !== 0) return;
    (root || document).querySelectorAll("label.form-label").forEach(function (lbl) {
      var t = lbl.textContent || "";
      if (/User Name/i.test(t)) {
        lbl.textContent = t.replace(/User Name/g, "Username");
      }
    });
  }

  // 6. Tablero /challenges (optimizado: sin bucles de MutationObserver)
  function upgradeChallengesPage() {
    var board = document.querySelector('[x-data="ChallengeBoard"]');
    if (!board || document.querySelector(".cyber-filter-bar")) return;

    var jumboContainer = document.querySelector("main .jumbotron .container");
    var statsWrap = null;
    if (jumboContainer) {
      statsWrap = document.createElement("div");
      statsWrap.id = "gdg-core-stats";
      statsWrap.style.display = "none";
      statsWrap.innerHTML =
        '<div class="cyber-stats-strip">' +
        '  <span class="cyber-stat-chip"><i class="fas fa-terminal" style="color:#FF007F;"></i><span>Challenges:</span><strong id="gdg-stat-total">0</strong></span>' +
        '  <span class="cyber-stat-chip cyber-stat-chip--solved"><i class="fas fa-check-circle" style="color:#00FF66;"></i><span>Solved:</span><strong id="gdg-stat-solved">0 / 0</strong></span>' +
        "</div>" +
        '<div class="cyber-progress-wrap"><div class="cyber-progress-track"><div class="cyber-progress-fill" id="gdg-stat-bar" style="width:0%"></div></div></div>';
      jumboContainer.appendChild(statsWrap);
    }

    var savedHideSolved = false;
    try {
      savedHideSolved = window.localStorage && localStorage.getItem("cyber_hide_solved") === "1";
    } catch (_) {}

    var filterBar = document.createElement("div");
    filterBar.className = "cyber-filter-bar";
    filterBar.style.display = "none";
    filterBar.innerHTML =
      '<div class="row g-3 align-items-center justify-content-between">' +
      '  <div class="col-md-8 col-lg-6">' +
      '    <div class="theme-search-box">' +
      '      <i class="fas fa-search ms-2" style="color:#00F0FF;"></i>' +
      '      <input type="text" id="gdg-chal-search" placeholder="Search challenges by name" aria-label="Search challenges by name">' +
      '      <button type="button" id="gdg-chal-clear" class="btn btn-sm p-1 border-0 bg-transparent text-secondary" style="display:none;min-height:auto;padding:0.25rem!important;" aria-label="Clear search"><i class="fas fa-times"></i></button>' +
      "    </div>" +
      "  </div>" +
      '  <div class="col-md-4 col-lg-4 d-flex justify-content-md-end">' +
      '    <button type="button" id="gdg-chal-hide-solved" class="theme-pill-btn' + (savedHideSolved ? " active" : "") + '">' +
      '      <i class="fas ' + (savedHideSolved ? "fa-eye-slash" : "fa-eye") + '"></i><span>' + (savedHideSolved ? "Hiding solved" : "Showing solved") + "</span>" +
      "    </button>" +
      "  </div>" +
      "</div>" +
      '<div class="cyber-category-pills" id="gdg-chal-cats"></div>';

    var loadedDiv = board.querySelector('[x-show="loaded"]');
    if (loadedDiv && loadedDiv.parentNode) {
      loadedDiv.parentNode.insertBefore(filterBar, loadedDiv);
    } else {
      board.insertBefore(filterBar, board.firstChild);
    }

    // Solo hideSolved se recuerda entre visitas; búsqueda y categoría se resetean siempre
    var state = { search: "", category: "ALL", hideSolved: savedHideSolved };
    var CATEGORY_ORDER = ["web", "criptografía", "criptografia", "forense", "reversing", "misc"];
    function catRank(name) {
      var idx = CATEGORY_ORDER.indexOf((name || "").trim().toLowerCase());
      return idx === -1 ? 99 : idx;
    }
    var searchInput = filterBar.querySelector("#gdg-chal-search");
    var clearBtn = filterBar.querySelector("#gdg-chal-clear");
    var hideSolvedBtn = filterBar.querySelector("#gdg-chal-hide-solved");
    var catsWrap = filterBar.querySelector("#gdg-chal-cats");
    var boardObs = null;

    function observeBoard() {
      if (!boardObs) return;
      boardObs.observe(loadedDiv || board, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function applyFilters() {
      if (boardObs) boardObs.disconnect();
      var q = state.search.trim().toLowerCase();
      board.querySelectorAll(".category-header").forEach(function (header) {
        var section = header.parentElement;
        if (!section) return;
        var h3 = header.querySelector("h3");
        var catName = h3 ? (h3.textContent || "").trim() : "";
        var catMatch = state.category === "ALL" || state.category === catName;

        var visibleInSection = 0;
        section.querySelectorAll(".challenges-row > div").forEach(function (col) {
          var btn = col.querySelector(".challenge-button");
          if (!btn) return;
          var titleEl = btn.querySelector("p");
          var title = titleEl ? (titleEl.textContent || "").toLowerCase() : "";
          var tags = Array.prototype.slice
            .call(btn.classList)
            .filter(function (c) {
              return c.indexOf("tag-") === 0;
            })
            .map(function (c) {
              return c.slice(4).replace(/-/g, " ").toLowerCase();
            })
            .join(" ");
          var isSolved =
            btn.classList.contains("challenge-solved") || btn.classList.contains("solved-challenge");

          var matchText =
            !q || title.indexOf(q) !== -1 || catName.toLowerCase().indexOf(q) !== -1 || tags.indexOf(q) !== -1;
          var matchSolved = !state.hideSolved || !isSolved;
          var show = catMatch && matchText && matchSolved;
          col.classList.toggle("gdg-filter-hidden", !show);
          if (show) visibleInSection++;
        });

        section.classList.toggle("gdg-filter-hidden", visibleInSection === 0);
      });
      observeBoard();
    }

    searchInput.addEventListener("input", function () {
      state.search = searchInput.value;
      clearBtn.style.display = state.search.length > 0 ? "" : "none";
      applyFilters();
    });

    clearBtn.addEventListener("click", function () {
      searchInput.value = "";
      state.search = "";
      clearBtn.style.display = "none";
      applyFilters();
      searchInput.focus();
    });

    hideSolvedBtn.addEventListener("click", function () {
      state.hideSolved = !state.hideSolved;
      try {
        if (window.localStorage) localStorage.setItem("cyber_hide_solved", state.hideSolved ? "1" : "0");
      } catch (_) {}
      hideSolvedBtn.classList.toggle("active", state.hideSolved);
      hideSolvedBtn.innerHTML =
        '<i class="fas ' +
        (state.hideSolved ? "fa-eye-slash" : "fa-eye") +
        '"></i><span>' +
        (state.hideSolved ? "Hiding solved" : "Showing solved") +
        "</span>";
      applyFilters();
    });

    var lastCatSig = "";
    var syncScheduled = false;

    function syncChallengesBoard() {
      syncScheduled = false;
      if (boardObs) boardObs.disconnect();

      var btns = board.querySelectorAll(".challenge-button");
      if (!btns.length) {
        observeBoard();
        return;
      }

      var total = btns.length;
      var solved = 0;

      btns.forEach(function (btn) {
        var isSolved =
          btn.classList.contains("challenge-solved") || btn.classList.contains("solved-challenge");
        if (isSolved) solved++;

        if (!btn.classList.contains("tilt-card")) {
          btn.classList.add("tilt-card");
          btn.setAttribute("data-tilt-max", "1.8");
        }
        if (!btn.querySelector(".tilt-glare")) {
          var glare = document.createElement("div");
          glare.className = "tilt-glare";
          glare.setAttribute("aria-hidden", "true");
          btn.insertBefore(glare, btn.firstChild);
        }
        // Solo mostrar badge "✓ SOLVED" en retos resueltos (sin etiqueta "ACTIVE" innecesaria)
        var statusBadge = btn.querySelector(".gdg-core-status-badge");
        if (isSolved) {
          var targetCls = "challenge-status-badge gdg-core-status-badge challenge-status-badge--solved";
          if (!statusBadge) {
            statusBadge = document.createElement("span");
            statusBadge.className = targetCls;
            statusBadge.textContent = "✓ SOLVED";
            btn.appendChild(statusBadge);
          } else {
            if (statusBadge.className !== targetCls) statusBadge.className = targetCls;
            if (statusBadge.textContent !== "✓ SOLVED") statusBadge.textContent = "✓ SOLVED";
          }
        } else if (statusBadge) {
          statusBadge.remove();
        }
      });

      if (typeof window.gdgocScanTiltCards === "function") {
        window.gdgocScanTiltCards(board);
      }

      if (statsWrap) {
        statsWrap.style.display = "";
        var totalEl = document.getElementById("gdg-stat-total");
        var solvedEl = document.getElementById("gdg-stat-solved");
        var barEl = document.getElementById("gdg-stat-bar");
        if (totalEl) totalEl.textContent = String(total);
        if (solvedEl) solvedEl.textContent = solved + " / " + total;
        if (barEl) barEl.style.width = (total ? Math.round((solved / total) * 100) : 0) + "%";
      }

      filterBar.style.display = "";

      // Ordenar las secciones del DOM según el orden oficial: Web → Criptografía → Forense → Reversing → Misc
      var headers = Array.prototype.slice.call(board.querySelectorAll(".category-header"));
      var sections = headers
        .map(function (h) {
          var h3 = h.querySelector("h3");
          return {
            header: h,
            section: h.parentElement,
            name: h3 ? (h3.textContent || "").trim() : "",
          };
        })
        .filter(function (item) {
          return item.name && item.section && item.section.parentElement;
        });

      sections.sort(function (a, b) {
        var diff = catRank(a.name) - catRank(b.name);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

      var catNames = [];
      var sectionsParent = sections.length ? sections[0].section.parentElement : null;
      sections.forEach(function (item) {
        if (sectionsParent && item.section.parentElement === sectionsParent) {
          sectionsParent.appendChild(item.section);
        }
        var header = item.header;
        var h3 = header.querySelector("h3");
        catNames.push(item.name);

        if (!header.querySelector(".gdg-cat-slash")) {
          var slash = document.createElement("span");
          slash.className = "gdg-cat-slash";
          slash.style.cssText =
            "color:#00F0FF;font-family:'JetBrains Mono',monospace;font-weight:700;";
          slash.textContent = "//";
          header.insertBefore(slash, h3);
        }

        var secBtns = item.section.querySelectorAll(".challenge-button");
        var secSolved = 0;
        secBtns.forEach(function (b) {
          if (b.classList.contains("challenge-solved") || b.classList.contains("solved-challenge")) {
            secSolved++;
          }
        });
        var pillTxt = secSolved + "/" + secBtns.length;
        var pill = header.querySelector(".category-count-pill");
        if (!pill) {
          pill = document.createElement("span");
          pill.className = "category-count-pill";
          pill.textContent = pillTxt;
          header.appendChild(pill);
        } else if (pill.textContent !== pillTxt) {
          pill.textContent = pillTxt;
        }
      });

      var sig = catNames.join("|");
      if (sig !== lastCatSig) {
        lastCatSig = sig;
        catsWrap.innerHTML = "";
        var allBtn = document.createElement("button");
        allBtn.type = "button";
        allBtn.className = "theme-pill-btn" + (state.category === "ALL" ? " active" : "");
        allBtn.innerHTML = "<span>⚡ All</span>";
        allBtn.addEventListener("click", function () {
          state.category = "ALL";
          catsWrap.querySelectorAll("button").forEach(function (b) {
            b.classList.remove("active");
          });
          allBtn.classList.add("active");
          applyFilters();
        });
        catsWrap.appendChild(allBtn);

        catNames.forEach(function (cat) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "theme-pill-btn" + (state.category === cat ? " active" : "");
          b.textContent = cat;
          b.addEventListener("click", function () {
            state.category = cat;
            catsWrap.querySelectorAll("button").forEach(function (x) {
              x.classList.remove("active");
            });
            b.classList.add("active");
            applyFilters();
          });
          catsWrap.appendChild(b);
        });
      }

      applyFilters();
    }

    function scheduleSync(mutations) {
      if (syncScheduled) return;
      if (mutations && mutations.length) {
        var relevant = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === "childList") {
            relevant = true;
            break;
          }
          if (m.type === "attributes" && m.target && m.target.classList && m.target.classList.contains("challenge-button")) {
            relevant = true;
            break;
          }
        }
        if (!relevant) return;
      }
      syncScheduled = true;
      requestAnimationFrame(syncChallengesBoard);
    }

    if (typeof MutationObserver !== "undefined") {
      boardObs = new MutationObserver(scheduleSync);
    }
    scheduleSync();
  }

  // 7. Reordenar tabla /users y /teams: Username | Country (bandera + tooltip) | Affiliation | Website preview
  function upgradeUsersDirectoryTable() {
    var table = document.querySelector("main table.table");
    if (!table || table.dataset.cyberUsersUpgraded === "1") return;
    var headerRow = table.querySelector("thead tr");
    if (!headerRow) return;
    var ths = Array.prototype.slice.call(headerRow.querySelectorAll("th"));
    if (ths.length !== 4) return;

    table.dataset.cyberUsersUpgraded = "1";
    table.classList.add("align-middle");

    var thUser = ths[0];
    var thWeb = ths[1];
    var thAff = ths[2];
    var thCountry = ths[3];

    thUser.textContent = "Username";
    thUser.className = "";

    thCountry.textContent = "Country";
    thCountry.className = "text-center";
    thCountry.style.width = "105px";

    thAff.textContent = "Affiliation";
    thAff.className = "d-none d-md-table-cell";

    thWeb.textContent = "Website";
    thWeb.className = "d-none d-sm-table-cell";

    headerRow.innerHTML = "";
    headerRow.appendChild(thUser);
    headerRow.appendChild(thCountry);
    headerRow.appendChild(thAff);
    headerRow.appendChild(thWeb);

    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var tds = Array.prototype.slice.call(tr.querySelectorAll("td"));
      if (tds.length !== 4) return;
      var tdUser = tds[0];
      var tdWeb = tds[1];
      var tdAff = tds[2];
      var tdCountry = tds[3];

      tdUser.className = "fw-semibold";

      var flagIcon = tdCountry.querySelector('i[class*="flag-"]');
      var countryName = (tdCountry.textContent || "").replace(/\s+/g, " ").trim();
      tdCountry.className = "text-center";
      tdCountry.innerHTML = "";
      if (flagIcon) {
        var wrap = document.createElement("span");
        wrap.className = "cyber-flag-tooltip";
        wrap.setAttribute("tabindex", "0");
        if (countryName) {
          wrap.setAttribute("data-tooltip", countryName);
          wrap.setAttribute("aria-label", countryName);
        }
        wrap.appendChild(flagIcon);
        tdCountry.appendChild(wrap);
      } else if (countryName) {
        tdCountry.innerHTML = '<span class="theme-text-secondary small"></span>';
        tdCountry.querySelector("span").textContent = countryName;
      } else {
        tdCountry.innerHTML = '<span class="theme-text-secondary opacity-50">—</span>';
      }

      tdAff.className = "d-none d-md-table-cell";
      var affText = (tdAff.textContent || "").trim();
      if (!affText) {
        tdAff.innerHTML = '<span class="theme-text-secondary opacity-50">—</span>';
      } else {
        var affSpan = tdAff.querySelector("span[data-toggle='tooltip'], span[data-bs-toggle='tooltip']");
        if (affSpan) {
          affSpan.removeAttribute("data-toggle");
          affSpan.removeAttribute("data-bs-toggle");
        }
      }

      var webLink = tdWeb.querySelector("a[href]");
      tdWeb.className = "d-none d-sm-table-cell";
      tdWeb.style.width = "";
      if (webLink && webLink.href) {
        var href = webLink.getAttribute("href");
        var preview = formatWebsitePreview(href);
        tdWeb.innerHTML = "";
        var a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "cyber-web-preview";
        a.setAttribute("data-cyber-tooltip", href);
        a.setAttribute("aria-label", href);
        a.innerHTML =
          '<i class="fas fa-globe"></i>' +
          '<span class="cyber-web-preview-text"></span>' +
          '<i class="fas fa-external-link-alt cyber-web-preview-ext"></i>';
        a.querySelector(".cyber-web-preview-text").textContent = preview;
        tdWeb.appendChild(a);
      } else {
        tdWeb.innerHTML = '<span class="theme-text-secondary opacity-50">—</span>';
      }

      tr.innerHTML = "";
      tr.appendChild(tdUser);
      tr.appendChild(tdCountry);
      tr.appendChild(tdAff);
      tr.appendChild(tdWeb);
    });
  }

  // Helper para organizar campos de entrada .mb-3 en rejilla 2 columnas (excluyendo filas de botones submit)
  function arrangeFieldsIntoGrid(formEl, colClass) {
    if (!formEl) return;
    var groups = Array.prototype.slice
      .call(formEl.querySelectorAll(":scope > .mb-3"))
      .filter(function (g) {
        return !g.querySelector('input[type="submit"], button[type="submit"]');
      });
    if (groups.length < 2) return;
    var grid = document.createElement("div");
    grid.className = "row g-3 mb-2";
    formEl.insertBefore(grid, groups[0]);
    groups.forEach(function (g) {
      g.classList.remove("mb-3");
      g.classList.add(colClass || "col-md-6");
      grid.appendChild(g);
    });
  }

  // Selector de fecha personalizado: campo DD/MM/YYYY estricto + botón Never debajo (sin subtítulo ni presets arriba)
  function buildCustomExpirationPicker(oldInput) {
    var hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = oldInput.id || "expiration";
    hidden.name = oldInput.name || "expiration";
    hidden.value = "";

    var wrap = document.createElement("div");
    wrap.className = "cyber-date-picker";
    wrap.setAttribute("data-cyber-date-picker", "1");
    wrap.innerHTML =
      '<div class="cyber-date-input-wrap">' +
      '  <input type="text" maxlength="10" inputmode="numeric" class="form-control cyber-date-text" placeholder="DD/MM/YYYY" autocomplete="off" aria-label="Expiration date DD/MM/YYYY">' +
      "</div>" +
      '<div class="cyber-date-never-wrap">' +
      '  <button type="button" class="cyber-date-never-btn" data-days="0">' +
      '    <i class="fas fa-infinity"></i><span>Never</span>' +
      "  </button>" +
      "</div>";
    wrap.insertBefore(hidden, wrap.firstChild);
    oldInput.parentNode.replaceChild(wrap, oldInput);
    if (typeof window.cyberInitDatePickers === "function") {
      window.cyberInitDatePickers(wrap.parentNode);
    }
  }

  // 8. Settings unificado y multilingüe (3 cajas 3D amplias: Profile → Passwords → Access Tokens)
  function upgradeSettingsPage() {
    var mainContainer = document.querySelector("main > .container");
    if (!mainContainer || mainContainer.dataset.cyberSettingsUpgraded === "1") return;
    mainContainer.dataset.cyberSettingsUpgraded = "1";
    mainContainer.classList.add("cyber-settings-unified");

    var locale = getActiveLocale();
    var isEn = locale === "en" || locale.indexOf("en") === 0;
    var isEs = locale === "es" || locale.indexOf("es") === 0;

    var passwordsTitles = {
      en: "Passwords",
      es: "Contraseñas",
      fr: "Mots de passe",
      de: "Passwörter",
      pt_br: "Senhas",
      it: "Password",
      ca: "Contrasenyes",
      pl: "Hasła",
    };

    var profileTab = mainContainer.querySelector("#settings-profile-tab");
    var tokensTab = mainContainer.querySelector("#settings-tokens-tab");
    var profileTitleText = (profileTab && profileTab.textContent.trim()) || "Profile";
    var tokensTitleText = (tokensTab && tokensTab.textContent.trim()) || "Access Tokens";
    var passwordsTitleText = passwordsTitles[locale] || passwordsTitles[locale.split("_")[0]] || "Passwords";

    var navPills = mainContainer.querySelector(".nav-pills");
    if (navPills) {
      var navCol = navPills.closest('[class*="col-"]');
      if (navCol) navCol.classList.add("d-none");
    }

    var tabContent = mainContainer.querySelector(".tab-content");
    if (!tabContent) return;

    var contentCol = tabContent.closest('[class*="col-"]');
    if (contentCol) {
      contentCol.className = "col-12 mx-auto";
    }

    var profilePane = tabContent.querySelector("#profile");
    var tokensPane = tabContent.querySelector("#tokens");

    function createSectionHeader(iconCls, iconColor, text, modifierCls) {
      var h = document.createElement("h3");
      h.className = "cyber-settings-section-title" + (modifierCls ? " " + modifierCls : "");
      h.innerHTML = '<i class="' + iconCls + '" style="color:' + iconColor + ';"></i><span></span>';
      h.querySelector("span").textContent = text;
      return h;
    }

    var passwordsCard = null;

    if (profilePane) {
      profilePane.classList.add("show", "active");
      normalizeUsernameLabels(profilePane);

      var langLabel = profilePane.querySelector('label[for="language"]');
      if (langLabel) {
        if (isEn && langLabel.textContent.trim().toLowerCase() === "language") {
          langLabel.textContent = "Preferred Language";
        } else if (isEs && langLabel.textContent.trim().toLowerCase() === "idioma") {
          langLabel.textContent = "Idioma preferido";
        }
      }

      var profileForm = profilePane.querySelector('form[x-data="SettingsForm"]');
      var confirmInput = profileForm && profileForm.querySelector('#confirm, input[name="confirm"]');
      var passwordInput = profileForm && profileForm.querySelector('#password, input[name="password"]');

      if (profileForm && confirmInput && passwordInput) {
        var confirmGroup = confirmInput.closest(".mb-3");
        var passwordGroup = passwordInput.closest(".mb-3");

        var passLabel = passwordGroup && passwordGroup.querySelector('label[for="password"]');
        if (passLabel) {
          if (isEn && passLabel.textContent.trim().toLowerCase() === "password") {
            passLabel.textContent = "New Password";
          } else if (isEs && passLabel.textContent.trim().toLowerCase() === "contraseña") {
            passLabel.textContent = "Nueva contraseña";
          }
        }

        // Quitar los <hr> sobrantes dentro del formulario de Profile
        profileForm.querySelectorAll(":scope > hr").forEach(function (hr) {
          hr.remove();
        });

        passwordsCard = document.createElement("div");
        passwordsCard.className = "theme-card p-4 p-sm-5 mb-4";
        passwordsCard.id = "passwords";
        passwordsCard.appendChild(
          createSectionHeader("fas fa-lock", "#FFE600", passwordsTitleText, "cyber-settings-section-title--passwords")
        );

        var pwForm = document.createElement("form");
        pwForm.method = "post";
        pwForm.setAttribute("accept-charset", "utf-8");
        pwForm.setAttribute("autocomplete", "off");
        pwForm.setAttribute("role", "form");
        pwForm.setAttribute("x-data", "SettingsForm");
        pwForm.setAttribute("@submit.prevent", "updateProfile()");
        pwForm.className = "form-horizontal";

        if (confirmGroup) pwForm.appendChild(confirmGroup);
        if (passwordGroup) pwForm.appendChild(passwordGroup);
        arrangeFieldsIntoGrid(pwForm, "col-md-6");

        var origResults = profileForm.querySelector("#results");
        var origSubmit = profileForm.querySelector('input[type="submit"], button[type="submit"]');

        var pwActions = document.createElement("div");
        pwActions.className = "cyber-form-actions";

        var pwStatus = document.createElement("div");
        pwStatus.className = "cyber-form-status";
        if (origResults) {
          var pwResultsClone = origResults.cloneNode(true);
          pwResultsClone.removeAttribute("id");
          pwResultsClone.className = "cyber-form-status";
          pwStatus = pwResultsClone;
        }
        pwActions.appendChild(pwStatus);

        var pwSubmit = document.createElement("input");
        pwSubmit.type = "submit";
        pwSubmit.name = "_submit";
        pwSubmit.className = "btn btn-primary";
        pwSubmit.value = (origSubmit && (origSubmit.value || origSubmit.textContent.trim())) || "Submit";
        pwActions.appendChild(pwSubmit);

        pwForm.appendChild(pwActions);

        passwordsCard.appendChild(pwForm);
        makeTiltable(passwordsCard, 0.9);
      }

      if (profileForm) {
        arrangeFieldsIntoGrid(profileForm, "col-md-6");
        var pSub = profileForm.querySelector('input[type="submit"], button[type="submit"]');
        var pRes = profileForm.querySelector("#results");
        if (pSub) {
          pSub.classList.remove("float-end", "btn-outlined", "btn-md", "w-100");
          var oldSubRow = pSub.closest(".mb-3, .submit-row, div");
          var pActions = document.createElement("div");
          pActions.className = "cyber-form-actions";

          if (pRes) {
            pRes.className = "cyber-form-status";
            pActions.appendChild(pRes);
          } else {
            var emptySt = document.createElement("div");
            emptySt.className = "cyber-form-status";
            pActions.appendChild(emptySt);
          }
          pActions.appendChild(pSub);
          profileForm.appendChild(pActions);

          if (oldSubRow && oldSubRow !== profileForm && oldSubRow.children.length === 0) {
            oldSubRow.remove();
          }
        }
      }

      var profileCard = wrapInThemeCard(profilePane, "p-4 p-sm-5 mb-4");
      if (profileCard) {
        if (!profilePane.querySelector(".cyber-settings-section-title")) {
          profilePane.insertBefore(
            createSectionHeader("fas fa-user-circle", "#00F0FF", profileTitleText, ""),
            profilePane.firstChild
          );
        }
        makeTiltable(profileCard, 0.9);
        if (passwordsCard && profileCard.parentNode) {
          profileCard.parentNode.insertBefore(passwordsCard, profileCard.nextSibling);
          var insertedPwForm = passwordsCard.querySelector('form[x-data="SettingsForm"]');
          if (
            insertedPwForm &&
            window.Alpine &&
            !insertedPwForm._x_dataStack &&
            typeof window.Alpine.initTree === "function"
          ) {
            window.Alpine.initTree(insertedPwForm);
          }
        }
      }
    }

    if (tokensPane) {
      tokensPane.classList.add("show", "active");
      var tokForm = tokensPane.querySelector('form[x-data="TokensForm"]');
      if (tokForm) {
        // Reemplazar input[type="date"] nativo por selector Cyber sin calendario
        var expInput = tokForm.querySelector('input[name="expiration"], #expiration');
        if (expInput && expInput.type !== "hidden") {
          buildCustomExpirationPicker(expInput);
        }

        // Convertir descripción de textarea a input de 1 sola línea
        var descEl = tokForm.querySelector('textarea[name="description"], #description');
        if (descEl && descEl.tagName === "TEXTAREA") {
          var oneLine = document.createElement("input");
          oneLine.type = "text";
          oneLine.id = descEl.id || "description";
          oneLine.name = descEl.name || "description";
          oneLine.className = "form-control";
          oneLine.autocomplete = "off";
          oneLine.placeholder = "Optional description (e.g. CLI, CI/CD)";
          oneLine.value = descEl.value || "";
          descEl.parentNode.replaceChild(oneLine, descEl);
        }

        var tokGroups = Array.prototype.slice
          .call(tokForm.querySelectorAll(":scope > .mb-3"))
          .filter(function (g) {
            return !g.querySelector('input[type="submit"], button[type="submit"]');
          });
        if (tokGroups.length >= 2) {
          var tGrid = document.createElement("div");
          tGrid.className = "row g-3 mb-2 align-items-start";
          tokForm.insertBefore(tGrid, tokGroups[0]);
          tokGroups[0].className = "col-md-6";
          tokGroups[1].className = "col-md-6";
          tGrid.appendChild(tokGroups[0]);
          tGrid.appendChild(tokGroups[1]);
        }

        var tSub = tokForm.querySelector('input[type="submit"], button[type="submit"]');
        if (tSub) {
          tSub.classList.remove("float-end", "btn-outlined", "btn-md", "w-100");
          var oldTWrap = tSub.closest(".mb-3, div");
          var tActions = document.createElement("div");
          tActions.className = "cyber-form-actions";
          var tStatus = document.createElement("div");
          tStatus.className = "cyber-form-status";
          tActions.appendChild(tStatus);
          tActions.appendChild(tSub);
          tokForm.appendChild(tActions);
          if (oldTWrap && oldTWrap !== tokForm && oldTWrap.children.length === 0) {
            oldTWrap.remove();
          }
        }
      }

      var tokensCard = wrapInThemeCard(tokensPane, "p-4 p-sm-5");
      if (tokensCard) {
        if (!tokensPane.querySelector(".cyber-settings-section-title")) {
          tokensPane.insertBefore(
            createSectionHeader("fas fa-key", "#FF007F", tokensTitleText, "cyber-settings-section-title--tokens"),
            tokensPane.firstChild
          );
        }
        makeTiltable(tokensCard, 0.9);
      }
    }

    wrapTablesInCyberWrap(document);
    if (typeof window.cyberInitSettingsInlineFeedback === "function") {
      window.cyberInitSettingsInlineFeedback();
    }
    if (typeof window.gdgocScanTiltCards === "function") {
      window.gdgocScanTiltCards(mainContainer);
    }
  }

  // 9. Mejora de páginas interiores de `core`
  function upgradeInnerPages() {
    var path = normPath(window.location.href) || "/";

    if (path === "/challenges") {
      upgradeChallengesPage();
      return;
    }

    if (
      path === "/login" ||
      path === "/register" ||
      path === "/reset_password" ||
      path === "/confirm"
    ) {
      var form = document.querySelector("main form");
      if (form) {
        normalizeUsernameLabels(form);

        if (path === "/register") {
          var locale = getActiveLocale();
          var isEs = locale === "es" || locale.indexOf("es") === 0;
          var regCodeText = isEs
            ? "Debe ser proporcionado por GDGoC UHU"
            : "Must be provided by GDGoC UHU";

          form.querySelectorAll(".mb-3").forEach(function (group) {
            var input = group.querySelector("input, select, textarea");
            var help = group.querySelector("small.form-text");
            if (!help) return;
            var nm = (input && (input.name || input.id) || "").toLowerCase();
            if (nm === "registration_code") {
              help.textContent = regCodeText;
            } else if (nm === "name" || nm === "email" || nm === "password") {
              help.remove();
            }
          });
        }

        if (path === "/login" || path === "/register") {
          // Acortar botones Submit de Login y Register como el resto de la web
          var authSub = form.querySelector('input[type="submit"], button[type="submit"]');
          if (authSub) {
            authSub.classList.remove("w-100", "w-sm-auto", "col-md-12", "btn-block", "float-end");
            authSub.classList.add("px-4");
            var subCol = authSub.closest('[class*="col-"]');
            if (subCol && subCol.parentElement && subCol.parentElement.classList.contains("row")) {
              var subRow = subCol.parentElement;
              var forgotLink = subRow.querySelector('a[href*="reset_password"]');
              if (forgotLink) {
                subRow.className = "d-flex flex-wrap justify-content-between align-items-center gap-3 pt-3";
                subRow.innerHTML = "";
                subRow.appendChild(forgotLink);
                subRow.appendChild(authSub);
              } else {
                subRow.className = "d-flex justify-content-end pt-3";
                subRow.innerHTML = "";
                subRow.appendChild(authSub);
              }
            }
          }
        }

        if (path === "/reset_password") {
          // Aviso equilibrado en 2 líneas y sin puntos finales
          document.querySelectorAll("main .alert span, main p").forEach(function (el) {
            var txt = (el.textContent || "").trim();
            if (/not configured to send email/i.test(txt)) {
              el.innerHTML =
                "This CTFd instance is not configured to send emails<br>" +
                "Please contact an organizer to have your password reset";
            } else if (/provide the email address/i.test(txt)) {
              el.textContent = txt.replace(/\.+$/, "");
            }
          });
          // Acortar botón Submit como el resto de formularios
          var rpSub = form.querySelector('input[type="submit"], button[type="submit"]');
          if (rpSub) {
            rpSub.classList.remove("w-100", "w-sm-auto", "col-md-12", "btn-block", "float-end");
            rpSub.classList.add("px-4");
            var rpRow = rpSub.closest(".row") || rpSub.closest(".mb-3, div");
            if (rpRow && rpRow !== form) {
              rpRow.className = "d-flex justify-content-end pt-3";
              rpRow.innerHTML = "";
              rpRow.appendChild(rpSub);
            }
          }
        }

        var col = form.closest('[class*="col-"]');
        if (col) {
          col.className = "col-md-10 col-lg-8 col-xl-7 mx-auto";
          var card = wrapChildrenInThemeCard(col, "p-4 p-sm-5");
          if (card) {
            makeTiltable(card, 0.9);
            if (path === "/login" && !card.querySelector('a[href*="/register"]')) {
              var footerHint = document.createElement("div");
              footerHint.innerHTML =
                '<hr class="my-4"><div class="text-center small theme-text-secondary">' +
                'Don\'t have an account yet? <a href="' +
                getUrlRoot() +
                '/register" class="fw-bold ms-1">Register →</a></div>';
              card.appendChild(footerHint);
            } else if (path === "/register" && !card.querySelector('a[href*="/login"]')) {
              var loginHint = document.createElement("div");
              loginHint.innerHTML =
                '<hr class="my-4"><div class="text-center small theme-text-secondary">' +
                'Already have an account? <a href="' +
                getUrlRoot() +
                '/login" class="fw-bold ms-1">Login →</a></div>';
              card.appendChild(loginHint);
            }
          }
        }
      } else if (path === "/reset_password") {
        // Caso sin formulario (CTFd solo renderiza aviso cuando no hay email configurado)
        document.querySelectorAll("main .alert span, main p, main h4, main h5").forEach(function (el) {
          var txt = (el.textContent || "").trim();
          if (/not configured to send email/i.test(txt)) {
            el.innerHTML =
              "This CTFd instance is not configured to send emails<br>" +
              "Please contact an organizer to have your password reset";
          }
        });
      }
      return;
    }

    if (path === "/notifications") {
      var emptyH2 = document.querySelector("main > .container > h2.text-center");
      if (emptyH2) {
        var box = document.createElement("div");
        box.className = "theme-card cyber-empty-state";
        box.innerHTML =
          '<span class="cyber-empty-signal"><span class="cyber-empty-dot"></span><span>0 notifications</span></span>';
        emptyH2.className = "h4 theme-text-primary fw-bold mb-1";
        emptyH2.parentNode.insertBefore(box, emptyH2);
        box.appendChild(emptyH2);
        var subNote = document.createElement("p");
        subNote.className = "small theme-text-secondary mb-0";
        subNote.textContent = "Competition announcements and updates will appear here in real time";
        box.appendChild(subNote);
        makeTiltable(box, 0.9);
      }
      document.querySelectorAll("main .card").forEach(function (c) {
        makeTiltable(c, 0.9);
      });
      return;
    }

    if (path === "/scoreboard") {
      var graph = document.getElementById("score-graph");
      if (graph) {
        var gc = wrapInThemeCard(graph, "cyber-chart-card p-3 p-md-4 mb-4");
        if (gc) {
          makeTiltable(gc, 0.8);
        }
      }
      wrapTablesInCyberWrap(document);
      if (typeof window.cyberInitScoreboardTimeframes === "function") {
        window.cyberInitScoreboardTimeframes();
      }
      if (typeof window.cyberInitChartDownloadButton === "function") {
        window.cyberInitChartDownloadButton();
      }
      return;
    }

    if (path === "/users" || path === "/teams") {
      if (path === "/users") {
        var uJumbo = document.querySelector("main .jumbotron .container");
        if (uJumbo && !uJumbo.querySelector("[data-cyber-user-count]")) {
          var rowCnt = document.querySelectorAll("main table.table tbody tr").length;
          var chipWrap = document.createElement("div");
          chipWrap.className = "cyber-stats-strip";
          chipWrap.innerHTML =
            '<span class="cyber-stat-chip">' +
            '  <i class="fas fa-users" style="color:#00F0FF;"></i>' +
            '  <span>Registered users:</span>' +
            '  <strong data-cyber-user-count>' + rowCnt + "</strong>" +
            "</span>";
          uJumbo.appendChild(chipWrap);
          if (typeof window.cyberInitRegisteredUsersCounter === "function") {
            window.cyberInitRegisteredUsersCounter();
          }
        }
      }
      var searchForm = document.querySelector("main form");
      if (searchForm) {
        if (path === "/users") {
          // Eliminar el selector de campo y el tooltip nativo "Completa este campo"
          searchForm.setAttribute("novalidate", "novalidate");
          searchForm.setAttribute("data-cyber-users-search", "1");
          var fieldSel = searchForm.querySelector('select[name="field"], #field');
          if (fieldSel) {
            var selCol = fieldSel.closest('[class*="col-"]');
            if (selCol) selCol.remove();
            else fieldSel.remove();
          }
          var qInput = searchForm.querySelector('input[name="q"], #q');
          if (qInput) {
            qInput.removeAttribute("required");
            qInput.removeAttribute("title");
            qInput.setAttribute("placeholder", "Search by username, name, country or affiliation");
            qInput.setAttribute("aria-label", "Search by username, name, country or affiliation");
            qInput.setAttribute("autocomplete", "off");
            var qCol = qInput.closest('[class*="col-"]');
            if (qCol) qCol.className = "col";
          }
          var subBtn = searchForm.querySelector('button[type="submit"], input[type="submit"]');
          if (subBtn) {
            var btnCol = subBtn.closest('[class*="col-"]');
            if (btnCol) btnCol.className = "col-auto";
            subBtn.classList.remove("w-100");
            subBtn.classList.add("cyber-users-search-btn");
          }
        }
        var sc = wrapInThemeCard(searchForm, "p-3 p-md-4 mb-4");
        if (sc) makeTiltable(sc, 0.8);
      }
      upgradeUsersDirectoryTable();
      wrapTablesInCyberWrap(document);
      if (path === "/users" && typeof window.cyberInitUsersTableInteractive === "function") {
        window.cyberInitUsersTableInteractive();
      }
      return;
    }

    if (
      path === "/user" ||
      path.indexOf("/users/") === 0 ||
      path === "/team" ||
      path.indexOf("/teams/") === 0
    ) {
      var profGraph = document.getElementById("score-graph");
      if (profGraph) {
        var pg = wrapInThemeCard(profGraph, "cyber-chart-card p-3 p-md-4 mb-4");
        if (pg) makeTiltable(pg, 0.8);
      }
      wrapTablesInCyberWrap(document);
      if (typeof window.cyberInitProfilePointsMetrics === "function") {
        window.cyberInitProfilePointsMetrics();
      }
      if (typeof window.cyberInitChartDownloadButton === "function") {
        window.cyberInitChartDownloadButton();
      }
      return;
    }

    if (path === "/settings") {
      upgradeSettingsPage();
      return;
    }

    wrapTablesInCyberWrap(document);
  }

  function finishBridge() {
    if (bridgeCompleted) return;
    bridgeCompleted = true;
    if (earlyObs) {
      earlyObs.disconnect();
      earlyObs = null;
    }
    enforceCyberMode();
    var legacyStyle = document.getElementById("gdg-custom-theme");
    if (legacyStyle) legacyStyle.disabled = true;

    if (!document.querySelector("header.theme-header") || navUpgraded) {
      injectBackgroundFx();
      upgradeNavbar();
      syncLanguagePersistence();
      upgradeFooter();
      upgradeInnerPages();
      highlightActiveNav();
    }

    document.documentElement.classList.remove("cyber-bridging");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishBridge);
  } else {
    finishBridge();
  }
})();
