import { describe, it, expect } from "vitest";
import { createTrackingEngine } from "./tracking.js";
import { createStateStore, QuotaExceededError, type StateStore } from "./state.js";
import type { Adapter, CourseManifest, Outcome, RuntimeEvent } from "./types.js";

// A stateful fake adapter: captures outcomes and actually round-trips suspend so
// resume can be exercised without a browser/LMS.
function fakeAdapter() {
  let suspend = "";
  let location = "";
  const outcomes: Outcome[] = [];
  const adapter: Adapter = {
    name: "web",
    start: async () => {},
    entry: () => (suspend || location ? "resume" : "new"),
    getSuspend: () => suspend,
    setSuspend: (p) => {
      suspend = p;
    },
    getLocation: () => location,
    setLocation: (id) => {
      location = id;
    },
    applyOutcome: (o) => outcomes.push({ ...o }),
    reportInteraction: () => {},
    commit: () => {},
    terminate: () => {},
  };
  return { adapter, outcomes, dumpSuspend: () => suspend };
}

const manifest = (tracking?: CourseManifest["tracking"]): CourseManifest => ({
  oelt: "0.1",
  id: "org.oeltkit.test",
  title: "Test",
  lang: "en",
  targets: ["web"],
  ...(tracking ? { tracking } : {}),
  structure: [
    {
      id: "m1",
      title: "M1",
      pages: [
        { id: "p1", title: "P1", src: "p1.html" },
        { id: "p2", title: "P2", src: "p2.html" },
        {
          id: "q",
          title: "Quiz",
          src: "q.html",
          interactions: [{ id: "quiz1", type: "quiz", weight: 1, required: true }],
        },
      ],
    },
  ],
});

const last = (o: Outcome[]) => o[o.length - 1]!;

describe("tracking engine — completion rules", () => {
  it("zero-config default: all-pages-viewed", () => {
    const { adapter, outcomes } = fakeAdapter();
    const e = createTrackingEngine(
      manifest(),
      adapter,
      createStateStore(adapter, () => {}),
    );
    e.recordPageView("p1");
    expect(last(outcomes).completion).toBe(false);
    e.recordPageView("p2");
    e.recordPageView("q");
    expect(last(outcomes).completion).toBe(true);
    expect(last(outcomes).progress).toBe(1); // pages-viewed default
  });

  it("pages-viewed with threshold", () => {
    const { adapter, outcomes } = fakeAdapter();
    const m = manifest({ completion: { rule: "pages-viewed", threshold: 0.6 } });
    const e = createTrackingEngine(
      m,
      adapter,
      createStateStore(adapter, () => {}),
    );
    e.recordPageView("p1"); // 1/3 < ceil(0.6*3)=2
    expect(last(outcomes).completion).toBe(false);
    e.recordPageView("p2"); // 2/3 >= 2
    expect(last(outcomes).completion).toBe(true);
  });

  it("manual rule only completes on track.complete()", () => {
    const { adapter, outcomes } = fakeAdapter();
    const e = createTrackingEngine(
      manifest({ completion: { rule: "manual" } }),
      adapter,
      createStateStore(adapter, () => {}),
    );
    e.recordPageView("p1");
    e.recordPageView("p2");
    e.recordPageView("q");
    expect(last(outcomes).completion).toBe(false);
    e.complete();
    expect(last(outcomes).completion).toBe(true);
  });
});

describe("tracking engine — score, mastery, and the success signal", () => {
  const m = manifest({
    completion: { rule: "required-interactions-passed" },
    score: { rule: "weighted-interactions", mastery: 0.8 },
  });

  it("passing the required interaction completes and passes", () => {
    const { adapter, outcomes } = fakeAdapter();
    const e = createTrackingEngine(
      m,
      adapter,
      createStateStore(adapter, () => {}),
    );
    e.recordInteraction({ id: "quiz1", result: "passed", score: 1 });
    const o = last(outcomes);
    expect(o.completion).toBe(true);
    expect(o.score).toBe(1);
    expect(o.success).toBe("passed"); // 1 >= 0.8
  });

  it("failing below mastery reports failed and not complete", () => {
    const { adapter, outcomes } = fakeAdapter();
    const e = createTrackingEngine(
      m,
      adapter,
      createStateStore(adapter, () => {}),
    );
    e.recordInteraction({ id: "quiz1", result: "failed", score: 0.5 });
    const o = last(outcomes);
    expect(o.success).toBe("failed"); // 0.5 < 0.8
    expect(o.completion).toBe(false); // required-interactions-passed not met
  });

  it("success is null when no mastery is defined (drives the 1.2 collapse)", () => {
    const { adapter, outcomes } = fakeAdapter();
    const m2 = manifest({ score: { rule: "single-interaction", source: "quiz1" } });
    const e = createTrackingEngine(
      m2,
      adapter,
      createStateStore(adapter, () => {}),
    );
    e.recordInteraction({ id: "quiz1", result: "passed", score: 0.9 });
    expect(last(outcomes).success).toBeNull();
    expect(last(outcomes).score).toBe(0.9);
  });
});

describe("suspend state store", () => {
  it("rejects writes over the 3 KB budget with QuotaExceededError", () => {
    const { adapter } = fakeAdapter();
    const store = createStateStore(adapter, () => {});
    expect(() => store.set("big", "x".repeat(5000))).toThrow(QuotaExceededError);
    expect(store.keys()).not.toContain("big"); // existing state untouched
  });

  it("reserves the __ namespace from authors", () => {
    const { adapter } = fakeAdapter();
    const store: StateStore = createStateStore(adapter, () => {});
    expect(() => store.set("__track", { x: 1 })).toThrow(/reserved/);
    store.setReserved("__track", { x: 1 });
    expect(store.keys()).not.toContain("__track");
    expect(store.getReserved("__track")).toEqual({ x: 1 });
  });

  it("round-trips author state and emits a state event", () => {
    const { adapter } = fakeAdapter();
    const events: RuntimeEvent[] = [];
    const store = createStateStore(adapter, (e) => events.push(e));
    store.set("note", "hello");
    expect(store.get("note")).toBe("hello");
    expect(events.at(-1)).toMatchObject({ type: "state", key: "note" });
  });
});

describe("resume", () => {
  it("rehydrates the engine so completion is not downgraded after reload", () => {
    const first = fakeAdapter();
    const store1 = createStateStore(first.adapter, () => {});
    const e1 = createTrackingEngine(
      manifest({
        completion: { rule: "required-interactions-passed" },
        score: { rule: "weighted-interactions", mastery: 0.8 },
      }),
      first.adapter,
      store1,
    );
    e1.recordInteraction({ id: "quiz1", result: "passed", score: 1 });
    expect(last(first.outcomes).completion).toBe(true);

    // Simulate reload: a new adapter seeded with the persisted suspend payload.
    const resumed = fakeAdapter();
    resumed.adapter.setSuspend(first.dumpSuspend());
    const store2 = createStateStore(resumed.adapter, () => {});
    const e2 = createTrackingEngine(
      manifest({
        completion: { rule: "required-interactions-passed" },
        score: { rule: "weighted-interactions", mastery: 0.8 },
      }),
      resumed.adapter,
      store2,
    );
    store2.hydrate(); // after adapter.start() in the real flow
    e2.hydrate();
    e2.evaluate();
    const o = last(resumed.outcomes);
    expect(o.completion).toBe(true); // restored, not downgraded
    expect(o.success).toBe("passed");
  });
});
