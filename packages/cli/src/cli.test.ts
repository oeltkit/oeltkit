import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { scorm12Manifest, cmi5Xml } from "./lib/generators.js";
import { validateCourse, type CourseManifest, type LoadedCourse } from "./lib/course.js";
import { exportCourse, importCourse, isSafePath } from "./lib/course-file.js";

const base = (over: Partial<CourseManifest> = {}): CourseManifest => ({
  oelt: "0.1",
  id: "org.oelt.test",
  title: "Test & <Course>",
  lang: "en",
  targets: ["scorm12"],
  structure: [{ id: "m1", title: "M1", pages: [{ id: "p1", title: "P1", src: "pages/p1.html" }] }],
  ...over,
});

describe("manifest generation", () => {
  it("scorm12: SCO resource, version 1.2, XML-escaped title", () => {
    const xml = scorm12Manifest(base());
    expect(xml).toContain('adlcp:scormtype="sco"');
    expect(xml).toContain("<schemaversion>1.2</schemaversion>");
    expect(xml).toContain("Test &amp; &lt;Course&gt;"); // escaped
  });

  it("cmi5: moveOn + masteryScore derive from the tracking rules", () => {
    const withMastery = cmi5Xml(
      base({ tracking: { score: { rule: "weighted-interactions", mastery: 0.8 } } }),
    );
    expect(withMastery).toContain('moveOn="CompletedAndPassed"');
    expect(withMastery).toContain('masteryScore="0.8"');
    const without = cmi5Xml(base());
    expect(without).toContain('moveOn="Completed"');
    expect(without).not.toContain("masteryScore");
  });

  it("cmi5: course + au carry a <description>, ordered before <url> (XSD-valid)", () => {
    // The cmi5 CourseStructure XSD requires <description> after <title>, and the
    // <au> sequence is title → description → url. SCORM Cloud rejects the import
    // otherwise (regression: Task 10 first live run).
    const xml = cmi5Xml(base());
    expect(xml).toContain("<description>");
    // <au> children appear in schema order.
    const au = xml.slice(xml.indexOf("<au "));
    expect(au.indexOf("<title>")).toBeLessThan(au.indexOf("<description>"));
    expect(au.indexOf("<description>")).toBeLessThan(au.indexOf("<url>"));
  });

  it("cmi5: course + au ids are absolute IRIs synthesized from a reverse-DNS id", () => {
    // cmi5/xAPI require an absolute IRI; SCORM Cloud rejects "org.oelt.test"
    // ("Activity ID … is not an absolute URI"). Task 10 second live run.
    const xml = cmi5Xml(base());
    expect(xml).toContain('<course id="https://oeltkit.org/cmi5/org.oelt.test">');
    expect(xml).toContain('<au id="https://oeltkit.org/cmi5/org.oelt.test/au"');
    // An author-supplied absolute IRI is preserved as-is.
    expect(cmi5Xml(base({ id: "https://acme.example/c/1" }))).toContain(
      '<course id="https://acme.example/c/1">',
    );
  });
});

describe("validateCourse cross-checks", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "oelt-cli-"));
    mkdirSync(join(dir, "pages"));
    writeFileSync(join(dir, "pages", "good.html"), '<oelt-mcq id="q1"></oelt-mcq>');
    writeFileSync(join(dir, "pages", "missing.html"), "<p>no interaction element here</p>");
    writeFileSync(
      join(dir, "pages", "media-bad.html"),
      '<oelt-media id="m1"><video controls></video></oelt-media>',
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const load = (course: CourseManifest): LoadedCourse => ({ dir, course });
  const codes = (c: CourseManifest) => validateCourse(load(c)).map((f) => f.code);
  const allHaveMessageHuman = (c: CourseManifest) =>
    validateCourse(load(c)).every(
      (f) => typeof f.message_human === "string" && f.message_human.length > 0,
    );

  it("passes when a declared interaction exists in the page HTML", () => {
    const c = base({
      structure: [
        {
          id: "m1",
          title: "M1",
          pages: [
            {
              id: "p1",
              title: "P1",
              src: "pages/good.html",
              interactions: [{ id: "q1", type: "choice" }],
            },
          ],
        },
      ],
    });
    expect(validateCourse(load(c))).toEqual([]);
  });

  it("flags a declared interaction missing from the page HTML", () => {
    const c = base({
      structure: [
        {
          id: "m1",
          title: "M1",
          pages: [
            {
              id: "p1",
              title: "P1",
              src: "pages/missing.html",
              interactions: [{ id: "q1", type: "choice" }],
            },
          ],
        },
      ],
    });
    expect(codes(c)).toContain("interaction-missing");
    expect(allHaveMessageHuman(c)).toBe(true);
    const finding = validateCourse(load(c)).find((f) => f.code === "interaction-missing")!;
    expect(finding.message_human).toContain("P1"); // page title
    expect(finding.message_human).toContain("q1"); // interaction id
  });

  it("flags <oelt-media> without captions or a transcript", () => {
    const c = base({
      structure: [
        {
          id: "m1",
          title: "M1",
          pages: [{ id: "p1", title: "Media Page", src: "pages/media-bad.html" }],
        },
      ],
    });
    expect(codes(c)).toContain("media-no-alt");
    expect(allHaveMessageHuman(c)).toBe(true);
    const finding = validateCourse(load(c)).find((f) => f.code === "media-no-alt")!;
    expect(finding.message_human).toContain("Media Page"); // page title, not id
  });

  it("flags required-interactions completion with no required interaction", () => {
    const c = base({
      tracking: { completion: { rule: "required-interactions-passed" } },
      structure: [
        {
          id: "m1",
          title: "M1",
          pages: [
            {
              id: "p1",
              title: "P1",
              src: "pages/good.html",
              interactions: [{ id: "q1", type: "choice" }],
            },
          ],
        },
      ],
    });
    expect(codes(c)).toContain("no-required-interaction");
    expect(allHaveMessageHuman(c)).toBe(true);
  });

  it("flags a missing score source interaction", () => {
    const c = base({
      tracking: { score: { rule: "single-interaction", source: "nonexistent-id" } },
      structure: [
        {
          id: "m1",
          title: "M1",
          pages: [{ id: "p1", title: "P1", src: "pages/good.html" }],
        },
      ],
    });
    expect(codes(c)).toContain("score-source");
    expect(allHaveMessageHuman(c)).toBe(true);
    const finding = validateCourse(load(c)).find((f) => f.code === "score-source")!;
    expect(finding.message_human).toContain("nonexistent-id");
  });

  it("every finding has a non-empty message_human (page-missing rule)", () => {
    const c = base({
      structure: [
        {
          id: "m1",
          title: "M1",
          pages: [{ id: "p1", title: "Gone Page", src: "pages/does-not-exist.html" }],
        },
      ],
    });
    expect(codes(c)).toContain("page-missing");
    const finding = validateCourse(load(c)).find((f) => f.code === "page-missing")!;
    expect(finding.message_human).toContain("Gone Page"); // title, not id
    expect(finding.message_human).toContain("pages/does-not-exist.html");
  });
});

