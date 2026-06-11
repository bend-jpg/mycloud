// Serveur WebDAV LOCAL (127.0.0.1) — le pont entre l'Explorateur Windows
// et le cloud MyTitanCloud.
//
// POURQUOI : Next.js/Vercel ne route pas la méthode HTTP PROPFIND, donc
// Windows ne peut pas monter https://mytitancloud.com/api/dav directement
// (erreurs système 67/1920 systématiques). À la place, ce mini serveur
// tourne DANS l'app Electron, parle WebDAV avec Windows en local, et
// traduit chaque opération en appels REST vers le cloud avec le cookie
// de session du webview :
//
//   PROPFIND  →  GET /api/dav-list?path=...        (listing JSON)
//   GET/HEAD  →  GET /api/dav/<path>               (redirect signé R2, suivi)
//   PUT       →  POST /api/files/upload-url + PUT signé + POST complete
//   DELETE    →  DELETE /api/files/<id>
//   MKCOL     →  POST /api/folders
//   LOCK/UNLOCK → faux lock local (suffisant pour l'Explorateur/Office)
//
// Sécurité : bind 127.0.0.1 UNIQUEMENT — rien d'exposé au réseau. Pas
// d'auth locale nécessaire (seul l'utilisateur de la machine y accède).

const http = require("http");

const PORT = 42042;

let cloudBase = "https://mytitancloud.com";
let cookieHeader = ""; // session du webview, rafraîchie par main.js
let server = null;

// Token secret par session d'app : le disque se monte sur
// http://127.0.0.1:42042/<token>/ — toute requête sans le bon premier
// segment est rejetée. Empêche un autre processus/utilisateur local (ou une
// attaque DNS-rebinding) d'accéder au cloud via le proxy sans connaître le
// token, qui n'existe qu'en mémoire de l'app.
let pathToken = null;
function setToken(t) {
  pathToken = t || null;
}

// Cache path→folderId pour les PUT/MKCOL (rempli par les listings)
const folderIdByPath = new Map(); // "" = racine → null
folderIdByPath.set("", null);

function setCookie(cookie) {
  cookieHeader = cookie || "";
}
function setCloudBase(url) {
  cloudBase = url.replace(/\/$/, "");
}

function cloudFetch(path, init = {}) {
  return fetch(`${cloudBase}${path}`, {
    ...init,
    headers: { cookie: cookieHeader, ...(init.headers || {}) },
  });
}

// --- Helpers XML -------------------------------------------------------

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function davHref(p, isDir) {
  // Les hrefs renvoyés à Windows doivent inclure le préfixe token — c'est
  // avec ces chemins que l'Explorateur adresse ensuite chaque fichier.
  const base = pathToken ? `/${pathToken}` : "";
  const segs = String(p === "/" ? "" : p).split("/").filter(Boolean).map(encodeURIComponent);
  let href = segs.length ? `${base}/${segs.join("/")}` : `${base}/`;
  if (isDir && !href.endsWith("/")) href += "/";
  return href;
}

function propfindEntry({ path, isDir, size, mtime, mime, displayName }) {
  const href = davHref(path, isDir);
  const date = new Date(mtime || Date.now()).toUTCString();
  return `<D:response>
<D:href>${href === "/" ? "/" : href}</D:href>
<D:propstat><D:prop>
<D:displayname>${xmlEscape(displayName ?? path.split("/").filter(Boolean).pop() ?? "")}</D:displayname>
<D:resourcetype>${isDir ? "<D:collection/>" : ""}</D:resourcetype>
${isDir ? "" : `<D:getcontentlength>${size ?? 0}</D:getcontentlength>`}
${isDir ? "" : `<D:getcontenttype>${xmlEscape(mime || "application/octet-stream")}</D:getcontenttype>`}
<D:getlastmodified>${date}</D:getlastmodified>
<D:supportedlock/>
</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
</D:response>`;
}

