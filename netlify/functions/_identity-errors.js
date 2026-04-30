function normalizeConstraintName(value) {
  return String(value || "").trim().toLowerCase();
}

export function getCatalogIdentityConflictMessage(error) {
  if (String(error?.code || "").trim() !== "23505") {
    return "";
  }

  const constraint = normalizeConstraintName(error?.constraint);

  if (constraint === "catalog_users_email_key" || constraint === "idx_catalog_users_email_lower") {
    return "Ja existe uma conta com este email.";
  }

  if (constraint === "idx_catalog_stores_business_email_unique_active") {
    return "Este email comercial ja esta a ser usado noutra empresa.";
  }

  if (constraint === "idx_catalog_stores_tax_id_unique_active") {
    return "Este numero fiscal ou documento ja esta registado noutra empresa.";
  }

  return "";
}
