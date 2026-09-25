import { afterEach, beforeEach } from "vitest";
import {
  assertNoUnexpectedLogs,
  installConsoleCapture,
  resetCapturedLogs,
} from "./expectLog";

installConsoleCapture();

beforeEach(() => {
  resetCapturedLogs();
});

afterEach(() => {
  assertNoUnexpectedLogs();
});
