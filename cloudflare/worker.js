/**
 * Cloudflare Worker: GDGoC UHU Cyber Trainer Reverse Proxy
 *
 * Monta la instancia CTFd (http://188.245.96.96) bajo HTTPS en:
 *   https://gdguhu.com/cybertrainer/*
 *   https://www.gdguhu.com/cybertrainer/*
 *
 * Qué hace bajo el capó (sin necesidad de modificar APPLICATION_ROOT en el VPS):
 *  1. Redirige `/cybertrainer` → `/cybertrainer/` (301) en GET/HEAD.
 *  2. Quita el prefijo `/cybertrainer` y reenvía la petición al VPS origen.
 *  3. Reescribe cabeceras `Location` (3xx) y `Set-Cookie` (añadiendo Secure + Path=/).
 *  4. Streaming directo (sin buffering) para SSE (`/events`) y binarios/assets.
 *  5. En HTML usa `HTMLRewriter` en streaming para prefijar `href`/`src`/`action`
 *     raíz con `/cybertrainer` y reescribir `window.init.urlRoot` a `"/cybertrainer"`.
 *  6. En CSS reescribe `url(/themes/...)` y `url(/files/...)`.
 *  7. En JSON (`/api/v1/*`) prefija `account_url`, `files[]` y atributos de `view`.
 */

const PREFIX = "/cybertrainer";
const UPSTREAM_ORIGIN = "http://188.245.96.96";
const UPSTREAM_HOST = "188.245.96.96";

function shouldPrefixPath(raw) {
  if (!raw || typeof raw !== "string") return false;
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw === PREFIX || raw.startsWith(PREFIX + "/")) return false;
  // Nunca tocar rutas que pertenecen explícitamente al portal hermano Open Badges
  if (raw === "/openbadges" || raw.startsWith("/openbadges/")) return false;
  return true;
}

function prefixAttrValue(val) {
  if (!shouldPrefixPath(val)) return val;
  return PREFIX + val;
}

