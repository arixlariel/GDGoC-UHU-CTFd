/* ============================================================================
   GDG on Campus Universidad de Huelva · CTFd `core` → Cyber Theme Bridge
   Transforma en caliente el tema nativo `core` de CTFd en el diseño completo
   GDGoC UHU Cyber (idéntico al repositorio GDGoC-UHU-CTFd y a gdguhu.com),
   manteniendo 100% intactos Alpine.js, Bootstrap 5, ECharts y el panel /admin.
   Si el tema Jinja `gdgoc-cyber` ya está instalado en disco, no duplica nada.
   ============================================================================ */

(function () {
  "use strict";

  // Guardia absoluta: nunca tocar el panel de administración de CTFd
  if (window.location.pathname.indexOf("/admin") === 0) {
    return;
  }

  var ASSET_BASE = (
    window.GDGOC_ASSET_BASE ||
    "https://arixlariel.github.io/GDGoC-UHU-CTFd/static"
  ).replace(/\/+$/, "");
  var ASSET_VER = window.GDGOC_ASSET_VER ? "?v=" + window.GDGOC_ASSET_VER : "";

  function assetUrl(rel) {
    return ASSET_BASE + "/" + rel.replace(/^\/+/, "") + ASSET_VER;
  }

  // 1. Forzar Cyber Dark inmediatamente (antes del primer paint) y bloquear vueltas a modo claro
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
    var htmlObserver = new MutationObserver(enforceCyberMode);
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bs-theme", "data-theme"],
    });
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

  // 2. Fondo animado Cyber (#theme-fx-container)
  function injectBackgroundFx() {
    if (document.getElementById("theme-fx-container")) return;
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

  // 3. Upgrade del Navbar de `core` a `<header class="theme-header">`
  function upgradeNavbar() {
    if (document.querySelector("header.theme-header")) return;
    var nav = document.querySelector("body > nav.navbar") || document.querySelector("nav.navbar");
    if (!nav) return;

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

    // Brand con logo GDGoC UHU + GDGoC UHU / CyberTrainer
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

    var collapse = nav.querySelector(".navbar-collapse");
    if (!collapse) return;

    var uls = collapse.querySelectorAll(":scope > ul.navbar-nav");
    var leftUl = uls[0];
    var rightUl = uls[1];

    var hr = collapse.querySelector(":scope > hr");
    if (hr) {
      hr.className = "d-lg-none my-3";
    }

    var leftIcons = {
      "/users": "fas fa-user-astronaut fa-fw",
      "/teams": "fas fa-users fa-fw",
      "/scoreboard": "fas fa-trophy fa-fw",
      "/challenges": "fas fa-flag fa-fw",
    };

    var unreadBadge = null;
    var notifHref = getUrlRoot() + "/notifications";
    var notifLabel = "Notifications";

    // Buscar si Notifications ya está en rightUl (usuario autenticado) para moverlo a leftUl preservando Alpine
    if (rightUl) {
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
    }

    // Estilizar enlaces de la izquierda + asegurar Notifications siempre visible
    if (leftUl) {
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
        if (unreadBadge) {
          notifA.appendChild(unreadBadge);
        }
        notifLi.appendChild(notifA);
        leftUl.appendChild(notifLi);
      }
    }

    // Estilizar controles de la derecha (Admin, Profile, Settings, Logout / Login + Register / Idioma / Comunidad)
    if (rightUl) {
      rightUl.className = "navbar-nav ms-lg-auto align-items-lg-center gap-2 pb-2 pb-lg-0";

      var loginLi = null;
      var registerLi = null;

      Array.prototype.slice.call(rightUl.children).forEach(function (li) {
        // Eliminar el botón obsoleto claro/oscuro (.theme-switch)
        if (li.querySelector(".theme-switch")) {
          li.remove();
          return;
        }

        // Selector de idioma oficial de CTFd (mantiene intacto <form x-data="LanguageForm">)
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

      // Ordenar Login ANTES de Register (misma altura visual)
      if (loginLi && registerLi && loginLi.parentNode === rightUl && registerLi.parentNode === rightUl) {
        rightUl.insertBefore(loginLi, registerLi);
      }

      // Añadir botón Comunidad → https://gdguhu.com al final
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
    }
  }

  // 4. Upgrade del Footer de `core` al Footer oficial Cyber (clon de gdguhu.com)
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
    } else {
      document.body.appendChild(footer);
    }
  }

  // Helpers comunes para páginas interiores de `core`
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
    if (!el || el.closest(".theme-card")) return;
    var card = document.createElement("div");
    card.className = "theme-card " + (extraClasses || "p-4");
    var bar = document.createElement("div");
    bar.className = "cyber-card-accent-bar";
    card.appendChild(bar);
    el.parentNode.insertBefore(card, el);
    card.appendChild(el);
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

  // 5. Mejora interactiva del tablero /challenges de `core` (buscador, filtros, progreso, 3D tilt)
  function upgradeChallengesPage() {
    var board = document.querySelector('[x-data="ChallengeBoard"]');
    if (!board || document.querySelector(".cyber-filter-bar")) return;

    // Añadir subtítulo y strip de estadísticas en el jumbotron
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

    // Barra de búsqueda, ocultar resueltos y pills de categorías
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

    function applyFilters() {
      var q = state.search.trim().toLowerCase();
      var sections = board.querySelectorAll(".category-header");
      sections.forEach(function (header) {
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
      var btns = board.querySelectorAll(".challenge-button");
      if (!btns.length) return;

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
        var statusBadge = btn.querySelector(".gdg-core-status-badge");
        if (!statusBadge) {
          statusBadge = document.createElement("span");
          statusBadge.className = "challenge-status-badge gdg-core-status-badge";
          btn.appendChild(statusBadge);
        }
        statusBadge.className =
          "challenge-status-badge gdg-core-status-badge " +
          (isSolved ? "challenge-status-badge--solved" : "challenge-status-badge--open");
        statusBadge.textContent = isSolved ? "✓ SOLVED" : "ACTIVE";
      });

      if (typeof window.gdgocScanTiltCards === "function") {
        window.gdgocScanTiltCards(board);
      }

      // Actualizar estadísticas y barra de progreso
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

      // Actualizar cabeceras de categoría y pills
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
            "color:#00F0FF;font-family:'Google Sans Mono',monospace;font-weight:700;";
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
        var pill = header.querySelector(".category-count-pill");
        if (!pill) {
          pill = document.createElement("span");
          pill.className = "category-count-pill";
          header.appendChild(pill);
        }
        pill.textContent = secSolved + "/" + secBtns.length;
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

      applyFilters();
    }

    function scheduleSync() {
      if (syncScheduled) return;
      syncScheduled = true;
      requestAnimationFrame(syncChallengesBoard);
    }

    scheduleSync();
    if (typeof MutationObserver !== "undefined") {
      var boardObs = new MutationObserver(scheduleSync);
      boardObs.observe(board, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  // 6. Mejora de páginas interiores de `core` (Login, Register, Notifications, Scoreboard, Users, Profile, Settings)
  function upgradeInnerPages() {
    var path = normPath(window.location.href) || "/";

    // /challenges
    if (path === "/challenges") {
      upgradeChallengesPage();
      return;
    }

    // /login, /register, /reset_password, /confirm
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

    // /notifications
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

    // /scoreboard
    if (path === "/scoreboard") {
      addJumbotronPill("LIVE RANKING · TELEMETRY", true);
      var graph = document.getElementById("score-graph");
      if (graph) wrapInThemeCard(graph, "p-3 p-md-4 mb-4");
      wrapTablesInCyberWrap(document);
      return;
    }

    // /users, /teams (directorios)
    if (path === "/users" || path === "/teams") {
      addJumbotronPill(path === "/teams" ? "DIRECTORY::TEAMS" : "DIRECTORY::PLAYERS", false);
      var searchForm = document.querySelector("main form");
      if (searchForm) wrapInThemeCard(searchForm, "p-3 p-md-4 mb-4");
      wrapTablesInCyberWrap(document);
      return;
    }

    // /user, /users/<id>, /team, /teams/<id> (perfiles)
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

    // /settings
    if (path === "/settings") {
      addJumbotronPill("ACCOUNT::CONFIG", false);
      var navPills = document.querySelector("main .nav-pills");
      if (navPills) wrapInThemeCard(navPills, "p-3");
      var tabContent = document.querySelector("main .tab-content");
      if (tabContent) wrapInThemeCard(tabContent, "p-4 p-sm-5");
      wrapTablesInCyberWrap(document);
      return;
    }

    // Resto de páginas (p. ej. / o páginas CMS personalizadas)
    wrapTablesInCyberWrap(document);
  }

  // 7. Resaltado activo en el navbar (ejecutado tras upgradeNavbar)
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

  document.addEventListener("DOMContentLoaded", function () {
    enforceCyberMode();
    var legacyStyle = document.getElementById("gdg-custom-theme");
    if (legacyStyle) legacyStyle.disabled = true;

    // Solo actuar como puente cuando no esté activo el tema Jinja nativo `gdgoc-cyber`
    if (!document.querySelector("header.theme-header")) {
      injectBackgroundFx();
      upgradeNavbar();
      upgradeFooter();
      upgradeInnerPages();
      highlightActiveNav();
    }
  });
})();
