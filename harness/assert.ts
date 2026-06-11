// Programmatic access to the harness call log for Playwright tests.
//
// The harness keeps its log + data-model state in the host window
// (`window.__oelt_harness`, installed by harness/client/panel.js). These
// helpers read it via page.evaluate and poll, since tracking calls land
// asynchronously. This is the stable surface later tasks' a11y/tracking tests
// import — keep it backward compatible.

import { expect, type Page } from "@playwright/test";

export interface LogEntry {
  seq: number;
  t: string;
  mode: string;
  kind: "call" | "statement" | "state" | "info";
  op?: string;
  key?: string;
  value?: string;
  result?: string;
  error?: string;
  verb?: string;
  scaled?: number | null;
}

/** The current harness log (host window). */
export async function getLog(page: Page): Promise<LogEntry[]> {
  return page.evaluate(() => (window as any).__oelt_harness?.getLog() ?? []);
}

/** The data-model state the LMS currently holds (SCORM/web modes). */
export async function getModel(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => (window as any).__oelt_harness?.getModel() ?? {});
}

/** The LMS-visible completion/success/score summary. */
export async function getSummary(
  page: Page,
): Promise<{ completion: string; success: string; score: string }> {
  return page.evaluate(() => (window as any).__oelt_harness?.summary());
}

/** suspend_data byte count as the LMS measures it. */
export async function suspendBytes(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__oelt_harness?.suspendBytes() ?? 0);
}

/** Assert a SCORM/web API operation was logged (e.g. "LMSInitialize", "Terminate"). */
export async function expectCall(page: Page, op: string): Promise<void> {
  await expect
    .poll(async () => (await getLog(page)).some((e) => e.kind === "call" && e.op === op), {
      message: `expected a logged call "${op}"`,
    })
    .toBe(true);
}

/** Assert a SCORM/web data-model element holds the expected value. */
export async function expectScormValue(page: Page, key: string, value: string): Promise<void> {
  await expect
    .poll(async () => (await getModel(page))[key], { message: `expected ${key} = ${value}` })
    .toBe(value);
}

/** Assert a cmi5 xAPI statement was sent. Optionally match its scaled score. */
export async function expectStatement(
  page: Page,
  match: { verb: string; scaled?: number },
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await getLog(page)).some(
          (e) =>
            e.kind === "statement" &&
            e.verb === match.verb &&
            (match.scaled === undefined || e.scaled === match.scaled),
        ),
      { message: `expected a "${match.verb}" statement` },
    )
    .toBe(true);
}
