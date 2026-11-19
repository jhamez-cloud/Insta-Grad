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
page.on("pageerror", (error) => errors.push(error.message))
const cleanup = {
  sessions: new Set(),
  documents: new Set(),
  libraries: new Set(),
}
const checks = []
async function api(path, method = "GET", data, status = 200, multipart) {
  const response = await context.request.fetch(`${base}/api/policy/${path}`, {
    method,
    headers: { Origin: base },
    data,
    multipart,
    timeout: 30000,
  })
  assert.equal(
    response.status(),
    status,
    `${method} ${path}: ${await response.text()}`
  )
  return status === 204 ? undefined : response.json()
}
async function choose(trigger, option) {
  await trigger.click()
  await page
    .getByRole("option", { name: option, exact: typeof option === "string" })
    .click()
}
async function noOverflow(target = page) {
  assert.equal(
    await target.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  )
}
async function reducedMotionPopup(popup) {
  const style = await popup.evaluate((element) => {
    const computed = getComputedStyle(element)
    return { animation: computed.animationName, opacity: computed.opacity }
  })
  assert.deepEqual(style, { animation: "none", opacity: "1" })
}
const corpus = page
  .locator("[data-slot=card]")
  .filter({ has: page.getByText("Evidence corpus", { exact: true }) })
