import { expect, test } from "@playwright/test";

const INITIAL_PASSWORD = "SenhaTeste123";
const RESET_PASSWORD = "NovaSenhaTeste123";

function uniqueSlug(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function installWindowOpenStub(page) {
  await page.addInitScript(() => {
    const openedUrls = [];
    Object.defineProperty(window, "__codexOpenedUrls", {
      value: openedUrls,
      configurable: true,
    });

    window.open = (initialUrl = "") => {
      const popup = {
        closed: false,
        __href: String(initialUrl || ""),
        location: {},
        close() {
          this.closed = true;
        },
        focus() {},
      };

      Object.defineProperty(popup.location, "href", {
        get() {
          return popup.__href;
        },
        set(value) {
          popup.__href = String(value || "");
          openedUrls.push(popup.__href);
        },
      });

      if (popup.__href) {
        openedUrls.push(popup.__href);
      }

      return popup;
    };
  });
}

async function registerMerchant(page, account) {
  await page.goto("/auth");
  await page.getByTestId("auth-mode-register").click();
  await page.getByTestId("auth-register-store-name").fill(account.storeName);
  await page.getByTestId("auth-register-full-name").fill("QA Browser");
  await page.getByTestId("auth-register-email").fill(account.email);
  await page.getByTestId("auth-register-country").selectOption(account.country);
  await page.getByTestId("auth-register-phone").fill(account.phone);
  await page.getByTestId("auth-register-password").fill(INITIAL_PASSWORD);
  await page.getByTestId("auth-register-confirm-password").fill(INITIAL_PASSWORD);
  await page.getByTestId("auth-register-submit").click();

  const approvalLink = await page.locator("a").filter({ hasText: /^https?:\/\//i }).getAttribute("href");
  expect(approvalLink).toBeTruthy();
  await page.goto(String(approvalLink));
  await expect(page.getByText(/Loja .* aprovada com sucesso|Loja aprovada com sucesso/i)).toBeVisible({ timeout: 20000 });
  await page.getByTestId("auth-login-password").fill(INITIAL_PASSWORD);
  await page.getByTestId("auth-login-submit").click();
  await page.waitForURL(/\/painel$/, { timeout: 20000 });
  await expect(page.getByTestId("admin-open-catalog-preview")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Sessao iniciada com sucesso.")).toBeVisible();
}

async function configureStore(page) {
  await page.getByRole("button", { name: /^Editar$/i }).first().click();
  await page.getByPlaceholder("Ex: 244923000000 ou https://wa.me/244923000000").fill("244923000000");
  await page.getByPlaceholder("Ex: Entrega em Luanda e retirada na loja das 9h as 18h").fill("Entrega de teste em Luanda");
  await page.getByRole("button", { name: /Catalogo publico ativo/i }).click();
  await page.getByRole("button", { name: /Guardar configuracoes/i }).click();
  await expect(page.getByText("Loja salva com sucesso.")).toBeVisible();
}

async function addProduct(page, productName) {
  await page.getByTestId("admin-tab-produtos").click();
  await page.getByRole("button", { name: /Adicionar produto/i }).first().click();
  await expect(page.getByText("Novo produto")).toBeVisible();

  await page.getByPlaceholder("Ex: Camiseta Basica").fill(productName);
  await page.getByPlaceholder("29,90").fill("1500");
  await page.getByPlaceholder("https://cdn.exemplo.com/produto.jpg").first().fill("/favicon.svg");
  await page.getByRole("button", { name: /Adicionar produto/i }).last().click();

  await expect(page.getByText(/Produto adicionado/i)).toBeVisible();
  await expect(page.getByText("Novo produto")).toBeHidden();
}

async function createOrder(page) {
  await page.getByTestId("admin-open-catalog-preview").click();
  await page.waitForURL(/\/catalog\//, { timeout: 20000 });
  const firstAddButton = page.getByRole("button", { name: /^Adicionar$/i }).first();
  await expect(firstAddButton).toBeVisible();
  await firstAddButton.click();

  await page.getByRole("button", { name: /Ver carrinho/i }).click();
  await expect(page.getByText("O teu pedido")).toBeVisible();

  await page.getByPlaceholder("Como te devemos identificar?").fill("Cliente QA");
  await page.getByPlaceholder("Ex: 244923000000").fill("244923123123");
  await page.locator("select").first().selectOption("delivery");
  await page.getByPlaceholder("Ex: Luanda, Sao Paulo, Lisboa...").fill("Luanda");
  await page.getByPlaceholder("Ex: Maianga, Catete, Lobito...").fill("Maianga");
  await page.locator("select").nth(1).selectOption("10:00");
  await page.getByRole("button", { name: /Enviar pedido pelo WhatsApp/i }).click();

  await expect(page.getByText("Pedido gravado com sucesso")).toBeVisible();
  await page.getByRole("button", { name: /Acompanhar pedido/i }).click();
  await page.waitForURL(/\/tracking\//, { timeout: 20000 });
  await expect(page.getByText("Acompanhamento da encomenda")).toBeVisible();

  const openedUrls = await page.evaluate(() => window.__codexOpenedUrls || []);
  expect(openedUrls.some((url) => String(url).includes("wa.me"))).toBeTruthy();
}

async function logout(page) {
  await page.goto("/painel");
  await expect(page.getByTestId("admin-logout")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("admin-logout").click();
  await page.waitForURL(/\/auth(?:\?.*)?$/, { timeout: 20000 });
  await page.context().clearCookies();
  await page.goto("/auth");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/auth");
  await expect(page.getByTestId("auth-login-submit")).toBeVisible();
}

async function resetPassword(page, email) {
  await page.getByTestId("auth-mode-reset").click();
  await page.getByTestId("auth-reset-email").fill(email);
  await page.getByTestId("auth-reset-request-submit").click();
  await expect(page.getByTestId("auth-reset-dev-code")).toBeVisible();

  const tokenText = (await page.getByTestId("auth-reset-dev-code").textContent()) || "";
  const tokenMatch = tokenText.match(/Token de teste neste ambiente:\s*(\S+)/i);
  const resetToken = tokenMatch?.[1] || "";
  expect(resetToken).not.toBe("");

  await page.getByTestId("auth-reset-code").fill(resetToken);
  await page.getByTestId("auth-reset-password").fill(RESET_PASSWORD);
  await page.getByTestId("auth-reset-confirm-password").fill(RESET_PASSWORD);
  await page.getByTestId("auth-reset-submit").click();

  await expect(page.getByTestId("auth-login-submit")).toBeVisible();
}

async function loginWithResetPassword(page, email) {
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-login-email").fill(email);
  await page.getByTestId("auth-login-password").fill(RESET_PASSWORD);
  await page.getByTestId("auth-login-submit").click();

  await page.waitForURL(/\/painel$/, { timeout: 20000 });
  await expect(page.getByTestId("admin-open-catalog-preview")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Sessao iniciada com sucesso.")).toBeVisible();
}

test("merchant can publish, sell, and recover access in browser smoke flow", async ({ page }) => {
  test.slow();

  const slug = uniqueSlug("browser");
  const account = {
    country: "Angola",
    email: `${slug}@example.com`,
    phone: "923000000",
    storeName: `Loja ${slug}`,
    productName: `Produto ${slug}`,
  };

  await installWindowOpenStub(page);

  await test.step("register merchant account", async () => {
    await registerMerchant(page, account);
  });

  await test.step("configure store and publish catalog", async () => {
    await configureStore(page);
    await addProduct(page, account.productName);
  });

  await test.step("create order from public catalog and open tracking", async () => {
    await createOrder(page);
  });

  await test.step("logout and reset password with local token", async () => {
    await logout(page);
    await resetPassword(page, account.email);
  });

  await test.step("login again with the new password", async () => {
    await loginWithResetPassword(page, account.email);
  });
});
