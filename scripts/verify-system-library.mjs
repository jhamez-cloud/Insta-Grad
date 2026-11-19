import assert from "node:assert/strict"

const { chromium } = await import(
  process.env.INTEGRATION_PLAYWRIGHT_MODULE || "playwright-core"
)
const base = process.env.INTEGRATION_APP_URL || "http://127.0.0.1:3000"
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
const browser = await chromium.launch({
  ...(process.env.INTEGRATION_CHROME_PATH
    ? { executablePath: process.env.INTEGRATION_CHROME_PATH }
    : { channel: "chrome" }),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
})
const page = await context.newPage()
const errors = []
const diagnostics = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("console", (message) => {
  if (message.type() === "error") diagnostics.push(message.text().slice(0, 500))
})
page.on("requestfailed", (request) =>
  diagnostics.push(`${request.url()}: ${request.failure()?.errorText}`)
)
const cleanup = {
  libraries: new Set(),
  documents: new Set(),
  sessions: new Set(),
}
const checks = []
async function api(path, method = "GET", data, expected = 200, multipart) {
  const response = await context.request.fetch(`${base}/api/policy/${path}`, {
    method,
    headers: { Origin: base },
    data,
    multipart,
    timeout: 30000,
  })
  assert.equal(
    response.status(),
    expected,
    `${method} ${path}: ${await response.text()}`
  )
  return expected === 204 ? undefined : response.json()
}
async function all(path) {
  const items = []
  for (let offset = 0; ;) {
    const result = await api(`${path}?limit=100&offset=${offset}`)
    items.push(...result.items)
    offset += result.items.length
    if (offset >= result.total || !result.items.length) return items
  }
}
async function send(question) {
  await page
    .getByRole("textbox", { name: "Prompt", exact: true })
    .fill(question)
  await page.getByRole("button", { name: "Send", exact: true }).click()
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  )
}
const badges = page.locator("button[data-query-failure]")
try {
  assert.equal((await api("health")).database, true)
  const libraries = await all("libraries")
  const systemLibraries = libraries.filter((library) => library.is_system)
  assert.equal(systemLibraries.length, 1)
  const system = systemLibraries[0]
  assert.equal(system.name, "Software policy")
  const documents = await all("documents")
  const seeds = documents.filter((document) => document.source === "seed")
  assert.ok(
    seeds.length,
    "Expected project seed policies in the running backend"
  )
  assert.ok(seeds.every((document) => document.library_id === system.id))
  const policyDocuments = await all(`libraries/${system.id}/documents`)
  assert.deepEqual(
    new Set(policyDocuments.map((document) => document.id)),
    new Set(seeds.map((document) => document.id))
  )
  checks.push(`one built-in library with all ${seeds.length} seeded documents`)

  const tag = `system-regression-${crypto.randomUUID().slice(0, 8)}`
  const custom = await api("libraries", "POST", { name: tag }, 201)
  cleanup.libraries.add(custom.id)
  assert.equal(custom.is_system, false)
  const upload = await api("documents/upload", "POST", undefined, 201, {
    library_id: String(custom.id),
    files: {
      name: `${tag}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(
        `# ${tag}\n\nTemporary evidence for library protection checks.`
      ),
    },
  })
  const document = upload.results[0].document
  cleanup.documents.add(document.id)
  const seedId = seeds[0].id
  await api(
    `libraries/${system.id}`,
    "PATCH",
    { name: "Forbidden rename" },
    403
  )
  await api(`libraries/${system.id}`, "DELETE", undefined, 403)
  await api(
    `libraries/${system.id}/documents`,
    "POST",
    { document_ids: [document.id] },
    403
  )
  await api(
    `libraries/${system.id}/documents`,
    "DELETE",
    { document_ids: [seedId] },
    403
  )
  await api(
    `libraries/${system.id}/documents/${seedId}`,
    "DELETE",
    undefined,
    403
  )
  await api(
    `libraries/${custom.id}/documents`,
    "POST",
    { document_ids: [document.id, seedId] },
    403
  )
  await api(`documents/${seedId}`, "DELETE", undefined, 403)
  await api("documents/upload", "POST", undefined, 403, {
    library_id: String(system.id),
    files: {
      name: "forbidden.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(`# ${tag}\n\nCannot add this to project policies.`),
    },
  })
  assert.equal((await api(`libraries/${system.id}`)).name, system.name)
  assert.equal((await api(`documents/${seedId}`)).library_id, system.id)
  assert.equal((await api(`documents/${document.id}`)).library_id, custom.id)
  checks.push(
    "system rename, delete, upload, membership changes and seed deletion blocked through real API"
  )

  await page.goto(`${base}/dashboard`)
  await page.locator(`[data-library-row="${system.id}"] a`).waitFor()
  assert.equal(
    await page
      .getByRole("button", { name: "Actions for Software policy", exact: true })
      .count(),
    0
  )
  await page.goto(`${base}/libraries/${system.id}/documents`)
  await page
    .getByText("Built-in · Read-only", { exact: true })
    .first()
    .waitFor()
  assert.equal(
    await page
      .getByRole("button", {
        name: /Delete from corpus|Remove from library|Assign existing documents|Upload documents/,
      })
      .count(),
    0
  )
  assert.equal(await page.locator("input[type=file]").count(), 0)
  assert.equal(await page.getByRole("checkbox").count(), 0)
  await noOverflow()
  await page.screenshot({
    path: "/tmp/instagrad-system-library-desktop.png",
    fullPage: true,
  })
  checks.push(
    "built-in library visible on page load with read-only document controls"
  )

  await page.goto(`${base}/sessions`)
  await page.locator("#new-session-library:not(:disabled)").waitFor()
  assert.match(
    await page.locator("#new-session-library").innerText(),
    /Software policy/
  )
  await page.goto(`${base}/documents`)
  await page
    .getByRole("button", { name: seeds[0].title, exact: true })
    .waitFor()
  const seedRow = page.locator("li").filter({
    has: page.getByRole("button", { name: seeds[0].title, exact: true }),
  })
  assert.equal(
    await seedRow
      .getByRole("button", { name: "Delete from corpus", exact: true })
      .count(),
    0
  )
  checks.push(
    "new sessions default to system library and global policy rows have no delete control"
  )

  const session = await api("sessions", "POST", { library_id: custom.id }, 201)
  cleanup.sessions.add(session.id)
  await page.goto(`${base}/libraries/${custom.id}?session=${session.id}`)
  await page.locator("#chat-session").waitFor()
  const failCases = [
    {
      kind: "unavailable",
      status: 503,
      detail: "The answer service is unavailable. Please try again.",
      question: "Why is the service unavailable?",
    },
    {
      kind: "timeout",
      status: 504,
      detail: "The policy request timed out. Please try again.",
      question: "Why did the request time out?",
    },
    {
      kind: "response_failed",
      contentType: "application/json",
      body: "invalid-json",
      question: "Why could the response not load?",
    },
    {
      kind: "response_failed",
      answer: "",
      question: "Why did the response arrive empty?",
    },
    {
      kind: "unavailable",
      abort: true,
      question: "What happens when the network fails?",
    },
  ]
  for (const [index, failure] of failCases.entries()) {
    await page.route("**/api/policy/query", async (route) => {
      if (failure.abort) return route.abort("failed")
      if (failure.body)
        return route.fulfill({
          status: 200,
          contentType: failure.contentType,
          body: failure.body,
        })
      if (failure.status)
        return route.fulfill({
          status: failure.status,
          json: { detail: failure.detail },
        })
      return route.fulfill({
        json: {
          answer: failure.answer,
          sources: [],
          model: "failure-regression",
          session_id: session.id,
          library_id: custom.id,
        },
      })
    })
    await send(failure.question)
    await badges.nth(index).waitFor()
    assert.equal(
      await badges.nth(index).getAttribute("data-query-failure"),
      failure.kind
    )
    assert.equal(await badges.count(), index + 1)
    assert.ok(
      (await badges.nth(index).getAttribute("aria-label")).startsWith(
        "Query failed:"
      )
    )
    await badges.nth(index).focus()
    assert.equal(await badges.nth(index).getAttribute("aria-expanded"), "true")
    const reasonId = await badges.nth(index).getAttribute("aria-controls")
    await page.locator(`[id="${reasonId}"]`).waitFor()
    await page.unroute("**/api/policy/query")
  }
  const stored = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`instagrad:policy:session:${id}`)),
    session.id
  )
  assert.equal(
    stored.filter((message) => message.failure).length,
    failCases.length
  )
  await page.reload()
  await page.locator("#chat-session").waitFor()
  assert.equal(await badges.count(), failCases.length)
  checks.push(
    "unavailable, timeout, network, malformed and empty responses mark the correct user query and survive reload"
  )

  await page.route("**/api/policy/query", async (route) =>
    route.fulfill({
      json: {
        answer: "This response completed successfully.",
        sources: [],
        model: "failure-regression",
        session_id: session.id,
        library_id: custom.id,
      },
    })
  )
  await send("Will a successful query have a failure badge?")
  await page
    .getByText("This response completed successfully.", { exact: true })
    .waitFor()
  assert.equal(await badges.count(), failCases.length)
  await page.unroute("**/api/policy/query")
  checks.push("successful query remains unmarked")

  await page.route("**/api/policy/query", async (route) =>
    route.fulfill({
      json: {
        answer: "The retried query completed successfully.",
        sources: [],
        model: "failure-regression",
        session_id: session.id,
        library_id: custom.id,
      },
    })
  )
  await badges.last().click()
  const retryReasonId = await badges.last().getAttribute("aria-controls")
  await page
    .locator(`[id="${retryReasonId}"]`)
    .getByRole("button", { name: "Retry question", exact: true })
    .click()
  await page
    .getByText("The retried query completed successfully.", { exact: true })
    .waitFor()
  assert.equal(await badges.count(), failCases.length - 1)
  await page.unroute("**/api/policy/query")
  checks.push("retry after reload clears only the retried query badge")

  let releaseQuery
  const heldQuery = new Promise((resolve) => {
    releaseQuery = resolve
  })
  await page.route("**/api/policy/query", async (route) => {
    await heldQuery
    await route.abort("failed").catch(() => {})
  })
  const queryStarted = page.waitForRequest((request) =>
    request.url().endsWith("/api/policy/query")
  )
  await send("Can I cancel this query myself?")
  await queryStarted
  await page.getByRole("button", { name: "Stop", exact: true }).click()
  await page
    .getByText("Request canceled. No answer was received.", { exact: true })
    .waitFor()
  assert.equal(await badges.count(), failCases.length - 1)
  releaseQuery()
  await page.unroute("**/api/policy/query")
  checks.push("manually stopped query remains unmarked")

  await page.setViewportSize({ width: 390, height: 844 })
  await badges.last().click()
  await noOverflow()
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use dark theme", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  await noOverflow()
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    colorScheme: "dark",
    storageState: await context.storageState(),
  })
  const touchPage = await touchContext.newPage()
  touchPage.on("pageerror", (error) => errors.push(error.message))
  await touchPage.goto(`${base}/libraries/${custom.id}?session=${session.id}`)
  const touchBadge = touchPage.locator("button[data-query-failure]").last()
  await touchBadge.tap()
  const touchReasonId = await touchBadge.getAttribute("aria-controls")
  await touchPage.locator(`[id="${touchReasonId}"]`).scrollIntoViewIfNeeded()
  assert.equal(await touchBadge.getAttribute("aria-expanded"), "true")
  assert.equal((await touchBadge.boundingBox()).width, 24)
  assert.ok(
    await touchBadge.evaluate(
      (element) =>
        Number.parseFloat(getComputedStyle(element, "::after").width) >= 44
    )
  )
  assert.equal(
    await touchPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  )
  await touchPage.screenshot({
    path: "/tmp/instagrad-query-failures-mobile-dark.png",
    fullPage: true,
  })
  await touchContext.close()
  assert.deepEqual(errors, [])
  checks.push(
    "mobile dark theme, keyboard/touch error details, no horizontal overflow or browser runtime errors"
  )
  console.log(JSON.stringify({ passed: true, checks, errors }, null, 2))
} catch (error) {
  await page
    .screenshot({
      path: "/tmp/instagrad-system-regression-failure.png",
      fullPage: true,
    })
    .catch(() => {})
  console.error(
    "Browser at failure:",
    page.url(),
    (await page.locator("body").innerText()).slice(0, 5000),
    diagnostics
  )
  throw error
} finally {
  for (const [resource, ids] of Object.entries(cleanup)) {
    for (const id of ids)
      await api(`${resource}/${id}`, "DELETE", undefined, 204).catch((error) =>
        console.error("cleanup", resource, id, error.message)
      )
  }
  await browser.close()
}
