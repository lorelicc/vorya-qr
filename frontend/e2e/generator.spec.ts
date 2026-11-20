import { expect, test } from "@playwright/test";
import { PASSWORD, uniqueEmail, verificationLink } from "./helpers";

test("generatore gratuito → download → «crealo dinamico» → registrazione → verifica → il QR dinamico esiste con lo stesso stile", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/genera?utm_source=e2e&utm_medium=test");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Genera il tuo QR code");

  // Free generator: static website QR with a custom module shape, checked by the server.
  await page.getByLabel("URL").fill("https://example.com/menu-estate");
  await expect(page.getByText("Scansionabile")).toBeVisible({ timeout: 15_000 });
  await page.locator("summary", { hasText: "Personalizza lo stile" }).click();
  await page.locator("label[title='Pallini']").click();
  await expect(page.getByText("Scansionabile")).toBeVisible({ timeout: 15_000 });

  // PNG download: no registration, no watermark.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Scarica PNG" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("qr-website.png");

  // The red disclaimer is also the invitation to the dynamic version.
  await expect(page.getByTestId("static-notice")).toContainText("NON potrà più essere modificato");
  await page.getByRole("button", { name: "Crealo dinamico, gratis" }).click();
  await page.waitForURL(/\/register/);
  await expect(page.getByText("troverai già il tuo QR dinamico")).toBeVisible();

  const email = uniqueEmail("gen");
  await page.getByLabel("Nome e cognome").fill("Giulia Bianchi");
  await page.getByLabel("Azienda o progetto").fill("Pizzeria Generatore");
  await page.getByLabel("Email di lavoro").fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continua con l’email" }).click();
  await expect(page.getByText("Controlla la tua casella email")).toBeVisible();
  await page.goto(await verificationLink(email));
  await page.getByLabel("Nuova password").fill(PASSWORD);
  await page.getByLabel("Ripeti la password").fill(PASSWORD);
  await page.getByRole("button", { name: "Attiva la prova" }).click();
  await page.waitForURL(/\/app\/c\/(\d+)$/);

  // The dynamic QR already exists, with the style chosen in the generator.
  const companyId = page.url().match(/\/c\/(\d+)$/)![1];
  const list = await (await page.request.get(`/api/companies/${companyId}/qr-codes`)).json();
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({
    kind: "dynamic",
    qr_type: "website",
    target_url: "https://example.com/menu-estate",
  });
  expect(list[0].design.modules).toBe("dots");
  await expect(page.getByText("example.com").first()).toBeVisible();
});