const rows = corpus.locator("[data-slot=card-content] > ul > li")
const tag = `controls-${crypto.randomUUID().slice(0, 8)}`
let touchContext
try {
  const library = await api(
    "libraries",
    "POST",
    { name: `${tag} library` },
    201
  )
  const other = await api(
    "libraries",
    "POST",
    { name: `${tag} alternate` },
    201
  )
  cleanup.libraries.add(library.id)
  cleanup.libraries.add(other.id)
  const documents = []
  for (let index = 1; index <= 4; index++) {
    const title = `${tag} document ${index}`
    const upload = await api("documents/upload", "POST", undefined, 201, {
      library_id: String(library.id),
      category: tag,
      files: {
        name: `${tag}-${index}.md`,
        mimeType: "text/markdown",
        buffer: Buffer.from(
          `# ${title}\n\nPagination checks preserve this ${index} document as real evidence.`
        ),
      },
    })
    const document = upload.results[0].document
    cleanup.documents.add(document.id)
    documents.push(document)
  }
  await page.goto(`${base}/libraries/${library.id}/documents`)
  await page
    .getByRole("button", { name: documents[3].title, exact: true })
    .waitFor()
  assert.equal(await rows.count(), 3)
  const pagination = page.getByRole("navigation", {
    name: "Documents pagination",
    exact: true,
  })
  assert.match(await pagination.innerText(), /1–3 of 4/)
  await pagination.getByRole("button", { name: "Next", exact: true }).click()
  await page
    .getByRole("button", { name: documents[0].title, exact: true })
    .waitFor()
  assert.equal(await rows.count(), 1)
  assert.match(await pagination.innerText(), /4–4 of 4/)
  await rows
    .first()
    .getByRole("button", { name: "Remove from library", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove from library", exact: true })
    .click()
  await page
    .getByRole("button", { name: documents[3].title, exact: true })
    .waitFor()
  assert.equal(await rows.count(), 3)
  assert.equal((await api(`documents/${documents[0].id}`)).library_id, null)
  checks.push(
    "three document rows, one-item final page, and page correction after final membership removal"
  )

  await page.goto(`${base}/documents`)
  await page
    .getByRole("button", { name: documents[3].title, exact: true })
    .waitFor()
  assert.equal(await rows.count(), 3)
  await page.locator("#documents-category-filter").fill(tag)
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await page
    .getByRole("button", { name: documents[3].title, exact: true })
    .waitFor()
  await page
    .getByRole("navigation", { name: "Documents pagination", exact: true })
    .getByRole("button", { name: "Next", exact: true })
    .click()
  await page
    .getByRole("button", { name: documents[0].title, exact: true })
    .waitFor()
  assert.equal(await rows.count(), 1)
  await page.locator("#documents-category-filter").fill("02_legal")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await page.getByText("Read-only", { exact: true }).first().waitFor()
  assert.equal(await rows.count(), 3)
  assert.match(
    await page
      .getByRole("navigation", { name: "Documents pagination", exact: true })
      .innerText(),
    /1–3 of/
  )
  checks.push(
    "global corpus pagination and category changes reset to three-item first page"
  )

  await page.goto(`${base}/libraries/${other.id}/documents`)
  await page
    .getByRole("heading", { name: `${other.name} documents`, exact: true })
    .waitFor()
  await page
    .getByRole("button", { name: "Add existing documents", exact: true })
    .click()
  const picker = page.getByRole("dialog")
  await picker
    .getByRole("checkbox", { name: new RegExp(documents[3].title) })
    .waitFor()
  assert.equal(await picker.getByRole("checkbox").count(), 3)
  await picker
    .getByRole("checkbox", { name: new RegExp(documents[3].title) })
    .check()
  await picker
    .getByRole("navigation", {
      name: "Existing documents pagination",
      exact: true,
    })
    .getByRole("button", { name: "Next", exact: true })
    .click()
  await picker
    .getByRole("checkbox", { name: new RegExp(documents[0].title) })
    .waitFor()
  assert.equal(await picker.getByRole("checkbox").count(), 3)
  await picker
    .getByRole("navigation", {
      name: "Existing documents pagination",
      exact: true,
    })
    .getByRole("button", { name: "Previous", exact: true })
    .click()
  await picker
    .getByRole("checkbox", { name: new RegExp(documents[3].title) })
    .waitFor()
  assert.equal(
    await picker
      .getByRole("checkbox", { name: new RegExp(documents[3].title) })
      .isChecked(),
    true
  )
  await picker.getByRole("button", { name: "Cancel", exact: true }).click()
  await page
    .getByRole("button", { name: "Add existing documents", exact: true })
    .click()
  await picker
    .getByRole("checkbox", { name: new RegExp(documents[3].title) })
    .waitFor()
  assert.equal(
    await picker
      .getByRole("checkbox", { name: new RegExp(documents[3].title) })
      .isChecked(),
    false
  )
  await picker.getByRole("button", { name: "Cancel", exact: true }).click()
  checks.push(
    "assignment picker lists three documents and preserves selections between pages"
  )

  const first = await api("sessions", "POST", { library_id: library.id }, 201)
  const second = await api("sessions", "POST", { library_id: library.id }, 201)
  cleanup.sessions.add(first.id)
  cleanup.sessions.add(second.id)
  await page.goto(`${base}/libraries/${library.id}?session=${first.id}`)
  const sessionControl = page.locator("#chat-session")
  await sessionControl.waitFor()
  await sessionControl.focus()
  await page.keyboard.press("ArrowDown")
  await page.getByRole("listbox").waitFor()
  await reducedMotionPopup(page.getByRole("listbox"))
  await page.keyboard.press("Escape")
  await page.waitForFunction(
    () => document.activeElement?.id === "chat-session"
  )
  assert.equal(
    await sessionControl.evaluate(
      (element) => element === document.activeElement
    ),
    true
  )
  await choose(sessionControl, new RegExp(`^Session ${second.id}\\b`))
  await page.waitForURL(`${base}/libraries/${library.id}?session=${second.id}`)
  await page.reload()
  await sessionControl.waitFor()
  assert.match(
    await sessionControl.innerText(),
    new RegExp(`Session ${second.id}\\b`)
  )
  assert.equal(await page.locator("select:visible").count(), 0)
  const header = page.locator("section > header").filter({
    has: page.getByRole("heading", { name: library.name, exact: true }),
  })
  assert.ok((await header.boundingBox()).height < 170)
  await page
    .getByRole("button", { name: "Library options", exact: true })
    .click()
  await page.getByRole("menuitem", { name: /Manage sessions/ }).waitFor()
  await reducedMotionPopup(page.getByRole("menu"))
  await page.keyboard.press("Escape")
  await page
    .getByRole("navigation", { name: "Library views", exact: true })
    .getByLabel("Evidence flow", { exact: true })
    .click()
  await page
    .getByRole("heading", {
      name: "From question to grounded answer",
      exact: true,
    })
    .waitFor()
  await page
    .getByRole("navigation", { name: "Library views", exact: true })
    .getByLabel("Conversation", { exact: true })
    .click()
  await noOverflow()
  await page.screenshot({
    path: "/tmp/instagrad-minimal-toolbar-desktop.png",
    fullPage: true,
  })
  checks.push(
    "minimal desktop toolbar, shadcn keyboard selection, session URL reload, view switch and secondary menu"
  )

  await page.goto(`${base}/sessions`)
  const libraryControl = page.locator("#new-session-library")
  await libraryControl.waitFor()
  await choose(libraryControl, library.name)
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/policy/sessions") &&
      response.request().method() === "POST"
  )
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click()
  const managed = await (await created).json()
  cleanup.sessions.add(managed.id)
  const card = page
    .locator("[data-slot=card]")
    .filter({ has: page.getByText(`Session ${managed.id}`, { exact: true }) })
  await choose(card.getByRole("combobox"), other.name)
  await card
    .getByRole("button", { name: "Save selection", exact: true })
    .click()
  await page
    .getByText(`Session ${managed.id} now searches ${other.name}.`, {
      exact: true,
    })
    .waitFor()
  assert.equal((await api(`sessions/${managed.id}`)).library_id, other.id)
  checks.push("shadcn library selectors create and reassign backend sessions")

  touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    reducedMotion: "reduce",
  })
  const touchPage = await touchContext.newPage()
  touchPage.on("pageerror", (error) => errors.push(error.message))
  await touchPage.goto(`${base}/libraries/${library.id}?session=${second.id}`)
  await touchPage.locator("#chat-session").waitFor()
  const touchHeader = touchPage.locator("section > header").filter({
    has: touchPage.getByRole("heading", { name: library.name, exact: true }),
  })
  assert.ok((await touchHeader.boundingBox()).height < 200)
  await touchPage.locator("#chat-session").tap()
  const listbox = touchPage.getByRole("listbox")
  await listbox.waitFor()
  await reducedMotionPopup(listbox)
  await touchPage.screenshot({
    path: "/tmp/instagrad-shadcn-session-select-mobile-dark.png",
    fullPage: true,
  })
  const bounds = await listbox.boundingBox()
  assert.ok(
    bounds.x >= 0 &&
      bounds.x + bounds.width <= 391 &&
      bounds.y >= 0 &&
      bounds.y + bounds.height <= 845
  )
  await touchPage
    .getByRole("option", { name: new RegExp(`^Session ${first.id}\\b`) })
    .tap()
  await touchPage.waitForURL(
    `${base}/libraries/${library.id}?session=${first.id}`
  )
  await touchPage
    .getByRole("button", { name: "Library options", exact: true })
    .tap()
  await touchPage.getByRole("menuitem", { name: /Manage sessions/ }).waitFor()
  await reducedMotionPopup(touchPage.getByRole("menu"))
  await noOverflow(touchPage)
  await touchPage.screenshot({
    path: "/tmp/instagrad-minimal-toolbar-mobile-dark.png",
    fullPage: true,
  })
  await touchPage.keyboard.press("Escape")
  await touchPage.goto(`${base}/documents`)
  await touchPage
    .getByRole("button", { name: documents[3].title, exact: true })
    .waitFor()
  assert.equal(
    await touchPage.locator("[data-slot=card-content] > ul > li").count(),
    3
  )
  await noOverflow(touchPage)
  await touchPage.screenshot({
    path: "/tmp/instagrad-three-documents-mobile-dark.png",
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  checks.push(
    "mobile dark toolbar, touch select portal, three document rows, reduced-motion popups and no overflow/runtime errors"
  )
  console.log(JSON.stringify({ passed: true, checks, errors }, null, 2))
} catch (error) {
  await page
    .screenshot({ path: "/tmp/instagrad-controls-failure.png", fullPage: true })
    .catch(() => {})
  console.error(
    "Page at failure:",
    page.url(),
    (await page.locator("body").innerText()).slice(0, 4500)
  )
  throw error
} finally {
  if (touchContext) await touchContext.close()
  await context.close()
  const cleanupContext = await browser.newContext()
  for (const [resource, ids] of Object.entries(cleanup)) {
    for (const id of ids) {
      const response = await cleanupContext.request
        .delete(`${base}/api/policy/${resource}/${id}`, {
          headers: { Origin: base },
          timeout: 30000,
        })
        .catch((error) => console.error("cleanup", resource, id, error.message))
      if (response && response.status() !== 204)
        console.error("cleanup", resource, id, response.status())
    }
  }
  await cleanupContext.close()
  await browser.close()
}
