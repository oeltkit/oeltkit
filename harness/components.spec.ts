// Component tests (Task 04 merge gates): axe-core clean, keyboard-only
// operation, interaction emission, and tracking visible in the fake-LMS harness.

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectScormValue } from "./assert";

const DEMOS = "http://localhost:4173/demos";
const COURSE = "http://localhost:4175"; // examples/components-demo

const events = (page: Page) => page.locator("#events li");
const axeClean = async (page: Page) => {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations, JSON.stringify(r.violations, null, 2)).toEqual([]);
};

test.describe("oelt-mcq", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/mcq.html`);
    await page.locator("oelt-mcq[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("keyboard-only: select + submit emits a passed interaction", async ({ page }) => {
    await page.goto(`${DEMOS}/mcq.html`);
    const single = page.locator("#mcq-single");
    await single.getByRole("radio", { name: /four targets/ }).focus();
    await page.keyboard.press("Space"); // select the focused radio
    await single.getByRole("button", { name: "Check answer" }).focus();
    await page.keyboard.press("Enter");
    await expect(events(page)).toContainText('"id":"mcq-single"');
    await expect(events(page)).toContainText('"result":"passed"');
  });
});

test.describe("oelt-text-entry", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/text-entry.html`);
    await page.locator("oelt-text-entry[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("keyboard-only: type + Enter emits a passed fill-in interaction", async ({ page }) => {
    await page.goto(`${DEMOS}/text-entry.html`);
    const input = page.locator("#te-text [part~='input']");
    await input.focus();
    await page.keyboard.type("paris"); // case-insensitive match
    await page.keyboard.press("Enter"); // Enter in the input submits
    await expect(events(page)).toContainText('"id":"te-text"');
    await expect(events(page)).toContainText('"type":"fill-in"');
    await expect(events(page)).toContainText('"result":"passed"');
  });

  test("numeric within tolerance passes; controls lock after submit", async ({ page }) => {
    await page.goto(`${DEMOS}/text-entry.html`);
    const entry = page.locator("#te-numeric");
    await entry.locator("[part~='input']").fill("3.15");
    await entry.getByRole("button", { name: "Check answer" }).click();
    await expect(events(page).filter({ hasText: '"id":"te-numeric"' })).toContainText(
      '"result":"passed"',
    );
    // Without `retry`, input + submit disable after the first submit.
    await expect(entry.locator("[part~='input']")).toBeDisabled();
    await expect(entry.getByRole("button", { name: "Check answer" })).toBeDisabled();
  });
});

test.describe("oelt-branching", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/branching.html`);
    await page.locator("oelt-branching[data-oelt-upgraded]").waitFor();
    await axeClean(page);
  });

  test("keyboard-only: taking the good branch reaches a passed end", async ({ page }) => {
    await page.goto(`${DEMOS}/branching.html`);
    await page.getByRole("button", { name: /Refuse and report it/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('#scenario [part~="end"]')).toContainText(/passed/);
    await expect(events(page).filter({ hasText: '"result":"passed"' })).toHaveCount(1);
  });
});

test.describe("oelt-media", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/media.html`);
    await page.locator("oelt-media[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("gate: refuses to render without captions/transcript", async ({ page }) => {
    await page.goto(`${DEMOS}/media.html`);
    await expect(page.locator('#media-bad [part~="error"]')).toHaveText(
      /missing captions or a transcript/i,
    );
    await expect(page.locator("#media-bad video")).toHaveCount(0);
  });

  test("with a transcript: renders a player + transcript disclosure", async ({ page }) => {
    await page.goto(`${DEMOS}/media.html`);
    await expect(page.locator('#media-ok [part~="transcript-toggle"]')).toHaveText("Transcript");
    await expect(page.locator("#media-ok video")).toHaveCount(1);
  });

  test("emits completion once playback passes the threshold", async ({ page }) => {
    await page.goto(`${DEMOS}/media.html`);
    // Simulate playback progress: fake duration + currentTime, fire timeupdate.
    await page.locator("#media-ok video").waitFor();
    await page.evaluate(() => {
      const v = document.querySelector("#media-ok video") as HTMLVideoElement;
      Object.defineProperty(v, "duration", { configurable: true, value: 10 });
      Object.defineProperty(v, "currentTime", { configurable: true, value: 9.5 });
      v.dispatchEvent(new Event("timeupdate"));
    });
    await expect(events(page)).toContainText('"id":"media-ok"');
    await expect(events(page)).toContainText('"result":"completed"');
  });
});

test.describe("tracking visible in the fake-LMS harness", () => {
  test("scorm12: answering oelt-mcq records a cmi.interaction", async ({ page }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await expect(frame.locator("h1")).toHaveText("Multiple choice");
    await frame.getByRole("radio", { name: /four targets/ }).check();
    await frame.getByRole("button", { name: "Check answer" }).click();
    // The runtime forwarded oelt-interaction → adapter recorded it.
    await expectScormValue(page, "cmi.interactions.0.id", "mcq1");
    await expectScormValue(page, "cmi.interactions.0.result", "correct");
  });

  test("scorm12: answering oelt-text-entry records a fill-in cmi.interaction", async ({ page }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    // Navigate to the Short answer page via the harness TOC.
    await frame.locator("#c-toc").getByText("4. Short answer").click();
    await expect(frame.locator("h1")).toHaveText("Short answer");
    await frame.locator("#te1 [part~='input']").fill("cmi5");
    await frame.getByRole("button", { name: "Check answer" }).click();
    await expectScormValue(page, "cmi.interactions.0.id", "te1");
    await expectScormValue(page, "cmi.interactions.0.type", "fill-in");
    await expectScormValue(page, "cmi.interactions.0.result", "correct");
  });
});
