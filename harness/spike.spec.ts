// Runtime spike tests (the thesis test, part 1): the SAME examples/spike course
// produces correct tracking in all four modes, driven by the real
// @oeltkit/runtime. Served by the harness on port 4174.

import { test, expect, type Page } from "@playwright/test";
import { expectScormValue, expectStatement, getSummary, getModel } from "./assert";

const BASE = "http://localhost:4174";

const frame = (page: Page) => page.frameLocator("#course-frame");
const h1 = (page: Page) => frame(page).locator("h1");
// The iframe Frame handle, for evaluating against the runtime's `(window as any).oelt`.
const oeltFrame = (page: Page) => page.frames().find((f) => f.url().includes("/preview"))!;

async function launch(page: Page, mode: string) {
  await page.request.delete(`${BASE}/api/state?mode=${mode}`);
  await page.goto(`${BASE}/?mode=${mode}`);
  await expect(h1(page)).toHaveText("Introduction");
}

async function passQuiz(page: Page) {
  await frame(page).locator("#c-toc").getByText("3. Quiz").click();
  await expect(h1(page)).toHaveText("Quiz");
  await frame(page)
    .getByRole("button", { name: /four targets/ })
    .click();
}

// Wait until the harness has durably persisted `pageId` as the resume location,
// so a reload reads committed state (the harness writes async; web is sync).
async function waitPersistedLocation(page: Page, mode: string, pageId: string) {
  if (mode === "web") return;
  if (mode === "scorm12" || mode === "scorm2004") {
    const key = mode === "scorm12" ? "cmi.core.lesson_location" : "cmi.location";
    await expect
      .poll(
        async () => (await (await page.request.get(`${BASE}/api/state?mode=${mode}`)).json())[key],
      )
      .toBe(pageId);
    return;
  }
  // cmi5: the host stores the (stable) registration in localStorage.
  const reg = await page.evaluate(() => localStorage.getItem("oelt:reg:org.oeltkit.spike:cmi5"));
  await expect
    .poll(async () => {
      const r = await page.request.get(
        `${BASE}/cmi5/activities/state?stateId=oelt.location&activityId=org.oeltkit.spike&registration=${reg}`,
      );
      return r.ok() ? ((await r.json())?.location ?? null) : null;
    })
    .toBe(pageId);
}

test.describe("fresh launch reports not-yet-complete", () => {
  test("scorm12", async ({ page }) => {
    await launch(page, "scorm12");
    await expectScormValue(page, "cmi.core.lesson_status", "incomplete");
  });
  test("scorm2004", async ({ page }) => {
    await launch(page, "scorm2004");
    await expectScormValue(page, "cmi.completion_status", "incomplete");
  });
  test("cmi5", async ({ page }) => {
    await launch(page, "cmi5");
    await expectStatement(page, { verb: "initialized" });
    expect((await getSummary(page)).completion).toBe("incomplete");
  });
  test("web", async ({ page }) => {
    await launch(page, "web");
    await expectScormValue(page, "completion", "incomplete");
  });
});

test.describe("passing the quiz completes + scores per the tracking spec", () => {
  test("scorm12 — collapse rule: mastery defined ⇒ lesson_status carries success", async ({
    page,
  }) => {
    await launch(page, "scorm12");
    await passQuiz(page);
    // score 1.0 >= mastery 0.8 ⇒ passed; the single field reports success.
    await expectScormValue(page, "cmi.core.lesson_status", "passed");
    await expectScormValue(page, "cmi.core.score.raw", "100");
  });

  test("scorm2004 — separate completion + success channels", async ({ page }) => {
    await launch(page, "scorm2004");
    await passQuiz(page);
    await expectScormValue(page, "cmi.completion_status", "completed");
    await expectScormValue(page, "cmi.success_status", "passed");
    await expectScormValue(page, "cmi.score.scaled", "1");
  });

  test("cmi5 — completed then passed statements with score", async ({ page }) => {
    await launch(page, "cmi5");
    await passQuiz(page);
    await expectStatement(page, { verb: "completed" });
    await expectStatement(page, { verb: "passed", scaled: 1 });
  });

  test("web — standalone record", async ({ page }) => {
    await launch(page, "web");
    await passQuiz(page);
    await expectScormValue(page, "completion", "completed");
    await expectScormValue(page, "success", "passed");
    expect((await getModel(page))["score"]).toBe(1);
  });
});

test.describe("suspend / resume restores page + state without downgrading status", () => {
  for (const mode of ["scorm12", "scorm2004", "cmi5", "web"]) {
    test(mode, async ({ page }) => {
      await launch(page, mode);
      await passQuiz(page);
      // Author state + navigate to the middle page (so location = "content").
      await oeltFrame(page).evaluate(() => (window as any).oelt.state.set("note", "remember-me"));
      await frame(page).locator("#c-toc").getByText("2. Key idea").click();
      await expect(h1(page)).toHaveText("Key idea");

      await waitPersistedLocation(page, mode, "content");
      await page.reload();
      await expect(h1(page)).toHaveText("Key idea"); // resumed to saved page
      const restored = await oeltFrame(page).evaluate(() => ({
        page: (window as any).oelt.nav.current(),
        note: (window as any).oelt.state.get("note"),
      }));
      expect(restored.page).toBe(1);
      expect(restored.note).toBe("remember-me");

      // Completion must survive resume (not be downgraded by re-evaluation).
      const summary = await getSummary(page);
      expect(["completed", "passed"]).toContain(summary.completion);
    });
  }
});

test.describe("oversized state writes are rejected with a clear error", () => {
  test("web", async ({ page }) => {
    await launch(page, "web");
    const message = await oeltFrame(page).evaluate(() => {
      try {
        (window as any).oelt.state.set("blob", "x".repeat(5000));
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(message).toMatch(/exceeds|budget|3072/i);
  });
});
