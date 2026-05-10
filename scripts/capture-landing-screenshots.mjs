import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const APP_BASE_URL_CANDIDATES = [
  process.env.LANDING_CAPTURE_BASE_URL,
  "http://localhost:4173",
  "http://localhost:5173",
].filter(Boolean);
const OUTPUT_DIR = path.resolve("public", "landing");
const SCREENSHOT_CLIP = { x: 0, y: 0, width: 430, height: 760 };
const INITIAL_PASSWORD = "SenhaTeste123";

function uniqueSlug(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueAngolaPhone() {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-6);
  return `244923${suffix}`;
}

async function waitForAppReady() {
  for (const candidate of APP_BASE_URL_CANDIDATES) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await fetch(`${candidate}/auth`);
        if (response.ok) {
          return candidate;
        }
      } catch {
        // Ignore connection errors while probing local servers.
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `A app nao ficou pronta em ${APP_BASE_URL_CANDIDATES.join(" ou ")}. Inicia o ambiente local antes de capturar os screenshots.`,
  );
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

async function approveRegistration(appBaseUrl, approvalLink) {
  const approvalUrl = new URL(String(approvalLink || ""));
  const email = approvalUrl.searchParams.get("approval_email") || "";
  const token = approvalUrl.searchParams.get("approval_token") || "";

  if (!email || !token) {
    throw new Error("O link de aprovacao nao trouxe email e token suficientes.");
  }

  const response = await fetch(`${appBaseUrl}/api/auth-register-approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, token }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel aprovar a conta pelo endpoint local.");
  }

  return payload;
}

async function createMerchantAccount(appBaseUrl, account) {
  const response = await fetch(`${appBaseUrl}/api/auth-register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullName: "Landing Capture",
      storeName: account.storeName,
      email: account.email,
      phone: account.phone,
      password: INITIAL_PASSWORD,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel criar a conta para a captura.");
  }

  const approvalLink = payload?.approvalLink || "";
  if (!approvalLink) {
    throw new Error("A API local nao devolveu o link de aprovacao esperado para a captura.");
  }

  await approveRegistration(appBaseUrl, approvalLink);
}

