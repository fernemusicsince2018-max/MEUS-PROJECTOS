import assert from "node:assert/strict";
import {
  FULL_SUPER_ADMIN_ACCESS,
  getResolvedSuperAdminAccess,
  hasSuperAdminAccess,
  normalizeSuperAdminAccess,
} from "../netlify/functions/_auth.js";

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

export async function runSuperAdminAccessTests() {
  const normalized = normalizeSuperAdminAccess({
    clientes: false,
    equipa: true,
    financeiro: false,
    lixo: true,
    planos: false,
    configuracoes: true,
  });

  assert.equal(normalized.clientes, true);
  assert.equal(normalized.equipa, true);
  assert.equal(normalized.lixo, true);
  assert.equal(normalized.configuracoes, true);
  assert.equal(normalized.planos, false);

  await withEnv(
    {
      SUPER_ADMIN_EMAILS: "principal@catalogo.com",
    },
    async () => {
      const helperAccess = getResolvedSuperAdminAccess({
        email: "ajudante@catalogo.com",
        role: "super_admin",
        super_admin_access: {
          clientes: true,
          equipa: false,
          financeiro: true,
          lixo: false,
          planos: false,
          configuracoes: false,
        },
      });

      assert.equal(helperAccess.clientes, true);
      assert.equal(helperAccess.financeiro, true);
      assert.equal(helperAccess.equipa, false);
      assert.equal(hasSuperAdminAccess({ email: "ajudante@catalogo.com", role: "super_admin", super_admin_access: helperAccess }, "clientes"), true);
      assert.equal(hasSuperAdminAccess({ email: "ajudante@catalogo.com", role: "super_admin", super_admin_access: helperAccess }, "equipa"), false);

      const primaryAccess = getResolvedSuperAdminAccess({
        email: "principal@catalogo.com",
        role: "super_admin",
        super_admin_access: {
          clientes: true,
          equipa: false,
          financeiro: false,
          lixo: false,
          planos: false,
          configuracoes: false,
        },
      });

      assert.deepEqual(primaryAccess, FULL_SUPER_ADMIN_ACCESS);
    },
  );

  const merchantAccess = getResolvedSuperAdminAccess({
    email: "lojista@catalogo.com",
    role: "merchant",
  });

  assert.equal(Object.values(merchantAccess).some(Boolean), false);
}
