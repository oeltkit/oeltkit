// Playwright driver for OELT packages running inside a real player.
//
// The same playthrough functions drive both the SCORM Cloud launch URL (where
// our packaged index.html runs inside the Cloud player's content iframe) and the
// local --dry-run web server (where it is the top document). All locating goes
// through the discovered content Frame, so the playthroughs are agnostic to how
// deeply the host nests our content.

/**
 * Open a SCORM Cloud launch URL and return the Page that actually hosts the
 * course. SCORM Cloud's default player launches the SCO in a NEW WINDOW via
 * window.open (the launch URL itself just shows a "we launched it in a new
 * window" notice). Headless Chromium has no popup blocker, so that becomes a new
 * Playwright Page on the context. If no popup appears (e.g. a player configured
 * to launch inline, or the local dry-run), the launcher page itself is returned.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {import('@playwright/test').Page} page  page to navigate to the launch URL
 * @param {string} launchUrl
 * @returns {Promise<import('@playwright/test').Page>}
 */
export async function openCourseWindow(context, page, launchUrl, { timeoutMs = 20_000 } = {}) {
  const popupPromise = context.waitForEvent("page", { timeout: timeoutMs }).catch(() => null);
  await page.goto(launchUrl, { waitUntil: "load" });
  const popup = await popupPromise;
  if (popup) await popup.waitForLoadState("load").catch(() => {});
  return popup ?? page;
}

/**
 * Find the Playwright Frame that contains the OELT player. SCORM Cloud serves
 * the SCO in a (possibly nested) iframe; the local dry-run serves it at the top.
 * We detect it by the player's stable root element (#course-root), then wait for
 * the runtime to have rendered the first page.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<import('@playwright/test').Frame>}
 */
export async function findContentFrame(page, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const frame of page.frames()) {
      try {
        if ((await frame.locator("#course-root").count()) > 0) {
          // Runtime renders #oelt-page asynchronously after the API handshake.
          await frame.locator("#oelt-page h1").first().waitFor({ timeout: 15_000 });
          return frame;
        }
      } catch {
        /* frame detached mid-poll (Cloud redirects) — retry */
      }
    }
    if (Date.now() > deadline)
      throw new Error("OELT content frame (#course-root) not found at launch URL");
    await page.waitForTimeout(500);
  }
}

/**
 * Build the playthrough context handed to each drive() function. Thin helpers
 * over the discovered Frame + the page keyboard, mirroring the selectors proven
 * in harness/package.spec.ts and harness/components.spec.ts.
 */
export function makeContext(page, frame) {
  const ctx = {
    page,
    frame,

    /** Click a table-of-contents entry by its visible label (e.g. "3. Quiz"). */
    async toc(label) {
      await frame.locator("#oelt-toc").getByText(label, { exact: false }).click();
    },

    /**
     * Wait for the current page heading to read `text`. Web-first wait (not a
     * one-shot read) so it tolerates the LMS's navigate→render latency — on
     * SCORM Cloud the page swap lags the click by enough to race a bare read.
     */
    async expectH1(text) {
      await frame.locator("#oelt-page h1", { hasText: text }).first().waitFor({ timeout: 15_000 });
    },

    /** Click a button (optionally scoped to a CSS selector) by accessible name. */
    async clickButton(name, scope) {
      const root = scope ? frame.locator(scope) : frame;
      await root.getByRole("button", { name }).click();
    },

    /** Check a radio by accessible name within a scope. */
    async checkRadio(scope, name) {
      await frame.locator(scope).getByRole("radio", { name }).check();
    },

    /** Fill an input (CSS selector relative to the frame). */
    async fill(selector, value) {
      await frame.locator(selector).fill(value);
    },

    /** Number of TOC entries (pages). */
    async pageCount() {
      return frame.locator("#oelt-toc button").count();
    },

    /** Evaluate against the runtime's global `oelt` inside the content frame. */
    setState(key, value) {
      return frame.evaluate(([k, v]) => window.oelt.state.set(k, v), [key, value]);
    },
    getState(key) {
      return frame.evaluate((k) => window.oelt.state.get(k), key);
    },
    currentPage() {
      return frame.evaluate(() => window.oelt.nav.current());
    },

    /** Flush a clean termination (LMSCommit + LMSFinish / cmi5 terminated). */
    terminate() {
      return frame.evaluate(() => window.oelt?.terminate?.());
    },
  };
  return ctx;
}
