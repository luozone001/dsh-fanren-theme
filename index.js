/**
 * Host half of the 凡人·朱煞 theme bundle.
 *
 * It owns exactly one job: stream the bundled wallpaper video (and its poster)
 * to the authenticated Web page, with HTTP Range support so the browser can
 * seek and start playing before the whole 19 MB file has arrived. Everything
 * visual lives in `client.js`.
 *
 * Two exact routes are registered under `/fanren-theme/`; both are read-only:
 *
 *   GET /fanren-theme/wallpaper.mp4   the 1080p30, audio-less wallpaper video
 *   GET /fanren-theme/poster.jpg      its first-paint poster (JPEG)
 *   GET /fanren-theme/status          small JSON diagnostic for troubleshooting
 *
 * Both file routes answer `HEAD`, honour `Range` (single range) and
 * `If-None-Match`, and never expose a path outside this package.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))
const ROUTE_PREFIX = '/fanren-theme'
const PLUGIN_ID = '@local/fanren-theme'
const PLUGIN_VERSION = '1.0.0'

/** Last state report a browser sent through the status route (diagnostics only, never parsed as input). */
let clientReport = null

/** Every servable file, keyed by its exact pathname. */
const FILES = new Map([
  [`${ROUTE_PREFIX}/wallpaper.mp4`, {
    path: join(PACKAGE_DIR, 'assets', 'fanren-wallpaper.mp4'),
    type: 'video/mp4',
  }],
  [`${ROUTE_PREFIX}/poster.jpg`, {
    path: join(PACKAGE_DIR, 'assets', 'fanren-poster.jpg'),
    type: 'image/jpeg',
  }],
])

/** Write a small plain-text response. */
function sendText(response, status, text, headers = {}) {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  response.end(text)
}

/**
 * Parse one `Range` header against a known size.
 * @returns null for an absent header, `{ invalid: true }` for one we refuse
 *   (416), or the inclusive byte window to serve.
 */
function parseRange(header, size) {
  if (typeof header !== 'string' || header === '') return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null) return { invalid: true }
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return { invalid: true }
  let start
  let end
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true }
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(rawStart)
    if (!Number.isFinite(start) || !Number.isInteger(start)) return { invalid: true }
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  }
  if (start >= size || end < start) return { invalid: true }
  return { start, end }
}

/** Build the Node handler for one file entry. */
function createFileHandler(entry) {
  return async function handleFile(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'method not allowed', { allow: 'GET, HEAD' })
      return
    }
    let info
    try {
      info = await stat(entry.path)
    } catch {
      sendText(response, 404, `fanren-theme: wallpaper asset is missing at ${entry.path}`)
      return
    }
    if (!info.isFile()) {
      sendText(response, 404, 'fanren-theme: wallpaper asset is not a regular file')
      return
    }
    const etag = `"fanren-${info.size}-${Math.round(info.mtimeMs)}"`
    const headers = {
      'content-type': entry.type,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=86400',
      etag,
      'last-modified': info.mtime.toUTCString(),
      'x-content-type-options': 'nosniff',
    }
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, { etag, 'cache-control': headers['cache-control'] })
      response.end()
      return
    }
    const range = parseRange(request.headers.range, info.size)
    if (range !== null && range.invalid === true) {
      response.writeHead(416, {
        'content-range': `bytes */${info.size}`,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      })
      response.end()
      return
    }
    const start = range === null ? 0 : range.start
    const end = range === null ? info.size - 1 : range.end
    response.writeHead(range === null ? 200 : 206, {
      ...headers,
      'content-length': String(end - start + 1),
      ...(range === null ? {} : { 'content-range': `bytes ${start}-${end}/${info.size}` }),
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const stream = createReadStream(entry.path, { start, end })
    stream.on('error', () => { response.destroy() })
    response.on('close', () => { stream.destroy() })
    stream.pipe(response)
  }
}

/** Store the short client-state report a page sends via `?report=1` (diagnostics only). */
function acceptClientReport(url) {
  const pick = (name) => {
    const value = url.searchParams.get(name)
    return typeof value === 'string' ? value.slice(0, 64) : undefined
  }
  clientReport = {
    at: new Date().toISOString(),
    theme: pick('theme'),
    palette: pick('palette'),
    wallpaper: pick('wallpaper'),
    mounted: pick('mounted'),
    video: pick('video'),
    viewport: pick('viewport'),
  }
}

/** Small read-only diagnostic: which assets exist, how large they are, and what the page last reported. */
async function handleStatus(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'method not allowed', { allow: 'GET, HEAD' })
    return
  }
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (request.method === 'GET' && url.searchParams.get('report') === '1') {
    acceptClientReport(url)
    response.writeHead(204, { 'cache-control': 'no-store' })
    response.end()
    return
  }
  const files = {}
  for (const [pathname, entry] of FILES) {
    try {
      const info = await stat(entry.path)
      files[pathname] = { present: info.isFile(), bytes: info.size }
    } catch {
      files[pathname] = { present: false }
    }
  }
  const body = JSON.stringify({
    ok: Object.values(files).every(file => file.present === true),
    plugin: PLUGIN_ID,
    version: PLUGIN_VERSION,
    theme: 'fanren',
    files,
    client: clientReport,
  }, null, 2)
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body)),
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}

/**
 * Host plugin body: register the three read-only routes while a Web carrier
 * exists. On a host without `webServer` (a pure file-mode shell) the plugin
 * stays inert and the Client half degrades to the colour theme alone.
 * @param ctx - Host Cordis context.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (scope) => {
    scope.effect(
      () => scope.webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/wallpaper.mp4`,
        handler: createFileHandler(FILES.get(`${ROUTE_PREFIX}/wallpaper.mp4`)),
      }),
      'fanren-theme: wallpaper.mp4 route',
    )
    scope.effect(
      () => scope.webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/poster.jpg`,
        handler: createFileHandler(FILES.get(`${ROUTE_PREFIX}/poster.jpg`)),
      }),
      'fanren-theme: poster.jpg route',
    )
    scope.effect(
      () => scope.webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/status`,
        handler: handleStatus,
      }),
      'fanren-theme: status route',
    )
  })
}
