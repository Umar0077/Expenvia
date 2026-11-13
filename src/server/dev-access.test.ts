import { afterEach, describe, expect, it, vi } from "vitest";
import { devAccessEnabled } from "./dev-access";

afterEach(() => vi.unstubAllEnvs());

describe("development account access", () => {
  it("requires explicit opt-in in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_ACCOUNTS", undefined);
    expect(devAccessEnabled()).toBe(false);
    vi.stubEnv("ALLOW_DEV_ACCOUNTS", "false");
    expect(devAccessEnabled()).toBe(false);
    vi.stubEnv("ALLOW_DEV_ACCOUNTS", "true");
    expect(devAccessEnabled()).toBe(true);
  });

  it("refuses production even with the flag enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_ACCOUNTS", "true");
    expect(devAccessEnabled()).toBe(false);
  });
});
