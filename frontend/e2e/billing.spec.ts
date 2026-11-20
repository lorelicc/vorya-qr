import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MAIL_DIR, signUp, uniqueEmail } from "./helpers";

function seedPrices() {
  execFileSync(process.env.PYTHON ?? "python3", [path.resolve("e2e/seed-billing.py")], {
    cwd: path.resolve("../backend"),
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      PYTHONPATH: path.resolve("../backend"),
    },
  });
}

test("piani → dati di fatturazione → checkout (Stripe simulato) → piano attivo → cambio piano", async ({
  page,
}) => {
  test.setTimeout(90_000);
  seedPrices();
  const email = uniqueEmail("billing");
  await signUp(page, email, "Enoteca Billing");

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Piani e prezzi" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Piano Pro" })).toContainText(
    "Menu e carta dei vini",
  );
  await expect(page.getByRole("region", { name: "Piano Free" })).not.toContainText("Menu e carta");

  // No billing data yet: the form comes first, with formal validation of the VAT number.
  await page.getByRole("button", { name: "Scegli Pro" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ragione sociale o nome e cognome").fill("Enoteca Billing Srl");
  await dialog.getByLabel("Partita IVA").fill("12345678901");
  await dialog.getByLabel("Indirizzo").fill("Via Roma 1");
  await dialog.getByLabel("CAP").fill("20100");
  await dialog.getByLabel("Comune").fill("Milano");
  await dialog.getByLabel("Provincia").fill("MI");
  await dialog.getByLabel("Codice SDI").fill("ABC1234");
  await dialog.getByRole("button", { name: "Salva e vai al pagamento" }).click();
  await expect(dialog.getByText("Partita IVA non valida.")).toBeVisible();
  await dialog.getByLabel("Partita IVA").fill("12345678903");
  await dialog.getByRole("button", { name: "Salva e vai al pagamento" }).click();

  // Fake Stripe Checkout: paying sends the signed webhooks to the real backend.
  await expect(page.getByRole("heading", { name: "Checkout di prova" })).toBeVisible();
  await page.getByRole("link", { name: "Paga ora" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento ricevuto" })).toBeVisible();

  // The worker sends the "payment received" email through the outbox.
  await expect
    .poll(() =>
      readdirSync(MAIL_DIR)
        .filter((f) => f.startsWith("billing-"))
        .map((f) => JSON.parse(readFileSync(`${MAIL_DIR}/${f}`, "utf8")))
        .some((m) => m.to === email && /Pagamento ricevuto/.test(m.subject)),
    )
    .toBe(true);

  await page.goto("/account/plan");
  await expect(page.getByText("Piano Pro").first()).toBeVisible();
  await expect(page.getByText("Attivo", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pagato" })).toBeVisible();

  // Upgrade with the proration preview.
  await page.getByRole("button", { name: "Scegli Plus" }).click();
  await expect(page.getByText(/Importo che verrà addebitato ora/)).toBeVisible();
  await page.getByRole("button", { name: "Conferma", exact: true }).click();
  await expect(page.getByText("Piano Plus attivato.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Piano Plus" })).toContainText("Il tuo piano");
});

test("pagamento annullato: pagina con illustrazione e il piano non cambia", async ({ page }) => {
  seedPrices();
  await signUp(page, uniqueEmail("billing-ko"), "Enoteca KO");
  await page.goto("/billing/cancelled");
  await expect(page.getByRole("heading", { name: "Pagamento non completato" })).toBeVisible();
  await expect(page.getByText("Non è stato addebitato nulla")).toBeVisible();
});