function rewriteMetaRefresh(content) {
  if (!content) return content;
  return content.replace(/(url\s*=\s*['"]?)(\/[^'"\s;]+)/i, (_, lead, path) => {
    return lead + prefixAttrValue(path);
  });
}

function rewriteInlineHtmlSnippet(html) {
  if (!html || typeof html !== "string") return html;
  return html.replace(
    /\b(href|src|action|formaction)=(["'])(\/[^"']*)\2/gi,
    (full, attr, quote, val) => {
      if (!shouldPrefixPath(val)) return full;
      return `${attr}=${quote}${PREFIX}${val}${quote}`;
    }
  );
}

function rewriteCssUrls(css) {
  if (!css || typeof css !== "string") return css;
  return css.replace(
    /url\(\s*(['"]?)(\/(?:themes|files|static)\/[^)'"]+)\1\s*\)/gi,
    (_, quote, path) => `url(${quote}${PREFIX}${path}${quote})`
  );
}

function rewriteApiJsonValue(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = rewriteApiJsonValue(node[i]);
    }
    return node;
  }

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (key === "account_url" && typeof val === "string") {
      node[key] = prefixAttrValue(val);
    } else if (key === "files" && Array.isArray(val)) {
      node[key] = val.map((item) => {
        if (typeof item === "string") return prefixAttrValue(item);
        if (item && typeof item === "object" && typeof item.location === "string") {
          return { ...item, location: prefixAttrValue(item.location) };
        }
        return item;
      });
    } else if (key === "view" && typeof val === "string") {
      node[key] = rewriteInlineHtmlSnippet(val);
    } else if (val && typeof val === "object") {
      rewriteApiJsonValue(val);
    }
  }
  return node;
}

function rewriteSetCookie(rawCookie) {
  const parts = rawCookie
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return rawCookie;

  const nameValue = parts[0];
  const attrs = [];
  let hasPath = false;
  let hasSecure = false;
  let hasSameSite = false;

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const lower = p.toLowerCase();
    if (lower.startsWith("domain=")) {
      // Quitar Domain del origen para que la cookie pertenezca a gdguhu.com
      continue;
    }
    if (lower.startsWith("path=")) {
      attrs.push("Path=/");
      hasPath = true;
      continue;
    }
    if (lower === "secure") {
      hasSecure = true;
      attrs.push("Secure");
      continue;
    }
    if (lower.startsWith("samesite=")) {
      hasSameSite = true;
      attrs.push(p);
      continue;
    }
    attrs.push(p);
  }

  if (!hasPath) attrs.push("Path=/");
  if (!hasSecure) attrs.push("Secure");
  if (!hasSameSite) attrs.push("SameSite=Lax");

  return [nameValue, ...attrs].join("; ");
}

function rewriteLocationHeader(rawLocation, publicUrl) {
  if (!rawLocation) return rawLocation;
  try {
    const resolved = new URL(rawLocation, UPSTREAM_ORIGIN);
    if (resolved.hostname === UPSTREAM_HOST || resolved.hostname === publicUrl.hostname) {
      const nextParam = resolved.searchParams.get("next");
      if (nextParam && (nextParam === PREFIX || nextParam.startsWith(PREFIX + "/"))) {
        resolved.searchParams.set("next", nextParam.slice(PREFIX.length) || "/");
      }
      const newPath = shouldPrefixPath(resolved.pathname)
        ? PREFIX + resolved.pathname
        : resolved.pathname;
      return `https://${publicUrl.host}${newPath}${resolved.search}${resolved.hash}`;
    }
  } catch {
    if (shouldPrefixPath(rawLocation)) {
      return PREFIX + rawLocation;
    }
  }
  return rawLocation;
}

class AttrPrefixRewriter {
  constructor(attr) {
    this.attr = attr;
  }
  element(el) {
    const val = el.getAttribute(this.attr);
    if (val && shouldPrefixPath(val)) {
      el.setAttribute(this.attr, PREFIX + val);
    }
  }
}

class MetaRefreshRewriter {
  element(el) {
    const httpEquiv = (el.getAttribute("http-equiv") || "").toLowerCase();
    if (httpEquiv === "refresh") {
      const content = el.getAttribute("content");
      if (content) el.setAttribute("content", rewriteMetaRefresh(content));
    }
  }
}

class InlineScriptRewriter {
  constructor() {
    this.active = false;
    this.buf = "";
  }
  element(el) {
    // Solo reescribir scripts inline (los externos se reescriben vía src)
    this.active = !el.hasAttribute("src");
    this.buf = "";
  }
  text(chunk) {
    if (!this.active) return;
    this.buf += chunk.text;
    if (chunk.lastInTextNode) {
      const rewritten = this.buf.replace(
        /(['"])urlRoot\1\s*:\s*""/g,
        `'urlRoot': "${PREFIX}"`
      );
      chunk.replace(rewritten, { html: true });
      this.buf = "";
      this.active = false;
    } else if (this.buf.length < 131072) {
      chunk.remove();
    } else {
      // Salvaguarda para scripts inline muy grandes
      chunk.replace(this.buf, { html: true });
      this.buf = "";
      this.active = false;
    }
  }
}

class InlineStyleRewriter {
  constructor() {
    this.buf = "";
  }
  element() {
    this.buf = "";
  }
  text(chunk) {
    this.buf += chunk.text;
    if (chunk.lastInTextNode) {
      chunk.replace(rewriteCssUrls(this.buf), { html: true });
      this.buf = "";
    } else if (this.buf.length < 131072) {
      chunk.remove();
    } else {
      chunk.replace(this.buf, { html: true });
      this.buf = "";
    }
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Redirección canónica: /cybertrainer → /cybertrainer/ (solo GET/HEAD)
    if (url.pathname === PREFIX && (request.method === "GET" || request.method === "HEAD")) {
      return Response.redirect(`https://${url.host}${PREFIX}/${url.search}`, 301);
    }

    // Quitar prefijo /cybertrainer para el origen CTFd
    const upstreamPath = url.pathname.startsWith(PREFIX)
      ? url.pathname.slice(PREFIX.length) || "/"
      : url.pathname;

    const upstreamUrl = new URL(upstreamPath + url.search, UPSTREAM_ORIGIN);

    // Si viene ?next=/cybertrainer/..., normalizarlo a /... para evitar doble prefijo al redirigir CTFd
    const nextParam = upstreamUrl.searchParams.get("next");
    if (nextParam && (nextParam === PREFIX || nextParam.startsWith(PREFIX + "/"))) {
      upstreamUrl.searchParams.set("next", nextParam.slice(PREFIX.length) || "/");
    }

    // Construir cabeceras hacia el VPS origen
    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete("host");
    reqHeaders.delete("cf-connecting-ip");
    reqHeaders.delete("cf-ray");
    reqHeaders.delete("cf-visitor");
    reqHeaders.set("X-Forwarded-Proto", "https");
    reqHeaders.set("X-Forwarded-Host", url.host);
    reqHeaders.set("X-Forwarded-Prefix", PREFIX);

    const referer = reqHeaders.get("referer");
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.hostname === url.hostname && refUrl.pathname.startsWith(PREFIX)) {
          const strippedRef = refUrl.pathname.slice(PREFIX.length) || "/";
          reqHeaders.set("Referer", `${UPSTREAM_ORIGIN}${strippedRef}${refUrl.search}`);
        }
      } catch {
        // mantener referer original si no es parseable
      }
    }

    const origin = reqHeaders.get("origin");
    if (origin && origin === `https://${url.host}`) {
      reqHeaders.set("Origin", UPSTREAM_ORIGIN);
    }

    const init = {
      method: request.method,
      headers: reqHeaders,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    let upstreamResp;
    try {
      upstreamResp = await fetch(upstreamUrl.toString(), init);
    } catch (err) {
      return new Response(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cyber Trainer · Servicio temporalmente no disponible</title></head>` +
          `<body style="background:#05070F;color:#E2F1FF;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">` +
          `<div style="max-width:520px;border:1px solid rgba(0,240,255,.35);border-radius:20px;padding:32px;background:#0B1124">` +
          `<h1 style="margin:0 0 12px;font-size:1.5rem;color:#00F0FF">GDGoC UHU Cyber Trainer</h1>` +
          `<p style="margin:0 0 20px;color:#94A3B8">No se ha podido conectar con el servidor de retos en este momento. Inténtalo de nuevo en unos segundos.</p>` +
          `<a href="https://gdguhu.com/" style="display:inline-block;padding:10px 22px;border-radius:999px;background:#00F0FF;color:#05070F;font-weight:700;text-decoration:none">Volver a gdguhu.com</a>` +
          `</div></body></html>`,
        {
          status: 502,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        }
      );
    }

    // Copiar cabeceras de respuesta y reescribir Location y Set-Cookie
    const respHeaders = new Headers(upstreamResp.headers);
    const setCookies =
      typeof upstreamResp.headers.getSetCookie === "function"
        ? upstreamResp.headers.getSetCookie()
        : [];
    if (setCookies.length > 0) {
      respHeaders.delete("set-cookie");
      for (const cookie of setCookies) {
        respHeaders.append("Set-Cookie", rewriteSetCookie(cookie));
      }
    }

    const location = respHeaders.get("location");
    if (location) {
      respHeaders.set("Location", rewriteLocationHeader(location, url));
    }

    const contentType = (respHeaders.get("content-type") || "").toLowerCase();

    // 1. SSE (/events): streaming directo SIN buffering
    if (contentType.includes("text/event-stream") || upstreamPath === "/events") {
      respHeaders.set("Cache-Control", "no-cache, no-transform");
      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    }

    // 2. Respuestas HTML: HTMLRewriter en streaming
    if (contentType.includes("text/html")) {
      respHeaders.delete("content-length");
      respHeaders.delete("content-encoding");
      const baseResp = new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });

      return new HTMLRewriter()
        .on("a[href]", new AttrPrefixRewriter("href"))
        .on("area[href]", new AttrPrefixRewriter("href"))
        .on("link[href]", new AttrPrefixRewriter("href"))
        .on("script[src]", new AttrPrefixRewriter("src"))
        .on("img[src]", new AttrPrefixRewriter("src"))
        .on("source[src]", new AttrPrefixRewriter("src"))
        .on("iframe[src]", new AttrPrefixRewriter("src"))
        .on("audio[src]", new AttrPrefixRewriter("src"))
        .on("video[src]", new AttrPrefixRewriter("src"))
        .on("embed[src]", new AttrPrefixRewriter("src"))
        .on("form[action]", new AttrPrefixRewriter("action"))
        .on("button[formaction]", new AttrPrefixRewriter("formaction"))
        .on("input[formaction]", new AttrPrefixRewriter("formaction"))
        .on("meta[http-equiv]", new MetaRefreshRewriter())
        .on("script", new InlineScriptRewriter())
        .on("style", new InlineStyleRewriter())
        .transform(baseResp);
    }

    // 3. Hojas de estilo CSS: reescribir url(/themes/...) y url(/files/...)
    if (contentType.includes("text/css")) {
      const cssText = await upstreamResp.text();
      respHeaders.delete("content-length");
      respHeaders.delete("content-encoding");
      return new Response(rewriteCssUrls(cssText), {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    }

    // 4. Respuestas JSON de la API (/api/v1/*): reescribir rutas internas (account_url, files, view)
    if (contentType.includes("application/json") && upstreamPath.startsWith("/api/")) {
      const rawJson = await upstreamResp.text();
      respHeaders.delete("content-length");
      respHeaders.delete("content-encoding");
      try {
        const parsed = JSON.parse(rawJson);
        const rewritten = rewriteApiJsonValue(parsed);
        return new Response(JSON.stringify(rewritten), {
          status: upstreamResp.status,
          statusText: upstreamResp.statusText,
          headers: respHeaders,
        });
      } catch {
        return new Response(rawJson, {
          status: upstreamResp.status,
          statusText: upstreamResp.statusText,
          headers: respHeaders,
        });
      }
    }

    // 5. Resto de recursos (JS, fuentes, imágenes, archivos de retos): streaming directo
    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  },
};