async function loginMerchantViaApi(appBaseUrl, account) {
  const response = await fetch(`${appBaseUrl}/api/auth-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: account.email,
      password: INITIAL_PASSWORD,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel autenticar a conta da captura pela API.");
  }

  return payload;
}

async function registerMerchant(page, appBaseUrl, account) {
  await page.goto(`${appBaseUrl}/auth`);
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-login-email").fill(account.email);
  await page.getByTestId("auth-login-password").fill(INITIAL_PASSWORD);
  await page.getByTestId("auth-login-submit").click();
  await page.waitForURL(/\/app$/, { timeout: 20000 });
  await page.getByTestId("admin-open-catalog-preview").waitFor({ state: "visible", timeout: 20000 });
}

async function configureStore(page, account) {
  await page.getByRole("button", { name: /^Editar$/i }).first().click();
  await page.getByTestId("store-whatsapp").fill(account.phone);
  await page.getByTestId("store-pickup-note").fill("Entrega de teste em Luanda");

  const publicEnabledToggle = page.getByTestId("store-public-enabled");
  if ((await publicEnabledToggle.getAttribute("aria-pressed")) !== "true") {
    await publicEnabledToggle.click();
  }

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/catalog-save")
      && response.request().method() === "POST",
    { timeout: 20000 },
  );
  await page.getByTestId("store-save").click();
  const saveResponse = await saveResponsePromise;

  if (!saveResponse.ok()) {
    throw new Error(`Falha ao guardar a loja na captura: ${await saveResponse.text()}`);
  }

  await page.getByTestId("admin-open-catalog-preview").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(400);
}

async function addProduct(page, productName) {
  const mobileProductsTab = page.getByRole("button", { name: /^Produtos$/i }).last();
  await mobileProductsTab.waitFor({ state: "visible", timeout: 20000 });
  await mobileProductsTab.click();
  await page.getByRole("button", { name: /Adicionar produto/i }).first().click();
  await page.getByPlaceholder("Ex: Camiseta Basica").waitFor({ state: "visible", timeout: 20000 });

  await page.getByPlaceholder("Ex: Camiseta Basica").fill(productName);
  await page
    .getByPlaceholder("Cor, tamanho, material...")
    .fill("Produto de demonstracao para capturar screenshots reais do app.");
  await page.getByPlaceholder("29,90").fill("1500");
  await page.getByPlaceholder("Roupas, Calcados...").fill("Destaques");

  const imageInputs = page.getByPlaceholder("https://cdn.exemplo.com/produto.jpg");
  await imageInputs.nth(0).fill("/favicon.svg");
  await imageInputs.nth(1).fill("/pwa-icon.svg");
  await imageInputs.nth(2).fill("/pwa-maskable.svg");

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/catalog-save")
      && response.request().method() === "POST",
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: /Adicionar produto/i }).last().click();
  const saveResponse = await saveResponsePromise;
  if (!saveResponse.ok()) {
    throw new Error(`Falha ao guardar o produto na captura: ${await saveResponse.text()}`);
  }
  await page.getByPlaceholder("Ex: Camiseta Basica").waitFor({ state: "hidden", timeout: 20000 });
  await page.getByText(productName).waitFor({ state: "visible", timeout: 20000 });
}

async function openCatalogPreview(page, appBaseUrl, storeId) {
  await page.goto(`${appBaseUrl}/catalog/${encodeURIComponent(storeId)}?preview=1`);
}

async function createOrderAndOpenTracking(page, appBaseUrl, storeId) {
  await openCatalogPreview(page, appBaseUrl, storeId);
  await page.waitForURL(/\/catalog\//, { timeout: 20000 });
  await page.getByRole("button", { name: /^Adicionar$/i }).first().waitFor({ state: "visible", timeout: 20000 });
  await page.getByRole("button", { name: /^Adicionar$/i }).first().click();

  await page.getByRole("button", { name: /Ver carrinho/i }).click();
  await page.getByText("O teu pedido").waitFor({ state: "visible", timeout: 20000 });

  await page.getByPlaceholder("Como te devemos identificar?").fill("Cliente Landing");
  await page.getByPlaceholder("Ex: 244923000000").fill("244923123123");
  await page.locator("select").first().selectOption("delivery");
  await page.getByPlaceholder("Ex: Luanda, Sao Paulo, Lisboa...").fill("Luanda");
  await page.getByPlaceholder("Ex: Maianga, Catete, Lobito...").fill("Maianga");
  await page.locator("select").nth(1).selectOption("10:00");
  await page.getByRole("button", { name: /Enviar pedido pelo WhatsApp/i }).click();
  await page.getByText("Pedido gravado com sucesso").waitFor({ state: "visible", timeout: 20000 });
  await page.getByRole("button", { name: /Acompanhar pedido/i }).click();
  await page.waitForURL(/\/tracking\//, { timeout: 20000 });
  await page.getByText("Acompanhamento da encomenda").waitFor({ state: "visible", timeout: 20000 });
}

async function captureViewport(page, outputFileName) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(450);

  const outputPath = path.join(OUTPUT_DIR, outputFileName);
  await page.screenshot({
    path: outputPath,
    animations: "disabled",
    clip: SCREENSHOT_CLIP,
  });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const appBaseUrl = await waitForAppReady();

  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const slug = uniqueSlug("landing");
  const account = {
    country: "Angola",
    email: `${slug}@example.com`,
    phone: uniqueAngolaPhone(),
    storeName: `Loja ${slug}`,
    productName: `Produto ${slug}`,
  };

  try {
    await installWindowOpenStub(page);
    await createMerchantAccount(appBaseUrl, account);
    const merchantSession = await loginMerchantViaApi(appBaseUrl, account);
    await registerMerchant(page, appBaseUrl, account);
    await configureStore(page, account);
    await addProduct(page, account.productName);

    await captureViewport(page, "dashboard-mobile.png");

    await openCatalogPreview(page, appBaseUrl, merchantSession.storeId);
    await page.waitForURL(/\/catalog\//, { timeout: 20000 });
    await page.getByText(account.productName).waitFor({ state: "visible", timeout: 20000 });
    await captureViewport(page, "catalog-mobile.png");

    await createOrderAndOpenTracking(page, appBaseUrl, merchantSession.storeId);
    await captureViewport(page, "tracking-mobile.png");
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
