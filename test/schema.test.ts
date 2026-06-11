import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// @ts-expect-error — plain ESM helper, no types needed for tests.
import { validateCourse } from "./lib/validate-course.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** A minimal valid manifest, cloned per test so mutations don't leak. */
function base(): Record<string, unknown> {
  return {
    oelt: "0.1",
    id: "org.oeltkit.test",
    title: "Test Course",
    lang: "en",
    targets: ["web"],
    structure: [
      { id: "m1", title: "Module 1", pages: [{ id: "p1", title: "Page 1", src: "pages/p1.html" }] },
    ],
  };
}

describe("course.schema.json — valid manifests", () => {
  it("accepts the shipped minimal example", () => {
    const path = resolve(here, "../examples/minimal/course.json");
    const course = JSON.parse(readFileSync(path, "utf8"));
    const { valid, errors } = validateCourse(course);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it("accepts a fully-tracked manifest", () => {
    const course = base();
    (course.structure as any[])[0].pages[0].interactions = [
      { id: "final-quiz", type: "quiz", weight: 1.0, required: true },
    ];
    course.tracking = {
      completion: { rule: "required-interactions-passed" },
      score: { rule: "weighted-interactions", mastery: 0.8 },
      progress: { rule: "pages-viewed" },
    };
    expect(validateCourse(course).valid).toBe(true);
  });

  it("accepts pages-viewed completion with a threshold", () => {
    const course = base();
    course.tracking = { completion: { rule: "pages-viewed", threshold: 0.75 } };
    expect(validateCourse(course).valid).toBe(true);
  });

  it("accepts single-interaction score with a source", () => {
    const course = base();
    course.tracking = { score: { rule: "single-interaction", source: "final-quiz" } };
    expect(validateCourse(course).valid).toBe(true);
  });
});

describe("course.schema.json — rejected manifests", () => {
  const reject = (mutate: (c: Record<string, unknown>) => void) => {
    const course = base();
    mutate(course);
    return validateCourse(course).valid;
  };

  it("rejects a missing required top-level field", () => {
    expect(reject((c) => delete c.title)).toBe(false);
  });

  it("rejects an unknown top-level field", () => {
    expect(reject((c) => (c.author = "nope"))).toBe(false);
  });

  it("rejects an unsupported target", () => {
    expect(reject((c) => (c.targets = ["scorm12", "aicc"]))).toBe(false);
  });

  it("rejects a non-reverse-DNS id", () => {
    expect(reject((c) => (c.id = "Not An Id"))).toBe(false);
  });

  it("rejects an id token that is not a valid HTML id", () => {
    expect(reject((c) => ((c.structure as any[])[0].id = "1bad"))).toBe(false);
  });

  it("rejects an empty structure", () => {
    expect(reject((c) => (c.structure = []))).toBe(false);
  });

  it("rejects a module with no pages", () => {
    expect(reject((c) => ((c.structure as any[])[0].pages = []))).toBe(false);
  });

  it("rejects threshold on a non pages-viewed completion rule", () => {
    expect(
      reject((c) => (c.tracking = { completion: { rule: "all-pages-viewed", threshold: 0.5 } })),
    ).toBe(false);
  });

  it("rejects pages-viewed completion without a threshold", () => {
    expect(reject((c) => (c.tracking = { completion: { rule: "pages-viewed" } }))).toBe(false);
  });

  it("rejects single-interaction score without a source", () => {
    expect(reject((c) => (c.tracking = { score: { rule: "single-interaction" } }))).toBe(false);
  });

  it("rejects a source on a non single-interaction score rule", () => {
    expect(
      reject((c) => (c.tracking = { score: { rule: "weighted-interactions", source: "x" } })),
    ).toBe(false);
  });

  it("rejects mastery when the score rule is none", () => {
    expect(reject((c) => (c.tracking = { score: { rule: "none", mastery: 0.8 } }))).toBe(false);
  });

  it("rejects mastery outside 0–1", () => {
    expect(
      reject((c) => (c.tracking = { score: { rule: "weighted-interactions", mastery: 80 } })),
    ).toBe(false);
  });

  it("rejects an unknown interaction type pattern", () => {
    expect(
      reject(
        (c) => ((c.structure as any[])[0].pages[0].interactions = [{ id: "q", type: "MCQ Quiz!" }]),
      ),
    ).toBe(false);
  });
});
