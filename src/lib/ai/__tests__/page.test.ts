import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "../net-guard";
import { extractPageContent, htmlToText } from "../page-content";

describe("extractPageContent", () => {
  it("prefers schema.org Recipe data, including inside @graph", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not json }</script>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Page"},
        {"@type":["Recipe"],"name":"Tiramisù","recipeYield":"6","recipeIngredient":["250 g mascarpone"],
         "recipeInstructions":[{"@type":"HowToStep","text":"Whip."}],"review":[{"text":"long"}]}
      ]}</script></head><body>Lots of other text</body></html>`;
    const result = extractPageContent(html);
    expect(result.structured).toBe(true);
    const data = JSON.parse(result.content);
    expect(data.name).toBe("Tiramisù");
    expect(data.recipeIngredient).toEqual(["250 g mascarpone"]);
    expect(data.review).toBeUndefined();
  });

  it("falls back to readable page text", () => {
    const html = `<body><nav><script>var x = 1;</script></nav><h1>Pesto</h1><ul><li>Basilico &amp; pinoli</li><li>Olio</li></ul><style>p{}</style></body>`;
    const result = extractPageContent(html);
    expect(result.structured).toBe(false);
    expect(result.content).toBe("Pesto\n- Basilico & pinoli\n- Olio");
  });

  it("decodes numeric entities", () => {
    expect(htmlToText("<p>Rag&#249; &#x2013; 200&nbsp;g</p>")).toBe("Ragù – 200 g");
  });
});

describe("isBlockedAddress", () => {
  it("blocks private, loopback and link-local addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.20", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1", "0.0.0.0"]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });
});