function multistatus(entries) {
  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${entries.join("\n")}
</D:multistatus>`;
}

// --- Handlers ----------------------------------------------------------

function pathFromUrl(reqUrl) {
  // Windows envoie des chemins URL-encodés ; on décode segment par segment
  const clean = decodeURIComponent(reqUrl.split("?")[0]).replace(/\/+$/, "");
  return clean.replace(/^\/+/, ""); // "" = racine
}

async function handlePropfind(req, res, path) {
  const depth = (req.headers.depth ?? "1") === "0" ? 0 : 1;
  const r = await cloudFetch(`/api/dav-list?path=${encodeURIComponent(path)}`);
  if (r.status === 401) return sendStatus(res, 401, { "WWW-Authenticate": 'Basic realm="MyTitanCloud"' });
  if (r.status === 404) return sendStatus(res, 404);
  if (!r.ok) return sendStatus(res, 502);

  const data = await r.json();
  const entries = [];

  if (data.type === "file") {
    entries.push(
      propfindEntry({
        path,
        isDir: false,
        size: data.file.size,
        mtime: data.file.uploadedAt,
        mime: data.file.mimeType,
        displayName: data.file.name,
      }),
    );
  } else {
    folderIdByPath.set(path, data.folderId ?? null);
    entries.push(
      propfindEntry({
        path: path || "/",
        isDir: true,
        mtime: Date.now(),
        displayName: path.split("/").filter(Boolean).pop() ?? "MyTitanCloud",
      }),
    );
    if (depth >= 1) {
      for (const f of data.folders) {
        const childPath = path ? `${path}/${f.name}` : f.name;
        folderIdByPath.set(childPath, f.id);
        entries.push(propfindEntry({ path: childPath, isDir: true, mtime: f.updatedAt, displayName: f.name }));
      }
      for (const f of data.files) {
        const childPath = path ? `${path}/${f.name}` : f.name;
        entries.push(
          propfindEntry({
            path: childPath,
            isDir: false,
            size: f.size,
            mtime: f.uploadedAt,
            mime: f.mimeType,
            displayName: f.name,
          }),
        );
      }
    }
  }

  const xml = multistatus(entries);
  res.writeHead(207, { "Content-Type": 'application/xml; charset="utf-8"', "Content-Length": Buffer.byteLength(xml) });
  res.end(xml);
}

async function handleGet(req, res, path, headOnly) {
  // Le GET cloud renvoie un redirect vers une URL signée R2 — fetch le suit
  // automatiquement et on streame le résultat vers l'Explorateur.
  const r = await cloudFetch(`/api/dav/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: headOnly ? "HEAD" : "GET",
  });
  if (!r.ok) return sendStatus(res, r.status === 401 ? 401 : 404);

  const headers = {
    "Content-Type": r.headers.get("content-type") || "application/octet-stream",
  };
  const len = r.headers.get("content-length");
  if (len) headers["Content-Length"] = len;
  res.writeHead(200, headers);
  if (headOnly || !r.body) return res.end();

  // Stream web → Node
  const reader = r.body.getReader();
  const pump = () =>
    reader.read().then(({ done, value }) => {
      if (done) return res.end();
      res.write(Buffer.from(value));
      return pump();
    });
  pump().catch(() => res.end());
}

async function resolveFolderId(path) {
  // Trouve le folderId du dossier parent (en re-listant si pas en cache)
  if (folderIdByPath.has(path)) return folderIdByPath.get(path);
  const r = await cloudFetch(`/api/dav-list?path=${encodeURIComponent(path)}`);
  if (!r.ok) return undefined;
  const data = await r.json();
  if (data.type !== "folder") return undefined;
  folderIdByPath.set(path, data.folderId ?? null);
  return data.folderId ?? null;
}

