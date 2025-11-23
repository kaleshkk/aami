import { expect, test } from "@playwright/test";

test("landing page redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});


