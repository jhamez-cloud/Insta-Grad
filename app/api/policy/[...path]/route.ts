import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ path: string[] }> }

const ROUTES: Array<{ pattern: RegExp; methods: string[]; admin?: boolean }> = [
  { pattern: /^root$/, methods: ["GET"] },
  { pattern: /^health$/, methods: ["GET"] },
  { pattern: /^openapi\.json$/, methods: ["GET"] },
  { pattern: /^query$/, methods: ["POST"] },
  { pattern: /^documents$/, methods: ["GET"] },
  { pattern: /^documents\/upload$/, methods: ["POST"], admin: true },
  { pattern: /^documents\/[1-9]\d*$/, methods: ["GET", "DELETE"], admin: true },
  { pattern: /^libraries$/, methods: ["GET", "POST"], admin: true },
  {
    pattern: /^libraries\/[1-9]\d*$/,
    methods: ["GET", "PATCH", "DELETE"],
    admin: true,
  },
  {
    pattern: /^libraries\/[1-9]\d*\/documents$/,
    methods: ["GET", "POST", "DELETE"],
    admin: true,
  },
  {
    pattern: /^libraries\/[1-9]\d*\/documents\/[1-9]\d*$/,
    methods: ["DELETE"],
    admin: true,
  },
  { pattern: /^sessions$/, methods: ["GET", "POST"] },
  { pattern: /^sessions\/[1-9]\d*$/, methods: ["GET", "PATCH", "DELETE"] },
]

function failure(
  status: number,
  detail: string,
  extraHeaders: Record<string, string> = {}
) {
  return Response.json(
    { detail },
    { status, headers: { "Cache-Control": "no-store", ...extraHeaders } }
  )
}

function localUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return null
    if (url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

async function forward(request: NextRequest, context: Context) {
  const { path } = await context.params
  const routePath = path.join("/")
  const route = ROUTES.find((entry) => entry.pattern.test(routePath))
  if (!route) return failure(404, "Unknown policy API endpoint.")
  if (!route.methods.includes(request.method))
    return failure(405, "Method not supported for this endpoint.", {
      Allow: route.methods.join(", "),
    })

  const originValues = (
    process.env.POLICY_ALLOWED_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((value) => value.trim())
  const origins = originValues.map(localUrl)
  if (origins.some((origin) => origin === null))
    return failure(503, "Configure valid local frontend origins.")
  const allowedOrigins = new Set(origins.map((origin) => origin!.origin))
  const origin = request.headers.get("origin")
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method)
  if (
    (origin && !allowedOrigins.has(origin)) ||
    (isMutation && !origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return failure(
      403,
      "This request must come from an allowed local frontend origin."
    )
  }

  const backend = localUrl(
    process.env.POLICY_API_URL || "http://127.0.0.1:8000"
  )
  if (!backend || backend.pathname !== "/" || backend.search || backend.hash)
    return failure(503, "Configure a valid local policy service URL.")
  const targetPath =
    routePath === "health"
      ? "/health"
      : routePath === "openapi.json"
        ? "/openapi.json"
        : routePath === "root"
          ? "/api/v1/"
          : `/api/v1/${routePath}`
  const target = new URL(targetPath, backend)
  target.search = request.nextUrl.search

  const headers = new Headers({ Accept: "application/json" })
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)
  if (isMutation && route.admin) {
    const key = process.env.POLICY_ADMIN_API_KEY
    if (!key)
      return failure(
        503,
        "The local policy admin API key is not configured on the frontend server."
      )
    headers.set("X-API-Key", key)
  }

  const configuredTimeout = Number(process.env.POLICY_API_TIMEOUT_MS || 90000)
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 90000
  const timeout = AbortSignal.timeout(timeoutMs)
  try {
    const body =
      isMutation && request.body ? await request.arrayBuffer() : undefined
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, timeout]),
    })
    if (upstream.status >= 300 && upstream.status < 400)
      return failure(502, "The policy service returned an unexpected redirect.")
    const responseHeaders = new Headers({ "Cache-Control": "no-store" })
    const responseType = upstream.headers.get("content-type")
    if (responseType) responseHeaders.set("Content-Type", responseType)
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    if (request.signal.aborted)
      return failure(499, "The request was cancelled.")
    if (timeout.aborted)
      return failure(504, "The policy request timed out. Please try again.")
    return failure(
      502,
      "Could not reach the local policy service. Start the backend on its configured port."
    )
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE }
