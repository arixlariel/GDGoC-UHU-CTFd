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

  // 2. Configuración Cyber Neon para gráficas Apache ECharts nativas de CTFd
  var cyberChartTheme = {
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
    title: {
      textStyle: {
        color: "#F0F9FF",
        fontFamily: "'Orbitron', 'Google Sans Display', sans-serif",
        fontWeight: 700,
        fontSize: 16,
      },
    },
    tooltip: {
      backgroundColor: "rgba(6, 10, 24, 0.95)",
      borderColor: "#00F0FF",
      borderWidth: 1,
      textStyle: {
        color: "#E2F1FF",
        fontFamily: "'Google Sans', sans-serif",
      },
      axisPointer: {
        lineStyle: { color: "rgba(0, 240, 255, 0.6)" },
        crossStyle: { color: "rgba(255, 0, 127, 0.6)" },
        label: {
          backgroundColor: "#0B1124",
          borderColor: "#00F0FF",
          color: "#00F0FF",
        },
      },
    },
    legend: {
      textStyle: {
        color: "#E2F1FF",
        fontFamily: "'Google Sans', sans-serif",
      },
      pageTextStyle: { color: "#94A3B8" },
      pageIconColor: "#00F0FF",
      pageIconInactiveColor: "#475569",
    },
    toolbox: {
      iconStyle: {
        borderColor: "#00F0FF",
      },
      emphasis: {
        iconStyle: {
          borderColor: "#FF007F",
        },
      },
    },
    xAxis: [
      {
        axisLine: { lineStyle: { color: "rgba(0, 240, 255, 0.35)" } },
        axisLabel: { color: "#94A3B8", fontFamily: "'Google Sans Mono', monospace" },
        splitLine: { show: true, lineStyle: { color: "rgba(0, 240, 255, 0.08)" } },
      },
    ],
    yAxis: [
      {
        axisLine: { lineStyle: { color: "rgba(0, 240, 255, 0.35)" } },
        axisLabel: { color: "#94A3B8", fontFamily: "'Google Sans Mono', monospace" },
        splitLine: { show: true, lineStyle: { color: "rgba(0, 240, 255, 0.1)" } },
      },
    ],
    dataZoom: [
      {
        id: "dataZoomX",
        type: "slider",
        xAxisIndex: [0],
        filterMode: "filter",
        height: 20,
        top: 35,
        backgroundColor: "rgba(6, 10, 24, 0.85)",
        borderColor: "rgba(0, 240, 255, 0.35)",
        fillerColor: "rgba(0, 240, 255, 0.18)",
        handleStyle: {
          color: "#00F0FF",
          borderColor: "#05070F",
        },
        textStyle: { color: "#94A3B8" },
      },
    ],
  };

  window.scoreboardChartOptions = Object.assign({}, cyberChartTheme, window.scoreboardChartOptions || {});
  window.userScoreGraphChartOptions = Object.assign({}, cyberChartTheme, window.userScoreGraphChartOptions || {});
  window.teamScoreGraphChartOptions = Object.assign({}, cyberChartTheme, window.teamScoreGraphChartOptions || {});

  // 3. Limpiar el viejo bloque inline de Theme Header y adaptar la portada de BD (/)
  function cleanupLegacyThemeHeader() {
    var legacyStyle = document.getElementById("gdg-custom-theme");
    if (legacyStyle) {
      legacyStyle.disabled = true;
    }

    // Potenciar automáticamente .feature-card en la portada con tilt 3D + glare
    document.querySelectorAll("main .feature-card").forEach(function (card) {
      if (!card.classList.contains("tilt-card")) {
        card.classList.add("tilt-card");
        card.setAttribute("data-tilt-max", "1.8");
        if (!card.querySelector(".tilt-glare")) {
          var glare = document.createElement("div");
          glare.className = "tilt-glare";
          glare.setAttribute("aria-hidden", "true");
          card.insertBefore(glare, card.firstChild);
        }
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

  document.addEventListener("DOMContentLoaded", function () {
    cleanupLegacyThemeHeader();
    highlightActiveNav();
    scanTiltCards(document);

    // Observar nuevos nodos inyectados dinámicamente por Alpine.js (retos, modales)
    if (!prefersReducedMotion && typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              scanTiltCards(node);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
