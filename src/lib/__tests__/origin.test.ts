import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { publicOrigin } from "../origin";

const request = (headers: Record<string, string>) => new NextRequest("http://0.0.0.0:3000/api/agenda/google/connect", { headers });

describe("publicOrigin", () => {
  it("uses the address the browser used, not the one the server listens on", () => {
    expect(publicOrigin(request({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(publicOrigin(request({ host: "x", "x-forwarded-host": "casa-pi-weld.vercel.app", "x-forwarded-proto": "https" }))).toBe(
      "https://casa-pi-weld.vercel.app",
    );
    expect(publicOrigin(request({}))).toBe("http://0.0.0.0:3000");
  });
});