async function handlePut(req, res, path) {
  const segments = path.split("/").filter(Boolean);
  const name = segments.pop();
  const parentPath = segments.join("/");
  if (!name) return sendStatus(res, 400);

  // Windows écrit des fichiers temporaires/métadonnées — on les refuse poliment
  if (/^(desktop\.ini|thumbs\.db|~\$|\.tmp$)/i.test(name)) return sendStatus(res, 403);

  const folderId = await resolveFolderId(parentPath);
  if (folderId === undefined) return sendStatus(res, 409); // parent inconnu

  // Buffer le body (limite 2 Go en RAM ? non — on cap à 500 Mo pour le drive)
  const chunks = [];
  let total = 0;
  const MAX = 500 * 1024 * 1024;
  await new Promise((resolve, reject) => {
    req.on("data", (c) => {
      total += c.length;
      if (total > MAX) {
        reject(new Error("TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", resolve);
    req.on("error", reject);
  }).catch((e) => {
    if (e.message === "TOO_LARGE") {
      sendStatus(res, 413);
      throw e;
    }
    throw e;
  });
  const body = Buffer.concat(chunks);
  const mime = req.headers["content-type"] || "application/octet-stream";

  // 1. Demande URL signée
  const initRes = await cloudFetch("/api/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size: body.length, mimeType: mime, folderId, teamId: null }),
  });
  if (!initRes.ok) return sendStatus(res, initRes.status === 401 ? 401 : 502);
  const init = await initRes.json();

  // 2. PUT vers le storage
  const putRes = await fetch(init.uploadUrl, {
    method: init.method || "PUT",
    body,
    headers: { "Content-Type": mime, ...(init.headers || {}) },
  });
  if (!putRes.ok) return sendStatus(res, 502);

  // 3. Complete (quota, notifications, versioning)
  await cloudFetch(`/api/files/${init.fileId}/complete`, { method: "POST" });

  sendStatus(res, 201);
}

async function handleDelete(req, res, path) {
  // Trouve l'id du fichier via le listing du parent
  const segments = path.split("/").filter(Boolean);
  const name = segments.pop();
  const parentPath = segments.join("/");
  const r = await cloudFetch(`/api/dav-list?path=${encodeURIComponent(parentPath)}`);
  if (!r.ok) return sendStatus(res, 404);
  const data = await r.json();
  if (data.type !== "folder") return sendStatus(res, 404);
  const file = data.files.find((f) => f.name === name);
  if (!file) return sendStatus(res, 404); // V1 : pas de suppression de dossiers depuis Z:
  const del = await cloudFetch(`/api/files/${file.id}`, { method: "DELETE" });
  sendStatus(res, del.ok ? 204 : 502);
}

async function handleMkcol(req, res, path) {
  const segments = path.split("/").filter(Boolean);
  const name = segments.pop();
  const parentPath = segments.join("/");
  if (!name) return sendStatus(res, 400);
  const parentId = await resolveFolderId(parentPath);
  if (parentId === undefined) return sendStatus(res, 409);
  const r = await cloudFetch("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parentId, teamId: null }),
  });
  sendStatus(res, r.ok ? 201 : 502);
}

function sendStatus(res, code, headers = {}) {
  res.writeHead(code, { "Content-Length": "0", ...headers });
  res.end();
}

// --- Serveur -----------------------------------------------------------

function start({ base, onLog } = {}) {
  if (server) return PORT;
  if (base) setCloudBase(base);
  const log = onLog || (() => {});

  server = http.createServer(async (req, res) => {
    const method = req.method.toUpperCase();

    // Anti DNS-rebinding : seul un Host local légitime est accepté. Un site
    // malveillant dont le domaine résout vers 127.0.0.1 enverrait son propre
    // Host — rejeté ici.
    const host = (req.headers.host || "").toLowerCase();
    if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
      return sendStatus(res, 403);
    }

    let path = pathFromUrl(req.url || "/");

    // Validation du token secret (premier segment du chemin)
    if (pathToken) {
      const segs = path.split("/").filter(Boolean);
      if (segs[0] !== pathToken) return sendStatus(res, 404);
      path = segs.slice(1).join("/");
    }

    try {
      if (method === "OPTIONS") {
        res.writeHead(200, {
          Allow: "OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, LOCK, UNLOCK",
          DAV: "1, 2",
          "MS-Author-Via": "DAV",
          "Content-Length": "0",
        });
        return res.end();
      }
      if (method === "PROPFIND") return await handlePropfind(req, res, path);
      if (method === "GET" || method === "HEAD") return await handleGet(req, res, path, method === "HEAD");
      if (method === "PUT") return await handlePut(req, res, path);
      if (method === "DELETE") return await handleDelete(req, res, path);
      if (method === "MKCOL") return await handleMkcol(req, res, path);
      if (method === "LOCK") {
        // Faux lock — suffisant pour l'Explorateur et la plupart des apps
        const token = `opaquelocktoken:${Date.now().toString(36)}`;
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:"><D:lockdiscovery><D:activelock>
<D:locktype><D:write/></D:locktype><D:lockscope><D:exclusive/></D:lockscope>
<D:depth>0</D:depth><D:timeout>Second-3600</D:timeout>
<D:locktoken><D:href>${token}</D:href></D:locktoken>
</D:activelock></D:lockdiscovery></D:prop>`;
        res.writeHead(200, { "Content-Type": 'application/xml; charset="utf-8"', "Lock-Token": `<${token}>` });
        return res.end(xml);
      }
      if (method === "UNLOCK") return sendStatus(res, 204);
      if (method === "PROPPATCH") {
        // On accepte sans rien faire (Windows pose des dates) — 207 vide OK
        const xml = multistatus([]);
        res.writeHead(207, { "Content-Type": 'application/xml; charset="utf-8"' });
        return res.end(xml);
      }
      sendStatus(res, 405, { Allow: "OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL" });
    } catch (err) {
      log(`[webdav-proxy] ${method} /${path} → ${err.message}`);
      if (!res.headersSent) sendStatus(res, 500);
    }
  });

  server.listen(PORT, "127.0.0.1", () => log(`[webdav-proxy] écoute sur http://127.0.0.1:${PORT}`));
  server.on("error", (e) => log(`[webdav-proxy] erreur serveur: ${e.message}`));
  return PORT;
}

function stop() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { start, stop, setCookie, setCloudBase, setToken, PORT };
