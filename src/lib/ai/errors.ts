import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/** Anthropic's own explanation of a failed call, from the response body. */
function apiMessage(error: InstanceType<typeof Anthropic.APIError>): string {
  const body = error.error as { error?: { message?: unknown } } | undefined;
  return typeof body?.error?.message === "string" ? body.error.message : error.message;
}

/** A plain-English reason for a failed Claude call, to show in the app. */
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return `The Claude API key was refused (401: ${apiMessage(error)}). The key in Vercel's ANTHROPIC_API_KEY may be mistyped, revoked or deleted; check it in the Claude Console, update it in Vercel, then redeploy.`;
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return `Claude accepted the API key but didn't allow this request (403: ${apiMessage(error)}). This isn't about credit; check the key's organization and workspace in the Claude Console.`;
  }
  if (error instanceof Anthropic.APIError && error.type === "billing_error") {
    return `Claude refused the request because of billing (402: ${apiMessage(error)}).`;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Claude's usage limit for this API key was reached. Wait a minute and try again.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Claude. Try again in a moment.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude returned an error${error.status ? ` (${error.status})` : ""}: ${apiMessage(error)}`;
  }
  if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
    return "No Claude API key is set. Add ANTHROPIC_API_KEY to Vercel's environment variables, then redeploy.";
  }
  return `Something went wrong: ${error instanceof Error ? error.message : String(error)}`;
}
