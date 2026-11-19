import { expect, test } from "@playwright/test";
import { IPHONE_UA, signUp, uniqueEmail } from "./helpers";

// Runs with reducedMotion "reduce" (see the reduced-motion project in playwright.config.ts).

test("link breve → back-half → genera QR → cambio tipo a vCard → ripristino", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signUp(page, uniqueEmail("link"), "Cantina Test");

  // Quick short link: paste, create, copied.
  await page.getByLabel("URL da accorciare").fill("https://example.com/vendemmia");
  await page.getByRole("button", { name: "Crea link" }).click();
  await expect(page.getByText(/Link (copiato|creato)/)).toBeVisible();
  await page.getByRole("link", { name: "Link e QR", exact: true }).click();
  await page.getByRole("radio", { name: "Link brevi" }).click();
  await page
    .getByRole("link", { name: /example\.com/ })
    .first()
    .click();
  await page.waitForURL(/\/qr\/\d+$/);
  const slug = (await page.locator("code").first().textContent())!.trim().split("/").pop()!;

  // Back-half as an alias: both addresses work.
  await page.getByLabel("Nuovo back-half").fill("vendemmia2026");
  await expect(page.getByText("Disponibile.")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.locator("code", { hasText: "/vendemmia2026" })).toBeVisible();
  const headers = { "User-Agent": IPHONE_UA };
  for (const path of ["/vendemmia2026", `/${slug}`, `/r/${slug}`]) {
    const hop = await request.get(path, { maxRedirects: 0, headers });
    expect(hop.status(), path).toBe(302);
    expect(hop.headers()["location"]).toBe("https://example.com/vendemmia");
  }

  // The link becomes a QR: same slug.
  await page.getByRole("button", { name: "Genera QR" }).click();
  await expect(page.getByRole("heading", { name: "Scarica" })).toBeVisible();

  // Change type to vCard (warning first), save, then restore the previous version.
  await page.getByRole("button", { name: "Cambia tipo" }).click();
  await expect(
    page.getByText("Chi scansiona questo QR vedrà subito il nuovo contenuto"),
  ).toBeVisible();
  await page.getByRole("dialog").locator("label", { hasText: "vCard" }).click();
  await page.getByRole("button", { name: "Continua" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Giulia");
  await page.getByLabel("Cognome").fill("Bianchi");
  await page.getByLabel("Numero").fill("+39 333 1234567");
  await page.getByRole("button", { name: "Salva e cambia tipo" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();
  const asPage = await request.get(`/vendemmia2026`, { maxRedirects: 0, headers });
  expect(asPage.status()).toBe(200); // hosted page rendered on the same URL
  expect(await asPage.text()).toContain("Giulia");

  await page.reload();
  await page.getByRole("button", { name: "Ripristina questa versione" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Ripristina" }).click();
  await expect(page.getByText(/Versione \d+ ripristinata/)).toBeVisible();
  const back = await request.get(`/vendemmia2026`, { maxRedirects: 0, headers });
  expect(back.status()).toBe(302);
});

test("QR statico: avviso, 'Usa la versione dinamica' e 'Duplica e modifica'", async ({ page }) => {
  await signUp(page, uniqueEmail("static"), "Bar Statico");
  await page.getByRole("link", { name: /Crea il tuo primo QR/ }).click();
  await page.locator("label", { hasText: "Wi-Fi" }).first().click();
  const notice = page.getByTestId("static-notice");
  await expect(notice).toContainText("NON potrà più essere modificato");
  await expect(notice.getByRole("button", { name: "Usa la versione dinamica" })).toHaveCount(0);

  await page.locator("label", { hasText: "Sito web" }).first().click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Nome del QR").fill("Sito stampato");
  await page.getByLabel("QR dinamico").uncheck();
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/stampa");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Scansionabile")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByTestId("static-notice")).toBeVisible(); // again in the summary

  // Go dynamic with the data already typed.
  await page.getByRole("button", { name: "Usa la versione dinamica" }).click();
  await expect(page.getByTestId("static-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "Indietro" }).click();
  await page.getByRole("button", { name: "Indietro" }).click();
  await expect(page.getByLabel("URL di destinazione")).toHaveValue("https://example.com/stampa");

  // Back to static, create it, then "Duplica e modifica".
  await page.getByLabel("QR dinamico").uncheck();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea codice QR" }).click();
  await page.getByRole("link", { name: "Apri il QR" }).click();
  await expect(page.getByText("Statico · non modificabile").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toHaveCount(0);
  await page.getByRole("link", { name: "Duplica e modifica" }).click();
  await expect(page.getByText("I codici già stampati resteranno invariati")).toBeVisible();
  await expect(page.getByLabel("Nome del QR")).toHaveValue("Sito stampato (copia)");
});
