/* ============================================================================
   GDG on Campus Universidad de Huelva · CTFd Theme: Cyber
   - Fuerza el modo Cyber sin parpadeo
   - Proxy de EventSource (/events) que cierra streams SSE al cambiar de apartado
   - Motor 3D Perspective Tilt + Specular Glare (mismo algoritmo que Open Badges)
   - Paleta Cyber Neon para gráficas Apache ECharts (Scoreboard, Users, Teams)
   ============================================================================ */

(function () {
  "use strict";

  // 1. Forzar siempre el modo Cyber oscuro
  document.documentElement.setAttribute("data-theme", "cyber");
  document.documentElement.setAttribute("data-bs-theme", "dark");

  // 1b. Proxy de EventSource para evitar bloqueos HTTP/1.1 al navegar rápido (si no lo aplicó cyber-bridge)
  if (!window.__cyberEventSourcePatched && typeof window.EventSource === "function") {
    window.__cyberEventSourcePatched = true;
    var NativeES = window.EventSource;
    var activeStreams = [];
    function closeAllStreams() {
      for (var i = 0; i < activeStreams.length; i++) {
        try { activeStreams[i].close(); } catch (_) {}
      }
      activeStreams.length = 0;
    }
    function ManagedES(url, cfg) {
      var self = this;
      this.url = url;
      this.readyState = 0;
      this._closed = false;
      this._real = null;
      this._listeners = [];
      this._timer = setTimeout(function () {
        self._timer = null;
        if (self._closed || document.visibilityState === "hidden") return;
        try {
          var real = cfg ? new NativeES(url, cfg) : new NativeES(url);
          self._real = real;
          self.readyState = real.readyState;
          if (typeof self.onopen === "function") real.onopen = self.onopen;
          if (typeof self.onmessage === "function") real.onmessage = self.onmessage;
          if (typeof self.onerror === "function") real.onerror = self.onerror;
          for (var j = 0; j < self._listeners.length; j++) {
            var it = self._listeners[j];
            real.addEventListener(it[0], it[1], it[2]);
          }
          self._listeners.length = 0;
        } catch (_) {}
      }, 350);
      activeStreams.push(this);
    }
    ManagedES.CONNECTING = 0;
    ManagedES.OPEN = 1;
    ManagedES.CLOSED = 2;
    ManagedES.prototype.addEventListener = function (t, f, o) {
      if (this._closed) return;
      if (this._real) this._real.addEventListener(t, f, o);
      else this._listeners.push([t, f, o]);
    };
    ManagedES.prototype.removeEventListener = function (t, f, o) {
      if (this._real) this._real.removeEventListener(t, f, o);
      else this._listeners = this._listeners.filter(function (it) { return it[0] !== t || it[1] !== f; });
    };
    ManagedES.prototype.close = function () {
      this._closed = true;
      this.readyState = 2;
      if (this._timer !== null) { clearTimeout(this._timer); this._timer = null; }
      if (this._real) { try { this._real.close(); } catch (_) {} this._real = null; }
    };
    window.EventSource = ManagedES;
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var h = a.getAttribute("href") || "";
      if (!h || h.charAt(0) === "#" || h.indexOf("javascript:") === 0) return;
      try { if (new URL(a.href, window.location.origin).origin === window.location.origin) closeAllStreams(); } catch (_) {}
    }, true);
    document.addEventListener("submit", closeAllStreams, true);
    window.addEventListener("pagehide", closeAllStreams);
    window.addEventListener("beforeunload", closeAllStreams);
  }

  // 2. Configuración Cyber Neon 100% compatible con mergeObjects() de CTFd ECharts
  //    (solo propiedades seguras para mergeObjects; sin barra blanca superior dataZoom ni tooltips decimales)
  var CHART_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatChartDate(val) {
    if (val === null || val === undefined || val === "") return "";
    var d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) {
      // Limpiar sufijos tipo "GMT+0100 (hora estándar de Europa central)" si llegara texto crudo
      return String(val).replace(/\s*GMT[^\n]*$/i, "").trim();
    }
    var dd = String(d.getDate()).padStart(2, "0");
    var mon = CHART_MONTHS[d.getMonth()] || "";
    var yyyy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return dd + " " + mon + " " + yyyy + " · " + hh + ":" + mm;
  }

  function formatIntAxis(v) {
    var num = Number(v);
    if (isNaN(num)) return "";
    return Math.abs(num - Math.round(num)) < 1e-6 ? String(Math.round(num)) : "";
  }

  // Crea un objeto hoja seguro para mergeObjects() de CTFd (instanceof Object === false evita recursión en claves inexistentes)
  function safeMergeLeaf(props) {
    var o = Object.create(null);
    Object.defineProperty(o, "hasOwnProperty", {
      value: Object.prototype.hasOwnProperty,
      enumerable: false,
    });
    Object.keys(props).forEach(function (k) {
      o[k] = props[k];
    });
    return o;
  }

  // Paleta fija y claramente diferenciada por categoría (usada en Category Breakdown y perfiles)
  var CATEGORY_COLOR_MAP = {
    web: "#00F0FF",
    "criptografía": "#FF007F",
    criptografia: "#FF007F",
    forense: "#FFE600",
    reversing: "#A855F7",
    misc: "#00FF66",
  };
  var CATEGORY_FALLBACK_COLORS = ["#FF6B00", "#38BDF8", "#F43F5E", "#10B981", "#E879F9", "#FACC15"];
  var TOP10_SERIES_COLORS = [
    "#00F0FF",
    "#FF007F",
    "#00FF66",
    "#FFE600",
    "#A855F7",
    "#FF6B00",
    "#38BDF8",
    "#FF3358",
    "#10B981",
    "#E879F9",
  ];

  function getCategoryColor(name) {
    var key = (name || "").trim().toLowerCase();
    if (CATEGORY_COLOR_MAP[key]) return CATEGORY_COLOR_MAP[key];
    var hash = 0;
    for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return CATEGORY_FALLBACK_COLORS[Math.abs(hash) % CATEGORY_FALLBACK_COLORS.length];
  }
  window.cyberCategoryColor = getCategoryColor;

  function makeCyberChartTheme(isProfile) {
    var base = {
      backgroundColor: "transparent",
      color: TOP10_SERIES_COLORS.slice(),
      textStyle: safeMergeLeaf({
        color: "#E2F1FF",
        fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
      }),
      title: {
        top: 6,
        textStyle: safeMergeLeaf({
          color: "#F0F9FF",
          fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: isProfile ? 23 : 20,
        }),
      },
      toolbox: {
        show: false,
      },
      grid: {
        top: isProfile ? 68 : 64,
        bottom: isProfile ? 68 : 76,
        left: 20,
        right: 24,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: "rgba(6, 10, 24, 0.96)",
        borderColor: "#00F0FF",
        borderWidth: 1,
        padding: isProfile ? [6, 14] : [10, 14],
        textStyle: safeMergeLeaf({
          color: "#E2F1FF",
          fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
        }),
        axisPointer: {
          type: "line",
          snap: true,
          label: safeMergeLeaf({ show: false }),
          lineStyle: safeMergeLeaf({
            color: "rgba(0, 240, 255, 0.5)",
            width: 1.5,
            type: "dashed",
          }),
        },
      },
      legend: {
        show: true,
        bottom: 8,
        textStyle: safeMergeLeaf({
          color: "#E2F1FF",
          fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
          fontWeight: 600,
        }),
        pageTextStyle: safeMergeLeaf({ color: "#94A3B8" }),
        pageIconColor: "#00F0FF",
        pageIconInactiveColor: "#475569",
      },
      xAxis: [
        {
          axisLabel: safeMergeLeaf({
            color: "#94A3B8",
            margin: 18,
            fontSize: 12,
            fontFamily: "'Google Sans Mono', 'JetBrains Mono', monospace",
            formatter: formatChartDate,
          }),
          axisPointer: safeMergeLeaf({
            label: safeMergeLeaf({ show: false }),
          }),
        },
      ],
      yAxis: [
        {
          minInterval: 1,
          axisLabel: safeMergeLeaf({
            color: "#94A3B8",
            margin: 12,
            fontFamily: "'Google Sans Mono', 'JetBrains Mono', monospace",
            formatter: formatIntAxis,
          }),
          splitLine: safeMergeLeaf({
            lineStyle: safeMergeLeaf({ color: "rgba(0, 240, 255, 0.14)" }),
          }),
          axisPointer: safeMergeLeaf({
            show: false,
            label: safeMergeLeaf({ show: false }),
          }),
        },
      ],
      dataZoom: [
        {
          show: false,
        },
      ],
    };

    if (isProfile) {
      base.title.text = "Score Over Time";
      base.tooltip.formatter = function (params) {
        var p = Array.isArray(params) ? params[0] : params;
        if (!p) return "";
        var raw = Array.isArray(p.value) ? p.value[1] : p.value;
        var pts = Math.round(Number(raw || 0));
        return (
          '<span style="font-family:\'JetBrains Mono\',monospace;font-weight:800;font-size:16px;color:#00F0FF;">' +
          pts +
          "</span>"
        );
      };
      base.series = [
        {
          symbol: "circle",
          symbolSize: 15,
          showSymbol: true,
          showAllSymbol: true,
          emphasis: safeMergeLeaf({ scale: 1.35 }),
        },
      ];
    } else {
      base.tooltip.formatter = function (params) {
        var items = Array.isArray(params) ? params : [params];
        if (!items.length) return "";
        var header = items[0].axisValue ? formatChartDate(items[0].axisValue) : "";
        var lines = header
          ? ['<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#94A3B8;margin-bottom:4px;">' + header + "</div>"]
          : [];
        items.forEach(function (it) {
          var raw = Array.isArray(it.value) ? it.value[1] : it.value;
          var pts = Math.round(Number(raw || 0));
          lines.push(
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:13px;">' +
            "<span>" + (it.marker || "") + " " + String(it.seriesName || "") + "</span>" +
            '<strong style="font-family:\'JetBrains Mono\',monospace;color:#00F0FF;">' + pts + "</strong>" +
            "</div>"
          );
        });
        return lines.join("");
      };
    }

    return base;
  }

  ["scoreboardChartOptions", "userScoreGraphChartOptions", "teamScoreGraphChartOptions"].forEach(function (prop) {
    var isProf = prop !== "scoreboardChartOptions";
    try {
      Object.defineProperty(window, prop, {
        configurable: true,
        enumerable: true,
        get: function () {
          return makeCyberChartTheme(isProf);
        },
      });
    } catch (_) {
      window[prop] = makeCyberChartTheme(isProf);
    }
  });

  // Botón Download diferenciado sobre #score-graph / #cyber-score-graph (descarga sot_<USERNAME>.png en perfiles)
  function initChartDownloadButton() {
    var graph = document.getElementById("score-graph");
    if (!graph) return;
    var card = graph.closest(".theme-card") || graph.parentElement;
    if (!card || card.querySelector(".cyber-chart-dl-btn")) return;
    card.classList.add("cyber-chart-card");

    var path = getNormPath();
    var isProfile =
      path === "/user" ||
      path === "/profile" ||
      path.indexOf("/users/") === 0 ||
      path === "/team" ||
      path.indexOf("/teams/") === 0;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cyber-chart-dl-btn";
    btn.setAttribute("aria-label", "Download chart as image");
    btn.innerHTML = '<i class="fas fa-download"></i><span>Download</span>';

    btn.addEventListener("click", function () {
      var canvas = card.querySelector("#cyber-score-graph canvas") || graph.querySelector("canvas");
      if (!canvas) return;
      var out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      var ctx = out.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#080E22";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
      }
      var filename = "scoreboard.png";
      if (isProfile) {
        var rawName =
          (window.USER && window.USER.name) ||
          (window.TEAM && window.TEAM.name) ||
          ((document.querySelector("main h1") && document.querySelector("main h1").textContent) || "").trim() ||
          "profile";
        var safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "profile";
        filename = "sot_" + safeName + ".png";
      }
      var link = document.createElement("a");
      link.download = filename;
      link.href = out.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      link.remove();
    });

    card.appendChild(btn);
  }

  // 3. Limpiar el viejo bloque inline de Theme Header y activar 3D en toda la portada (/)
  function cleanupLegacyThemeHeader() {
    var legacyStyle = document.getElementById("gdg-custom-theme");
    if (legacyStyle) {
      legacyStyle.disabled = true;
    }

    // Potenciar automáticamente .gdg-hero y todas las .feature-card en la portada con tilt 3D + glare
    document.querySelectorAll("main .gdg-hero, main .feature-card").forEach(function (card) {
      if (!card.classList.contains("tilt-card")) {
        card.classList.add("tilt-card");
        var isHero = card.classList.contains("gdg-hero");
        card.setAttribute("data-tilt-max", isHero ? "0.7" : card.offsetWidth > 500 ? "1.0" : "1.8");
      }
      if (!card.querySelector(":scope > .tilt-glare")) {
        var glare = document.createElement("div");
        glare.className = "tilt-glare";
        glare.setAttribute("aria-hidden", "true");
        card.insertBefore(glare, card.firstChild);
      }
    });

    // Ocultar el aviso obsoleto del selector claro/oscuro y el mini-footer duplicado si siguen en la BD de /
    var mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.querySelectorAll("p, div").forEach(function (el) {
        if (el.children.length > 3) return;
        var txt = (el.textContent || "").trim();
        if (
          txt.indexOf("Modo Claro") !== -1 &&
          txt.indexOf("barra de navegación") !== -1
        ) {
          el.classList.add("gdg-legacy-hidden");
        }
        if (
          el.tagName === "DIV" &&
          txt.indexOf("Diseñado con") !== -1 &&
          txt.indexOf("GDG on Campus Universidad de Huelva") !== -1
        ) {
          el.classList.add("gdg-legacy-hidden");
        }
      });
    }
  }

  // 4. Motor 3D Perspective Tilt + Specular Glare (inmune al scroll y pausa en inputs)
  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function bindTiltCard(card) {
    if (prefersReducedMotion || !card || card.dataset.tiltBound === "1") return;
    card.dataset.tiltBound = "1";

    var maxTilt = Math.min(Number(card.getAttribute("data-tilt-max") || "2.2"), 2.5);
    var rafId = null;

    function resetTilt() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      card.classList.remove("is-tilting");
      card.style.transform = "";
    }

    card.addEventListener("pointermove", function (e) {
      if (window.innerWidth < 768 || e.pointerType === "touch") return;
      if (document.body.classList.contains("modal-open") || document.querySelector(".modal.show")) {
        resetTilt();
        return;
      }
      var activeEl = document.activeElement;
      if (
        activeEl &&
        card.contains(activeEl) &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")
      ) {
        resetTilt();
        return;
      }

      var clientX = e.clientX;
      var clientY = e.clientY;
      if (rafId !== null) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(function () {
        rafId = null;
        var rect = card.getBoundingClientRect();
        var w = card.offsetWidth || rect.width;
        var h = card.offsetHeight || rect.height;
        if (!w || !h) return;

        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var pctX = Math.max(0, Math.min(1, (clientX - cx) / w + 0.5));
        var pctY = Math.max(0, Math.min(1, (clientY - cy) / h + 0.5));
        var rotateY = (pctX - 0.5) * maxTilt * 2;
        var rotateX = (0.5 - pctY) * maxTilt * 2;

        card.classList.add("is-tilting");
        card.style.transform =
          "perspective(1200px) rotateX(" +
          rotateX.toFixed(2) +
          "deg) rotateY(" +
          rotateY.toFixed(2) +
          "deg) scale3d(1.008, 1.008, 1)";
        card.style.setProperty("--glare-x", (pctX * 100).toFixed(1) + "%");
        card.style.setProperty("--glare-y", (pctY * 100).toFixed(1) + "%");
      });
    });

    card.addEventListener("focusin", function (e) {
      if (
        e.target &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")
      ) {
        resetTilt();
      }
    });

    card.addEventListener("pointerleave", resetTilt);
    card.addEventListener("pointercancel", resetTilt);
  }

  // Limpiar cualquier transform 3D al abrir un modal de Bootstrap (evita atrapar modales fixed)
  document.addEventListener("show.bs.modal", function () {
    document.querySelectorAll(".tilt-card").forEach(function (card) {
      card.classList.remove("is-tilting");
      card.style.transform = "";
    });
  });

  function scanTiltCards(root) {
    if (prefersReducedMotion) return;
    var scope = root || document;
    if (scope.matches && scope.matches(".tilt-card")) {
      bindTiltCard(scope);
    }
    if (scope.parentElement && scope.parentElement.matches && scope.parentElement.matches(".tilt-card")) {
      bindTiltCard(scope.parentElement);
    }
    var cards = scope.querySelectorAll ? scope.querySelectorAll(".tilt-card") : [];
    cards.forEach(bindTiltCard);
  }

  window.gdgocScanTiltCards = scanTiltCards;

  // 5. Marcar el enlace activo en el navbar (incluyendo nav-link y botones pill de Profile/Settings/Login)
  function highlightActiveNav() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var rootPath =
      (window.init && window.init.urlRoot ? window.init.urlRoot : "").replace(/\/+$/, "") || "/";

    document.querySelectorAll(".theme-header a.nav-link[href], .theme-header a.theme-pill-btn[href]").forEach(function (link) {
      link.classList.remove("active");
      try {
        var url = new URL(link.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        var linkPath = url.pathname.replace(/\/+$/, "") || "/";
        if (linkPath === path) {
          link.classList.add("active");
        } else if (linkPath !== "/" && linkPath !== rootPath && path.startsWith(linkPath + "/")) {
          link.classList.add("active");
        }
      } catch (_) {}
    });
  }

  // Helper para normalizar ruta quitando urlRoot (funciona tanto en live CTFd como en GitHub Pages)
  function getNormPath() {
    var root = ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
    var p = window.location.pathname;
    if (root && p.indexOf(root) === 0) p = p.slice(root.length) || "/";
    return p.replace(/\/+$/, "") || "/";
  }

  // 6. Selector de expiración personalizado Cyber: campo de texto DD/MM/YYYY + selección explícita Never + feedback inline en Settings
  function showInlineFormStatus(container, type, msg) {
    if (!container) return;
    container.querySelectorAll(".cyber-inline-feedback").forEach(function (n) {
      n.remove();
    });
    if (!msg) return;
    var alert = document.createElement("div");
    alert.className = "alert alert-" + (type === "error" ? "danger" : "success") + " alert-dismissible cyber-inline-feedback";
    alert.setAttribute("role", "alert");
    alert.innerHTML =
      "<strong>" + (type === "error" ? "Error!" : "Success!") + "</strong> " +
      "<span></span>" +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
    alert.querySelector("span").textContent = msg;
    container.appendChild(alert);
    if (container._hideTimer) clearTimeout(container._hideTimer);
    container._hideTimer = setTimeout(function () {
      if (alert.parentNode === container) alert.remove();
    }, 4500);
  }

  function initCyberDatePickers(root) {
    var scope = root || document;
    var pickers = scope.querySelectorAll ? scope.querySelectorAll("[data-cyber-date-picker]") : [];
    pickers.forEach(function (picker) {
      if (picker.dataset.pickerBound === "1") return;
      picker.dataset.pickerBound = "1";

      var hidden = picker.querySelector('input[type="hidden"][name="expiration"]');
      var textInput = picker.querySelector(".cyber-date-text");
      var neverBtn = picker.querySelector('.cyber-date-never-btn, [data-days="0"]');
      if (!hidden || !textInput) return;

      var neverActive = false;

      function pad2(n) {
        return String(n).padStart(2, "0");
      }

      function applyNever(enabled) {
        neverActive = Boolean(enabled);
        if (neverBtn) neverBtn.classList.toggle("active", neverActive);
        textInput.placeholder = "DD/MM/YYYY";
        if (neverActive) {
          hidden.value = "";
          textInput.value = "";
          textInput.disabled = true;
          textInput.classList.remove("is-invalid");
          textInput.dataset.invalidDate = "0";
        } else {
          textInput.disabled = false;
        }
      }

      function validateStrict(raw) {
        var s = (raw || "").trim();
        if (!s) {
          hidden.value = "";
          textInput.classList.remove("is-invalid");
          textInput.dataset.invalidDate = neverActive ? "0" : "1";
          return false;
        }
        // Validación estricta: exactamente DD/MM/YYYY (2 dígitos / 2 dígitos / 4 dígitos)
        var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          var d = parseInt(m[1], 10);
          var mo = parseInt(m[2], 10);
          var y = parseInt(m[3], 10);
          var minYear = new Date().getFullYear();
          var dt = new Date(y, mo - 1, d);
          var today = new Date();
          today.setHours(0, 0, 0, 0);
          var valid =
            y >= minYear &&
            y <= 2100 &&
            mo >= 1 &&
            mo <= 12 &&
            d >= 1 &&
            d <= 31 &&
            dt.getFullYear() === y &&
            dt.getMonth() === mo - 1 &&
            dt.getDate() === d &&
            dt.getTime() >= today.getTime();
          if (valid) {
            hidden.value = y + "-" + pad2(mo) + "-" + pad2(d);
            textInput.classList.remove("is-invalid");
            textInput.dataset.invalidDate = "0";
            return true;
          }
        }
        hidden.value = "";
        textInput.classList.add("is-invalid");
        textInput.dataset.invalidDate = "1";
        return false;
      }

      if (neverBtn) {
        neverBtn.addEventListener("click", function () {
          applyNever(!neverActive);
          if (!neverActive) textInput.focus();
        });
      }

      textInput.addEventListener("input", function (e) {
        if (neverActive) return;
        // Solo permitir dígitos y "/", máximo 8 dígitos (DD/MM/YYYY — imposible letras o años de >4 cifras)
        var cleaned = textInput.value.replace(/[^\d/]/g, "");
        if (e.inputType !== "deleteContentBackward") {
          var digits = cleaned.replace(/\D/g, "").slice(0, 8);
          if (digits.length > 4) {
            cleaned = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
          } else if (digits.length > 2) {
            cleaned = digits.slice(0, 2) + "/" + digits.slice(2);
          } else {
            cleaned = digits;
          }
        } else {
          cleaned = cleaned.slice(0, 10);
        }
        if (textInput.value !== cleaned) textInput.value = cleaned;
        validateStrict(textInput.value);
      });

      var form = picker.closest("form");
      if (form && !form.dataset.cyberTokenHooked) {
        form.dataset.cyberTokenHooked = "1";
        form.addEventListener(
          "submit",
          function (e) {
            var statusBox = form.querySelector(".cyber-form-status");
            if (!neverActive && !validateStrict(textInput.value)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              showInlineFormStatus(
                statusBox,
                "error",
                "Invalid date. Use exact DD/MM/YYYY format or activate Never."
              );
              textInput.focus();
            }
          },
          true
        );
      }

      // Empezar con la barra habilitada (placeholder DD/MM/YYYY) y Never desactivado hasta pulsarlo
      applyNever(false);
    });
  }

  // Feedback rojo/verde inline en Settings: Passwords (validación vacía) + Access Tokens (POST /api/v1/tokens)
  function initSettingsInlineFeedback() {
    if (getNormPath() !== "/settings") return;

    var pwForm = document.querySelector('#passwords form[x-data="SettingsForm"]');
    if (pwForm && !pwForm.dataset.cyberPwGuard) {
      pwForm.dataset.cyberPwGuard = "1";
      pwForm.addEventListener(
        "submit",
        function (e) {
          var newPw = pwForm.querySelector('#password, input[name="password"]');
          var curPw = pwForm.querySelector('#confirm, input[name="confirm"]');
          var statusBox = pwForm.querySelector(".cyber-form-status");
          if (newPw && !newPw.value.trim()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            showInlineFormStatus(
              statusBox,
              "error",
              curPw && !curPw.value.trim()
                ? "Please enter your current and new password."
                : "Please enter a new password."
            );
            newPw.focus();
            return;
          }
          if (statusBox) {
            statusBox.querySelectorAll(".cyber-inline-feedback").forEach(function (n) {
              n.remove();
            });
          }
        },
        true
      );
    }

    if (window.__cyberTokenFetchPatched || typeof window.fetch !== "function") return;
    window.__cyberTokenFetchPatched = true;
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || "GET").toUpperCase();
      var promise = origFetch(input, init);
      if (method === "POST" && /\/api\/v1\/tokens(?:\?|$)/.test(url)) {
        promise
          .then(function (resp) {
            var tokForm = document.querySelector('#tokens form[x-data="TokensForm"]');
            var statusBox = tokForm && tokForm.querySelector(".cyber-form-status");
            if (!statusBox) return;
            resp
              .clone()
              .json()
              .then(function (data) {
                if (resp.ok && data && data.success) {
                  showInlineFormStatus(statusBox, "success", "Access token generated successfully.");
                } else {
                  var errMsg = "Could not generate access token.";
                  if (data && data.errors) {
                    var vals = Object.values(data.errors).flat ? Object.values(data.errors).flat() : Object.values(data.errors);
                    if (vals.length) errMsg = String(vals[0]);
                  }
                  showInlineFormStatus(statusBox, "error", errMsg);
                }
              })
              .catch(function () {
                if (!resp.ok) showInlineFormStatus(statusBox, "error", "Could not generate access token.");
              });
          })
          .catch(function () {
            var tokForm = document.querySelector('#tokens form[x-data="TokensForm"]');
            var statusBox = tokForm && tokForm.querySelector(".cyber-form-status");
            showInlineFormStatus(statusBox, "error", "Network error while generating token.");
          });
      }
      return promise;
    };
  }

  // 7. Scoreboard: pestañas All-Time (por solves), This Year (por semanas) y Last 30 days (por días)
  //    - Gráfica: Top 10 con 10 colores bien diferenciados y puntos más grandes
  //    - Tabla: TODOS los perfiles registrados con 6 columnas operativas y protección para nombres largos
  function initScoreboardTimeframes() {
    if (getNormPath() !== "/scoreboard") return;
    var sbRoot = document.getElementById("scoreboard");
    if (!sbRoot || sbRoot.dataset.cyberPeriodsInit === "1") return;
    sbRoot.dataset.cyberPeriodsInit = "1";

    var nowDate = new Date();
    var year = nowDate.getFullYear();
    var bar = document.createElement("div");
    bar.className = "cyber-period-tabs col-md-12";
    bar.innerHTML =
      '<button type="button" class="cyber-period-btn active" data-period="all"><i class="fas fa-infinity"></i><span>All-Time</span></button>' +
      '<button type="button" class="cyber-period-btn" data-period="year"><i class="fas fa-calendar-alt"></i><span>This Year</span></button>' +
      '<button type="button" class="cyber-period-btn" data-period="month"><i class="fas fa-clock"></i><span>Last 30 days</span></button>';

    sbRoot.insertBefore(bar, sbRoot.firstChild);

    var enhancedPanel = document.createElement("div");
    enhancedPanel.className = "col-md-12";
    enhancedPanel.id = "cyber-scoreboard-enhanced";
    sbRoot.appendChild(enhancedPanel);

    var root = ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
    var hdrs = { Accept: "application/json", "Content-Type": "application/json" };
    var activePeriod = "all"; // Nunca se guarda entre visitas
    var activeBracket = null;
    var dataLoaded = false;
    var standingsList = [];
    var allUsersList = [];
    var topMap = {};
    var userMetricsById = {};
    var chalMaxById = {};
    var chartEmbedFn = null;

    function fetchJson(u) {
      return fetch(u, { headers: hdrs })
        .then(function (r) {
          var ct = (r.headers && r.headers.get("content-type")) || "";
          return r.ok && ct.indexOf("application/json") !== -1 ? r.json() : null;
        })
        .catch(function () { return null; });
    }

    function fetchAllRegisteredProfiles() {
      var endpoint = (window.init && window.init.userMode === "teams") ? "/api/v1/teams" : "/api/v1/users";
      var collected = [];
      function loadPage(page) {
        return fetchJson(root + endpoint + "?per_page=500&page=" + page).then(function (res) {
          if (!res || !Array.isArray(res.data)) return collected;
          collected = collected.concat(res.data);
          var next = res.meta && res.meta.pagination && res.meta.pagination.next;
          if (next && page < 10) return loadPage(next);
          return collected;
        });
      }
      return loadPage(1);
    }

    function loadCtfdEmbed() {
      if (chartEmbedFn) return Promise.resolve(chartEmbedFn);
      var candidates = [];
      var seen = {};
      function addCandidate(u) {
        if (!u || seen[u]) return;
        seen[u] = true;
        candidates.push(u);
      }

      // 1. Buscar en <script type="module"> y <link rel="modulepreload">
      document.querySelectorAll('script[type="module"][src], link[rel="modulepreload"][href]').forEach(function (el) {
        var u = el.getAttribute("src") || el.getAttribute("href") || "";
        if (/assets\/index\.[a-f0-9]+\.js/i.test(u)) addCandidate(u);
      });

      function tryImportList(urls) {
        if (!urls.length) return Promise.resolve(null);
        return Promise.all(
          urls.map(function (src) {
            return import(src).catch(function () { return null; });
          })
        ).then(function (mods) {
          for (var i = 0; i < mods.length; i++) {
            if (mods[i] && typeof mods[i].e === "function" && typeof mods[i].c === "function") {
              chartEmbedFn = mods[i].e;
              return chartEmbedFn;
            }
          }
          return null;
        });
      }

      return tryImportList(candidates).then(function (found) {
        if (found) return found;
        // 2. Fallback: consultar manifest.json de CTFd (`core` o preview estática) para resolver _index.*.js
        var manifestBases = [root + "/themes/core/static", root + "/static"];
        return Promise.all(
          manifestBases.map(function (base) {
            return fetchJson(base + "/manifest.json").then(function (man) {
              if (!man || typeof man !== "object") return [];
              var urls = [];
              Object.keys(man).forEach(function (k) {
                if (/^_?index\.[a-f0-9]+\.js$/i.test(k) && man[k] && man[k].file) {
                  urls.push(base + "/" + man[k].file.replace(/^\/+/, ""));
                }
              });
              return urls;
            });
          })
        ).then(function (lists) {
          var flat = [];
          lists.forEach(function (arr) {
            arr.forEach(function (u) {
              if (!seen[u]) {
                seen[u] = true;
                flat.push(u);
              }
            });
          });
          return tryImportList(flat);
        });
      });
    }

    function getNativeCols() {
      return Array.prototype.slice.call(sbRoot.children).filter(function (el) {
        return el !== bar && el !== enhancedPanel && !el.querySelector(".nav-pills");
      });
    }

    function fmtPctCell(pct, kind) {
      if (pct === null || pct === undefined || isNaN(pct)) {
        return '<span class="theme-text-secondary opacity-50">—</span>';
      }
      var clean = Number(pct.toFixed(1));
      var cls = clean < 50 ? "cyber-sb-pct--low" : kind === "acc" ? "cyber-sb-pct--acc" : "cyber-sb-pct--eff";
      return '<span class="cyber-sb-pct ' + cls + '">' + clean + "%</span>";
    }

    function getDayKey(d) {
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    }

    function getWeekOfYear(d) {
      var start = new Date(d.getFullYear(), 0, 1);
      var diffDays = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      return Math.max(1, Math.floor(diffDays / 7) + 1);
    }

    function buildRowsForPeriod(period) {
      var now = new Date();
      var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var cutoff30 = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000).getTime();
      var cutoffYear = new Date(year, 0, 1).getTime();
      var cutoff = period === "month" ? cutoff30 : period === "year" ? cutoffYear : 0;

      var isTeams = window.init && window.init.userMode === "teams";
      var urlBase = root + (isTeams ? "/teams/" : "/users/");
      var byId = {};

      // 1. Sembrar TODOS los perfiles registrados (incluso con 0 puntos)
      allUsersList.forEach(function (u) {
        var id = String(u.id || "");
        if (!id || u.hidden || u.banned) return;
        byId[id] = {
          id: id,
          regOrder: Number(u.id || 0),
          name: u.name,
          account_url: urlBase + id,
          bracket_id: u.bracket_id || null,
          bracket_name: u.bracket_name || null,
          allScore: 0,
          solves: [],
        };
      });

      // 2. Superponer standings oficiales
      standingsList.forEach(function (st) {
        var id = String(st.account_id || st.id || "");
        if (!id) return;
        if (!byId[id]) {
          byId[id] = {
            id: id,
            regOrder: Number(id) || 999999,
            name: st.name,
            account_url: st.account_url || (urlBase + id),
            bracket_id: st.bracket_id || null,
            bracket_name: st.bracket_name || null,
            allScore: Number(st.score || 0),
            solves: [],
          };
        } else {
          byId[id].allScore = Number(st.score || 0);
          if (st.account_url) byId[id].account_url = st.account_url;
          if (st.bracket_name) byId[id].bracket_name = st.bracket_name;
        }
      });

      // 3. Superponer solves detallados de top/100
      Object.keys(topMap).forEach(function (k) {
        var entry = topMap[k];
        if (!entry) return;
        var id = String(entry.id || k);
        if (!byId[id]) {
          byId[id] = {
            id: id,
            regOrder: Number(id) || 999999,
            name: entry.name,
            account_url: entry.account_url || (urlBase + id),
            bracket_id: entry.bracket_id || null,
            bracket_name: entry.bracket_name || null,
            allScore: Number(entry.score || 0),
            solves: [],
          };
        }
        if (Array.isArray(entry.solves)) {
          byId[id].solves = entry.solves.slice().sort(function (a, b) {
            return (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0);
          });
        }
      });

      var rows = [];
      Object.keys(byId).forEach(function (id) {
        var u = byId[id];
        if (activeBracket && String(u.bracket_id) !== String(activeBracket)) return;

        var uMet = userMetricsById[id] || { failCount: 0, fails: [], posAwards: 0, negAwards: 0 };
        var filtSolves =
          period === "all"
            ? u.solves
            : u.solves.filter(function (sv) {
                var ts = Date.parse(sv.date);
                return !isNaN(ts) && ts >= cutoff;
              });

        var solveCount = filtSolves.length;
        var score = 0;
        var lastSolveMs = 0;
        if (period === "all") {
          score = u.allScore;
          filtSolves.forEach(function (sv) {
            var ts = Date.parse(sv.date);
            if (!isNaN(ts) && ts > lastSolveMs) lastSolveMs = ts;
          });
        } else {
          filtSolves.forEach(function (sv) {
            score += Number(sv.value || 0);
            var ts = Date.parse(sv.date);
            if (!isNaN(ts) && ts > lastSolveMs) lastSolveMs = ts;
          });
        }

        var failCount = uMet.failCount;
        var filtFails = uMet.fails || [];
        if (period !== "all" && filtFails.length) {
          filtFails = filtFails.filter(function (fl) {
            var ts = Date.parse(fl.date);
            return !isNaN(ts) && ts >= cutoff;
          });
          failCount = filtFails.length;
        } else if (period !== "all" && solveCount === 0) {
          failCount = 0;
        }

        var totalAttempts = solveCount + failCount;
        var accuracy = totalAttempts > 0 ? (solveCount / totalAttempts) * 100 : null;

        var chalIds = {};
        var solveSum = 0;
        filtSolves.forEach(function (sv) {
          var cid = String(sv.challenge_id || "");
          if (cid) chalIds[cid] = Math.max(chalIds[cid] || 0, Number(sv.value || 0));
          solveSum += Number(sv.value || 0);
        });
        filtFails.forEach(function (fl) {
          var cid = String(fl.challenge_id || "");
          if (cid && !(cid in chalIds)) chalIds[cid] = 0;
        });

        var potential = 0;
        Object.keys(chalIds).forEach(function (cid) {
          potential += Math.max(chalMaxById[cid] || 0, chalIds[cid] || 0);
        });
        var earned = period === "all" ? Math.max(0, score - uMet.posAwards) : Math.max(0, solveSum);
        if (potential > 0) potential = Math.max(potential, earned);
        var efficiency = potential > 0 ? Math.min(100, (earned / potential) * 100) : null;

        // Solo participan usuarios con al menos 1 solve (si tienen 1 solve y 0 puntos SÍ participan; con 0 solves NO)
        if (solveCount < 1) return;

        rows.push({
          id: id,
          regOrder: u.regOrder,
          name: u.name,
          account_url: u.account_url,
          bracket_name: u.bracket_name,
          score: Math.round(score),
          solves: solveCount,
          solveList: filtSolves,
          accuracy: accuracy,
          efficiency: efficiency,
          lastSolveMs: lastSolveMs,
        });
      });

      rows.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.solves !== a.solves) return b.solves - a.solves;
        if (a.lastSolveMs !== b.lastSolveMs) return a.lastSolveMs - b.lastSolveMs;
        return a.regOrder - b.regOrder;
      });
      return rows;
    }

    function renderScoreboardChart(rows) {
      var origGraph = document.getElementById("score-graph");
      if (!origGraph) return;
      var card = origGraph.closest(".theme-card") || origGraph.parentElement;
      if (!card) return;

      var top10 = rows
        .filter(function (r) {
          return r.solveList.length > 0;
        })
        .slice(0, 10);

      var customHost = document.getElementById("cyber-score-graph");
      if (!customHost) {
        customHost = document.createElement("div");
        customHost.id = "cyber-score-graph";
        customHost.style.cssText = "width:100%;display:none;";
        origGraph.parentNode.insertBefore(customHost, origGraph.nextSibling);
      }

      if (!top10.length) {
        origGraph.style.display = "none";
        customHost.style.display = "block";
        customHost.innerHTML =
          '<div class="cyber-empty-state py-5">' +
          '  <span class="cyber-empty-signal"><span class="cyber-empty-dot"></span><span>Top 10</span></span>' +
          '  <h4 class="h6 theme-text-secondary mb-0">No activity recorded in this timeframe</h4>' +
          "</div>";
        return;
      }

      loadCtfdEmbed().then(function (embed) {
        if (!embed) return;
        origGraph.style.display = "none";
        customHost.style.display = "block";

        var xLabels = [];
        var series = [];
        var chartTitle = "Top 10 · All-Time";
        var xAxisName = "Solves";

        if (activePeriod === "all") {
          chartTitle = "Top 10 · All-Time";
          xAxisName = "Solves";
          var maxSolves = 0;
          top10.forEach(function (u) {
            if (u.solveList.length > maxSolves) maxSolves = u.solveList.length;
          });
          xLabels = ["0"];
          for (var sIdx = 1; sIdx <= maxSolves; sIdx++) xLabels.push(String(sIdx));
          top10.forEach(function (u, idx) {
            var color = TOP10_SERIES_COLORS[idx % TOP10_SERIES_COLORS.length];
            var cum = 0;
            var pts = [0];
            u.solveList.forEach(function (sv) {
              cum += Number(sv.value || 0);
              pts.push(Math.round(cum));
            });
            series.push({
              name: u.name,
              type: "line",
              smooth: false,
              symbol: "circle",
              symbolSize: 13,
              showSymbol: true,
              showAllSymbol: true,
              itemStyle: { color: color, borderColor: "#060A18", borderWidth: 2 },
              lineStyle: { color: color, width: 3 },
              emphasis: { scale: 1.35 },
              data: pts,
            });
          });
        } else if (activePeriod === "year") {
          chartTitle = "Top 10 · This Year";
          xAxisName = "Weeks";
          var curWeek = getWeekOfYear(new Date());
          for (var w = 1; w <= curWeek; w++) xLabels.push("W" + w);
          top10.forEach(function (u, idx) {
            var color = TOP10_SERIES_COLORS[idx % TOP10_SERIES_COLORS.length];
            var weekDelta = {};
            u.solveList.forEach(function (sv) {
              var d = new Date(sv.date);
              if (!isNaN(d.getTime()) && d.getFullYear() === year) {
                var wk = getWeekOfYear(d);
                weekDelta[wk] = (weekDelta[wk] || 0) + Number(sv.value || 0);
              }
            });
            var cum = 0;
            var pts = [];
            for (var wk2 = 1; wk2 <= curWeek; wk2++) {
              cum += weekDelta[wk2] || 0;
              pts.push(Math.round(cum));
            }
            series.push({
              name: u.name,
              type: "line",
              smooth: false,
              symbol: "circle",
              symbolSize: 12,
              showSymbol: true,
              itemStyle: { color: color, borderColor: "#060A18", borderWidth: 2 },
              lineStyle: { color: color, width: 3 },
              emphasis: { scale: 1.35 },
              data: pts,
            });
          });
        } else {
          chartTitle = "Top 10 · Last 30 days";
          xAxisName = "Days";
          var now = new Date();
          var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          var dayKeys = [];
          for (var offset = 29; offset >= 0; offset--) {
            var day = new Date(todayStart.getTime() - offset * 24 * 60 * 60 * 1000);
            dayKeys.push(getDayKey(day));
            xLabels.push(String(day.getDate()).padStart(2, "0") + " " + CHART_MONTHS[day.getMonth()]);
          }
          top10.forEach(function (u, idx) {
            var color = TOP10_SERIES_COLORS[idx % TOP10_SERIES_COLORS.length];
            var dayDelta = {};
            u.solveList.forEach(function (sv) {
              var d = new Date(sv.date);
              if (!isNaN(d.getTime())) {
                var k = getDayKey(d);
                dayDelta[k] = (dayDelta[k] || 0) + Number(sv.value || 0);
              }
            });
            var cum = 0;
            var pts = dayKeys.map(function (k) {
              cum += dayDelta[k] || 0;
              return Math.round(cum);
            });
            series.push({
              name: u.name,
              type: "line",
              smooth: false,
              symbol: "circle",
              symbolSize: 12,
              showSymbol: true,
              itemStyle: { color: color, borderColor: "#060A18", borderWidth: 2 },
              lineStyle: { color: color, width: 3 },
              emphasis: { scale: 1.35 },
              data: pts,
            });
          });
        }

        var opt = {
          backgroundColor: "transparent",
          color: TOP10_SERIES_COLORS.slice(),
          title: {
            left: "center",
            top: 6,
            text: chartTitle,
            textStyle: {
              color: "#F0F9FF",
              fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: 21,
            },
          },
          tooltip: {
            trigger: "axis",
            confine: true,
            backgroundColor: "rgba(6, 10, 24, 0.96)",
            borderColor: "#00F0FF",
            borderWidth: 1,
            padding: [10, 14],
            textStyle: {
              color: "#E2F1FF",
              fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
            },
            axisPointer: {
              type: "line",
              snap: true,
              label: { show: false },
              lineStyle: { color: "rgba(0, 240, 255, 0.5)", width: 1.5, type: "dashed" },
            },
            formatter: function (params) {
              var items = Array.isArray(params) ? params : [params];
              if (!items.length) return "";
              var lbl = items[0].axisValueLabel || items[0].name || "";
              var prefix = activePeriod === "all" ? "Solve #" : "";
              var lines = [
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#94A3B8;margin-bottom:5px;">' +
                prefix + lbl + "</div>",
              ];
              items
                .slice()
                .sort(function (a, b) { return Number(b.value || 0) - Number(a.value || 0); })
                .forEach(function (it) {
                  lines.push(
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:13px;">' +
                    "<span>" + (it.marker || "") + " " + String(it.seriesName || "") + "</span>" +
                    '<strong style="font-family:\'JetBrains Mono\',monospace;color:#00F0FF;">' + Math.round(Number(it.value || 0)) + "</strong>" +
                    "</div>"
                  );
                });
              return lines.join("");
            },
          },
          legend: {
            show: true,
            type: "scroll",
            orient: "horizontal",
            bottom: 8,
            icon: "circle",
            itemWidth: 12,
            itemHeight: 12,
            textStyle: {
              color: "#E2F1FF",
              fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
            },
            pageTextStyle: { color: "#94A3B8" },
            pageIconColor: "#00F0FF",
            pageIconInactiveColor: "#475569",
            data: top10.map(function (u) { return u.name; }),
          },
          toolbox: { show: false },
          grid: { top: 66, bottom: 72, left: 20, right: 28, containLabel: true },
          xAxis: [
            {
              type: "category",
              name: xAxisName,
              nameLocation: "middle",
              nameGap: 32,
              nameTextStyle: { color: "#64748B", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
              boundaryGap: false,
              data: xLabels,
              axisLabel: {
                color: "#94A3B8",
                margin: 14,
                fontSize: 11,
                fontFamily: "'Google Sans Mono', 'JetBrains Mono', monospace",
              },
              axisPointer: { label: { show: false } },
            },
          ],
          yAxis: [
            {
              type: "value",
              minInterval: 1,
              axisLabel: {
                color: "#94A3B8",
                margin: 12,
                fontFamily: "'Google Sans Mono', 'JetBrains Mono', monospace",
                formatter: formatIntAxis,
              },
              splitLine: { lineStyle: { color: "rgba(0, 240, 255, 0.14)" } },
              axisPointer: { show: false, label: { show: false } },
            },
          ],
          dataZoom: [{ show: false }],
          series: series,
        };

        // Montar sobre un nodo limpio para que cada cambio de pestaña re-renderice sin artefactos
        customHost.innerHTML = "";
        var inner = document.createElement("div");
        inner.style.cssText = "width:100%;height:410px;";
        customHost.appendChild(inner);
        embed(inner, opt);
      });
    }

    function paintTable() {
      bar.querySelectorAll(".cyber-period-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-period") === activePeriod);
      });

      getNativeCols().forEach(function (el) {
        el.classList.add("gdg-filter-hidden");
      });

      if (!dataLoaded) {
        enhancedPanel.innerHTML =
          '<div class="theme-card p-5 text-center"><i class="fas fa-circle-notch fa-spin fa-2x spinner"></i></div>';
        return;
      }

      var rows = buildRowsForPeriod(activePeriod);
      renderScoreboardChart(rows);

      if (!rows.length) {
        enhancedPanel.innerHTML =
          '<div class="theme-card cyber-empty-state">' +
          '  <span class="cyber-empty-signal"><span class="cyber-empty-dot"></span><span>0 entries</span></span>' +
          '  <h3 class="h5 theme-text-primary fw-bold mb-0">No profiles registered yet</h3>' +
          "</div>";
        return;
      }

      var modeWord = (window.init && window.init.userMode === "teams") ? "Team" : "User";
      var html =
        '<div class="cyber-table-wrap"><table class="table table-striped align-middle">' +
        "<thead><tr>" +
        '<th class="text-center" style="width:86px">Place</th>' +
        '<th class="text-center" style="width:110px">Points</th>' +
        '<th class="text-start ps-3">' + modeWord + "</th>" +
        '<th class="text-center">Solves</th>' +
        '<th class="text-center">Submission accuracy</th>' +
        '<th class="text-center">Points efficiency</th>' +
        "</tr></thead><tbody>";

      rows.forEach(function (r, idx) {
        var rCls =
          idx === 0
            ? "rank-badge--1"
            : idx === 1
            ? "rank-badge--2"
            : idx === 2
            ? "rank-badge--3"
            : "rank-badge--other";
        var bracketHtml = r.bracket_name ? ' <span class="badge bg-secondary ms-2"></span>' : "";
        html +=
          "<tr>" +
          '<th scope="row" class="text-center"><span class="rank-badge ' + rCls + '">#' + (idx + 1) + "</span></th>" +
          '<td class="text-center font-mono fw-bold" style="color:#00F0FF;">' + r.score + "</td>" +
          '<td class="text-start ps-3 fw-semibold cyber-sb-user-cell"><a class="cyber-sb-user-link" href="' + r.account_url + '"></a>' + bracketHtml + "</td>" +
          '<td class="text-center font-mono fw-bold theme-text-primary">' + r.solves + "</td>" +
          '<td class="text-center">' + fmtPctCell(r.accuracy, "acc") + "</td>" +
          '<td class="text-center">' + fmtPctCell(r.efficiency, "eff") + "</td>" +
          "</tr>";
      });
      html += "</tbody></table></div>";
      enhancedPanel.innerHTML = html;

      var trs = enhancedPanel.querySelectorAll("tbody tr");
      rows.forEach(function (r, idx) {
        var a = trs[idx].querySelector("a");
        if (a) {
          a.textContent = r.name;
          a.setAttribute("title", r.name);
        }
        var br = trs[idx].querySelector(".badge");
        if (br && r.bracket_name) br.textContent = r.bracket_name;
      });
    }

    window.addEventListener("bracket-change", function (ev) {
      activeBracket = ev && ev.detail ? ev.detail : null;
      paintTable();
    });

    bar.querySelectorAll(".cyber-period-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activePeriod = btn.getAttribute("data-period") || "all";
        paintTable();
      });
    });

    paintTable();

    var apiBase = (window.init && window.init.userMode === "teams") ? "/api/v1/teams/" : "/api/v1/users/";
    Promise.all([
      fetchJson(root + "/api/v1/scoreboard"),
      fetchJson(root + "/api/v1/scoreboard/top/100"),
      fetchAllRegisteredProfiles(),
    ]).then(function (res) {
      standingsList = (res[0] && Array.isArray(res[0].data)) ? res[0].data : [];
      topMap = (res[1] && res[1].data) || {};
      allUsersList = Array.isArray(res[2]) ? res[2] : [];

      var accountIds = {};
      var chalIds = {};
      allUsersList.forEach(function (u) {
        if (u && u.id && !u.hidden && !u.banned) accountIds[String(u.id)] = true;
      });
      standingsList.forEach(function (st) {
        var id = String(st.account_id || st.id || "");
        if (id) accountIds[id] = true;
      });
      Object.keys(topMap).forEach(function (k) {
        var entry = topMap[k];
        if (!entry) return;
        var id = String(entry.id || k);
        accountIds[id] = true;
        if (Array.isArray(entry.solves)) {
          entry.solves.forEach(function (sv) {
            if (sv.challenge_id) chalIds[String(sv.challenge_id)] = true;
          });
        }
      });

      var ids = Object.keys(accountIds);
      var userPromises = ids.map(function (id) {
        return Promise.all([
          fetchJson(root + apiBase + id + "/fails"),
          fetchJson(root + apiBase + id + "/awards"),
        ]).then(function (ur) {
          var failsRes = ur[0] || {};
          var failsData = Array.isArray(failsRes.data) ? failsRes.data : [];
          var failCount =
            failsRes.meta && typeof failsRes.meta.count === "number"
              ? failsRes.meta.count
              : failsData.length;
          failsData.forEach(function (fl) {
            if (fl.challenge_id) chalIds[String(fl.challenge_id)] = true;
          });
          var awardsData = (ur[1] && Array.isArray(ur[1].data)) ? ur[1].data : [];
          var posAwards = 0;
          var negAwards = 0;
          awardsData.forEach(function (aw) {
            var v = Number(aw.value || 0);
            if (v > 0) posAwards += v;
            else if (v < 0) negAwards += Math.abs(v);
          });
          userMetricsById[id] = {
            failCount: failCount,
            fails: failsData,
            posAwards: posAwards,
            negAwards: negAwards,
          };
        });
      });

      Promise.all(userPromises)
        .then(function () {
          var cids = Object.keys(chalIds);
          return Promise.all(
            cids.map(function (cid) {
              return fetchJson(root + "/api/v1/challenges/" + cid).then(function (cr) {
                if (cr && cr.data) {
                  chalMaxById[cid] = Number(
                    cr.data.initial != null ? cr.data.initial : cr.data.value || 0
                  );
                }
              });
            })
          );
        })
        .then(function () {
          dataLoaded = true;
          paintTable();
        });
    });
  }

  // 8. Contador live de usuarios registrados ("Registered users") en Landing (/) y /users
  function initRegisteredUsersCounter() {
    var els = document.querySelectorAll("[data-cyber-user-count]");
    if (!els.length) return;
    var root = ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
    fetch(root + "/api/v1/users?per_page=1", {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    })
      .then(function (r) {
        var ct = (r.headers && r.headers.get("content-type")) || "";
        return r.ok && ct.indexOf("application/json") !== -1 ? r.json() : null;
      })
      .then(function (res) {
        var total =
          res && res.meta && res.meta.pagination && typeof res.meta.pagination.total === "number"
            ? res.meta.pagination.total
            : res && Array.isArray(res.data)
            ? res.data.length
            : null;
        if (total !== null) {
          els.forEach(function (el) {
            el.textContent = String(total);
          });
        }
      })
      .catch(function () {});
  }

  // 8b. Búsqueda en vivo y ordenación alfabética por idioma en /users (Country & Affiliation)
  function initUsersTableInteractive() {
    if (getNormPath() !== "/users") return;
    var table = document.querySelector("main table.table");
    if (!table || table.dataset.cyberUsersInteractive === "1") return;
    table.dataset.cyberUsersInteractive = "1";

    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var origRows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
    if (!origRows.length) return;

    // Detectar idioma activo para traducir y ordenar nombres de país correctamente
    var activeLangEl = document.querySelector('form[x-data="LanguageForm"] .dropdown-item.bg-primary[value]');
    var rawLocale =
      (activeLangEl && activeLangEl.getAttribute("value")) ||
      (window.localStorage && localStorage.getItem("language")) ||
      document.documentElement.getAttribute("lang") ||
      "en";
    var locale = String(rawLocale).replace("_", "-");

    var regionDisplay = null;
    try {
      if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
        regionDisplay = new Intl.DisplayNames([locale], { type: "region" });
      }
    } catch (_) {}

    function getLocalizedCountry(td) {
      if (!td) return "";
      var flag = td.querySelector('i[class*="flag-"]');
      if (flag && regionDisplay) {
        var m = flag.className.match(/flag-([a-z]{2})\b/i);
        if (m) {
          try {
            var locName = regionDisplay.of(m[1].toUpperCase());
            if (locName) {
              var tipWrap = td.querySelector(".cyber-flag-tooltip");
              if (tipWrap) {
                tipWrap.setAttribute("data-tooltip", locName);
                tipWrap.setAttribute("aria-label", locName);
              }
              return locName;
            }
          } catch (_) {}
        }
      }
      var tip = td.querySelector("[data-tooltip]");
      var txt = (tip && tip.getAttribute("data-tooltip")) || (td.textContent || "").trim();
      return txt === "—" ? "" : txt;
    }

    var rowMeta = origRows.map(function (tr, idx) {
      var tds = tr.querySelectorAll("td");
      var userTxt = tds[0] ? (tds[0].textContent || "").trim() : "";
      var countryTxt = getLocalizedCountry(tds[1]);
      var affTxt = tds[2] ? (tds[2].textContent || "").trim() : "";
      if (affTxt === "—") affTxt = "";
      return {
        tr: tr,
        origIdx: idx,
        user: userTxt,
        country: countryTxt,
        affiliation: affTxt,
        haystack: (userTxt + " " + countryTxt + " " + affTxt).toLowerCase(),
      };
    });

    // Búsqueda instantánea sin recarga ni validación nativa "Completa este campo"
    var searchForm = document.querySelector('main form[data-cyber-users-search], main form');
    var qInput = searchForm && searchForm.querySelector('input[name="q"], #q');
    if (searchForm && qInput) {
      searchForm.setAttribute("novalidate", "novalidate");
      qInput.removeAttribute("required");
      var runSearch = function () {
        var q = (qInput.value || "").trim().toLowerCase();
        rowMeta.forEach(function (item) {
          item.tr.classList.toggle("gdg-filter-hidden", Boolean(q) && item.haystack.indexOf(q) === -1);
        });
      };
      qInput.addEventListener("input", runSearch);
      searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        runSearch();
      });
    }

    // Ordenación alfabética con píldoras limpias en Country y Affiliation (vuelve al orden de registro al pulsar de nuevo o en Username)
    var ths = table.querySelectorAll("thead th");
    var sortState = null; // null | "country" | "affiliation"
    var countryPill = null;
    var affPill = null;

    function updateSortPills() {
      if (countryPill) countryPill.classList.toggle("is-active", sortState === "country");
      if (affPill) affPill.classList.toggle("is-active", sortState === "affiliation");
    }

    function applySort(field) {
      sortState = sortState === field ? null : field;
      var sorted = rowMeta.slice();
      if (!sortState) {
        sorted.sort(function (a, b) { return a.origIdx - b.origIdx; });
      } else {
        sorted.sort(function (a, b) {
          var va = a[sortState] || "";
          var vb = b[sortState] || "";
          if (!va && !vb) return a.origIdx - b.origIdx;
          if (!va) return 1;
          if (!vb) return -1;
          var cmp = va.localeCompare(vb, locale, { sensitivity: "base" });
          return cmp !== 0 ? cmp : a.origIdx - b.origIdx;
        });
      }
      sorted.forEach(function (item) {
        tbody.appendChild(item.tr);
      });
      updateSortPills();
    }

    if (ths[0]) {
      ths[0].style.cursor = "pointer";
      ths[0].setAttribute("title", "Restore registration order");
      ths[0].addEventListener("click", function () {
        sortState = null;
        rowMeta.slice().sort(function (a, b) { return a.origIdx - b.origIdx; }).forEach(function (it) {
          tbody.appendChild(it.tr);
        });
        updateSortPills();
      });
    }
    if (ths[1]) {
      var cLabel = (ths[1].textContent || "Country").trim();
      ths[1].innerHTML = "";
      countryPill = document.createElement("button");
      countryPill.type = "button";
      countryPill.className = "cyber-sort-pill";
      countryPill.textContent = cLabel;
      countryPill.addEventListener("click", function () { applySort("country"); });
      ths[1].appendChild(countryPill);
    }
    if (ths[2]) {
      var aLabel = (ths[2].textContent || "Affiliation").trim();
      ths[2].innerHTML = "";
      affPill = document.createElement("button");
      affPill.type = "button";
      affPill.className = "cyber-sort-pill";
      affPill.textContent = aLabel;
      affPill.addEventListener("click", function () { applySort("affiliation"); });
      ths[2].appendChild(affPill);
    }
  }

  // 8c. Modal de retos (/challenges): cabecera alineada 100%, Description con "pts", bloques de código limpios,
  //     pestaña Stats (Average Attempts · Average Time en min · Average Points + %) y confirmación antes de desbloquear hints
  function initChallengeModalEnhancer() {
    if (getNormPath() !== "/challenges") return;
    var modal = document.getElementById("challenge-window");
    if (!modal || modal.dataset.cyberModalEnhanced === "1") return;
    modal.dataset.cyberModalEnhanced = "1";

    var root = ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
    var hdrs = { Accept: "application/json", "Content-Type": "application/json" };

    function fetchJson(u) {
      return fetch(u, { headers: hdrs })
        .then(function (r) {
          var ct = (r.headers && r.headers.get("content-type")) || "";
          return r.ok && ct.indexOf("application/json") !== -1 ? r.json() : null;
        })
        .catch(function () { return null; });
    }

    function showCyberHintConfirm(summaryText) {
      return new Promise(function (resolve) {
        var existing = document.getElementById("cyber-hint-confirm-overlay");
        if (existing) existing.remove();

        var overlay = document.createElement("div");
        overlay.id = "cyber-hint-confirm-overlay";
        overlay.className = "cyber-confirm-backdrop";
        overlay.innerHTML =
          '<div class="cyber-confirm-dialog" role="dialog" aria-modal="true">' +
          '  <h5 class="fw-bold theme-text-primary mb-2"><i class="fas fa-lightbulb me-2" style="color:#FFE600;"></i>Unlock Hint</h5>' +
          '  <p class="small theme-text-secondary mb-1">Are you sure you want to unlock this hint?</p>' +
          '  <p class="small font-mono mb-0" style="color:#00F0FF;"></p>' +
          '  <div class="cyber-confirm-actions">' +
          '    <button type="button" class="theme-pill-btn" data-confirm="no">Cancel</button>' +
          '    <button type="button" class="btn btn-primary px-4" data-confirm="yes">Yes, unlock</button>' +
          "  </div>" +
          "</div>";
        overlay.querySelector("p.font-mono").textContent = summaryText || "";

        function cleanup(answer) {
          overlay.remove();
          resolve(answer);
        }

        overlay.querySelector('[data-confirm="no"]').addEventListener("click", function () { cleanup(false); });
        overlay.querySelector('[data-confirm="yes"]').addEventListener("click", function () { cleanup(true); });
        overlay.addEventListener("click", function (ev) {
          if (ev.target === overlay) cleanup(false);
        });
        document.body.appendChild(overlay);
      });
    }

    // Interceptar clics sobre hints bloqueadas para mostrar confirmación Cyber antes de desbloquear
    modal.addEventListener(
      "click",
      function (e) {
        var summary = e.target && e.target.closest ? e.target.closest(".challenge-hints details > summary") : null;
        if (!summary) return;
        var details = summary.parentElement;
        if (!details || details.open || details.dataset.cyberHintConfirmed === "1") return;
        var txt = (summary.textContent || "").trim();
        var isLocked = /unlock|cost/i.test(txt);
        if (!isLocked) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        showCyberHintConfirm(txt).then(function (ok) {
          if (!ok) return;
          details.dataset.cyberHintConfirmed = "1";
          // Evitar doble diálogo si CTFd también lanza su displayUnlock nativo
          var prevFn =
            window.CTFd &&
            window.CTFd._functions &&
            window.CTFd._functions.challenge &&
            window.CTFd._functions.challenge.displayUnlock;
          if (prevFn) {
            window.CTFd._functions.challenge.displayUnlock = function () {
              return Promise.resolve(true);
            };
          }
          details.open = true;
          details.dispatchEvent(new Event("toggle"));
          if (prevFn) {
            setTimeout(function () {
              if (window.CTFd && window.CTFd._functions && window.CTFd._functions.challenge) {
                window.CTFd._functions.challenge.displayUnlock = prevFn;
              }
            }, 600);
          }
        });
      },
      true
    );

    function populateChallengeStats(chalId, pane) {
      if (!chalId || !pane) return;
      var attEl = pane.querySelector('[data-stat="avg-att"]');
      var timeEl = pane.querySelector('[data-stat="avg-time"]');
      var ptsEl = pane.querySelector('[data-stat="avg-pts"]');
      if (attEl) attEl.textContent = "…";
      if (timeEl) timeEl.textContent = "…";
      if (ptsEl) ptsEl.textContent = "…";

      Promise.all([
        fetchJson(root + "/api/v1/challenges/" + chalId),
        fetchJson(root + "/api/v1/challenges/" + chalId + "/solves"),
        fetchJson(root + "/api/v1/submissions?challenge_id=" + chalId + "&per_page=200"),
      ]).then(function (res) {
        var chal = (res[0] && res[0].data) || {};
        var solves = (res[1] && Array.isArray(res[1].data)) ? res[1].data : [];
        var subs = (res[2] && Array.isArray(res[2].data)) ? res[2].data : [];

        var maxPts = Number(chal.initial != null ? chal.initial : chal.value || 0);
        var curPts = Number(chal.value || 0);

        // Agrupar intentos y tiempos por usuario
        var byUser = {};
        subs.forEach(function (s) {
          var uid = String(s.user_id || s.account_id || "");
          if (!uid) return;
          if (!byUser[uid]) byUser[uid] = { attempts: 0, firstMs: Infinity, solveMs: 0 };
          byUser[uid].attempts += 1;
          var ts = Date.parse(s.date);
          if (!isNaN(ts)) {
            if (ts < byUser[uid].firstMs) byUser[uid].firstMs = ts;
            if (s.type === "correct" && (!byUser[uid].solveMs || ts < byUser[uid].solveMs)) {
              byUser[uid].solveMs = ts;
            }
          }
        });

        var solverAttempts = [];
        var durations = [];
        Object.keys(byUser).forEach(function (uid) {
          var rec = byUser[uid];
          if (rec.solveMs > 0) {
            solverAttempts.push(rec.attempts);
            if (rec.firstMs <= rec.solveMs) {
              durations.push(rec.solveMs - rec.firstMs);
            }
          }
        });

        if (!durations.length && chal.solved_by_me) {
          try {
            var opened = Number(localStorage.getItem("cyber_chal_open_" + chalId) || "0");
            if (opened > 0 && solves.length) {
              var latestSolve = Date.parse(solves[solves.length - 1].date);
              if (!isNaN(latestSolve) && latestSolve >= opened) {
                durations.push(latestSolve - opened);
              }
            }
          } catch (_) {}
        }

        // 1. Average Attempts (entero redondeado normal)
        if (attEl) {
          if (solverAttempts.length) {
            var avgAtt = solverAttempts.reduce(function (a, b) { return a + b; }, 0) / solverAttempts.length;
            attEl.textContent = String(Math.round(avgAtt));
          } else if (chal.attempts > 0) {
            attEl.textContent = String(Math.round(chal.attempts));
          } else {
            attEl.textContent = "—";
          }
        }

        // 2. Average Time (solo minutos enteros, sin decimales ni segundos)
        if (timeEl) {
          if (durations.length) {
            var avgMs = durations.reduce(function (a, b) { return a + b; }, 0) / durations.length;
            var mins = Math.round(avgMs / 60000);
            timeEl.textContent = mins + " min";
          } else {
            timeEl.textContent = "—";
          }
        }

        // 3. Average Points: promedio entero de puntos obtenidos Y porcentaje entero sobre máximo obtenible
        if (ptsEl) {
          if (maxPts > 0 && (solves.length > 0 || chal.solves > 0)) {
            var avgPts = Math.round(curPts);
            var avgPct = Math.min(100, Math.round((curPts / maxPts) * 100));
            ptsEl.textContent = avgPts + " (" + avgPct + "%)";
          } else {
            ptsEl.textContent = "—";
          }
        }
      });
    }

    function enhanceModalContent() {
      var tabs = modal.querySelector(".nav-tabs");
      if (!tabs) return;

      // 0. Envolver tabs + btn-close en .cyber-modal-header-bar para separador 100% de lado a lado
      var headerParent = tabs.parentElement;
      if (headerParent && !headerParent.classList.contains("cyber-modal-header-bar")) {
        headerParent.classList.add("cyber-modal-header-bar");
        var closeBtn = headerParent.querySelector(":scope > .btn-close");
        if (closeBtn) {
          closeBtn.classList.remove("float-end");
          headerParent.appendChild(closeBtn);
        }
      }

      // 1. Ocultar ratings (like/dislike)
      modal.querySelectorAll(".challenge-ratings").forEach(function (el) { el.remove(); });

      // 2. Renombrar pestaña Challenge -> Description
      var firstTab = tabs.querySelector('button[data-bs-target="#challenge"]');
      if (firstTab && !firstTab.dataset.cyberRenamed) {
        firstTab.dataset.cyberRenamed = "1";
        firstTab.innerHTML = '<i class="fas fa-align-left me-1"></i><span>Description</span>';
      }

      // 2b. Añadir "pts" al subtítulo de puntos en Description (ej. "35 pts")
      var valEl = modal.querySelector(".challenge-value");
      if (valEl && !valEl.dataset.cyberPtsFormatted) {
        var rawVal = (valEl.textContent || "").trim();
        if (/^\d+$/.test(rawVal)) {
          valEl.textContent = rawVal + " pts";
        } else if (/^\d+\s*pts$/i.test(rawVal)) {
          valEl.textContent = rawVal.replace(/\s*pts$/i, " pts");
        }
        valEl.dataset.cyberPtsFormatted = "1";
      }

      // 2c. Convertir <code> inline largos en bloque limpio sin bordes partidos (ej. Set-Cookie / JWT)
      modal.querySelectorAll(".challenge-desc code:not(pre code)").forEach(function (codeEl) {
        if (codeEl.classList.contains("cyber-code-block")) return;
        var txt = (codeEl.textContent || "").trim();
        var parent = codeEl.parentElement;
        var soleChild = parent && parent.tagName === "P" && parent.childNodes.length === 1;
        if (txt.length > 42 || soleChild) {
          codeEl.classList.add("cyber-code-block");
        }
      });

      // 3. Renombrar cabecera Name -> Username en Solves
      var solvesPane = modal.querySelector("#solves");
      if (solvesPane) {
        solvesPane.querySelectorAll("thead th").forEach(function (th) {
          if ((th.textContent || "").trim().toLowerCase() === "name") {
            th.textContent = "Username";
          }
        });
      }

      // 4. Registrar hora de primera apertura del reto para métricas de tiempo
      var cidInput = modal.querySelector("#challenge-id, .challenge-id");
      var chalId = cidInput ? cidInput.value : "";
      if (chalId) {
        try {
          var k = "cyber_chal_open_" + chalId;
          if (!localStorage.getItem(k)) localStorage.setItem(k, String(Date.now()));
        } catch (_) {}
      }

      // 5. Inyectar pestaña Stats al final: Average Attempts -> Average Time -> Average Points
      var tabContent = modal.querySelector(".tab-content");
      if (tabContent && !tabs.querySelector("[data-cyber-stats-tab]")) {
        var li = document.createElement("li");
        li.className = "nav-item";
        li.innerHTML =
          '<button class="nav-link challenge-stats" data-bs-target="#stats" data-cyber-stats-tab="1" type="button">' +
          '<i class="fas fa-chart-bar me-1"></i><span>Stats</span></button>';
        tabs.appendChild(li);
      }

      if (tabContent && !tabContent.querySelector("#stats")) {
        var pane = document.createElement("div");
        pane.setAttribute("role", "tabpanel");
        pane.className = "tab-pane fade";
        pane.id = "stats";
        pane.innerHTML =
          '<div class="cyber-chal-stats-grid" data-cyber-stats-body="1">' +
          '  <div class="cyber-chal-stat-box">' +
          '    <span class="cyber-chal-stat-label">Average Attempts</span>' +
          '    <span class="cyber-chal-stat-val" style="color:#B366FF;" data-stat="avg-att">—</span>' +
          '    <span class="cyber-chal-stat-sub">Submissions per solve</span>' +
          "  </div>" +
          '  <div class="cyber-chal-stat-box">' +
          '    <span class="cyber-chal-stat-label">Average Time</span>' +
          '    <span class="cyber-chal-stat-val" data-stat="avg-time">—</span>' +
          '    <span class="cyber-chal-stat-sub">First attempt to solve</span>' +
          "  </div>" +
          '  <div class="cyber-chal-stat-box">' +
          '    <span class="cyber-chal-stat-label">Average Points</span>' +
          '    <span class="cyber-chal-stat-val" style="color:#00FF66;" data-stat="avg-pts">—</span>' +
          '    <span class="cyber-chal-stat-sub">Average earned (% of max)</span>' +
          "  </div>" +
          "</div>";
        tabContent.appendChild(pane);
      }

      var statsBtn = tabs.querySelector("[data-cyber-stats-tab]");
      var statsPane = tabContent && tabContent.querySelector("#stats");
      if (statsBtn && statsPane && !statsBtn.dataset.cyberBound) {
        statsBtn.dataset.cyberBound = "1";
        statsBtn.addEventListener("click", function () {
          tabs.querySelectorAll(".nav-link").forEach(function (b) { b.classList.remove("active"); });
          tabContent.querySelectorAll(".tab-pane").forEach(function (p) { p.classList.remove("show", "active"); });
          statsBtn.classList.add("active");
          statsPane.classList.add("show", "active");
          var curCid = (modal.querySelector("#challenge-id, .challenge-id") || {}).value || chalId;
          populateChallengeStats(curCid, statsPane);
        });
        tabs.querySelectorAll(".nav-link:not([data-cyber-stats-tab])").forEach(function (other) {
          other.addEventListener("click", function () {
            statsBtn.classList.remove("active");
            statsPane.classList.remove("show", "active");
          });
        });
      }
    }

    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(enhanceModalContent).observe(modal, { childList: true, subtree: true });
    }
    enhanceModalContent();
  }

  // 9. Perfiles de usuario (/user y /users/<id>):
  //    - Columna "Points" (earned / max sin "PTS")
  //    - Solves ordenados por más puntos potenciales a menos, límite 15 + botón "Load more"
  //    - Orden de barras con 3D tilt: 1) Submission Accuracy (Cyan/Rojo) · 2) Points Efficiency (Verde/Rojo) · 3) Category Breakdown (colores únicos por categoría)
  function initProfilePointsMetrics() {
    var path = getNormPath();
    var isPrivate = path === "/user" || path === "/profile";
    var pubMatch = path.match(/^\/users\/(\d+)$/);
    if (!isPrivate && !pubMatch) return;
    if (document.body.dataset.cyberProfileMetricsInit === "1") return;
    document.body.dataset.cyberProfileMetricsInit = "1";

    var targetId = isPrivate ? "me" : pubMatch[1];
    var root = ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
    var hdrs = { Accept: "application/json", "Content-Type": "application/json" };

    // Activar 3D tilt en tarjetas ya existentes del perfil (awards, gráficas)
    document.querySelectorAll("main .theme-card, main .card").forEach(function (c) {
      if (!c.classList.contains("tilt-card")) {
        c.classList.add("tilt-card");
        c.setAttribute("data-tilt-max", c.querySelector("#score-graph") ? "0.7" : "1.2");
      }
      if (!c.querySelector(":scope > .tilt-glare")) {
        var g = document.createElement("div");
        g.className = "tilt-glare";
        g.setAttribute("aria-hidden", "true");
        c.insertBefore(g, c.firstChild);
      }
    });
    scanTiltCards(document);

    var solvesTable = null;
    document.querySelectorAll("main table.table").forEach(function (tbl) {
      var ths = tbl.querySelectorAll("thead th");
      ths.forEach(function (th) {
        var txt = (th.textContent || "").trim().toLowerCase();
        if (txt === "value" || txt === "points") {
          th.textContent = "Points";
          solvesTable = tbl;
        }
      });
    });

    function fetchJson(u) {
      return fetch(u, { headers: hdrs })
        .then(function (r) {
          var ct = (r.headers && r.headers.get("content-type")) || "";
          return r.ok && ct.indexOf("application/json") !== -1 ? r.json() : { data: [] };
        })
        .catch(function () { return { data: [] }; });
    }

    // Reestilizar Submission Accuracy (Violeta #B366FF / Fails #FF3358) y Category Breakdown (color distinto por categoría)
    function applyProfileBarPalette(accCol, catCol) {
      if (accCol) {
        var accBars = accCol.querySelectorAll(".progress-bar");
        if (accBars[0]) accBars[0].style.backgroundColor = "#B366FF";
        if (accBars[1]) accBars[1].style.backgroundColor = "#FF3358";
        var accCircles = accCol.querySelectorAll("svg circle");
        if (accCircles[0]) accCircles[0].setAttribute("fill", "#B366FF");
        if (accCircles[1]) accCircles[1].setAttribute("fill", "#FF3358");
      }
      if (catCol) {
        var legendItems = catCol.querySelectorAll("small, span");
        var catOrder = [];
        legendItems.forEach(function (el) {
          var t = (el.textContent || "").trim();
          var m = t.match(/^(.+?)\s*\([\d.]+%\)$/);
          if (m && m[1]) {
            var cname = m[1].trim();
            var color = getCategoryColor(cname);
            catOrder.push(color);
            var parent = el.parentElement;
            var circle = parent && parent.querySelector("svg circle");
            if (circle) circle.setAttribute("fill", color);
          }
        });
        var catBars = catCol.querySelectorAll(".progress-bar");
        catBars.forEach(function (bar, idx) {
          if (catOrder[idx]) bar.style.backgroundColor = catOrder[idx];
        });
      }
    }

    Promise.all([
      fetchJson(root + "/api/v1/users/" + targetId + "/solves"),
      fetchJson(root + "/api/v1/users/" + targetId + "/fails"),
      fetchJson(root + "/api/v1/users/" + targetId + "/awards"),
      fetchJson(root + "/api/v1/users/" + targetId),
    ]).then(function (results) {
      var solves = (results[0] && results[0].data) || [];
      var fails = (results[1] && results[1].data) || [];
      var awards = (results[2] && results[2].data) || [];
      var userInfo = (results[3] && results[3].data && !Array.isArray(results[3].data)) ? results[3].data : null;

      var chalIds = {};
      solves.forEach(function (s) {
        var cid = s.challenge_id || (s.challenge && s.challenge.id);
        if (cid) chalIds[cid] = true;
      });
      fails.forEach(function (f) {
        var cid = f.challenge_id || (f.challenge && f.challenge.id);
        if (cid) chalIds[cid] = true;
      });

      var ids = Object.keys(chalIds);
      if (!ids.length) return;

      Promise.all(
        ids.map(function (cid) {
          return fetchJson(root + "/api/v1/challenges/" + cid).then(function (res) {
            return { id: String(cid), data: (res && res.data) || null };
          });
        })
      ).then(function (chalDetails) {
        var maxById = {};
        var nameById = {};
        var unlockedHintCostById = {};
        var unlockedHintCostTotal = 0;

        chalDetails.forEach(function (item) {
          if (item.data) {
            var maxVal = Number(item.data.initial != null ? item.data.initial : item.data.value || 0);
            maxById[item.id] = maxVal;
            nameById[item.id] = item.data.name || "";
            if (Array.isArray(item.data.hints)) {
              var hCost = 0;
              item.data.hints.forEach(function (h) {
                if (h && h.content != null && Number(h.cost || 0) > 0) {
                  hCost += Number(h.cost);
                }
              });
              if (hCost > 0) {
                unlockedHintCostById[item.id] = hCost;
                unlockedHintCostTotal += hCost;
              }
            }
          }
        });

        var negAwardTotal = 0;
        var posAwardTotal = 0;
        var negAwardById = {};
        awards.forEach(function (aw) {
          var v = Number(aw.value || 0);
          if (v < 0) {
            negAwardTotal += Math.abs(v);
            var desc = ((aw.name || "") + " " + (aw.description || "")).toLowerCase();
            ids.forEach(function (cid) {
              var nm = (nameById[cid] || "").toLowerCase();
              if (nm && desc.indexOf(nm) !== -1) {
                negAwardById[cid] = (negAwardById[cid] || 0) + Math.abs(v);
              }
            });
          } else if (v > 0) {
            posAwardTotal += v;
          }
        });

        var earnedTotal = 0;
        var solveById = {};
        var solveByName = {};
        solves.forEach(function (s) {
          var cid = String(s.challenge_id || (s.challenge && s.challenge.id) || "");
          var val = Number((s.challenge && s.challenge.value) || s.value || 0);
          var penalty = (negAwardById[cid] || 0) + (unlockedHintCostById[cid] || 0);
          var earned = Math.max(0, val - penalty);
          var maxPts = Math.max(maxById[cid] || val, val);
          var cName = (s.challenge && s.challenge.name) || nameById[cid] || "";
          var rec = { earned: earned, max: maxPts, name: cName, dateMs: Date.parse(s.date) || 0 };
          solveById[cid] = rec;
          if (cName) solveByName[cName.trim().toLowerCase()] = rec;
          earnedTotal += val;
        });

        earnedTotal = Math.max(0, earnedTotal - negAwardTotal - unlockedHintCostTotal);
        if (userInfo && typeof userInfo.score === "number" && !isNaN(userInfo.score)) {
          var netFromUserScore = Math.max(0, userInfo.score - posAwardTotal);
          if (netFromUserScore < earnedTotal) {
            earnedTotal = netFromUserScore;
          }
        }

        var potentialTotal = 0;
        ids.forEach(function (cid) {
          var fallback = solveById[cid] ? solveById[cid].max : 0;
          potentialTotal += maxById[cid] || fallback;
        });
        potentialTotal = Math.max(potentialTotal, earnedTotal);

        if (solvesTable) {
          var tbody = solvesTable.querySelector("tbody");
          var rows = Array.prototype.slice.call(solvesTable.querySelectorAll("tbody tr"));
          var rowMeta = rows.map(function (tr, idx) {
            var tds = tr.querySelectorAll("td");
            var matched = null;
            if (tds.length >= 3) {
              var link = tds[0].querySelector("a[href]");
              if (link && link.href) {
                var m = link.href.match(/-(\d+)$/);
                if (m && solveById[m[1]]) matched = solveById[m[1]];
              }
              if (!matched && link) {
                var linkTxt = (link.textContent || "").trim().toLowerCase();
                if (linkTxt && solveByName[linkTxt]) matched = solveByName[linkTxt];
              }
              if (!matched && solves[idx]) {
                var cid = String(solves[idx].challenge_id || (solves[idx].challenge && solves[idx].challenge.id) || "");
                matched = solveById[cid];
              }
              if (matched) {
                tds[2].classList.add("font-mono", "fw-bold");
                tds[2].innerHTML =
                  '<span style="color:#00FF66;">' + matched.earned + "</span>" +
                  '<span style="color:#64748B;"> / ' + matched.max + "</span>";
              }
            }
            return {
              tr: tr,
              max: matched ? matched.max : 0,
              earned: matched ? matched.earned : 0,
              dateMs: matched ? matched.dateMs : 0,
            };
          });

          rowMeta.sort(function (a, b) {
            if (b.max !== a.max) return b.max - a.max;
            if (b.earned !== a.earned) return b.earned - a.earned;
            return b.dateMs - a.dateMs;
          });

          if (tbody) {
            rowMeta.forEach(function (item) {
              tbody.appendChild(item.tr);
            });
          }

          var PAGE_SIZE = 15;
          if (rowMeta.length > PAGE_SIZE) {
            var visibleCount = PAGE_SIZE;
            var applyRowLimit = function () {
              rowMeta.forEach(function (item, idx) {
                item.tr.classList.toggle("gdg-filter-hidden", idx >= visibleCount);
              });
            };
            applyRowLimit();

            var tableWrap = solvesTable.closest(".cyber-table-wrap") || solvesTable;
            var existingMore = tableWrap.parentNode && tableWrap.parentNode.querySelector(".cyber-load-more-wrap");
            if (existingMore) existingMore.remove();

            var moreWrap = document.createElement("div");
            moreWrap.className = "cyber-load-more-wrap";
            var moreBtn = document.createElement("button");
            moreBtn.type = "button";
            moreBtn.className = "theme-pill-btn cyber-load-more-btn";
            moreBtn.innerHTML = '<i class="fas fa-plus-circle"></i><span>Load more</span>';
            moreBtn.addEventListener("click", function () {
              visibleCount += PAGE_SIZE;
              applyRowLimit();
              if (visibleCount >= rowMeta.length) moreWrap.remove();
            });
            moreWrap.appendChild(moreBtn);
            if (tableWrap.parentNode) {
              tableWrap.parentNode.insertBefore(moreWrap, tableWrap.nextSibling);
            }
          }
        }

        // Inyectar Points Efficiency ANTES de Category Breakdown con 3D tilt en las 3 tarjetas
        var graphsRow = document.querySelector('[x-data="UserGraphs"]');
        if (graphsRow && potentialTotal > 0 && !document.getElementById("cyber-points-efficiency-col")) {
          var earnedPct = Number(((earnedTotal / potentialTotal) * 100).toFixed(2));
          var missedPct = Number(Math.max(0, 100 - earnedPct).toFixed(2));

          graphsRow.classList.add("g-4", "mt-5", "mb-4");
          graphsRow.querySelectorAll(":scope > br.clearfix").forEach(function (br) {
            br.remove();
          });

          var coreHeaders = [
            '<h4 class="h6 fw-bold theme-text-primary mb-3 font-mono text-uppercase" style="letter-spacing:0.05em;"><i class="fas fa-crosshairs me-2" style="color:#B366FF;"></i>Submission Accuracy</h4>',
            '<h4 class="h6 fw-bold theme-text-primary mb-3 font-mono text-uppercase" style="letter-spacing:0.05em;"><i class="fas fa-chart-pie me-2" style="color:#00F0FF;"></i>Category Breakdown</h4>',
          ];
          var existingCols = Array.prototype.slice.call(graphsRow.querySelectorAll(":scope > .col-md-6"));
          existingCols.forEach(function (c, i) {
            c.classList.remove("col-md-6", "py-4");
            c.classList.add("col-md-4");
            var card = c.querySelector(".theme-card");
            if (!card) {
              card = document.createElement("div");
              card.className = "theme-card tilt-card p-4 h-100";
              card.setAttribute("data-tilt-max", "1.2");
              var prog = c.querySelector(".progress");
              if (prog) prog.classList.add("mb-3");
              while (c.firstChild) {
                card.appendChild(c.firstChild);
              }
              if (coreHeaders[i]) {
                card.insertAdjacentHTML("afterbegin", coreHeaders[i]);
              }
              c.appendChild(card);
            } else {
              card.classList.add("tilt-card");
              card.setAttribute("data-tilt-max", "1.2");
            }
            if (!card.querySelector(":scope > .tilt-glare")) {
              var glare = document.createElement("div");
              glare.className = "tilt-glare";
              glare.setAttribute("aria-hidden", "true");
              card.insertBefore(glare, card.firstChild);
            }
          });

          var accCol = existingCols[0] || null;
          var catCol = existingCols[1] || null;

          var col = document.createElement("div");
          col.id = "cyber-points-efficiency-col";
          col.className = "col-md-4 d-none d-md-block";
          col.innerHTML =
            '<div class="theme-card tilt-card p-4 h-100" data-tilt-max="1.2">' +
            '  <div class="tilt-glare" aria-hidden="true"></div>' +
            '  <div class="d-flex justify-content-between align-items-center mb-3 gap-2">' +
            '    <h4 class="h6 fw-bold theme-text-primary mb-0 font-mono text-uppercase" style="letter-spacing:0.05em;">' +
            '      <i class="fas fa-bolt me-2" style="color:#00FF66;"></i>Points Efficiency' +
            '    </h4>' +
            '    <span class="font-mono small fw-bold" style="color:#00FF66;">' + earnedTotal + " / " + potentialTotal + "</span>" +
            '  </div>' +
            '  <div class="progress mb-3">' +
            '    <div class="progress-bar" role="progressbar" style="width:' + earnedPct + '%;background-color:#00FF66;"></div>' +
            '    <div class="progress-bar" role="progressbar" style="width:' + missedPct + '%;background-color:#FF3358;"></div>' +
            '  </div>' +
            '  <div class="d-flex flex-wrap gap-3 small">' +
            '    <span class="d-inline-flex align-items-center gap-1 theme-text-primary">' +
            '      <svg height="16" width="16"><circle cx="8" cy="8" r="5" fill="#00FF66" /></svg>' +
            '      <small>Earned (' + earnedPct + '%)</small>' +
            '    </span>' +
            '    <span class="d-inline-flex align-items-center gap-1 theme-text-secondary">' +
            '      <svg height="16" width="16"><circle cx="8" cy="8" r="5" fill="#FF3358" /></svg>' +
            '      <small>Missed (' + missedPct + '%)</small>' +
            '    </span>' +
            '  </div>' +
            '</div>';

          // Insertar Points Efficiency ANTES de Category Breakdown (posición 2 de 3)
          if (catCol && catCol.parentNode === graphsRow) {
            graphsRow.insertBefore(col, catCol);
          } else if (accCol && accCol.parentNode === graphsRow) {
            graphsRow.insertBefore(col, accCol.nextSibling);
          } else {
            graphsRow.appendChild(col);
          }

          // Aplicar paleta diferenciada ahora y tras el render de Alpine
          applyProfileBarPalette(accCol, catCol);
          setTimeout(function () { applyProfileBarPalette(accCol, catCol); }, 350);
          setTimeout(function () { applyProfileBarPalette(accCol, catCol); }, 1100);
          scanTiltCards(graphsRow);
        }
      });
    });
  }

  window.cyberInitDatePickers = initCyberDatePickers;
  window.cyberInitSettingsInlineFeedback = initSettingsInlineFeedback;
  window.cyberInitScoreboardTimeframes = initScoreboardTimeframes;
  window.cyberInitProfilePointsMetrics = initProfilePointsMetrics;
  window.cyberInitChartDownloadButton = initChartDownloadButton;
  window.cyberInitRegisteredUsersCounter = initRegisteredUsersCounter;
  window.cyberInitUsersTableInteractive = initUsersTableInteractive;
  window.cyberInitChallengeModalEnhancer = initChallengeModalEnhancer;

  document.addEventListener("DOMContentLoaded", function () {
    cleanupLegacyThemeHeader();
    highlightActiveNav();
    scanTiltCards(document);
    initCyberDatePickers(document);
    initSettingsInlineFeedback();
    initScoreboardTimeframes();
    initProfilePointsMetrics();
    initChartDownloadButton();
    initRegisteredUsersCounter();
    initUsersTableInteractive();
    initChallengeModalEnhancer();

    // Observar nuevos nodos inyectados dinámicamente por Alpine.js (retos, modales) con debounce ligero
    if (!prefersReducedMotion && typeof MutationObserver !== "undefined") {
      var pendingNodes = [];
      var scanRaf = null;
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node.nodeType === 1 && (node.classList.contains("tilt-card") || node.childElementCount > 0)) {
              pendingNodes.push(node);
            }
          }
        }
        if (pendingNodes.length && scanRaf === null) {
          scanRaf = requestAnimationFrame(function () {
            scanRaf = null;
            var batch = pendingNodes.splice(0, pendingNodes.length);
            for (var k = 0; k < batch.length; k++) {
              scanTiltCards(batch[k]);
            }
          });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
