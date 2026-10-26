import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { describeClaudeError } = await import("../errors");

const apiError = (status: number, type: string, message: string) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, undefined, new Headers());

describe("describeClaudeError", () => {
  it("tells a refused key from a refused request, with Anthropic's reason", () => {
    const refusedKey = describeClaudeError(apiError(401, "authentication_error", "invalid x-api-key"));
    expect(refusedKey).toContain("401: invalid x-api-key");
    expect(refusedKey).toContain("API key was refused");

    const forbidden = describeClaudeError(apiError(403, "permission_error", "Your workspace can't use this model."));
    expect(forbidden).toContain("403: Your workspace can't use this model.");
    expect(forbidden).toContain("accepted the API key");
  });
});
