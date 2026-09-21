import { describe, expect, it } from "vitest";
import { windowStatus } from "./window-status.js";

describe("windowStatus", () => {
  it("should return FUTURE before booking window opens", () => {
    const now = new Date("2026-09-21T08:00:00");
    expect(windowStatus(now, "2026-09-21 09:15:00", "2026-09-21 21:00:00")).toBe("FUTURE");
  });

  it("should return OPEN inside booking window", () => {
    const now = new Date("2026-09-21T15:00:00");
    expect(windowStatus(now, "2026-09-21 09:15:00", "2026-09-21 21:00:00")).toBe("OPEN");
  });

  it("should return CLOSED after booking window", () => {
    const now = new Date("2026-09-21T22:00:00");
    expect(windowStatus(now, "2026-09-21 09:15:00", "2026-09-21 21:00:00")).toBe("CLOSED");
  });
});
