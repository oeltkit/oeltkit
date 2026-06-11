// Navigation model driven by course.json. Linear page list across modules;
// current page persisted to the adapter for resume. Rendering is the host's job
// (the runtime owns nav state and emits page-change).

import type { Adapter, CourseManifest, Emit, Page } from "./types.js";
import type { TrackingEngine } from "./tracking.js";

export interface Nav {
  readonly pages: ReadonlyArray<Page>;
  current(): number;
  currentPage(): Page;
  go(index: number): void;
  next(): void;
  prev(): void;
}

export function createNav(
  manifest: CourseManifest,
  engine: TrackingEngine,
  adapter: Adapter,
  emit: Emit,
): Nav {
  const pages = manifest.structure.flatMap((m) => m.pages);
  let index = 0;

  function go(to: number): void {
    index = Math.max(0, Math.min(pages.length - 1, to));
    const page = pages[index]!;
    engine.recordPageView(page.id);
    adapter.setLocation(page.id);
    adapter.commit();
    emit({ type: "page-change", index, pageId: page.id });
  }

  return {
    pages,
    current: () => index,
    currentPage: () => pages[index]!,
    go,
    next: () => go(index + 1),
    prev: () => go(index - 1),
  };
}
