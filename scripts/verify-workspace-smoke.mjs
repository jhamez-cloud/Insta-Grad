import assert from "node:assert/strict"
const { chromium } = await import(
  process.env.INTEGRATION_PLAYWRIGHT_MODULE || "playwright-core"
)
const base = process.env.INTEGRATION_APP_URL || "http://127.0.0.1:3000"
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname),
  "Checks require a local application"
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
const runtimeErrors = []
page.on("pageerror", (e) => runtimeErrors.push(e.message))
const libs = new Set(),
  docs = new Set(),
  sessions = new Set()
async function api(path, method = "GET", data, status = 200) {
  const r = await context.request.fetch(`${base}/api/policy/${path}`, {
    method,
    data,
    headers: { Origin: base },
    timeout: 30000,
  })
  assert.equal(r.status(), status, await r.text())
  return r.status() === 204 ? undefined : r.json()
}
try {
  assert.equal((await api("health")).database, true)
  const tag = `wizard-${crypto.randomUUID().slice(0, 8)}`
  await page.goto(`${base}/libraries/new`)
  await page.locator("#library-name").fill(tag)
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: `${tag}.md`,
      mimeType: "text/markdown",
      buffer: Buffer.from(
        `# ${tag}\n\nWizard uploads retain real bytes and create one library.`
      ),
    })
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  const createdResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/policy/libraries") &&
      r.request().method() === "POST"
  )
  const uploadResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/policy/documents/upload") &&
      r.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Save library", exact: true }).click()
  const lib = await (await createdResponse).json()
  libs.add(lib.id)
  const upload = await (await uploadResponse).json()
  for (const r of upload.results) {
    if (r.document) docs.add(r.document.id)
  }
  assert.equal(upload.indexed, 1)
  await page.waitForURL(`${base}/libraries/${lib.id}`)
  await page.locator("#chat-session").waitFor()
  const s1 = await api("sessions", "POST", { library_id: lib.id }, 201)
  sessions.add(s1.id)
  const s2 = await api("sessions", "POST", { library_id: lib.id }, 201)
  sessions.add(s2.id)
  await page.goto(`${base}/libraries/${lib.id}?session=${s1.id}`)
  await page.locator("#chat-session").waitFor()
  await page.locator("#chat-session").click()
  await page
    .getByRole("option", { name: new RegExp(`^Session ${s2.id}\\b`) })
    .click()
  await page.waitForURL(`${base}/libraries/${lib.id}?session=${s2.id}`)
  await page.reload()
  await page.locator("#chat-session").waitFor()
  assert.match(
    await page.locator("#chat-session").innerText(),
    new RegExp(`Session ${s2.id}\\b`)
  )
  await page.getByRole("button", { name: "New session", exact: true }).click()
  await page.waitForURL(`${base}/libraries/${lib.id}`)
  let latestBody
  await page.route("**/api/policy/query", async (route) => {
    latestBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        answer: "Final smoke rendered a complete answer.",
        model: "render-smoke",
        session_id: latestBody.session_id,
        library_id: lib.id,
        sources: [],
      },
    })
  })
  const newSessionPromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/policy/sessions") &&
      r.request().method() === "POST"
  )
  await page
    .getByRole("textbox", { name: "Prompt", exact: true })
    .fill("Does the new session preserve its URL?")
  await page.getByRole("button", { name: "Send", exact: true }).click()
  const newResponse = await newSessionPromise
  const s3 = await newResponse.json()
  sessions.add(s3.id)
  await page
    .getByText("Final smoke rendered a complete answer.", { exact: true })
    .waitFor()
  await page.waitForURL(`${base}/libraries/${lib.id}?session=${s3.id}`)
  assert.equal(latestBody.session_id, s3.id)
  await page
    .getByRole("button", { name: "Add files and sources", exact: true })
    .click()
  await page.getByRole("option", { name: "Manage library documents" }).click()
  await page.waitForURL(`${base}/libraries/${lib.id}/documents`)
  await page.getByRole("button", { name: tag, exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true,
    "document mobile overflow"
  )
  await page.goto(`${base}/libraries/${lib.id}?session=${s3.id}`)
  await page.locator("#chat-session").waitFor()
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true,
    "chat mobile overflow"
  )
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use dark theme", exact: true })
    .click()
  assert.equal(
    await page.locator("html").evaluate((el) => el.classList.contains("dark")),
    true
  )
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.screenshot({
    path:
      process.env.INTEGRATION_SMOKE_SCREENSHOT ||
      "/tmp/instagrad-integrated-chat-mobile-dark.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${base}/libraries/${lib.id}/documents`)
  await page
    .getByRole("button", { name: `Actions for ${tag}`, exact: true })
    .click()
  const libraryRow = page.locator(`[data-library-row="${lib.id}"]`)
  await libraryRow.getByRole("button", { name: "Rename", exact: true }).click()
  await page
    .getByRole("dialog")
    .getByLabel("Library name")
    .fill(`${tag} renamed`)
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save name", exact: true })
    .click()
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  await page
    .getByRole("button", { name: `Actions for ${tag} renamed`, exact: true })
    .click()
  await libraryRow.getByRole("button", { name: "Delete", exact: true }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete library", exact: true })
    .click()
  await page.waitForURL(`${base}/dashboard`)
  libs.delete(lib.id)
  assert.equal(
    (await api(`documents/${upload.results[0].document.id}`)).library_id,
    null
  )
  assert.equal((await api(`sessions/${s3.id}`)).library_id, null)
  assert.deepEqual(runtimeErrors, [])
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          "real wizard library creation and upload",
          "session selection URL and reload",
          "new session URL",
          "source menu opens document manager",
          "mobile document/chat overflow",
          "dark theme",
          "rename and delete active document-screen library",
          "document and session preservation",
        ],
        runtimeErrors,
      },
      null,
      2
    )
  )
} finally {
  for (const id of sessions)
    await api(`sessions/${id}`, "DELETE", undefined, 204).catch((e) =>
      console.error("cleanup session", id, e.message)
    )
  for (const id of docs)
    await api(`documents/${id}`, "DELETE", undefined, 204).catch((e) =>
      console.error("cleanup document", id, e.message)
    )
  for (const id of libs)
    await api(`libraries/${id}`, "DELETE", undefined, 204).catch((e) =>
      console.error("cleanup library", id, e.message)
    )
  await browser.close()
}
