import { describe, expect, it } from "vitest";
import { shouldDeliverAcpMessageToClient } from "./acpStreamFilter";

describe("shouldDeliverAcpMessageToClient", () => {
  it("allows session notifications", () => {
    expect(
      shouldDeliverAcpMessageToClient({
        method: "session/update",
        params: {},
      } as never),
    ).toBe(true);
  });

  it("allows numeric JSON-RPC responses", () => {
    expect(
      shouldDeliverAcpMessageToClient({
        jsonrpc: "2.0",
        id: 3,
        result: {},
      } as never),
    ).toBe(true);
  });

  it("drops string-id responses from Grok shell internals", () => {
    expect(
      shouldDeliverAcpMessageToClient({
        jsonrpc: "2.0",
        id: "skills-reload",
        result: { ok: true },
      } as never),
    ).toBe(false);
  });
});