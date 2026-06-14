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

test.describe("oelt-likert", () => {
  test("axe clean (explicit + generated scales)", async ({ page }) => {
    await page.goto(`${DEMOS}/likert.html`);
    await page.locator("oelt-likert[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("generated scale folds end anchors into the end labels", async ({ page }) => {
    await page.goto(`${DEMOS}/likert.html`);
    const gen = page.locator("#lk-generated");
    await expect(gen.getByRole("radio", { name: "1 — Very hard" })).toBeVisible();
    await expect(gen.getByRole("radio", { name: "5 — Very easy" })).toBeVisible();
  });

  test("keyboard-only: pick a rating + submit emits a completed likert interaction", async ({
    page,
  }) => {
    await page.goto(`${DEMOS}/likert.html`);
    const lk = page.locator("#lk-explicit");
    // exact: "Agree" is a substring of Disagree / Strongly (dis)agree.
    await lk.getByRole("radio", { name: "Agree", exact: true }).focus();
    await page.keyboard.press("Space"); // select the focused radio
    await lk.getByRole("button", { name: "Submit" }).focus();
    await page.keyboard.press("Enter");
    await expect(events(page)).toContainText('"id":"lk-explicit"');
    await expect(events(page)).toContainText('"type":"likert"');
    await expect(events(page)).toContainText('"result":"completed"');
    await expect(events(page)).toContainText('"response":"4"');
    // No score on a survey item.
    await expect(events(page).filter({ hasText: '"id":"lk-explicit"' })).not.toContainText('"score"');
  });
});

test.describe("oelt-ordering", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/ordering.html`);
    await page.locator("oelt-ordering[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("keyboard pick-up/move/drop announces every state change", async ({ page }) => {
    await page.goto(`${DEMOS}/ordering.html`);
    const live = page.locator('#ord [role="status"][aria-live="assertive"]');
    const first = page.locator("#ord [part~='item']").first();
    await first.focus();
    await page.keyboard.press("Space"); // pick up
    await expect(live).toContainText(/Grabbed .*Position 1 of 4/);
    await page.keyboard.press("ArrowDown"); // move down
    await expect(live).toContainText("Position 2 of 4.");
    await page.keyboard.press("Space"); // drop
    await expect(live).toContainText(/Dropped .*Position 2 of 4/);
    // Escape after a fresh pick-up cancels back.
    await page.locator("#ord [part~='item']").nth(1).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Escape");
    await expect(live).toContainText(/Cancelled/);
  });

  test("keyboard-only: solve the 2-item order and Check → passed", async ({ page }) => {
    await page.goto(`${DEMOS}/ordering.html`);
    // Two distinct items always start reversed (shuffleDifferent): [Second, First].
    const ord = page.locator("#ord2");
    await ord.locator("[part~='item']").first().focus();
    await page.keyboard.press("Space"); // pick up "Second" at index 0
    await page.keyboard.press("ArrowDown"); // → [First, Second]
    await page.keyboard.press("Space"); // drop
    await ord.getByRole("button", { name: "Check order" }).click();
    const ev = events(page).filter({ hasText: '"id":"ord2"' });
    await expect(ev).toHaveCount(1);
    await expect(ev).toContainText('"type":"sequencing"');
    await expect(ev).toContainText('"result":"passed"');
    await expect(ev).toContainText('"response":"first,second"');
  });
});

test.describe("oelt-matching", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/matching.html`);
    await page.locator("oelt-matching[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("keyboard pick-up announces position and moves across targets", async ({ page }) => {
    await page.goto(`${DEMOS}/matching.html`);
    const live = page.locator('#match [role="status"][aria-live="assertive"]');
    await page.locator("#match").getByRole("button", { name: "Paris", exact: true }).focus();
    await page.keyboard.press("Space"); // pick up from the bank
    await expect(live).toContainText(/Grabbed Paris\. Bank\./);
    await page.keyboard.press("ArrowLeft"); // bank → last target (Egypt)
    await expect(live).toContainText("Target: Egypt.");
    await page.keyboard.press("Escape");
    await expect(live).toContainText(/Cancelled/);
  });

  test("keyboard-only: solve the 2-pair match and Check → passed", async ({ page }) => {
    await page.goto(`${DEMOS}/matching.html`);
    const m = page.locator("#match2"); // prompts: France(t0), Japan(t1); bank cursor = 2
    // Paris → France: pick up (cursor=bank=2), ArrowLeft x2 → t0, drop.
    await m.getByRole("button", { name: "Paris", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    // Tokyo → Japan: pick up (cursor=bank=2), ArrowLeft x1 → t1, drop.
    await m.getByRole("button", { name: "Tokyo", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await m.getByRole("button", { name: "Check matches" }).click();
    const ev = events(page).filter({ hasText: '"id":"match2"' });
    await expect(ev).toHaveCount(1);
    await expect(ev).toContainText('"type":"matching"');
    await expect(ev).toContainText('"result":"passed"');
    await expect(ev).toContainText("France=paris,Japan=tokyo");
  });
});

test.describe("oelt-categorize", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/categorize.html`);
    await page.locator("oelt-categorize[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("keyboard pick-up announces bucket positions", async ({ page }) => {
    await page.goto(`${DEMOS}/categorize.html`);
    const live = page.locator('#cat [role="status"][aria-live="assertive"]');
    await page.locator("#cat").getByRole("button", { name: "Dog", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(live).toContainText(/Grabbed Dog\. Bank\./);
    await page.keyboard.press("ArrowLeft"); // bank → last bucket (Birds)
    await expect(live).toContainText("Bucket: Birds.");
    await page.keyboard.press("ArrowLeft"); // → Mammals
    await expect(live).toContainText("Bucket: Mammals.");
    await page.keyboard.press("Escape");
    await expect(live).toContainText(/Cancelled/);
  });

  test("keyboard-only: sort the 2 tokens and Check → passed", async ({ page }) => {
    await page.goto(`${DEMOS}/categorize.html`);
    const c = page.locator("#cat2"); // buckets: Mammals(b0), Birds(b1); bank cursor = 2
    // Dog → Mammals: pick up (cursor=2), ArrowLeft x2 → b0, drop.
    await c.getByRole("button", { name: "Dog", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    // Eagle → Birds: pick up (cursor=2), ArrowLeft x1 → b1, drop.
    await c.getByRole("button", { name: "Eagle", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await c.getByRole("button", { name: "Check" }).click();
    const ev = events(page).filter({ hasText: '"id":"cat2"' });
    await expect(ev).toHaveCount(1);
    await expect(ev).toContainText('"type":"matching"');
    await expect(ev).toContainText('"result":"passed"');
    await expect(ev).toContainText("dog=mammals,eagle=birds");
  });
});

test.describe("oelt-quiz", () => {
  test("axe clean", async ({ page }) => {
    await page.goto(`${DEMOS}/quiz.html`);
    await page.locator("oelt-quiz[data-oelt-upgraded]").waitFor();
    await axeClean(page);
  });

  test("status shows progress, then emits one weighted aggregate when all answered", async ({
    page,
  }) => {
    await page.goto(`${DEMOS}/quiz.html`);
    const quiz = page.locator("#quiz1");
    await expect(quiz.locator("[part~='status']")).toHaveText(/Answered 0 of 2/);

    // Answer q1 (mcq) correctly.
    await quiz.locator("#q1").getByRole("radio", { name: /cmi5/ }).check();
    await quiz.locator("#q1").getByRole("button", { name: "Check answer" }).click();
    await expect(quiz.locator("[part~='status']")).toHaveText(/Answered 1 of 2/);
    // The quiz has not aggregated yet (only children have emitted).
    await expect(events(page).filter({ hasText: '"id":"quiz1"' })).toHaveCount(0);

    // Answer q2 (text-entry) correctly → all answered → quiz emits.
    await quiz.locator("#q2 [part~='input']").fill("cmi5");
    await quiz.locator("#q2").getByRole("button", { name: "Check answer" }).click();

    await expect(quiz.locator("[part~='status']")).toHaveText(/Quiz complete\. Score 100%/);
    const quizEvent = events(page).filter({ hasText: '"id":"quiz1"' });
    await expect(quizEvent).toHaveCount(1);
    await expect(quizEvent).toContainText('"type":"performance"');
    await expect(quizEvent).toContainText('"result":"passed"');
    await expect(quizEvent).toContainText('"score":1');
  });

  test("weighted aggregation: wrong high-weight answer fails mastery", async ({ page }) => {
    await page.goto(`${DEMOS}/quiz.html`);
    const quiz = page.locator("#quiz1");
    // q1 (weight 1) correct, q2 (weight 2) wrong → (1·1 + 2·0)/3 ≈ 0.33 < 0.7 mastery.
    await quiz.locator("#q1").getByRole("radio", { name: /cmi5/ }).check();
    await quiz.locator("#q1").getByRole("button", { name: "Check answer" }).click();
    await quiz.locator("#q2 [part~='input']").fill("wrong answer");
    await quiz.locator("#q2").getByRole("button", { name: "Check answer" }).click();

    const quizEvent = events(page).filter({ hasText: '"id":"quiz1"' });
    await expect(quizEvent).toHaveCount(1);
    await expect(quizEvent).toContainText('"result":"failed"');
    // 1/3 rounds to 0.33 in the score region.
    await expect(quiz.locator("[part~='status']")).toHaveText(/Score 33%/);
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

test.describe("oelt-hotspot", () => {
  test("axe clean (single + multiple)", async ({ page }) => {
    await page.goto(`${DEMOS}/hotspot.html`);
    await page.locator("oelt-hotspot[data-oelt-upgraded]").first().waitFor();
    await axeClean(page);
  });

  test("keyboard-only: select the correct region + submit emits a passed choice", async ({
    page,
  }) => {
    await page.goto(`${DEMOS}/hotspot.html`);
    const hs = page.locator("#hs-single");
    await hs.getByRole("button", { name: "Nucleus" }).focus();
    await page.keyboard.press("Space"); // toggle selection (aria-pressed)
    await expect(hs.getByRole("button", { name: "Nucleus" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await hs.getByRole("button", { name: "Check answer" }).focus();
    await page.keyboard.press("Enter");
    const ev = events(page).filter({ hasText: '"id":"hs-single"' });
    await expect(ev).toContainText('"type":"choice"');
    await expect(ev).toContainText('"result":"passed"');
    await expect(ev).toContainText('"response":"nucleus"');
  });

  test("single mode: selecting a second region deselects the first", async ({ page }) => {
    await page.goto(`${DEMOS}/hotspot.html`);
    const hs = page.locator("#hs-single");
    await hs.getByRole("button", { name: "Nucleus" }).click();
    await hs.getByRole("button", { name: "Mitochondria" }).click();
    await expect(hs.getByRole("button", { name: "Nucleus" })).toHaveAttribute("aria-pressed", "false");
    await expect(hs.getByRole("button", { name: "Mitochondria" })).toHaveAttribute("aria-pressed", "true");
  });

  test("multiple mode: partial selection fails, exact set passes", async ({ page }) => {
    await page.goto(`${DEMOS}/hotspot.html`);
    const hs = page.locator("#hs-multi");
    await hs.getByRole("button", { name: "Nucleus" }).click(); // 1 of 2 correct
    await hs.getByRole("button", { name: "Check answer" }).click();
    await expect(events(page).filter({ hasText: '"id":"hs-multi"' })).toContainText(
      '"result":"failed"',
    );
  });
});

test.describe("presentation: tabs / accordion / flip-cards", () => {
  test("axe clean (all three on one page)", async ({ page }) => {
    await page.goto(`${DEMOS}/presentation.html`);
    await page.locator("oelt-tabs[data-oelt-upgraded]").waitFor();
    await page.locator("oelt-flip-cards[data-oelt-upgraded]").waitFor();
    await axeClean(page);
  });

  test("tabs: arrow keys select tabs and reveal the matching panel", async ({ page }) => {
    await page.goto(`${DEMOS}/presentation.html`);
    const tabs = page.locator("#tabs");
    const overview = tabs.getByRole("tab", { name: "Overview" });
    const details = tabs.getByRole("tab", { name: "Details" });
    await overview.focus();
    await expect(overview).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(details).toHaveAttribute("aria-selected", "true");
    await expect(details).toBeFocused();
    await expect(tabs.getByRole("tabpanel")).toHaveText("Details content.");
    // Roving tabindex: the unselected tab is removed from the tab order.
    await expect(overview).toHaveAttribute("tabindex", "-1");
    // End → last tab; ArrowRight wraps from last back to first.
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab", { name: "Examples" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(overview).toHaveAttribute("aria-selected", "true");
  });

  test("accordion: native disclosure, single keeps only one open", async ({ page }) => {
    await page.goto(`${DEMOS}/presentation.html`);
    const panels = page.locator("#acc details");
    await page.locator("#acc summary", { hasText: "What is SCORM?" }).click();
    await expect(panels.nth(0)).toHaveAttribute("open", "");
    await page.locator("#acc summary", { hasText: "What is cmi5?" }).click();
    // `single` (shared name) → opening the second natively closes the first.
    await expect(panels.nth(1)).toHaveAttribute("open", "");
    await expect(panels.nth(0)).not.toHaveAttribute("open", "");
  });

  test("flip-cards: activating a card flips it (aria-pressed + back revealed)", async ({ page }) => {
    await page.goto(`${DEMOS}/presentation.html`);
    const card = page.locator("#cards [part~='card']").first();
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator("[part~='back']")).toBeVisible();
    await expect(card.locator("[part~='front']")).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await expect(card.locator("[part~='front']")).toBeVisible();
  });
});

test.describe("tracking visible in the fake-LMS harness", () => {
  // These tests share one harness server and one mode=scorm12 state file; each
  // resets it at the start. Run serially so parallel workers don't stomp each
  // other's shared state (the source of "Harness error" flakes under load).
  test.describe.configure({ mode: "serial" });

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

  test("scorm12: a quiz records child interactions and its own aggregate", async ({ page }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("#c-toc").getByText("5. Quiz").click();
    await expect(frame.locator("h1")).toHaveText("Quiz");

    // Answer both child questions correctly → quiz emits its weighted aggregate.
    await frame.locator("#qa").getByRole("radio", { name: /cmi5/ }).check();
    await frame.locator("#qa").getByRole("button", { name: "Check answer" }).click();
    await frame.locator("#qb [part~='input']").fill("cmi5");
    await frame.locator("#qb").getByRole("button", { name: "Check answer" }).click();

    // Children recorded as their own interactions (0, 1); quiz aggregate is (2).
    await expectScormValue(page, "cmi.interactions.0.id", "qa");
    await expectScormValue(page, "cmi.interactions.1.id", "qb");
    await expectScormValue(page, "cmi.interactions.2.id", "quizfinal");
    await expectScormValue(page, "cmi.interactions.2.type", "performance");
    await expectScormValue(page, "cmi.interactions.2.result", "correct");
  });

  test("scorm12: answering oelt-likert records a neutral likert cmi.interaction", async ({
    page,
  }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("#c-toc").getByText("6. Survey").click();
    await expect(frame.locator("h1")).toHaveText("Survey");
    await frame.locator("#survey1").getByRole("radio", { name: "Agree", exact: true }).check();
    await frame.locator("#survey1").getByRole("button", { name: "Submit" }).click();
    await expectScormValue(page, "cmi.interactions.0.id", "survey1");
    await expectScormValue(page, "cmi.interactions.0.type", "likert");
    // Survey "completed" maps to SCORM result "neutral".
    await expectScormValue(page, "cmi.interactions.0.result", "neutral");
    await expectScormValue(page, "cmi.interactions.0.student_response", "4");
  });

  test("scorm12: solving oelt-ordering records a sequencing cmi.interaction", async ({ page }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("#c-toc").getByText("7. Ordering").click();
    await expect(frame.locator("h1")).toHaveText("Ordering");
    // 2 distinct items start reversed; one move solves it.
    await frame.locator("#order1 [part~='item']").first().focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await frame.getByRole("button", { name: "Check order" }).click();
    await expectScormValue(page, "cmi.interactions.0.id", "order1");
    await expectScormValue(page, "cmi.interactions.0.type", "sequencing");
    await expectScormValue(page, "cmi.interactions.0.result", "correct");
    await expectScormValue(page, "cmi.interactions.0.student_response", "first,second");
  });

  test("scorm12: solving oelt-matching records a matching cmi.interaction", async ({ page }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("#c-toc").getByText("8. Matching").click();
    await expect(frame.locator("h1")).toHaveText("Matching");
    // France(t0), Japan(t1); bank cursor = 2.
    await frame.locator("#match1").getByRole("button", { name: "Paris", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await frame.locator("#match1").getByRole("button", { name: "Tokyo", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await frame.getByRole("button", { name: "Check matches" }).click();
    await expectScormValue(page, "cmi.interactions.0.id", "match1");
    await expectScormValue(page, "cmi.interactions.0.type", "matching");
    await expectScormValue(page, "cmi.interactions.0.result", "correct");
    await expectScormValue(page, "cmi.interactions.0.student_response", "France=paris,Japan=tokyo");
  });

  test("scorm12: solving oelt-categorize records a matching cmi.interaction", async ({ page }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("#c-toc").getByText("9. Categorize").click();
    await expect(frame.locator("h1")).toHaveText("Categorize");
    // buckets Mammals(b0), Birds(b1); bank cursor = 2.
    await frame.locator("#cat1").getByRole("button", { name: "Dog", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await frame.locator("#cat1").getByRole("button", { name: "Eagle", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await frame.getByRole("button", { name: "Check" }).click();
    await expectScormValue(page, "cmi.interactions.0.id", "cat1");
    await expectScormValue(page, "cmi.interactions.0.type", "matching");
    await expectScormValue(page, "cmi.interactions.0.result", "correct");
    await expectScormValue(page, "cmi.interactions.0.student_response", "dog=mammals,eagle=birds");
  });

  test("scorm12: selecting the correct oelt-hotspot records a choice cmi.interaction", async ({
    page,
  }) => {
    await page.request.delete(`${COURSE}/api/state?mode=scorm12`);
    await page.goto(`${COURSE}/?mode=scorm12`);
    const frame = page.frameLocator("#course-frame");
    await frame.locator("#c-toc").getByText("10. Hotspot").click();
    await expect(frame.locator("h1")).toHaveText("Hotspot");
    await frame.locator("#hotspot1").getByRole("button", { name: "Nucleus" }).click();
    await frame.locator("#hotspot1").getByRole("button", { name: "Check answer" }).click();
    await expectScormValue(page, "cmi.interactions.0.id", "hotspot1");
    await expectScormValue(page, "cmi.interactions.0.type", "choice");
    await expectScormValue(page, "cmi.interactions.0.result", "correct");
    await expectScormValue(page, "cmi.interactions.0.student_response", "nucleus");
  });
});
