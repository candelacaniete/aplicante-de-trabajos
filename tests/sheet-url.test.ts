import { describe, expect, it } from "vitest";
import { requireSheetId, sheetIdFromUrl } from "../shared/sheet-url";
import { messageForEmptyApiResponse, messageForNonJsonApiResponse } from "../shared/api-client";

describe("sheetIdFromUrl", () => {
  it("acepta el link de compartir de Google Sheets", () => {
    const url =
      "https://docs.google.com/spreadsheets/d/1Xv4KTjOXytiAJJ9EK3AHXEojS8KV-m2IMoGjS-C9smM/edit?usp=sharing";
    expect(sheetIdFromUrl(url)).toBe("1Xv4KTjOXytiAJJ9EK3AHXEojS8KV-m2IMoGjS-C9smM");
  });

  it("rechaza un link que no es de Sheets", () => {
    expect(sheetIdFromUrl("https://docs.google.com/document/d/abc/edit")).toBeNull();
    expect(() => requireSheetId("https://example.com")).toThrow(/no parece válido/);
  });
});

describe("messageForEmptyApiResponse", () => {
  it("explica Vercel cuando el cuerpo viene vacío", () => {
    expect(messageForEmptyApiResponse(500)).toMatch(/npm run dev/);
    expect(messageForEmptyApiResponse(413)).toMatch(/demasiado grande/);
  });

  it("incluye un recorte si la respuesta no era JSON", () => {
    expect(messageForNonJsonApiResponse(502, "<html>bad gateway</html>")).toMatch(/502/);
  });
});
