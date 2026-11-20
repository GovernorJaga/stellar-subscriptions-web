import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cursorLedger, explainError, withRetry } from "./stellar";
import { LEDGER_SECONDS as FORMAT_LEDGER_SECONDS } from "./format";
import { LEDGER_SECONDS } from "./stellar";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries transient rate-limit errors up to three times", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));
    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toThrow(/rate limit/i);

    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("retries transient network errors up to three times", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network error"));
    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toThrow(/network/i);

    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("applies backoff between retries using fake timers", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));
    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toThrow(/rate limit/i);

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("never retries contract errors and throws on the first attempt", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("contract error: cap exceeded"));
    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toThrow(/contract error/i);

    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("explainError", () => {
  it("explains known error codes", () => {
    expect(explainError("RATE_LIMIT")).toMatch(/rate limit/i);
  });

  it("falls back gracefully for unknown codes", () => {
    const message = explainError("SOME_UNKNOWN_CODE");
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
  });

  it("explains balance-style messages", () => {
    expect(explainError("insufficient balance")).toMatch(/balance/i);
  });
});

describe("cursorLedger", () => {
  it("returns 0 for malformed cursor strings without throwing", () => {
    expect(() => cursorLedger("bad-cursor")).not.toThrow();
    expect(cursorLedger("bad-cursor")).toBe(0);
    expect(() => cursorLedger("")).not.toThrow();
    expect(cursorLedger("")).toBe(0);
    expect(() => cursorLedger("not-a-number-0")).not.toThrow();
    expect(cursorLedger("not-a-number-0")).toBe(0);
  });

  it("decodes a valid cursor correctly", () => {
    const ledger = 12345;
    const cursor = `${ledger}-1`;
    expect(cursorLedger(cursor)).toBe(ledger);
  });
});

describe("LEDGER_SECONDS", () => {
  it("is exported from lib/stellar and re-exported by lib/format with the same value", () => {
    expect(typeof LEDGER_SECONDS).toBe("number");
    expect(FORMAT_LEDGER_SECONDS).toBe(LEDGER_SECONDS);
  });
});
