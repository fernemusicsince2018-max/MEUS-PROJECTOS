function normalizeLockValue(value) {
  return String(value || "").trim().toLowerCase();
}

export async function lockCatalogIdentities(connection, entries = []) {
  const normalizedEntries = entries
    .map((entry) => ({
      scope: String(entry?.scope || "").trim().toLowerCase(),
      value: normalizeLockValue(entry?.value),
    }))
    .filter((entry) => entry.scope && entry.value)
    .sort((left, right) => `${left.scope}:${left.value}`.localeCompare(`${right.scope}:${right.value}`));

  for (const entry of normalizedEntries) {
    // Transaction-scoped advisory locks keep concurrent requests from reusing the same identity.
    await connection.query(
      `select pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [`catalog:${entry.scope}`, entry.value],
    );
  }
}
