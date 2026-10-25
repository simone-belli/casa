import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/** A plain-English reason for a failed Claude call, to show in the app. */
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "The Claude API key was refused. Check ANTHROPIC_API_KEY in .env.local on the computer running the app, then restart it.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Claude's usage limit for this API key was reached. Wait a minute and try again.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Claude. Check the internet connection of the computer running the app.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude returned an error${error.status ? ` (${error.status})` : ""}: ${error.message}`;
  }
  if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
    return "No Claude API key is set. Add ANTHROPIC_API_KEY to .env.local on the computer running the app, then restart it.";
  }
  return `Something went wrong: ${error instanceof Error ? error.message : String(error)}`;
}
