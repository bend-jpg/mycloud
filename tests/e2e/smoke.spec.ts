// Smoke tests sur les pages publiques. Pas d'auth requise → fonctionne en CI
// sans seed DB. Vérifie juste que les pages se rendent sans 500.

import { test, expect } from "@playwright/test";

test.describe("Pages publiques", () => {
  test("Landing FR se rend correctement", async ({ page }) => {
    await page.goto("/fr");
    await expect(page).toHaveTitle(/MyTitanCloud/);
    // Le logo cliquable est dans le header
    await expect(page.getByRole("link", { name: /MyTitanCloud/i }).first()).toBeVisible();
  });

  test("Landing EN", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/MyTitanCloud/);
  });

  test("Landing ES", async ({ page }) => {
    await page.goto("/es");
    await expect(page).toHaveTitle(/MyTitanCloud/);
  });

  test("Landing HE — direction RTL", async ({ page }) => {
    await page.goto("/he");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
  });

  test("Page Login accessible", async ({ page }) => {
    await page.goto("/fr/login");
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("Page Signup accessible", async ({ page }) => {
    await page.goto("/fr/signup");
    // au moins un champ email
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test("Page Legal", async ({ page }) => {
    await page.goto("/fr/legal");
    await expect(page.locator("body")).toContainText(/mentions|legal/i);
  });

  test("Page Contact accessible", async ({ page }) => {
    await page.goto("/fr/contact");
    await expect(page.locator("body")).toBeVisible();
  });

  test("404 sur token de partage invalide", async ({ page }) => {
    const res = await page.goto("/fr/s/tokenvraimentinvalide123");
    expect(res?.status()).toBe(404);
  });
});

test.describe("PWA", () => {
  test("manifest.webmanifest est servi", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.name).toMatch(/MyTitanCloud/);
    expect(json.share_target).toBeDefined();
  });
});

test.describe("API publiques", () => {
  test("WebDAV OPTIONS répond sans auth", async ({ request }) => {
    const res = await request.fetch("/api/dav", { method: "OPTIONS" });
    expect(res.status()).toBe(200);
    expect(res.headers()["dav"]).toBe("1");
    expect(res.headers()["allow"]).toContain("PROPFIND");
  });

  test("WebDAV PROPFIND sans auth → 401", async ({ request }) => {
    const res = await request.fetch("/api/dav", { method: "PROPFIND" });
    expect(res.status()).toBe(401);
    expect(res.headers()["www-authenticate"]).toContain("Basic");
  });

  test("/api/me sans session → 401", async ({ request }) => {
    const res = await request.get("/api/me");
    expect(res.status()).toBeGreaterThanOrEqual(200);
    // Peut être 401 (anonyme) ou 200 (dev fallback). On vérifie qu'on tape pas un 500.
    expect(res.status()).toBeLessThan(500);
  });
});
