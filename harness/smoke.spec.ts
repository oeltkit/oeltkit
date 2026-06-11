// Harness smoke test: load examples/minimal in all four modes, assert the
// course renders, and assert the LMS lifecycle (initialize/terminate) fires in
// the SCORM and cmi5 modes. Exercises the harness end-to-end and demonstrates
// the assertion API that later tasks reuse.

import { test, expect } from "@playwright/test";
import { expectCall, expectStatement, expectScormValue, getSummary } from "./assert";

const frameH1 = (page: import("@playwright/test").Page) =>
  page.frameLocator("#course-frame").locator("h1");
const exitButton = (page: import("@playwright/test").Page) =>
  page.frameLocator("#course-frame").getByRole("button", { name: "Exit course" });

test.beforeEach(async ({ page }) => {
  // Start each mode from clean persisted state so prior runs don't leak.
  for (const mode of ["scorm12", "scorm2004", "web"]) {
    await page.request.delete(`/api/state?mode=${mode}`);
  }
});

test("renders the course in every mode", async ({ page }) => {
  for (const mode of ["scorm12", "scorm2004", "cmi5", "web"]) {
    await page.goto(`/?mode=${mode}`);
    await expect(frameH1(page), `h1 visible in ${mode}`).toHaveText("Welcome");
  }
});

test("SCORM 1.2: initialize, complete, terminate", async ({ page }) => {
  await page.goto("/?mode=scorm12");
  await expect(frameH1(page)).toHaveText("Welcome");

  await expectCall(page, "LMSInitialize");
  // Single-page course + zero-config default ⇒ all-pages-viewed ⇒ completed.
  // No mastery ⇒ collapse rule reports completion, not success.
  await expectScormValue(page, "cmi.core.lesson_status", "completed");

  await exitButton(page).click();
  await expectCall(page, "LMSFinish");

  expect((await getSummary(page)).completion).toBe("completed");
});

test("SCORM 2004: initialize, complete, terminate", async ({ page }) => {
  await page.goto("/?mode=scorm2004");
  await expect(frameH1(page)).toHaveText("Welcome");

  await expectCall(page, "Initialize");
  await expectScormValue(page, "cmi.completion_status", "completed");

  await exitButton(page).click();
  await expectCall(page, "Terminate");
});

test("cmi5: initialized and terminated statements", async ({ page }) => {
  await page.goto("/?mode=cmi5");
  await expect(frameH1(page)).toHaveText("Welcome");

  await expectStatement(page, { verb: "initialized" });
  await expectStatement(page, { verb: "completed" });

  await exitButton(page).click();
  await expectStatement(page, { verb: "terminated" });
});

test("web: standalone completion", async ({ page }) => {
  await page.goto("/?mode=web");
  await expect(frameH1(page)).toHaveText("Welcome");
  await expectScormValue(page, "completion", "completed");
});
