/* ============================================================================
   GDG on Campus Universidad de Huelva · CTFd `core` → Cyber Theme Bridge
   - Cero flash (actualiza <nav> en cuanto se parsea, antes del primer paint)
   - Proxy diferido de EventSource (/events) que cierra streams al navegar
     (evita bloqueos en HTTP/1.1 al cambiar rápido entre pestañas/apartados)
   - Tablero /challenges optimizado sin bucles de MutationObserver
   - Tabla /users: Username · Country (bandera + tooltip) · Affiliation · Website preview
   - Vista /settings unificada (Perfil + Access Tokens sin pestañas separadas)
   - Guardia absoluta sobre /admin y auto-desactivación con tema nativo `cyber`
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
      this._timer = null;

      // Diferir 350ms la apertura real: si el usuario cambia rápido de apartado, no se abre conexión SSE
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
      if (this._real) {
        this._real.addEventListener(type, fn, opts);
      } else {
        this._listeners.push([type, fn, opts]);
      }
    };

    ManagedEventSource.prototype.removeEventListener = function (type, fn, opts) {
      if (this._real) {
        this._real.removeEventListener(type, fn, opts);
      } else {
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

    // Cerrar streams inmediatamente al hacer clic en cualquier enlace interno o al salir
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
          if (dest.origin === window.location.origin) {
            closeAllStreams();
          }
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
      if (root && p.indexOf(root) === 0) {
        p = p.slice(root.length) || "/";
      }
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
      '<span class="fx-cyber-token fx-cyber-token--2">&lt;CYBERTRAINER_CTF /&gt;</span>' +
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
    // Esperar hasta que termine de parsearse el último bloque del nav (dropdown de idioma o siguiente hermano)
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
        '<div class="gdg-brand-subtitle text-truncate">CyberTrainer</div>' +
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
          unreadBadge = badge;
        }
        li.remove();
      }
    });

    leftUl.className = "navbar-nav me-auto ms-lg-3 mt-3 mt-lg-0 gap-1";
    var hasNotifications = false;
    Array.prototype.slice.call(leftUl.querySelectorAll(":scope > li > a.nav-link")).forEach(function (a) {
      var p = normPath(a.href);
      if (p === "/notifications") hasNotifications = true;
      var iconCls = leftIcons[p];
      if (iconCls && !a.querySelector("i")) {
        var txt = cleanLabel(a, a.textContent.trim());
        a.innerHTML = '<i class="' + iconCls + '"></i><span>' + txt + "</span>";
      }
    });

    if (!hasNotifications) {
      var notifLi = document.createElement("li");
      notifLi.className = "nav-item";
      var notifA = document.createElement("a");
      notifA.className = "nav-link position-relative";
      notifA.href = notifHref;
      notifA.title = notifLabel;
      notifA.innerHTML = '<i class="fas fa-bell fa-fw"></i><span>' + notifLabel + "</span>";
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
          var langTitle = cleanLabel(btn, "Change language");
          btn.className = "theme-pill-btn theme-pill-btn--icon dropdown-toggle w-100 w-lg-auto";
          btn.setAttribute("title", langTitle);
          btn.innerHTML =
            '<i class="fas fa-language"></i>' +
            '<span class="d-lg-none">' + langTitle + "</span>";
        }
        return;
      }

      var a = li.querySelector("a[href]");
      if (!a) return;
      var p = normPath(a.href);
      var lbl = cleanLabel(a, "");

      if (p === "/admin") {
        var adminLabel = lbl.toLowerCase() === "admin panel" ? "Admin" : lbl || "Admin";
        a.className = "theme-pill-btn theme-pill-btn--admin w-100 w-lg-auto";
        a.title = lbl || "Admin Panel";
        a.innerHTML = '<i class="fas fa-wrench fa-fw"></i><span>' + adminLabel + "</span>";
      } else if (p === "/team") {
        a.className = "theme-pill-btn w-100 w-lg-auto";
        a.title = lbl || "Team";
        a.innerHTML = '<i class="fas fa-users fa-fw"></i><span>' + (lbl || "Team") + "</span>";
      } else if (p === "/user") {
        a.className = "theme-pill-btn w-100 w-lg-auto";
        a.title = lbl || "Profile";
        a.innerHTML = '<i class="fas fa-user-circle fa-fw"></i><span>' + (lbl || "Profile") + "</span>";
      } else if (p === "/settings") {
        a.className = "theme-pill-btn theme-pill-btn--icon w-100 w-lg-auto";
        a.title = lbl || "Settings";
        a.innerHTML =
          '<i class="fas fa-cogs fa-fw"></i>' +
          '<span class="d-lg-none">' + (lbl || "Settings") + "</span>";
      } else if (p === "/logout") {
        a.className = "theme-pill-btn theme-pill-btn--icon w-100 w-lg-auto";
        a.title = lbl || "Logout";
        a.innerHTML =
          '<i class="fas fa-sign-out-alt fa-fw"></i>' +
          '<span class="d-lg-none">' + (lbl || "Logout") + "</span>";
      } else if (p === "/login") {
        loginLi = li;
        a.className = "theme-pill-btn w-100 w-lg-auto";
        a.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>' + (lbl || "Login") + "</span>";
      } else if (p === "/register") {
        registerLi = li;
        a.className = "theme-primary-btn w-100 w-lg-auto";
        a.innerHTML = '<i class="fas fa-user-plus"></i><span>' + (lbl || "Register") + "</span>";
      }
    });

    if (loginLi && registerLi && loginLi.parentNode === rightUl && registerLi.parentNode === rightUl) {
      rightUl.insertBefore(loginLi, registerLi);
    }

    if (!rightUl.querySelector('a[href="https://gdguhu.com"]')) {
      var comLi = document.createElement("li");
      comLi.className = "nav-item";
      comLi.innerHTML =
        '<a href="https://gdguhu.com" target="_blank" rel="noopener noreferrer" ' +
        'class="theme-pill-btn w-100 w-lg-auto" title="Web oficial de GDG on Campus UHU">' +
        '<span>Comunidad</span>' +
        '<i class="fas fa-external-link-alt" style="font-size: 0.7rem;"></i>' +
        "</a>";
      rightUl.appendChild(comLi);
    }

    highlightActiveNav();
    return true;
  }

  // Observador temprano: actualiza <nav> al parsearse y termina <main>+<footer> en cuanto aparece </footer> (antes de módulos JS)
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
      '        <div class="theme-text-secondary" style="font-size: 0.76rem;">CyberTrainer</div>' +
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

  // Helpers comunes para páginas interiores
  function addJumbotronPill(labelText, withDots) {
    var jumboContainer = document.querySelector("main .jumbotron .container");
    if (!jumboContainer || jumboContainer.querySelector(".theme-badge-pill")) return;
    var pill = document.createElement("div");
    pill.className = "theme-badge-pill mb-3";
    var dotsHtml = withDots
      ? '<span class="cyber-dots" aria-hidden="true">' +
        '<span class="cyber-dot cyber-dot--1"></span>' +
        '<span class="cyber-dot cyber-dot--2"></span>' +
        '<span class="cyber-dot cyber-dot--3"></span>' +
        '<span class="cyber-dot cyber-dot--4"></span>' +
        "</span>"
      : "";
    pill.innerHTML = dotsHtml + "<span>" + labelText + "</span>";
    jumboContainer.insertBefore(pill, jumboContainer.firstChild);
  }

  function wrapInThemeCard(el, extraClasses) {
    if (!el || el.closest(".theme-card")) return null;
    var card = document.createElement("div");
    card.className = "theme-card " + (extraClasses || "p-4");
    var bar = document.createElement("div");
    bar.className = "cyber-card-accent-bar";
    card.appendChild(bar);
    el.parentNode.insertBefore(card, el);
    card.appendChild(el);
    return card;
  }

  function wrapChildrenInThemeCard(parent, extraClasses) {
    if (!parent || parent.querySelector(":scope > .theme-card")) return null;
    var card = document.createElement("div");
    card.className = "theme-card " + (extraClasses || "p-4 p-sm-5");
    var bar = document.createElement("div");
    bar.className = "cyber-card-accent-bar";
    card.appendChild(bar);
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

  // 6. Tablero /challenges (optimizado: desconecta el observer durante mutaciones propias, 0 bucles!)
  function upgradeChallengesPage() {
    var board = document.querySelector('[x-data="ChallengeBoard"]');
    if (!board || document.querySelector(".cyber-filter-bar")) return;

    var jumboContainer = document.querySelector("main .jumbotron .container");
    var statsWrap = null;
    if (jumboContainer) {
      var sub = document.createElement("p");
      sub.className = "cyber-hero-sub";
      sub.innerHTML = '<span class="theme-accent-text fw-bold">CyberTrainer GDGoC UHU</span>';
      jumboContainer.appendChild(sub);

      statsWrap = document.createElement("div");
      statsWrap.id = "gdg-core-stats";
      statsWrap.style.display = "none";
      statsWrap.innerHTML =
        '<div class="cyber-stats-strip">' +
        '  <span class="cyber-stat-chip"><i class="fas fa-terminal" style="color:#FF007F;"></i><span>Retos:</span><strong id="gdg-stat-total">0</strong></span>' +
        '  <span class="cyber-stat-chip cyber-stat-chip--solved"><i class="fas fa-check-circle" style="color:#00FF66;"></i><span>Resueltos:</span><strong id="gdg-stat-solved">0 / 0</strong></span>' +
        "</div>" +
        '<div class="cyber-progress-wrap"><div class="cyber-progress-track"><div class="cyber-progress-fill" id="gdg-stat-bar" style="width:0%"></div></div></div>';
      jumboContainer.appendChild(statsWrap);
    }

    var filterBar = document.createElement("div");
    filterBar.className = "cyber-filter-bar";
    filterBar.style.display = "none";
    filterBar.innerHTML =
      '<div class="row g-3 align-items-center">' +
      '  <div class="col-lg-7">' +
      '    <div class="theme-search-box">' +
      '      <i class="fas fa-search ms-2" style="color:#00F0FF;"></i>' +
      '      <input type="text" id="gdg-chal-search" placeholder="Buscar reto por nombre, categoría o etiqueta..." aria-label="Buscar reto">' +
      '      <button type="button" id="gdg-chal-clear" class="btn btn-sm p-1 border-0 bg-transparent text-secondary" style="display:none;" aria-label="Limpiar búsqueda"><i class="fas fa-times"></i></button>' +
      "    </div>" +
      "  </div>" +
      '  <div class="col-lg-5 d-flex justify-content-lg-end">' +
      '    <button type="button" id="gdg-chal-hide-solved" class="theme-pill-btn">' +
      '      <i class="fas fa-filter"></i><span>Ocultar resueltos</span>' +
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

    var state = { search: "", category: "ALL", hideSolved: false };
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
      hideSolvedBtn.classList.toggle("active", state.hideSolved);
      hideSolvedBtn.innerHTML =
        '<i class="fas ' +
        (state.hideSolved ? "fa-eye-slash" : "fa-filter") +
        '"></i><span>' +
        (state.hideSolved ? "Mostrando pendientes" : "Ocultar resueltos") +
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
          btn.setAttribute("data-tilt-max", "2.2");
        }
        if (!btn.querySelector(".tilt-glare")) {
          var glare = document.createElement("div");
          glare.className = "tilt-glare";
          glare.setAttribute("aria-hidden", "true");
          btn.insertBefore(glare, btn.firstChild);
        }
        var targetCls =
          "challenge-status-badge gdg-core-status-badge " +
          (isSolved ? "challenge-status-badge--solved" : "challenge-status-badge--open");
        var targetTxt = isSolved ? "✓ SOLVED" : "ACTIVE";
        var statusBadge = btn.querySelector(".gdg-core-status-badge");
        if (!statusBadge) {
          statusBadge = document.createElement("span");
          statusBadge.className = targetCls;
          statusBadge.textContent = targetTxt;
          btn.appendChild(statusBadge);
        } else {
          if (statusBadge.className !== targetCls) statusBadge.className = targetCls;
          if (statusBadge.textContent !== targetTxt) statusBadge.textContent = targetTxt;
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

      var catNames = [];
      board.querySelectorAll(".category-header").forEach(function (header) {
        var h3 = header.querySelector("h3");
        if (!h3) return;
        var name = (h3.textContent || "").trim();
        if (!name) return;
        catNames.push(name);

        if (!header.querySelector(".gdg-cat-slash")) {
          var slash = document.createElement("span");
          slash.className = "gdg-cat-slash";
          slash.style.cssText =
            "color:#00F0FF;font-family:'JetBrains Mono',monospace;font-weight:700;";
          slash.textContent = "//";
          header.insertBefore(slash, h3);
        }

        var secBtns = header.parentElement
          ? header.parentElement.querySelectorAll(".challenge-button")
          : [];
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
        allBtn.innerHTML = "<span>⚡ Todas</span>";
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

      applyFilters(); // Reconecta boardObs al terminar
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

    // CTFd core orden original: [0: User, 1: Website, 2: Affiliation, 3: Country]
    // Nuevo orden solicitado:   [0: Username, 1: Country (bandera+tooltip), 2: Affiliation, 3: Website preview]
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

      // Country: solo bandera + tooltip con nombre completo del país
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
          wrap.setAttribute("title", countryName);
          wrap.setAttribute("aria-label", countryName);
        }
        wrap.appendChild(flagIcon);
        tdCountry.appendChild(wrap);
      } else if (countryName) {
        tdCountry.innerHTML = '<span class="theme-text-secondary small">' + countryName + "</span>";
      } else {
        tdCountry.innerHTML = '<span class="theme-text-secondary opacity-50">—</span>';
      }

      // Affiliation
      tdAff.className = "d-none d-md-table-cell";
      if (!(tdAff.textContent || "").trim()) {
        tdAff.innerHTML = '<span class="theme-text-secondary opacity-50">—</span>';
      }

      // Website: preview visual clicable si existe enlace
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
        a.title = href;
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

  // 8. Settings unificado (Perfil + Access Tokens en una sola página sin pestañas separadas)
  function upgradeSettingsPage() {
    addJumbotronPill("ACCOUNT::CONFIG", false);
    var mainContainer = document.querySelector("main > .container");
    if (!mainContainer) return;

    mainContainer.classList.add("cyber-settings-unified");

    var navPills = mainContainer.querySelector(".nav-pills");
    if (navPills) {
      var navCol = navPills.closest('[class*="col-"]');
      if (navCol) navCol.classList.add("d-none");
    }

    var tabContent = mainContainer.querySelector(".tab-content");
    if (tabContent) {
      var contentCol = tabContent.closest('[class*="col-"]');
      if (contentCol) {
        contentCol.className = "col-lg-9 col-xl-8 mx-auto";
      }

      var profilePane = tabContent.querySelector("#profile");
      if (profilePane) {
        profilePane.classList.add("show", "active");
        var profileCard = wrapInThemeCard(profilePane, "p-4 p-sm-5 mb-4");
        if (profileCard && !profileCard.querySelector(".cyber-settings-section-title")) {
          var h = document.createElement("h3");
          h.className = "cyber-settings-section-title";
          h.innerHTML = '<i class="fas fa-user-cog" style="color:#00F0FF;"></i><span>Configuración de Perfil y Seguridad</span>';
          profilePane.insertBefore(h, profilePane.firstChild);
        }
      }

      var tokensPane = tabContent.querySelector("#tokens");
      if (tokensPane) {
        tokensPane.classList.add("show", "active");
        var tokensCard = wrapInThemeCard(tokensPane, "p-4 p-sm-5");
        if (tokensCard && !tokensCard.querySelector(".cyber-settings-section-title")) {
          var th = document.createElement("h3");
          th.className = "cyber-settings-section-title";
          th.innerHTML = '<i class="fas fa-key" style="color:#FF007F;"></i><span>Access Tokens (API)</span>';
          tokensPane.insertBefore(th, tokensPane.firstChild);
        }
      }
    }

    wrapTablesInCyberWrap(document);
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
      if (path === "/login") addJumbotronPill("AUTH::ACCESS_NODE", true);
      if (path === "/register") addJumbotronPill("NEW_PLAYER::ENROLLMENT", true);
      var form = document.querySelector("main form");
      if (form) {
        var col = form.closest('[class*="col-"]');
        if (col) {
          var card = wrapChildrenInThemeCard(col, "p-4 p-sm-5");
          if (card && path === "/login" && !card.querySelector('a[href*="/register"]')) {
            var footerHint = document.createElement("div");
            footerHint.innerHTML =
              '<hr class="my-4"><div class="text-center small theme-text-secondary">' +
              '¿Todavía no tienes cuenta? <a href="' +
              getUrlRoot() +
              '/register" class="fw-bold ms-1">Register →</a></div>';
            card.appendChild(footerHint);
          } else if (card && path === "/register" && !card.querySelector('a[href*="/login"]')) {
            var loginHint = document.createElement("div");
            loginHint.innerHTML =
              '<hr class="my-4"><div class="text-center small theme-text-secondary">' +
              '¿Ya tienes una cuenta registrada? <a href="' +
              getUrlRoot() +
              '/login" class="fw-bold ms-1">Login →</a></div>';
            card.appendChild(loginHint);
          }
        }
      }
      return;
    }

    if (path === "/notifications") {
      addJumbotronPill("SYSTEM::BROADCASTS", false);
      var emptyH2 = document.querySelector("main > .container > h2.text-center");
      if (emptyH2) {
        var box = document.createElement("div");
        box.className = "theme-card p-5 text-center";
        box.innerHTML =
          '<div class="cyber-card-accent-bar"></div>' +
          '<i class="fas fa-bell-slash fa-3x mb-3" style="color:#00F0FF;opacity:0.7;"></i>';
        emptyH2.className = "h4 theme-text-primary fw-bold mb-1";
        emptyH2.parentNode.insertBefore(box, emptyH2);
        box.appendChild(emptyH2);
      }
      document.querySelectorAll("main .card").forEach(function (c) {
        if (!c.querySelector(".cyber-card-accent-bar")) {
          var bar = document.createElement("div");
          bar.className = "cyber-card-accent-bar";
          c.insertBefore(bar, c.firstChild);
        }
      });
      return;
    }

    if (path === "/scoreboard") {
      addJumbotronPill("LIVE RANKING · TELEMETRY", true);
      var graph = document.getElementById("score-graph");
      if (graph) wrapInThemeCard(graph, "p-3 p-md-4 mb-4");
      wrapTablesInCyberWrap(document);
      return;
    }

    if (path === "/users" || path === "/teams") {
      addJumbotronPill(path === "/teams" ? "DIRECTORY::TEAMS" : "DIRECTORY::PLAYERS", false);
      var searchForm = document.querySelector("main form");
      if (searchForm) wrapInThemeCard(searchForm, "p-3 p-md-4 mb-4");
      upgradeUsersDirectoryTable();
      wrapTablesInCyberWrap(document);
      return;
    }

    if (
      path === "/user" ||
      path.indexOf("/users/") === 0 ||
      path === "/team" ||
      path.indexOf("/teams/") === 0
    ) {
      addJumbotronPill(path.indexOf("/team") === 0 ? "TEAM::PROFILE" : "PLAYER::PROFILE", true);
      var profGraph = document.getElementById("score-graph");
      if (profGraph) wrapInThemeCard(profGraph, "p-3 p-md-4 mb-4");
      wrapTablesInCyberWrap(document);
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

    // Solo actuar como puente cuando no esté activo el tema Jinja nativo `cyber`
    if (!document.querySelector("header.theme-header") || navUpgraded) {
      injectBackgroundFx();
      upgradeNavbar();
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
