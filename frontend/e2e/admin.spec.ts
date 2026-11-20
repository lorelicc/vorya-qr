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

test("admin: nuovo cliente con invito → modifica → elimina (archivio) → ripristina", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  seedAdmin();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const admin = await ctx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill(ADMIN);
  await admin.getByLabel("Password").fill(PASSWORD);
  await admin.getByRole("button", { name: "Accedi" }).click();
  await admin.waitForURL(/\/admin\/clients/);

  // Add a client: it exists at once as "Invitato" and the invitation mail is on its way.
  const email = uniqueEmail("invitato");
  await admin.getByRole("button", { name: "Nuovo cliente" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Nome e cognome").fill("Luca Bianchi");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Nome dell’attività").fill("Osteria Invito");
  await dialog.getByRole("button", { name: "Crea e invita" }).click();
  await admin.waitForURL(/\/admin\/clients\/\d+$/);
  await expect(admin.getByRole("heading", { name: "Osteria Invito" })).toBeVisible();
  await expect(admin.getByText("Invitato", { exact: true }).first()).toBeVisible();
  await expect(admin.getByRole("button", { name: "Reinvia l’invito" })).toBeVisible();
  await expect(admin.getByText("Cliente creato e invitato")).toBeVisible(); // audit trail

  // Edit the name.
  await admin.getByRole("button", { name: "Modifica dati" }).click();
  await admin.getByRole("dialog").getByLabel("Nome dell’attività").fill("Osteria Invito Due");
  await admin.getByRole("dialog").getByRole("button", { name: "Salva" }).click();
  await expect(admin.getByRole("heading", { name: "Osteria Invito Due" })).toBeVisible();

  // Delete = archive: needs the name typed, then it leaves the list and shows in the archive.
  await admin.getByRole("button", { name: "Elimina cliente" }).click();
  const confirm = admin.getByRole("dialog");
  await expect(confirm.getByRole("button", { name: "Elimina", exact: true })).toBeDisabled();
  await confirm.getByLabel(/Per confermare scrivi/).fill("Osteria Invito Due");
  await confirm.getByRole("button", { name: "Elimina", exact: true }).click();
  await admin.waitForURL(/\/admin\/clients$/);
  await admin.getByPlaceholder(/Cerca per nome/).fill(email);
  await expect(admin.getByText("Nessun cliente trovato")).toBeVisible();
  await admin.getByLabel("Elenco").selectOption("archived");
  await admin.getByRole("link", { name: "Osteria Invito Due" }).click();
  await expect(admin.getByText("Cliente archiviato", { exact: true }).first()).toBeVisible();

  // Restore.
  await admin.getByRole("button", { name: "Ripristina cliente" }).click();
  await expect(admin.getByRole("button", { name: "Modifica dati" })).toBeVisible();
  await ctx.close();
});
