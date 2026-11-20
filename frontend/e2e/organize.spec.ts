import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test("cartelle, tag, selezione multipla, ZIP e ricerca globale", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, uniqueEmail("org"), "Enoteca Test");

  // Both links are named after the host: the list is the source of truth for the count.
  for (const [index, url] of ["https://example.com/uno", "https://example.com/due"].entries()) {
    await page.getByLabel("URL da accorciare").fill(url);
    await page.getByRole("button", { name: "Crea link" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(index + 1);
  }

  // Folder, then move one link with the keyboard-friendly menu action.
  await page.getByRole("button", { name: "Nuova cartella" }).click();
  await page.getByRole("dialog").getByLabel("Nome").fill("Vendemmia");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByRole("button", { name: /Vendemmia/ }).first()).toBeVisible();
  await page
    .getByRole("button", { name: /Sposta example\.com in una cartella/ })
    .first()
    .click();
  await page.getByRole("dialog").getByLabel("Vendemmia").check();
  await page.getByRole("dialog").getByRole("button", { name: "Sposta", exact: true }).click();
  await expect(page.getByText("Elemento spostato.")).toBeVisible();
  await page
    .getByRole("button", { name: /Vendemmia/ })
    .first()
    .click();
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("button", { name: /^Tutti/ }).click();

  // Tag the selection from the bar that rises from the bottom.
  await page.getByRole("button", { name: "Crea un tag" }).click();
  await page.getByLabel("Nuovo tag").fill("Promo");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Chiudi" }).last().click();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await expect(page.getByText("2 selezionati")).toBeVisible();
  await page
    .getByRole("region", { name: "Azioni sulla selezione" })
    .getByRole("button", { name: "Tag" })
    .click();
  await page.getByRole("dialog").getByLabel("Promo").check();
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.getByText("Tag aggiunti.")).toBeVisible();
  await page.getByRole("button", { name: /^Promo/ }).click(); // filter chip
  await expect(page.getByRole("checkbox")).toHaveCount(2);

  // ZIP download of the selection (link-only entries have no QR: generate one first).
  await page
    .getByRole("button", { name: /Genera QR per/ })
    .first()
    .click();
  await page.getByRole("checkbox").first().check();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page
        .getByRole("region", { name: "Azioni sulla selezione" })
        .getByRole("button", { name: "Scarica ZIP" })
        .click();
      await page.getByRole("dialog").getByRole("button", { name: "Scarica", exact: true }).click();
    })(),
  ]);
  expect(download.suggestedFilename()).toBe("vorya-qr.zip");

  // Global search by tag name.
  await page.getByRole("button", { name: /Cerca/ }).first().click();
  await page.getByRole("dialog").getByRole("searchbox").fill("promo");
  await expect(page.getByRole("dialog").getByRole("link").first()).toBeVisible();
});

test("trascinare un QR (da qualsiasi punto) su una cartella: anteprima, cartelle evidenziate, spostamento", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUp(page, uniqueEmail("dnd"), "Cantina Drag");
  for (const [index, url] of ["https://example.com/uno", "https://example.com/due"].entries()) {
    await page.getByLabel("URL da accorciare").fill(url);
    await page.getByRole("button", { name: "Crea link" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(index + 1);
  }
  await page.getByRole("button", { name: "Nuova cartella" }).click();
  await page.getByRole("dialog").getByLabel("Nome").fill("Archivio");
  await page.getByRole("button", { name: "Salva" }).click();
  const folder = page.getByRole("button", { name: /Archivio/ }).first();
  await expect(folder).toBeVisible();

  // Grab the row by its NAME (not the grip) and drag it onto the folder.
  const item = page.locator("[data-draggable]").first();
  await item.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const from = (await item.boundingBox())!;
  await page.mouse.move(from.x + 90, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 140, from.y + from.height / 2 + 20, { steps: 6 });
  await expect(item).toHaveAttribute("data-dragging", "true");
  await expect(page.getByText("Rilascia su una cartella")).toBeVisible();
  await page.waitForTimeout(250); // the page may auto-scroll near an edge: measure the folder now
  const to = (await folder.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 14 });
  await expect(page.locator('li[data-over="true"]').first()).toBeVisible();
  await page.mouse.up();
  await expect(page.getByText("Elemento spostato.")).toBeVisible();
  await expect(folder).toContainText("1"); // the folder counted what it received
  await folder.click();
  await expect(page.getByRole("checkbox")).toHaveCount(1);
});
