import { expect, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAIL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.mail-outbox",
);
export const PASSWORD = "password-e2e-sicura-123";
export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Reads the verification link from the file mail transport (MAIL_TRANSPORT=file). */
export async function verificationLink(email: string): Promise<string> {
  let link = "";
  await expect
    .poll(() => {
      if (!existsSync(MAIL_DIR)) return "";
      for (const file of readdirSync(MAIL_DIR)) {
        const mail = JSON.parse(readFileSync(path.join(MAIL_DIR, file), "utf8"));
        if (mail.to === email && mail.kind === "verify")
          link = mail.text.match(/(http\S+#[\w-]{43})/)[1];
      }
      return link;
    })
    .not.toBe("");
  return link;
}

export async function signUp(page: Page, email: string, workspace = "Pizzeria E2E") {
  await page.goto("/register");
  await page.getByLabel("Nome e cognome").fill("Giulia Bianchi");
  await page.getByLabel("Azienda o progetto").fill(workspace);
  await page.getByLabel("Email di lavoro").fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continua con l’email" }).click();
  await expect(page.getByText("Controlla la tua casella email")).toBeVisible();
  await page.goto(await verificationLink(email));
  await page.getByLabel("Nuova password").fill(PASSWORD);
  await page.getByLabel("Ripeti la password").fill(PASSWORD);
  await page.getByRole("button", { name: "Attiva la prova" }).click();
  await page.waitForURL("**/app");
}
