import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const fixtureDirectory = process.argv[2]
assert.ok(
  fixtureDirectory,
  "Pass a directory containing report.pdf, report.docx, report.doc, report.pptx and report.csv"
)
const { chromium } = await import(
  process.env.INTEGRATION_PLAYWRIGHT_MODULE || "playwright-core"
)
const base = process.env.INTEGRATION_APP_URL || "http://localhost:3000"
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
page.on("pageerror", (error) => errors.push(error.message))
const documents = new Set()
let libraryId

async function api(path, method = "GET", data, expectedStatus = 200) {
  const response = await context.request.fetch(`${base}/api/policy/${path}`, {
    method,
    headers: { Origin: base },
    data,
    timeout: 90000,
  })
  assert.equal(response.status(), expectedStatus, await response.text())
  return response.status() === 204 ? undefined : response.json()
}

try {
  const configuration = await api("documents/upload-options")
  assert.deepEqual(
    [...configuration.supported_extensions].sort(),
    [
      ".pdf",
      ".docx",
      ".doc",
      ".pptx",
      ".csv",
      ".txt",
      ".md",
      ".markdown",
    ].sort()
  )
  assert.ok(configuration.max_upload_bytes > 0)
  const health = await api("health")
  assert.equal(health.database, true)
  const tag = `formats-${crypto.randomUUID().slice(0, 8)}`
  const library = await api("libraries", "POST", { name: tag }, 201)
  libraryId = library.id
  await page.goto(`${base}/libraries/${libraryId}/documents`)
  await page.getByText(/Up to .* MB per file\./).waitFor()
  const input = page.locator("input[type=file]")
  for (const extension of configuration.supported_extensions)
    assert.ok((await input.getAttribute("accept")).includes(extension))
  const uploads = []
  page.on("response", (response) => {
    if (
      response.url().endsWith("/api/policy/documents/upload") &&
      response.request().method() === "POST"
    ) {
      uploads.push(
        response.json().then((value) => {
          for (const result of value.results) {
            if (result.status === "indexed") documents.add(result.document.id)
          }
          return value
        })
      )
    }
  })
  const filenames = [
    "report.pdf",
    "report.docx",
    "report.doc",
    "report.pptx",
    "report.csv",
  ]
  await input.setInputFiles(
    filenames.map((name) => join(fixtureDirectory, name))
  )
  await page
    .getByRole("button", { name: "Upload selected files", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Choose files", exact: true })
    .waitFor({ state: "visible" })
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent.trim() === "Choose files"
      )
      return button && !button.disabled
    },
    null,
    { timeout: 90000 }
  )
  const results = (await Promise.all(uploads)).flatMap((value) => value.results)
  assert.equal(results.length, filenames.length)
  assert.ok(
    results.every((result) => result.status === "indexed"),
    JSON.stringify(results)
  )
  for (const result of results) {
    const document = await api(`documents/${result.document.id}`)
    assert.equal(document.filename, result.filename)
    assert.equal(document.library_id, libraryId)
    assert.ok(document.chunk_count > 0)
    assert.ok(document.content.includes("25 percent"))
  }

  // The proxy preserves real binary bytes and individual rejection results.
  const malformed = await context.request.post(
    `${base}/api/policy/documents/upload`,
    {
      headers: { Origin: base },
      multipart: {
        library_id: String(libraryId),
        files: {
          name: "damaged.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("damaged"),
        },
      },
    }
  )
  assert.equal(malformed.status(), 200)
  assert.equal((await malformed.json()).results[0].status, "rejected")
  const duplicate = await context.request.post(
    `${base}/api/policy/documents/upload`,
    {
      headers: { Origin: base },
      multipart: {
        library_id: String(libraryId),
        files: {
          name: "again.pdf",
          mimeType: "application/pdf",
          buffer: await readFile(join(fixtureDirectory, "report.pdf")),
        },
      },
    }
  )
  assert.equal(duplicate.status(), 200)
  assert.equal((await duplicate.json()).results[0].status, "duplicate")

  await context.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.emulateMedia({ colorScheme: "dark" })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByText(/Up to .* MB per file\./).waitFor()
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth
    ),
    false
  )
  await page.screenshot({
    path: join(fixtureDirectory, "upload-mobile.png"),
    fullPage: true,
  })
  await page.goto(`${base}/libraries/new`)
  await page.locator("#library-name").fill(`${tag}-wizard`)
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page
    .getByText(/Choose PDF, Word, PowerPoint, CSV, text and Markdown files\./)
    .waitFor()
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(join(fixtureDirectory, "report.pptx"))
  await page.getByText("report.pptx", { exact: true }).first().waitFor()
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth
    ),
    false
  )
  await page.screenshot({
    path: join(fixtureDirectory, "wizard-mobile.png"),
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify(
      {
        passed: true,
        indexedFormats: filenames,
        checked: [
          "backend format configuration",
          "browser multipart upload",
          "extracted previews and real indexed chunks",
          "damaged PDF rejection",
          "duplicate PDF",
          "mobile document manager and wizard",
          "no runtime errors",
        ],
      },
      null,
      2
    )
  )
} catch (error) {
  console.error(JSON.stringify({ runtimeErrors: errors, pageUrl: page.url() }))
  await page.screenshot({
    path: join(fixtureDirectory, "upload-failure.png"),
    fullPage: true,
  })
  throw error
} finally {
  for (const id of documents)
    await api(`documents/${id}`, "DELETE", undefined, 204)
  if (libraryId) await api(`libraries/${libraryId}`, "DELETE", undefined, 204)
  await browser.close()
}
