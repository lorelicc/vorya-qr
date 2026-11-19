import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test("su mobile il menu laterale si apre e la pagina non scorre in orizzontale", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("mobile"));
  await page.getByRole("button", { name: "Apri menu" }).click();
  await expect(page.getByRole("link", { name: "Piano e utilizzo" })).toBeVisible();
  await page.getByRole("link", { name: "Piano e utilizzo" }).click();
  await expect(page.getByRole("heading", { name: "Piano e utilizzo" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
