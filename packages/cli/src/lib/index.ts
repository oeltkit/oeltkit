// Public library surface of @oeltkit/cli. Consumers (the MCP server, the test
// harness) import course loading/validation, packaging, and .oeltcourse helpers
// from here rather than reaching into individual modules.

export {
  loadCourse,
  validateCourse,
  type CourseManifest,
  type LoadedCourse,
  type Module,
  type Page,
  type Interaction,
  type Tracking,
  type Finding,
} from "./course.js";

export {
  buildPackage,
  writePackage,
  scorm12Manifest,
  scorm2004Manifest,
  cmi5Xml,
  indexHtml,
  type Target,
} from "./generators.js";

export {
  exportCourse,
  importCourse,
  isOeltCourse,
  isSafePath,
  withCourseDir,
} from "./course-file.js";
