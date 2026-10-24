import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedAddress } from "./net-guard";
import { extractPageContent } from "./page-content";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 5;

export class FetchPageError extends Error {}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchPageError("Only http and https links can be read.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new FetchPageError("That website couldn't be found.");
  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new FetchPageError("That link points to a private network address.");
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FetchPageError("That page is too large to read.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Fetches a public web page and returns its recipe data or readable text. */
export async function fetchRecipePage(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new FetchPageError("That doesn't look like a link.");
  }

  for (let redirects = 0; ; redirects++) {
    await assertPublic(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; Ricettario/1.0; household recipe app)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      throw new FetchPageError("The website didn't respond.");
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) throw new FetchPageError("That link redirects too many times.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new FetchPageError(`The website refused the request (error ${response.status}). Try pasting the recipe text instead.`);
    }

    const html = await readLimited(response);
    return { url: url.toString(), ...extractPageContent(html) };
  }
}
