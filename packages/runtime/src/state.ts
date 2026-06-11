// Suspend-data state: a key/value store that round-trips through the active
// adapter and enforces the OELT suspend budget (tracking-semantics.md §8). All
// component/author state MUST go through here — never the LMS API directly — so
// the quota is enforced before an LMS can silently truncate it.
//
// Keys beginning with "__" are reserved for the runtime (e.g. the tracking
// engine's resume snapshot) and are hidden from the author-facing get/keys.

import type { Adapter, Emit } from "./types.js";

/** OELT enforced suspend budget in bytes (stricter than SCORM 1.2's 4 KB). */
export const SUSPEND_BUDGET_BYTES = 3072;
const RESERVED_PREFIX = "__";

const byteLength = (s: string): number =>
  typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(s).length
    : Buffer.byteLength(s, "utf8");

/** Thrown when a state write would exceed the suspend budget. */
export class QuotaExceededError extends Error {
  constructor(
    readonly bytes: number,
    readonly budget: number,
  ) {
    super(`Suspend data ${bytes} bytes exceeds the ${budget}-byte OELT budget`);
    this.name = "QuotaExceededError";
  }
}

export interface StateStore {
  /**
   * Load the resumed suspend payload from the adapter. MUST be called after
   * adapter.start() — a SCORM adapter cannot read suspend_data before
   * LMSInitialize, and the cmi5 adapter fills its cache during start().
   */
  hydrate(): void;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  keys(): string[];
  /** Current serialized byte size (including reserved runtime state). */
  bytes(): number;
  /** Internal: read/write the runtime-reserved namespace (tracking snapshot). */
  getReserved(key: string): unknown;
  setReserved(key: string, value: unknown): void;
}

export function createStateStore(adapter: Adapter, emit: Emit): StateStore {
  let data: Record<string, unknown> = {};

  const commit = (key: string, value: unknown): void => {
    const candidate = { ...data, [key]: value };
    const serialized = JSON.stringify(candidate);
    const bytes = byteLength(serialized);
    if (bytes > SUSPEND_BUDGET_BYTES) {
      // Reject and leave existing state untouched — fail loudly, don't truncate.
      throw new QuotaExceededError(bytes, SUSPEND_BUDGET_BYTES);
    }
    data = candidate;
    adapter.setSuspend(serialized);
    adapter.commit();
    emit({ type: "state", op: "set", key, value: serialized, bytes });
  };

  return {
    hydrate() {
      try {
        data = JSON.parse(adapter.getSuspend() || "{}") as Record<string, unknown>;
      } catch {
        data = {};
      }
    },
    get: (key) => (key.startsWith(RESERVED_PREFIX) ? undefined : data[key]),
    set(key, value) {
      if (key.startsWith(RESERVED_PREFIX)) {
        throw new Error(
          `State keys beginning with "${RESERVED_PREFIX}" are reserved for the runtime`,
        );
      }
      commit(key, value);
    },
    keys: () => Object.keys(data).filter((k) => !k.startsWith(RESERVED_PREFIX)),
    bytes: () => byteLength(JSON.stringify(data)),
    getReserved: (key) => data[key],
    setReserved: (key, value) => commit(key, value),
  };
}
