import { describe, expect, it } from "vitest";
import { loadBookingConfig } from "./booking-config.js";

describe("loadBookingConfig", () => {
  it("should apply defaults", () => {
    const config = loadBookingConfig({});
    expect(config.maxAttempts).toBe(3);
    expect(config.retryDelayMs).toBe(150);
    expect(config.retryHttpStatuses.has(500)).toBe(true);
  });

  it("should parse env overrides", () => {
    const config = loadBookingConfig({
      BOOK_MAX_ATTEMPTS: "2",
      BOOK_RETRY_DELAY_MS: "50",
      BOOK_RETRY_HTTP_STATUSES: "500,503",
    });
    expect(config.maxAttempts).toBe(2);
    expect(config.retryDelayMs).toBe(50);
    expect([...config.retryHttpStatuses]).toEqual([500, 503]);
  });
});
