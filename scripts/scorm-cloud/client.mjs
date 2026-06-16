// Thin SCORM Cloud v2 REST client — DEV-ONLY.
//
// This is a CI/dev script. It is NEVER imported by @oeltkit/runtime or
// @oeltkit/components and never ships in a package (CLAUDE.md hard-rule 1).
// We deliberately do NOT use the official swagger-codegen client
// (@rusticisoftware/scormcloud-api-v2-client-javascript, last published as a
// 1.0.0-beta, superagent/callback-based, browser+node): it is heavy, unmaintained,
// and not worth a dependency for the seven calls we make. A ~150-line fetch
// wrapper over the documented REST surface is clearer and audit-friendly.
//
// API contract (verified against the docs + the official client's generated
// source, June 2026):
//   - Base URL ............ https://cloud.scorm.com/api/v2/
//     https://cloud.scorm.com/docs/v2/reference/api_overview/
//   - Auth ................ HTTP Basic; username = Application ID, password =
//     Secret Key → base64("<APP_ID>:<SECRET_KEY>") in the Authorization header.
//     https://cloud.scorm.com/docs/v2/knowledge_base/authentication_types/
//   - Endpoints (paths confirmed in RusticiSoftware/scormcloud-api-v2-client-javascript):
//       POST   /courses/importJobs/upload?courseId&mayCreateNewVersion   (multipart "file")
//       GET    /courses/importJobs/{importJobId}                          (status: RUNNING|COMPLETE|ERROR)
//       DELETE /courses/{courseId}
//       POST   /registrations                                            (CreateRegistrationSchema)
//       POST   /registrations/{registrationId}/launchLink                ({ launchLink })
//       GET    /registrations/{registrationId}?includeChildResults&includeRuntime  (RegistrationSchema)
//       DELETE /registrations/{registrationId}

const BASE = "https://cloud.scorm.com/api/v2";

export class ScormCloudClient {
  /** @param {{ appId: string, secretKey: string, base?: string }} opts */
  constructor({ appId, secretKey, base = BASE }) {
    if (!appId || !secretKey) throw new Error("ScormCloudClient requires appId + secretKey");
    this.base = base;
    this.auth = "Basic " + Buffer.from(`${appId}:${secretKey}`).toString("base64");
  }

  /**
   * Core request helper.
   * @param {string} method
   * @param {string} path
   * @param {{ query?: Record<string, unknown>, json?: unknown, form?: FormData, raw?: boolean }} [opts]
   */
  async #request(method, path, opts = {}) {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const headers = { Authorization: this.auth, Accept: "application/json" };
    let body;
    if (opts.form) {
      body = opts.form; // fetch sets multipart content-type + boundary
    } else if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `SCORM Cloud ${method} ${path} → ${res.status} ${res.statusText}\n${text.slice(0, 2000)}`,
      );
    }
    if (opts.raw) return text;
    return text ? JSON.parse(text) : {};
  }

  // ── Courses ────────────────────────────────────────────────────────────────

  /**
   * Upload + import a course package zip. Returns the import job id.
   * @param {string} courseId
   * @param {Buffer|Uint8Array} zipBytes
   * @param {string} [filename]
   * @returns {Promise<string>} importJobId
   */
  async importCourse(courseId, zipBytes, filename = "course.zip") {
    const form = new FormData();
    form.append("file", new Blob([zipBytes], { type: "application/zip" }), filename);
    const result = await this.#request("POST", "/courses/importJobs/upload", {
      query: { courseId, mayCreateNewVersion: true },
      form,
    });
    // StringResultSchema → { result: "<importJobId>" }
    if (!result.result)
      throw new Error(`importCourse: no job id in response: ${JSON.stringify(result)}`);
    return result.result;
  }

  /** @returns {Promise<{ jobId: string, status: string, importResult?: object, message?: string }>} */
  getImportJob(importJobId) {
    return this.#request("GET", `/courses/importJobs/${encodeURIComponent(importJobId)}`);
  }

  /** Poll an import job until it leaves RUNNING. Throws on ERROR. */
  async waitForImport(importJobId, { timeoutMs = 120_000, intervalMs = 2000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await this.getImportJob(importJobId);
      if (job.status === "COMPLETE") return job;
      if (job.status === "ERROR") {
        throw new Error(`Course import failed: ${job.message ?? JSON.stringify(job)}`);
      }
      if (Date.now() > deadline) throw new Error(`Course import timed out (job ${importJobId})`);
      await sleep(intervalMs);
    }
  }

  /** Delete a course (idempotent-ish — ignores 404). */
  async deleteCourse(courseId) {
    try {
      await this.#request("DELETE", `/courses/${encodeURIComponent(courseId)}`);
    } catch (err) {
      if (!/→ 404/.test(String(err))) throw err;
    }
  }

  // ── Registrations ────────────────────────────────────────────────────────────

  /**
   * @param {{ courseId: string, registrationId: string, learner: { id: string, firstName?: string, lastName?: string } }} reg
   */
  createRegistration(reg) {
    return this.#request("POST", "/registrations", { json: reg, raw: true });
  }

  /**
   * Build a single-use launch link for a registration.
   * @returns {Promise<string>} the launch URL
   */
  async buildLaunchLink(registrationId, { redirectOnExitUrl = "https://cloud.scorm.com/" } = {}) {
    const res = await this.#request(
      "POST",
      `/registrations/${encodeURIComponent(registrationId)}/launchLink`,
      { json: { redirectOnExitUrl } },
    );
    if (!res.launchLink)
      throw new Error(`buildLaunchLink: no launchLink in response: ${JSON.stringify(res)}`);
    return res.launchLink;
  }

  /**
   * Fetch the registration result/progress (RegistrationSchema). With runtime +
   * child results it includes the activity/runtime detail used for failure artifacts.
   * @returns {Promise<object>} RegistrationSchema
   */
  getRegistration(registrationId, { includeChildResults = true, includeRuntime = true } = {}) {
    return this.#request("GET", `/registrations/${encodeURIComponent(registrationId)}`, {
      query: { includeChildResults, includeRuntime },
    });
  }

  /**
   * Poll a registration until `predicate(reg)` is true or it times out.
   * Returns the last fetched registration either way (caller asserts).
   */
  async waitForRegistration(
    registrationId,
    predicate,
    { timeoutMs = 60_000, intervalMs = 2000 } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    let last;
    for (;;) {
      last = await this.getRegistration(registrationId);
      try {
        if (predicate(last)) return last;
      } catch {
        /* predicate may throw on partial data; keep polling */
      }
      if (Date.now() > deadline) return last;
      await sleep(intervalMs);
    }
  }

  /** Delete a registration (idempotent-ish — ignores 404). */
  async deleteRegistration(registrationId) {
    try {
      await this.#request("DELETE", `/registrations/${encodeURIComponent(registrationId)}`);
    } catch (err) {
      if (!/→ 404/.test(String(err))) throw err;
    }
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
