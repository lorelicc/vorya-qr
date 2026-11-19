import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { signUp, uniqueEmail } from "./helpers";

test("import CSV di 10 righe con anteprima, avanzamento e download dello ZIP", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, uniqueEmail("import"), "Cantina Import");
  await page.getByRole("link", { name: "Importa CSV" }).click();
  await expect(page.getByRole("heading", { name: "Importa da CSV" })).toBeVisible();

  // A file with a mistake first: nothing is created and the row is highlighted.
  const header = "nome;tipo;destinazione;campi;back_half;cartella;tag";
  const rows = Array.from(
    { length: 10 },
    (_, i) => `Etichetta ${i + 1};url;https://example.com/p${i + 1};;;Vendemmia;lotto`,
  );
  const broken = [header, ...rows.slice(0, 9), "Rotta;url;non-un-url;;;;"].join("\n");
  await page.locator("input[type=file]").setInputFiles({
    name: "rotto.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(broken),
  });
  await expect(page.getByText(/1 problema da correggere/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Conferma e crea/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Carica un altro file" }).click();

  // The corrected file: preview, confirm, progress, ZIP.
  const good = [header, ...rows].join("\n");
  await page.locator("input[type=file]").setInputFiles({
    name: "lotto.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(good),
  });
  await expect(page.getByText("10 righe pronte da creare")).toBeVisible();
  await page.getByRole("button", { name: "Conferma e crea 10 elementi" }).click();
  await expect(page.getByText("10 elementi creati")).toBeVisible({ timeout: 60_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Scarica lo ZIP" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^vorya-qr-import-\d+\.zip$/);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK"); // a real ZIP
  expect(bytes.includes(Buffer.from("riepilogo.csv"))).toBe(true);

  await page.getByRole("link", { name: "Vai a Link e QR" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(10);
});
