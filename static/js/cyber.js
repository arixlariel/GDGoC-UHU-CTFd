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

  function makeCyberChartTheme(isProfile) {
    var base = {
      backgroundColor: "transparent",
      color: [
        "#00F0FF",
        "#FF007F",
        "#00FF66",
        "#FFE600",
        "#A855F7",
        "#38BDF8",
        "#FB7185",
        "#34D399",
        "#FBBF24",
        "#818CF8",
      ],
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
          fontSize: isProfile ? 23 : 19,
        }),
      },
      toolbox: {
        show: false,
      },
      grid: {
        top: isProfile ? 68 : 62,
        bottom: isProfile ? 48 : 74,
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
      legend: isProfile
        ? { show: false }
        : {
            show: true,
            bottom: 8,
            textStyle: safeMergeLeaf({
              color: "#E2F1FF",
              fontFamily: "'Google Sans', 'Plus Jakarta Sans', sans-serif",
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

  // Botón Download diferenciado sobre #score-graph (descarga sot_<USERNAME>.png en perfiles)
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
      var canvas = graph.querySelector("canvas");
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
      var hint = picker.querySelector(".cyber-date-hint");
      var presets = Array.prototype.slice.call(picker.querySelectorAll(".cyber-date-preset"));
      if (!hidden || !textInput) return;

      function pad2(n) {
        return String(n).padStart(2, "0");
      }

      function setActivePreset(daysVal) {
        presets.forEach(function (btn) {
          btn.classList.toggle("active", daysVal !== null && btn.getAttribute("data-days") === String(daysVal));
        });
      }

      function setNeverState() {
        hidden.value = "";
        textInput.value = "";
        textInput.placeholder = "Never (no expiration)";
        textInput.classList.add("is-never");
        textInput.classList.remove("is-invalid");
        textInput.dataset.invalidDate = "0";
        if (hint) {
          hint.classList.remove("is-error");
          hint.textContent = "Never expires — type DD/MM/YYYY to set a date";
        }
        setActivePreset(0);
      }

      function parseAndValidate(raw) {
        var s = (raw || "").trim();
        if (!s || s.toLowerCase() === "never") {
          setNeverState();
          return;
        }
        textInput.classList.remove("is-never");

        var d = null, m = null, y = null;
        var iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        var dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (iso) {
          y = parseInt(iso[1], 10);
          m = parseInt(iso[2], 10);
          d = parseInt(iso[3], 10);
        } else if (dmy) {
          d = parseInt(dmy[1], 10);
          m = parseInt(dmy[2], 10);
          y = parseInt(dmy[3], 10);
        }

        if (d !== null && m !== null && y !== null) {
          var dt = new Date(y, m - 1, d);
          var valid =
            y >= 2024 &&
            y <= 2100 &&
            m >= 1 &&
            m <= 12 &&
            d >= 1 &&
            d <= 31 &&
            dt.getFullYear() === y &&
            dt.getMonth() === m - 1 &&
            dt.getDate() === d;
          if (valid) {
            hidden.value = y + "-" + pad2(m) + "-" + pad2(d);
            textInput.classList.remove("is-invalid");
            textInput.dataset.invalidDate = "0";
            if (hint) {
              hint.classList.remove("is-error");
              hint.textContent = "Expires on " + pad2(d) + "/" + pad2(m) + "/" + y;
            }
            return;
          }
        }

        hidden.value = "";
        textInput.classList.add("is-invalid");
        textInput.dataset.invalidDate = "1";
        if (hint) {
          hint.classList.add("is-error");
          hint.textContent = "Invalid date — use DD/MM/YYYY or select Never";
        }
      }

      presets.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var days = parseInt(btn.getAttribute("data-days") || "0", 10);
          if (!days) {
            setNeverState();
            return;
          }
          var target = new Date();
          target.setDate(target.getDate() + days);
          textInput.value = pad2(target.getDate()) + "/" + pad2(target.getMonth() + 1) + "/" + target.getFullYear();
          parseAndValidate(textInput.value);
          setActivePreset(days);
        });
      });

      textInput.addEventListener("focus", function () {
        textInput.classList.remove("is-never");
        if (textInput.placeholder.indexOf("Never") === 0) {
          textInput.placeholder = "DD/MM/YYYY";
        }
      });

      textInput.addEventListener("input", function (e) {
        setActivePreset(null);
        // Auto-insertar "/" cómodamente si el usuario escribe solo dígitos (DDMMYYYY)
        var raw = textInput.value;
        if (e.inputType !== "deleteContentBackward" && /^\d+$/.test(raw.replace(/\//g, ""))) {
          var digits = raw.replace(/\D/g, "").slice(0, 8);
          if (digits.length > 4) {
            textInput.value = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
          } else if (digits.length > 2) {
            textInput.value = digits.slice(0, 2) + "/" + digits.slice(2);
          }
        }
        parseAndValidate(textInput.value);
      });

      textInput.addEventListener("blur", function () {
        if (!textInput.value.trim()) setNeverState();
      });

      // Validación previa al envío del formulario de Tokens + feedback rojo inline
      var form = picker.closest("form");
      if (form && !form.dataset.cyberTokenHooked) {
        form.dataset.cyberTokenHooked = "1";
        form.addEventListener(
          "submit",
          function (e) {
            var statusBox = form.querySelector(".cyber-form-status");
            if (textInput.dataset.invalidDate === "1") {
              e.preventDefault();
              e.stopImmediatePropagation();
              showInlineFormStatus(statusBox, "error", "Please enter a valid date (DD/MM/YYYY) or select Never.");
              textInput.focus();
            }
          },
          true
        );
      }

      setNeverState();
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

  // 7. Scoreboard con pestañas temporales (All-Time · Year · Last Month) y 6 columnas operativas:
  //    Place | Points | User | Solves | Submission accuracy | Points efficiency
  function initScoreboardTimeframes() {
    if (getNormPath() !== "/scoreboard") return;
    var sbRoot = document.getElementById("scoreboard");
    if (!sbRoot || sbRoot.dataset.cyberPeriodsInit === "1") return;
    sbRoot.dataset.cyberPeriodsInit = "1";

    var year = new Date().getFullYear();
    var bar = document.createElement("div");
    bar.className = "cyber-period-tabs col-md-12";
    bar.innerHTML =
      '<button type="button" class="cyber-period-btn active" data-period="all"><i class="fas fa-infinity"></i><span>All-Time</span></button>' +
      '<button type="button" class="cyber-period-btn" data-period="year"><i class="fas fa-calendar-alt"></i><span>' + year + ' (Year)</span></button>' +
      '<button type="button" class="cyber-period-btn" data-period="month"><i class="fas fa-clock"></i><span>Last Month</span></button>';

    sbRoot.insertBefore(bar, sbRoot.firstChild);

    var enhancedPanel = document.createElement("div");
    enhancedPanel.className = "col-md-12";
    enhancedPanel.id = "cyber-scoreboard-enhanced";
    sbRoot.appendChild(enhancedPanel);

    var root = ((window.init && window.init.urlRoot) || "").replace(/\/+$/, "");
    var hdrs = { Accept: "application/json", "Content-Type": "application/json" };
    var activePeriod = "all";
    var activeBracket = null;
    var dataLoaded = false;
    var standingsList = [];
    var topMap = {};
    var userMetricsById = {};
    var chalMaxById = {};

    function fetchJson(u) {
      return fetch(u, { headers: hdrs })
        .then(function (r) {
          var ct = (r.headers && r.headers.get("content-type")) || "";
          return r.ok && ct.indexOf("application/json") !== -1 ? r.json() : null;
        })
        .catch(function () { return null; });
    }

    function getNativeCols() {
      return Array.prototype.slice.call(sbRoot.children).filter(function (el) {
        return el !== bar && el !== enhancedPanel && !el.querySelector(".nav-pills");
      });
    }

    function fmtPctCell(pct) {
      if (pct === null || pct === undefined || isNaN(pct)) {
        return '<span class="theme-text-secondary opacity-50">—</span>';
      }
      var clean = Number(pct.toFixed(1));
      var cls = clean >= 75 ? "cyber-sb-pct--high" : clean >= 45 ? "cyber-sb-pct--mid" : "cyber-sb-pct--low";
      return '<span class="cyber-sb-pct ' + cls + '">' + clean + "%</span>";
    }

    function buildRowsForPeriod(period) {
      var now = Date.now();
      var cutoff =
        period === "month"
          ? now - 30 * 24 * 60 * 60 * 1000
          : period === "year"
          ? new Date(year, 0, 1).getTime()
          : 0;

      // Combinar standings nativos + entradas de top/100
      var byId = {};
      standingsList.forEach(function (st) {
        var id = String(st.account_id || st.id || "");
        if (!id) return;
        byId[id] = {
          id: id,
          name: st.name,
          account_url: st.account_url || (root + "/users/" + id),
          bracket_id: st.bracket_id || null,
          bracket_name: st.bracket_name || null,
          allScore: Number(st.score || 0),
          solves: [],
        };
      });
      Object.keys(topMap).forEach(function (k) {
        var entry = topMap[k];
        if (!entry) return;
        var id = String(entry.id || k);
        if (!byId[id]) {
          byId[id] = {
            id: id,
            name: entry.name,
            account_url: entry.account_url || (root + "/users/" + id),
            bracket_id: entry.bracket_id || null,
            bracket_name: entry.bracket_name || null,
            allScore: Number(entry.score || 0),
            solves: [],
          };
        }
        if (Array.isArray(entry.solves)) {
          byId[id].solves = entry.solves;
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
          if (score <= 0) return;
        }

        // Fails filtrados por periodo si existen timestamps (admin), o conteo total en All-Time
        var failCount = uMet.failCount;
        var filtFails = uMet.fails || [];
        if (period !== "all" && filtFails.length) {
          filtFails = filtFails.filter(function (fl) {
            var ts = Date.parse(fl.date);
            return !isNaN(ts) && ts >= cutoff;
          });
          failCount = filtFails.length;
        }

        var totalAttempts = solveCount + failCount;
        var accuracy = totalAttempts > 0 ? (solveCount / totalAttempts) * 100 : null;

        // Points efficiency: puntos obtenidos vs potenciales (max de retos resueltos/intentados)
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

        rows.push({
          id: id,
          name: u.name,
          account_url: u.account_url,
          bracket_name: u.bracket_name,
          score: Math.round(score),
          solves: solveCount,
          accuracy: accuracy,
          efficiency: efficiency,
          lastSolveMs: lastSolveMs,
        });
      });

      rows.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.lastSolveMs - b.lastSolveMs;
      });
      return rows;
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
      if (!rows.length) {
        var label =
          activePeriod === "month"
            ? "the last 30 days"
            : activePeriod === "year"
            ? String(year)
            : "the scoreboard yet";
        enhancedPanel.innerHTML =
          '<div class="theme-card cyber-empty-state">' +
          '  <span class="cyber-empty-signal"><span class="cyber-empty-dot"></span><span>0 entries</span></span>' +
          '  <h3 class="h5 theme-text-primary fw-bold mb-0">No scores recorded in ' + label + "</h3>" +
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
          '<tr>' +
          '<th scope="row" class="text-center"><span class="rank-badge ' + rCls + '">#' + (idx + 1) + "</span></th>" +
          '<td class="text-center font-mono fw-bold" style="color:#00F0FF;">' + r.score + "</td>" +
          '<td class="text-start ps-3 fw-semibold"><a href="' + r.account_url + '"></a>' + bracketHtml + "</td>" +
          '<td class="text-center font-mono fw-bold theme-text-primary">' + r.solves + "</td>" +
          '<td class="text-center">' + fmtPctCell(r.accuracy) + "</td>" +
          '<td class="text-center">' + fmtPctCell(r.efficiency) + "</td>" +
          "</tr>";
      });
      html += "</tbody></table></div>";
      enhancedPanel.innerHTML = html;

      var trs = enhancedPanel.querySelectorAll("tbody tr");
      rows.forEach(function (r, idx) {
        var a = trs[idx].querySelector("a");
        if (a) a.textContent = r.name;
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
    ]).then(function (res) {
      standingsList = (res[0] && Array.isArray(res[0].data)) ? res[0].data : [];
      topMap = (res[1] && res[1].data) || {};

      var accountIds = {};
      var chalIds = {};
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

      Promise.all(userPromises).then(function () {
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
      }).then(function () {
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

  // 9. Perfiles de usuario (/user y /users/<id>):
  //    - Columna "Points" (earned / max sin "PTS")
  //    - Solves ordenados por más puntos potenciales a menos, límite 15 + botón "Load more"
  //    - Barra automática "Points Efficiency" (Missed solo porcentaje) separada de Solves
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

    // Renombrar cabecera de columna Value -> Points inmediatamente en la tabla de Solves
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

          // Ordenar de más puntos potenciales a menos
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

          // Paginación de 15 en 15 con botón "Load more"
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
              if (visibleCount >= rowMeta.length) {
                moreWrap.remove();
              }
            });
            moreWrap.appendChild(moreBtn);
            if (tableWrap.parentNode) {
              tableWrap.parentNode.insertBefore(moreWrap, tableWrap.nextSibling);
            }
          }
        }

        // Inyectar la barra automática Potential vs Earned junto a Submission Accuracy y Category Breakdown
        var graphsRow = document.querySelector('[x-data="UserGraphs"]');
        if (graphsRow && potentialTotal > 0 && !document.getElementById("cyber-points-efficiency-col")) {
          var earnedPct = Number(((earnedTotal / potentialTotal) * 100).toFixed(2));
          var missedPct = Number(Math.max(0, 100 - earnedPct).toFixed(2));

          // Separar claramente las barras de la tabla de Solves y limpiar <br class="clearfix">
          graphsRow.classList.add("g-4", "mt-5", "mb-4");
          graphsRow.querySelectorAll(":scope > br.clearfix").forEach(function (br) {
            br.remove();
          });

          var coreHeaders = [
            '<h4 class="h6 fw-bold theme-text-primary mb-3 font-mono text-uppercase" style="letter-spacing:0.05em;"><i class="fas fa-crosshairs me-2" style="color:#00FF66;"></i>Submission Accuracy</h4>',
            '<h4 class="h6 fw-bold theme-text-primary mb-3 font-mono text-uppercase" style="letter-spacing:0.05em;"><i class="fas fa-chart-pie me-2" style="color:#00F0FF;"></i>Category Breakdown</h4>',
          ];
          var existingCols = Array.prototype.slice.call(graphsRow.querySelectorAll(":scope > .col-md-6"));
          existingCols.forEach(function (c, i) {
            c.classList.remove("col-md-6", "py-4");
            c.classList.add("col-md-4");
            if (!c.querySelector(".theme-card")) {
              var card = document.createElement("div");
              card.className = "theme-card p-4 h-100";
              var prog = c.querySelector(".progress");
              if (prog) prog.classList.add("mb-3");
              while (c.firstChild) {
                card.appendChild(c.firstChild);
              }
              if (coreHeaders[i]) {
                card.insertAdjacentHTML("afterbegin", coreHeaders[i]);
              }
              c.appendChild(card);
            }
          });

          var col = document.createElement("div");
          col.id = "cyber-points-efficiency-col";
          col.className = "col-md-4 d-none d-md-block";
          col.innerHTML =
            '<div class="theme-card p-4 h-100">' +
            '  <div class="d-flex justify-content-between align-items-center mb-3 gap-2">' +
            '    <h4 class="h6 fw-bold theme-text-primary mb-0 font-mono text-uppercase" style="letter-spacing:0.05em;">' +
            '      <i class="fas fa-bolt me-2" style="color:#FFE600;"></i>Points Efficiency' +
            '    </h4>' +
            '    <span class="font-mono small fw-bold" style="color:#00F0FF;">' + earnedTotal + " / " + potentialTotal + "</span>" +
            '  </div>' +
            '  <div class="progress mb-3">' +
            '    <div class="progress-bar" role="progressbar" style="width:' + earnedPct + '%;background-color:#00FF66;"></div>' +
            '    <div class="progress-bar" role="progressbar" style="width:' + missedPct + '%;background-color:#FF007F;"></div>' +
            '  </div>' +
            '  <div class="d-flex flex-wrap gap-3 small">' +
            '    <span class="d-inline-flex align-items-center gap-1 theme-text-primary">' +
            '      <span class="cyber-dot cyber-dot--4" style="animation:none;"></span>' +
            '      <span>Earned (' + earnedPct + '%)</span>' +
            '    </span>' +
            '    <span class="d-inline-flex align-items-center gap-1 theme-text-secondary">' +
            '      <span class="cyber-dot cyber-dot--2" style="animation:none;"></span>' +
            '      <span>Missed (' + missedPct + '%)</span>' +
            '    </span>' +
            '  </div>' +
            '</div>';

          if (existingCols.length) {
            var lastMetricCol = existingCols[existingCols.length - 1];
            graphsRow.insertBefore(col, lastMetricCol.nextSibling);
          } else {
            var graphCol = graphsRow.querySelector("#score-graph");
            var insertBeforeNode = graphCol ? graphCol.closest('[class*="col-"]') : null;
            if (insertBeforeNode && insertBeforeNode.parentNode === graphsRow) {
              graphsRow.insertBefore(col, insertBeforeNode);
            } else {
              graphsRow.appendChild(col);
            }
          }
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
