import assert from "node:assert/strict"
import { join } from "node:path"
import { tmpdir } from "node:os"

const { chromium } = await import(
  process.env.INTEGRATION_PLAYWRIGHT_MODULE || "playwright-core"
)

const base = process.env.INTEGRATION_APP_URL || "http://127.0.0.1:3000"
const appUrl = new URL(base)
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname),
  "Integration checks require a local application"
)
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
page.on("pageerror", (e) => errors.push(e.message))
const libraries = new Set(),
  documents = new Set(),
  sessions = new Set()
let operations = 0
async function api(
  path,
  { method = "GET", body, form, status = 200, origin = base } = {}
) {
  const response = await context.request.fetch(`${base}/api/policy/${path}`, {
    method,
    headers: { Origin: origin },
    data: body,
    multipart: form,
    timeout: 100000,
  })
  const text = await response.text()
  assert.equal(
    response.status(),
    status,
    `${method} ${path}: ${response.status()} ${text.slice(0, 180)}`
  )
  operations++
  return text ? JSON.parse(text) : undefined
}
const tag = `integration-${crypto.randomUUID().slice(0, 8)}`
const contents = `# ${tag}\n\nThe ${tag} approval deadline is seven working days. The owner is the library integration team.`
let provider = "unchecked"
try {
  assert.equal((await api("health")).database, true)
  assert.ok((await api("root")).status)
  const schema = await api("openapi.json")
  assert.ok(schema.paths["/api/v1/query"])
  await api("unknown", { status: 404 })
  await api("libraries", {
    method: "POST",
    body: { name: "blocked" },
    origin: "https://untrusted.example",
    status: 403,
  })
  await api("libraries", {
    method: "PATCH",
    body: { name: "blocked" },
    status: 405,
  })
  await api("libraries", { method: "POST", body: { name: " " }, status: 422 })
  const a = await api("libraries", {
    method: "POST",
    body: { name: `${tag} A` },
    status: 201,
  })
  libraries.add(a.id)
  const b = await api("libraries", {
    method: "POST",
    body: { name: `${tag} B` },
    status: 201,
  })
  libraries.add(b.id)
  await api(`libraries/${a.id}`, {
    method: "PATCH",
    body: { name: `${tag} renamed` },
  })
  assert.equal((await api(`libraries/${a.id}`)).name, `${tag} renamed`)
  assert.ok(
    (await api("libraries?limit=100&offset=0")).items.some((x) => x.id === a.id)
  )
  const upload = await api("documents/upload", {
    method: "POST",
    form: {
      category: tag,
      library_id: String(a.id),
      files: {
        name: `${tag}.md`,
        mimeType: "text/markdown",
        buffer: Buffer.from(contents),
      },
    },
    status: 201,
  })
  assert.equal(upload.indexed, 1)
  const doc = upload.results[0].document
  documents.add(doc.id)
  const duplicate = await api("documents/upload", {
    method: "POST",
    form: {
      category: tag,
      library_id: String(b.id),
      files: {
        name: "duplicate.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(contents),
      },
    },
    status: 200,
  })
  assert.equal(duplicate.results[0].status, "duplicate")
  assert.equal(duplicate.results[0].document.library_id, a.id)
  const rejected = await api("documents/upload", {
    method: "POST",
    form: {
      files: {
        name: "unsupported.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("invalid"),
      },
    },
    status: 200,
  })
  assert.equal(rejected.results[0].status, "rejected")
  assert.equal((await api(`documents/${doc.id}`)).content, contents)
  assert.equal(
    (await api(`documents?category=${tag}&library_id=${a.id}`)).total,
    1
  )
  await api(`documents?library_id=${a.id}&uncategorized=true`, { status: 422 })
  assert.equal(
    (await api(`libraries/${a.id}/documents?category=${tag}`)).total,
    1
  )
  await api(`libraries/${b.id}/documents`, {
    method: "POST",
    body: { document_ids: [doc.id] },
  })
  assert.equal((await api(`documents/${doc.id}`)).library_id, b.id)
  await api(`libraries/${b.id}/documents/${doc.id}`, {
    method: "DELETE",
    status: 204,
  })
  assert.equal(
    (await api(`documents?uncategorized=true&category=${tag}`)).total,
    1
  )
  await api(`libraries/${a.id}/documents`, {
    method: "POST",
    body: { document_ids: [doc.id] },
  })
  await api(`libraries/${a.id}/documents`, {
    method: "DELETE",
    body: { document_ids: [doc.id] },
  })
  assert.equal((await api(`documents/${doc.id}`)).library_id, null)
  await api(`libraries/${a.id}/documents`, {
    method: "POST",
    body: { document_ids: [doc.id] },
  })
  const session = await api("sessions", {
    method: "POST",
    body: { library_id: a.id },
    status: 201,
  })
  sessions.add(session.id)
  assert.ok(
    (await api("sessions?limit=100")).items.some((x) => x.id === session.id)
  )
  assert.equal((await api(`sessions/${session.id}`)).library_id, a.id)
  await api(`sessions/${session.id}`, {
    method: "PATCH",
    body: { library_id: b.id },
  })
  await api(`sessions/${session.id}`, {
    method: "PATCH",
    body: { library_id: a.id },
  })
  await api("query", { method: "POST", body: { question: "x" }, status: 422 })
  // One real provider call validates the live request path; the renderer is then
  // exercised with a deterministic response and actual uploaded source metadata.
  const answerResponse = await context.request.post(
    `${base}/api/policy/query`,
    {
      headers: { Origin: base },
      data: {
        question: `What is the ${tag} approval deadline?`,
        session_id: session.id,
        category: tag,
        top_k: 1,
      },
      timeout: 100000,
    }
  )
  const answer = await answerResponse.json()
  assert.ok(
    [200, 503].includes(answerResponse.status()),
    `query status ${answerResponse.status()}`
  )
  provider =
    answerResponse.status() === 200
      ? "live answer received"
      : "provider unavailable (503)"
  if (answerResponse.status() === 200) {
    assert.equal(answer.library_id, a.id)
    assert.equal(answer.session_id, session.id)
    assert.ok(answer.sources.some((x) => x.document_id === doc.id))
  }
  await page.goto(`${base}/dashboard`)
  await page.getByText("Service connected", { exact: true }).waitFor()
  await page
    .getByRole("link", { name: `${tag} renamed`, exact: true })
    .first()
    .waitFor()
  await page.goto(`${base}/libraries/${a.id}/documents`)
  await page.getByRole("button", { name: tag, exact: true }).waitFor()
  await page.getByRole("button", { name: "Read document", exact: true }).click()
  await page.getByRole("dialog").getByText(contents, { exact: true }).waitFor()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.locator("#documents-category-filter").fill(tag)
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await page.getByRole("button", { name: tag, exact: true }).waitFor()
  // Actual file upload through the browser control.
  await page.locator("input[type=file]").setInputFiles({
    name: `${tag}-browser.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(
      `# ${tag} browser\nBrowser upload has real file bytes.`
    ),
  })
  await page.locator("#document-upload-category").fill(tag)
  await page
    .getByRole("button", { name: "Upload selected files", exact: true })
    .click()
  await page.getByText("Indexed", { exact: true }).waitFor()
  const browserDocs = await api(`documents?category=${tag}`)
  for (const item of browserDocs.items) documents.add(item.id)
  assert.equal(browserDocs.total, 2)
  await page.goto(`${base}/sessions`)
  await page.locator("#new-session-library").click()
  await page
    .getByRole("option", { name: `${tag} renamed`, exact: true })
    .click()
  const createdPromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/policy/sessions") &&
      r.request().method() === "POST"
  )
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click()
  const uiSession = await (await createdPromise).json()
  sessions.add(uiSession.id)
  const card = page
    .locator("[data-slot=card]")
    .filter({ has: page.getByText(`Session ${uiSession.id}`, { exact: true }) })
  await card
    .getByRole("button", { name: "Session details", exact: true })
    .click()
  await page.getByRole("dialog").waitFor()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await card.getByRole("combobox").click()
  await page.getByRole("option", { name: b.name, exact: true }).click()
  await card
    .getByRole("button", { name: "Save selection", exact: true })
    .click()
  await page
    .getByText(`Session ${uiSession.id} now searches ${b.name}.`, {
      exact: true,
    })
    .waitFor()
  await card
    .getByRole("button", { name: "Delete session", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete session", exact: true })
    .click()
  await page.getByRole("alertdialog").waitFor({ state: "hidden" })
  sessions.delete(uiSession.id)
  await page.goto(`${base}/libraries/${a.id}?session=${session.id}`)
  await page.locator("#chat-session").waitFor()
  assert.match(
    await page.locator("#chat-session").innerText(),
    new RegExp(`Session ${session.id}\\b`)
  )
  let questionBody
  await page.route("**/api/policy/query", async (route) => {
    questionBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        answer:
          "Deterministic rendering check: the deadline is seven working days.",
        model: "integration-render-check",
        session_id: session.id,
        library_id: a.id,
        sources: [
          {
            document_id: doc.id,
            title: doc.title,
            category: tag,
            chunk_id: `${doc.id}-0`,
            similarity: 0.9,
            excerpt: "The approval deadline is seven working days.",
            source: "upload",
          },
        ],
      },
    })
  })
  await page.locator("#chat-top-k").fill("2")
  await page.locator("#chat-category").fill(tag)
  await page
    .getByRole("textbox", { name: "Prompt", exact: true })
    .fill("What is the approval deadline?")
  await page.getByRole("button", { name: "Send", exact: true }).click()
  await page
    .getByText(
      "Deterministic rendering check: the deadline is seven working days.",
      { exact: true }
    )
    .waitFor()
  assert.equal(questionBody.session_id, session.id)
  assert.equal(questionBody.top_k, 2)
  assert.equal(questionBody.category, tag)
  await page
    .getByRole("button", {
      name: `Read ${doc.title}, chunk ${doc.id}-0`,
      exact: true,
    })
    .click()
  await page.getByRole("dialog").getByText(contents, { exact: true }).waitFor()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  // External reassignment must be rejected before a subsequent query.
  await api(`sessions/${session.id}`, {
    method: "PATCH",
    body: { library_id: b.id },
  })
  await page
    .getByRole("textbox", { name: "Prompt", exact: true })
    .fill("Is this still the same library?")
  await page.getByRole("button", { name: "Send", exact: true }).click()
  await page
    .getByText(
      "This session now selects another library. Choose a new session before retrying.",
      { exact: true }
    )
    .waitFor()
  await page.screenshot({
    path: join(tmpdir(), "instagrad-integrated-desktop.png"),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/documents`)
  await page
    .getByRole("heading", { name: "All documents", exact: true })
    .waitFor()
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    ),
    true,
    "mobile overflow"
  )
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Sessions", exact: true })
    .waitFor()
  await page.screenshot({
    path: join(tmpdir(), "instagrad-integrated-mobile.png"),
    fullPage: true,
  })
  await api(`libraries/${a.id}`, { method: "DELETE", status: 204 })
  libraries.delete(a.id)
  assert.equal((await api(`documents/${doc.id}`)).library_id, null)
  await api(`libraries/${b.id}`, { method: "DELETE", status: 204 })
  libraries.delete(b.id)
  assert.equal((await api(`sessions/${session.id}`)).library_id, null)
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify(
      {
        passed: true,
        apiOperations: operations,
        provider,
        browserChecks: [
          "dashboard",
          "document content",
          "category filter",
          "real file upload",
          "sessions create/detail/reassign/delete",
          "query request and citation rendering",
          "external session reassignment guard",
          "mobile navigation and overflow",
        ],
        pageErrors: errors,
      },
      null,
      2
    )
  )
} finally {
  for (const id of sessions) {
    await api(`sessions/${id}`, { method: "DELETE", status: 204 }).catch((e) =>
      console.error("cleanup session", id, e.message)
    )
  }
  for (const id of documents) {
    await api(`documents/${id}`, { method: "DELETE", status: 204 }).catch((e) =>
      console.error("cleanup document", id, e.message)
    )
  }
  for (const id of libraries) {
    await api(`libraries/${id}`, { method: "DELETE", status: 204 }).catch((e) =>
      console.error("cleanup library", id, e.message)
    )
  }
  await browser.close()
}
