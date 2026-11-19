import { expect, test } from "@playwright/test";
import { IPHONE_UA, createWithWizard, signUp, uniqueEmail } from "./helpers";

test("registrazione → QR dinamico → cambio destinazione → scansione simulata", async ({
  page,
  request,
}) => {
  await signUp(page, uniqueEmail());
  await expect(page.getByRole("heading", { name: "Benvenuto in Vorya QR" })).toBeVisible();

  // Create a dynamic QR with the 4-step wizard.
  const shortUrl = await createWithWizard(page, "Sito web", "Menu del giorno", async () => {
    await page.getByLabel("URL di destinazione").fill("https://example.com/menu-pranzo");
  });
  expect(shortUrl).toMatch(/\/[A-Za-z0-9]{7}$/); // 0.3: root form, /r/{slug} stays valid
  const printed = shortUrl.replace(/\/([A-Za-z0-9]{7})$/, "/r/$1");
  const viaR = await request.get(printed, {
    maxRedirects: 0,
    headers: { "User-Agent": IPHONE_UA },
  });
  expect(viaR.status()).toBe(302);

  // Simulated scan: 302 to the destination, never cached.
  const first = await request.get(shortUrl, {
    maxRedirects: 0,
    headers: { "User-Agent": IPHONE_UA },
  });
  expect(first.status()).toBe(302);
  expect(first.headers()["location"]).toBe("https://example.com/menu-pranzo");
  expect(first.headers()["cache-control"]).toBe("no-store");

  // Change the destination: the same printed QR now goes elsewhere.
  await page.getByLabel("URL di destinazione").fill("https://example.com/menu-cena");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();
  const second = await request.get(shortUrl, {
    maxRedirects: 0,
    headers: { "User-Agent": IPHONE_UA },
  });
  expect(second.status()).toBe(302);
  expect(second.headers()["location"]).toBe("https://example.com/menu-cena");

  // Stats count both scans (never "visitors").
  await page.getByRole("main").getByRole("link", { name: "Statistiche" }).click();
  await expect(page.getByRole("heading", { name: "Statistiche" })).toBeVisible();
  await expect(page.getByText("3 scansioni in totale")).toBeVisible();
  await expect(page.getByText("Smartphone")).toBeVisible();

  // Pause: the short link shows the branded inactive page.
  await page.getByRole("link", { name: "Menu del giorno" }).click();
  await page.getByRole("button", { name: "Metti in pausa" }).click();
  await expect(page.getByText("In pausa", { exact: true })).toBeVisible();
  const paused = await request.get(shortUrl, { maxRedirects: 0 });
  expect(paused.status()).toBe(410);
  expect(await paused.text()).toContain("QR non attivo");

  // Dashboard lists the QR with its scans.
  await page.getByRole("link", { name: "Link e QR", exact: true }).click();
  await expect(page.getByRole("link", { name: "Menu del giorno", exact: true })).toBeVisible();
  await expect(page.getByText("1 / 25")).toBeVisible(); // trial = Pro limits
});

test("credenziali errate mostrano un errore", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nessuno@example.com");
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email" })).toContainText(
    "Email o password non valide.",
  );
});

test("le aree private richiedono l’accesso", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
});
