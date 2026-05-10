import assert from "node:assert/strict";
import { buildRegistrationApprovalLink } from "../netlify/functions/_email.js";
import {
  normalizeRegistrationStoreName,
  validateRegistrationPhone,
} from "../netlify/functions/_registration.js";
import { getCatalogIdentityConflictMessage } from "../netlify/functions/_identity-errors.js";
import { validatePhoneForCountry } from "../netlify/functions/_store-validation.js";

async function withEnv(overrides, run) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export async function runRegistrationFlowTests() {
  await withEnv(
    {
      APP_BASE_URL: "https://kastrozap.netlify.app",
    },
    async () => {
      const link = buildRegistrationApprovalLink(
        { headers: {} },
        "lojista@exemplo.com",
        "token-aprovacao",
      );
      assert.equal(
        link,
        "https://kastrozap.netlify.app/auth?approval_email=lojista%40exemplo.com&approval_token=token-aprovacao",
      );
    },
  );

  await withEnv(
    {
      APP_BASE_URL: "https://kastrozap.netlify.app",
    },
    async () => {
      const link = buildRegistrationApprovalLink(
        {
          headers: {
            host: "127.0.0.1:5173",
            "x-forwarded-host": "127.0.0.1:5173",
            "x-forwarded-proto": "http",
          },
        },
        "lojista@exemplo.com",
        "token-local",
      );
      assert.equal(
        link,
        "http://127.0.0.1:5173/auth?approval_email=lojista%40exemplo.com&approval_token=token-local",
      );
    },
  );

  assert.equal(validateRegistrationPhone("244923000000").normalized, "244923000000");
  assert.match(
    validateRegistrationPhone("923000000").error || "",
    /codigo do pais/i,
  );
  assert.equal(
    validatePhoneForCountry("Angola", "923000000", "O numero de telemovel").normalized,
    "244923000000",
  );
  assert.equal(
    normalizeRegistrationStoreName("", "boutique.kastro@exemplo.com"),
    "Loja boutique kastro",
  );
  assert.equal(
    getCatalogIdentityConflictMessage({
      code: "23505",
      constraint: "idx_catalog_stores_business_phone_unique_active",
    }),
    "Este numero de telemovel ja esta associado a outra loja.",
  );
}
