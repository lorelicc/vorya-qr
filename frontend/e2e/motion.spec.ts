import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

// Normal motion: menus and modals open and close with their animations and end in the right state.
test("menu e modali si aprono e si chiudono con le animazioni", async ({ page }) => {
  await signUp(page, uniqueEmail("motion"));
  const userMenu = page.getByRole("button", { name: /Giulia Bianchi/ });
  await userMenu.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toBeFocused(); // focus moves into the menu
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(userMenu).toBeFocused();

  await page.goto("/companies");
  await page.getByRole("button", { name: "Crea azienda" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
