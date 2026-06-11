// SCORM API discovery — the standard content-side search algorithm: walk up the
// parent window chain, then the opener chain, looking for the API handle the LMS
// placed on a containing window. (SCORM 1.2 "Finding the API" / SCORM 2004
// "API Instance" discovery.)

/** The SCORM 1.2 content-side API surface OELT uses. */
export interface Scorm12Api {
  LMSInitialize(arg: string): string;
  LMSFinish(arg: string): string;
  LMSGetValue(key: string): string;
  LMSSetValue(key: string, value: string): string;
  LMSCommit(arg: string): string;
  LMSGetLastError(): string;
}

/** The SCORM 2004 content-side API surface OELT uses. */
export interface Scorm2004Api {
  Initialize(arg: string): string;
  Terminate(arg: string): string;
  GetValue(key: string): string;
  SetValue(key: string, value: string): string;
  Commit(arg: string): string;
  GetLastError(): string;
}

function search(start: Window | null, name: string): unknown {
  let win: Window | null = start;
  for (let depth = 0; win && depth < 10; depth++) {
    const handle = (win as unknown as Record<string, unknown>)[name];
    if (handle) return handle;
    if (win.parent === win) break;
    win = win.parent;
  }
  return null;
}

export function findScormApi(name: "API"): Scorm12Api | null;
export function findScormApi(name: "API_1484_11"): Scorm2004Api | null;
export function findScormApi(name: "API" | "API_1484_11"): Scorm12Api | Scorm2004Api | null {
  if (typeof window === "undefined") return null;
  const fromParents = search(window, name);
  if (fromParents) return fromParents as Scorm12Api | Scorm2004Api;
  const opener = (window as unknown as { opener: Window | null }).opener;
  if (opener) {
    const fromOpener = search(opener, name);
    if (fromOpener) return fromOpener as Scorm12Api | Scorm2004Api;
  }
  return null;
}
