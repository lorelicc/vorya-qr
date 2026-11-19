import { expect, test } from "@playwright/test";
import {
  IPHONE_UA,
  MP3_BYTES,
  PDF_BYTES,
  createWithWizard,
  logIn,
  signUp,
  uniqueEmail,
} from "./helpers";

test("2 aziende → vCard, PDF e Musica → pagina pubblica su mobile → trasferimento → il QR funziona", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const owner = uniqueEmail("owner");
  const receiver = uniqueEmail("receiver");

  // The receiver needs a verified account before a transfer can be sent.
  const other = await browser.newPage();
  await signUp(other, receiver, "Studio Ricevente");
  await other.close();

  await signUp(page, owner, "Trattoria Uno");

  // Second company.
  await page.goto("/companies");
  await page.getByRole("button", { name: "Crea azienda" }).first().click();
  await page.getByLabel("Nome dell’azienda").fill("Bar Due");
  await page.getByRole("dialog").getByRole("button", { name: "Crea azienda" }).click();
  await page.waitForURL(/\/app\/c\/\d+$/); // a new company opens right away
  await expect(page.getByRole("heading", { name: "Bar Due" })).toBeVisible();
  const barUrl = page.url();

  // vCard
  const vcard = await createWithWizard(page, "vCard", "Biglietto Giulia", async () => {
    await page.getByLabel("Nome", { exact: true }).fill("Giulia");
    await page.getByLabel("Cognome").fill("Bianchi");
    await page.getByLabel("Numero").fill("+39 333 1234567");
  });

  // PDF
  await page.goto(barUrl);
  await createWithWizard(page, "PDF", "Menu PDF", async () => {
    await page.locator("input[type=file][accept*=pdf]").setInputFiles({
      name: "menu.pdf",
      mimeType: "application/pdf",
      buffer: PDF_BYTES,
    });
    await expect(page.getByLabel("Titolo del documento")).toBeVisible({ timeout: 15_000 });
  });

  // Music
  await page.goto(barUrl);
  await createWithWizard(page, "Musica", "Demo band", async () => {
    await page.locator("input[type=file][accept*=audio]").setInputFiles({
      name: "brano.mp3",
      mimeType: "audio/mpeg",
      buffer: MP3_BYTES,
    });
    await expect(page.getByLabel("Artista")).toBeVisible({ timeout: 15_000 });
  });

  // Public vCard page on a phone.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: IPHONE_UA,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const mobile = await phone.newPage();
  await mobile.goto(vcard);
  await expect(mobile.getByText("Giulia")).toBeVisible();
  expect(
    await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(0);
  await phone.close();

  // Transfer "Bar Due" to the second account.
  await page.goto(barUrl + "/settings");
  await page.getByLabel("Email del destinatario").fill(receiver);
  await page.getByRole("button", { name: "Invia richiesta" }).click();
  await expect(page.getByText(/richiesta/i).first()).toBeVisible();

  const receiverPage = await browser.newPage();
  await logIn(receiverPage, receiver);
  await receiverPage.goto("/companies");
  await receiverPage.getByRole("button", { name: "Accetta" }).click();
  await expect(receiverPage.getByText("Trasferimento completato")).toBeVisible();
  await receiverPage.getByRole("dialog").getByRole("button", { name: "Chiudi" }).last().click();
  await expect(receiverPage.getByRole("link", { name: /Bar Due/ })).toBeVisible();

  // The printed QR still works after the transfer.
  const hop = await request.get(vcard, { maxRedirects: 0, headers: { "User-Agent": IPHONE_UA } });
  expect(hop.status()).toBe(200);
  expect(await hop.text()).toContain("Giulia");
  await receiverPage.close();
});
