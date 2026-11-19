import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PASSWORD, signUp, uniqueEmail } from "./helpers";

const ADMIN = "admin-e2e@example.com";

function seedAdmin() {
  execFileSync(
    process.env.PYTHON ?? "python3",
    [path.resolve("e2e/seed-admin.py"), ADMIN, PASSWORD],
    {
      cwd: path.resolve("../backend"),
      env: {
        ...process.env,
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
        PYTHONPATH: path.resolve("../backend"),
      },
    },
  );
}

test("admin: clienti → dettaglio con aziende → regala 3 mesi → il cliente vede l'omaggio", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  seedAdmin();
  const email = uniqueEmail("cliente");
  await signUp(page, email, "Cantina Omaggio");

  const adminCtx = await browser.newContext({ reducedMotion: "reduce" });
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill(ADMIN);
  await admin.getByLabel("Password").fill(PASSWORD);
  await admin.getByRole("button", { name: "Accedi" }).click();
  await admin.waitForURL(/\/admin\/clients/);
  await expect(admin.getByRole("heading", { name: "Clienti" })).toBeVisible();

  await admin.getByPlaceholder(/Cerca per nome/).fill(email);
  await admin.getByRole("link", { name: "Cantina Omaggio" }).first().click();
  await expect(admin.getByRole("heading", { name: "Cantina Omaggio" })).toBeVisible();
  await expect(admin.getByText("Aziende collegate (1)")).toBeVisible();
  await expect(
    admin.getByText("Il cliente non ha ancora inserito i dati di fatturazione"),
  ).toBeVisible();

  await admin.getByRole("button", { name: "Regala un piano" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("button", { name: "3 mesi", exact: true }).click();
  await dialog.getByLabel("Nota interna").fill("Cliente storico");
  await dialog.getByRole("button", { name: "Regala 3 mesi" }).click();
  await expect(admin.getByText(/Omaggio in corso/)).toBeVisible();
  await expect(admin.getByText("Cliente storico", { exact: false })).toBeVisible();

  await page.goto("/account/plan");
  await expect(page.getByText("Hai un piano in omaggio")).toBeVisible();
  await adminCtx.close();
});
