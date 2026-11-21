/* ============================================================================
   GDG on Campus Universidad de Huelva · CTFd Cyber Interactive Enhancements
   - Fuerza el modo oscuro/cyber sin parpadeo
   - Desactiva estilos antiguos de Theme Header (#gdg-custom-theme) si quedaron
   - Efecto 3D Perspective Tilt + Specular Glare (idéntico a Open Badges)
   - Paleta Cyber Neon para gráficas Apache ECharts (Scoreboard, Users, Teams)
   ============================================================================ */

(function () {
  "use strict";

  // 1. Forzar siempre el modo Cyber oscuro
  document.documentElement.setAttribute("data-theme", "cyber");
  document.documentElement.setAttribute("data-bs-theme", "dark");

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
        splitLine: { lineStyle: { color: "rgba(0, 240, 255, 0.1)" } },
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

  // 3. Limpiar el viejo bloque inline de Theme Header si el admin aún no lo borró
  function cleanupLegacyThemeHeader() {
    var legacyStyle = document.getElementById("gdg-custom-theme");
    if (legacyStyle) {
      legacyStyle.disabled = true;
    }
  }

  // 4. Efecto 3D Perspective Tilt + Specular Glare (mismo algoritmo que Open Badges)
  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function bindTiltCard(card) {
    if (prefersReducedMotion || !card || card.dataset.tiltBound === "1") return;
    card.dataset.tiltBound = "1";

    var maxTilt = Math.min(Number(card.getAttribute("data-tilt-max") || "2.2"), 2.8);
    var baseRect = null;

    card.addEventListener("pointerenter", function () {
      if (window.innerWidth < 768) return;
      card.style.transform = "";
      baseRect = card.getBoundingClientRect();
    });

    card.addEventListener("pointermove", function (e) {
      if (window.innerWidth < 768) return;
      if (!baseRect || baseRect.width === 0) {
        baseRect = card.getBoundingClientRect();
      }
      var x = e.clientX - baseRect.left;
      var y = e.clientY - baseRect.top;
      var pctX = Math.max(0, Math.min(1, x / baseRect.width));
      var pctY = Math.max(0, Math.min(1, y / baseRect.height));
      var rotateY = (pctX - 0.5) * maxTilt * 2;
      var rotateX = (0.5 - pctY) * maxTilt * 2;
      card.style.transform =
        "perspective(1200px) rotateX(" +
        rotateX.toFixed(2) +
        "deg) rotateY(" +
        rotateY.toFixed(2) +
        "deg) scale3d(1.015, 1.015, 1)";
      card.style.setProperty("--glare-x", (pctX * 100).toFixed(1) + "%");
      card.style.setProperty("--glare-y", (pctY * 100).toFixed(1) + "%");
    });

    card.addEventListener("pointerleave", function () {
      baseRect = null;
      card.style.transform = "";
    });
  }

  function scanTiltCards(root) {
    if (prefersReducedMotion) return;
    var scope = root || document;
    if (scope.matches && scope.matches(".tilt-card")) {
      bindTiltCard(scope);
    }
    var cards = scope.querySelectorAll ? scope.querySelectorAll(".tilt-card") : [];
    cards.forEach(bindTiltCard);
  }

  // 5. Marcar el enlace activo en el navbar (sin marcar nunca el root en subrutas)
  function highlightActiveNav() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var rootPath =
      (window.init && window.init.urlRoot ? window.init.urlRoot : "").replace(/\/+$/, "") || "/";

    document.querySelectorAll(".theme-header .nav-link[href]").forEach(function (link) {
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