describe(".oeltcourse export / import", () => {
  let srcDir: string;
  let workDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "oelt-cf-"));
    srcDir = join(workDir, "src-course");
    mkdirSync(join(srcDir, "pages"), { recursive: true });
    writeFileSync(
      join(srcDir, "course.json"),
      JSON.stringify({
        oelt: "0.1",
        id: "org.oelt.cftest",
        title: "CF Test",
        lang: "en",
        targets: ["web"],
        structure: [
          { id: "m1", title: "M1", pages: [{ id: "p1", title: "P1", src: "pages/p1.html" }] },
        ],
      }),
    );
    writeFileSync(join(srcDir, "pages", "p1.html"), "<section><h1>Hello</h1></section>");
  });

  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  it("round-trip: export → import → identical tree", async () => {
    const outFile = join(workDir, "test.oeltcourse");
    await exportCourse(srcDir, outFile);

    const importDir = join(workDir, "imported");
    await importCourse(outFile, importDir);

    expect(readdirSync(join(importDir, "pages"))).toContain("p1.html");
    const manifest = JSON.parse(readFileSync(join(importDir, "course.json"), "utf8"));
    expect(manifest.id).toBe("org.oelt.cftest");
  });

  it("refuses to import when the embedded manifest requires a newer MAJOR version", async () => {
    const zip = new JSZip();
    zip.file(
      "course.json",
      JSON.stringify({
        oelt: "99.0",
        id: "x.y",
        title: "T",
        lang: "en",
        targets: ["web"],
        structure: [],
      }),
    );
    const bytes = await zip.generateAsync({ type: "nodebuffer" });
    const path = join(workDir, "future.oeltcourse");
    writeFileSync(path, bytes);
    await expect(importCourse(path, join(workDir, "future-out"))).rejects.toThrow(
      /requires toolkit v99\.0 or later/,
    );
  });

  it("refuses to import when archive has no course.json", async () => {
    const zip = new JSZip();
    zip.file("README.txt", "not a course");
    const bytes = await zip.generateAsync({ type: "nodebuffer" });
    const path = join(workDir, "bad.oeltcourse");
    writeFileSync(path, bytes);
    await expect(importCourse(path, join(workDir, "bad-out"))).rejects.toThrow(
      /missing course\.json/,
    );
  });

  it("refuses to import into a non-empty directory", async () => {
    const outFile = join(workDir, "test.oeltcourse");
    const occupied = join(workDir, "occupied");
    mkdirSync(occupied);
    writeFileSync(join(occupied, "existing.txt"), "data");
    await expect(importCourse(outFile, occupied)).rejects.toThrow(/non-empty/);
  });
});

describe("isSafePath zip-slip guard", () => {
  const target = "/safe/target";

  it("allows normal relative paths", () => {
    expect(isSafePath(target, "pages/p1.html")).toBe(true);
    expect(isSafePath(target, "course.json")).toBe(true);
    expect(isSafePath(target, "a/b/c/d.txt")).toBe(true);
  });

  it("rejects absolute POSIX paths", () => {
    expect(isSafePath(target, "/etc/passwd")).toBe(false);
  });

  it("rejects Windows absolute paths", () => {
    expect(isSafePath(target, "C:\\Windows\\System32")).toBe(false);
  });

  it("rejects path-traversal that escapes target", () => {
    expect(isSafePath(target, "../../outside.txt")).toBe(false);
    expect(isSafePath(target, "../sibling/file.txt")).toBe(false);
  });

  it("allows paths that stay inside target", () => {
    expect(isSafePath(target, "deep/../still-inside.txt")).toBe(true);
  });
});
