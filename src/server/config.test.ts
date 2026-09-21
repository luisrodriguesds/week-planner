import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("should apply defaults for minimal env", () => {
    const config = loadConfig({});
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(3847);
    expect(config.databasePath).toBe("data/planner.db");
    expect(config.gogymBaseUrl).toBe("https://gogym.gomygym.com");
    expect(config.smtp).toBeUndefined();
  });

  it("should parse smtp block when all vars are set", () => {
    const config = loadConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      SMTP_FROM: "GoGym <noreply@example.com>",
    });
    expect(config.smtp?.host).toBe("smtp.example.com");
    expect(config.smtp?.port).toBe(587);
  });
});
