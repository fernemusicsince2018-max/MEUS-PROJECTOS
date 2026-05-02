const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeCountryKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function looksLikeWhatsAppLink(value) {
  const text = String(value || "").trim().toLowerCase();
  return (
    text.startsWith("https://wa.me/") ||
    text.startsWith("http://wa.me/") ||
    text.startsWith("https://api.whatsapp.com/") ||
    text.startsWith("http://api.whatsapp.com/") ||
    text.startsWith("https://www.whatsapp.com/") ||
    text.startsWith("http://www.whatsapp.com/") ||
    text.startsWith("whatsapp://")
  );
}

function extractWhatsAppPhoneCandidate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (!looksLikeWhatsAppLink(raw)) {
    return raw;
  }

  try {
    if (raw.toLowerCase().startsWith("whatsapp://")) {
      const schemeUrl = new URL(raw);
      return schemeUrl.searchParams.get("phone") || "";
    }

    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host === "wa.me") {
      const pathSegment = url.pathname.split("/").filter(Boolean)[0] || "";
      return pathSegment || url.searchParams.get("phone") || "";
    }

    if (host === "api.whatsapp.com" || host === "www.whatsapp.com") {
      return url.searchParams.get("phone") || "";
    }
  } catch (error) {
    return "";
  }

  return "";
}

function alphaNumericOnly(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z]/g, "")
    .toUpperCase();
}

function allDigitsEqual(value) {
  return /^(\d)\1+$/.test(String(value || ""));
}

function validateCpf(value) {
  const cpf = digitsOnly(value);
  if (!/^\d{11}$/.test(cpf) || allDigitsEqual(cpf)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index);
  }
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index);
  }
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(cpf[10]);
}

function validateCnpj(value) {
  const cnpj = digitsOnly(value);
  if (!/^\d{14}$/.test(cnpj) || allDigitsEqual(cnpj)) return false;

  const calculate = (base, factors) => {
    const total = base
      .split("")
      .reduce((sum, digit, index) => sum + (Number(digit) * factors[index]), 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstCheck = calculate(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondCheck = calculate(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstCheck === Number(cnpj[12]) && secondCheck === Number(cnpj[13]);
}

function validatePortugueseNif(value) {
  const nif = digitsOnly(value);
  if (!/^\d{9}$/.test(nif) || allDigitsEqual(nif)) return false;

  const total = nif
    .slice(0, 8)
    .split("")
    .reduce((sum, digit, index) => sum + (Number(digit) * (9 - index)), 0);

  const remainder = total % 11;
  const expected = remainder < 2 ? 0 : 11 - remainder;
  return expected === Number(nif[8]);
}

function hasLetters(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function validateAngolanTaxId(value) {
  const raw = String(value || "").trim();
  const digits = digitsOnly(raw);
  const alnum = alphaNumericOnly(raw);

  if (/^\d{10}$/.test(digits) && digits.length === alnum.length) {
    return { normalized: digits };
  }

  if (/^\d{9}[A-Z]{2}\d{3}$/.test(alnum)) {
    return { normalized: alnum };
  }

  if (hasLetters(raw) || digits.length === 12) {
    return {
      error: "BI invalido. Para Angola, usa 9 digitos, 2 letras e 3 digitos finais. Ex: 003456789LA042.",
    };
  }

  if (digits.length > 0) {
    return { error: "NIF invalido. Para Angola, usa 10 digitos. Ex: 5001234567." };
  }

  return { error: "Para Angola, usa um BI valido ou um NIF com 10 digitos." };
}

function validateBrazilTaxId(value) {
  const raw = String(value || "").trim();
  const digits = digitsOnly(raw);

  if (digits.length === 11) {
    if (validateCpf(digits)) {
      return { normalized: digits };
    }

    return { error: "CPF invalido. Para o Brasil, usa 11 digitos validos. Ex: 12345678909." };
  }

  if (digits.length === 14) {
    if (validateCnpj(digits)) {
      return { normalized: digits };
    }

    return { error: "CNPJ invalido. Para o Brasil, usa 14 digitos validos. Ex: 12345678000195." };
  }

  if (digits.length > 0 && digits.length < 14) {
    return { error: "CPF invalido. Para o Brasil, usa 11 digitos validos. Ex: 12345678909." };
  }

  if (digits.length >= 14) {
    return { error: "CNPJ invalido. Para o Brasil, usa 14 digitos validos. Ex: 12345678000195." };
  }

  return { error: "Para o Brasil, usa um CPF ou CNPJ valido." };
}

function validatePortugueseTaxId(value) {
  const digits = digitsOnly(value);

  if (digits.length === 9 && validatePortugueseNif(digits)) {
    return { normalized: digits };
  }

  if (digits.length > 0) {
    return { error: "NIF invalido. Para Portugal, usa 9 digitos validos. Ex: 123456789." };
  }

  return { error: "Para Portugal, usa um NIF valido com 9 digitos." };
}

function validateMozambicanTaxId(value) {
  const digits = digitsOnly(value);

  if (/^\d{9}$/.test(digits)) {
    return { normalized: digits };
  }

  if (digits.length > 0) {
    return { error: "NUIT invalido. Para Mocambique, usa 9 digitos. Ex: 400123456." };
  }

  return { error: "Para Mocambique, usa um NUIT com 9 digitos." };
}

function validateUsEin(value) {
  const digits = digitsOnly(value);

  if (/^\d{9}$/.test(digits)) {
    return { normalized: digits };
  }

  if (digits.length > 0) {
    return { error: "EIN invalido. Para os Estados Unidos, usa 9 digitos. Ex: 123456789." };
  }

  return { error: "Para os Estados Unidos, usa um EIN com 9 digitos." };
}

function validateNamibianTin(value) {
  const digits = digitsOnly(value);

  if (/^\d{8}$/.test(digits)) {
    return { normalized: digits };
  }

  if (digits.length > 0) {
    return { error: "TIN invalido. Para Namibia, usa o TIN da NamRA com 8 digitos. Ex: 07096499." };
  }

  return { error: "Para Namibia, usa o TIN da NamRA com 8 digitos." };
}

function validateSouthAfricanTaxId(value) {
  const raw = String(value || "").trim();
  const digits = digitsOnly(raw);
  const alnum = alphaNumericOnly(raw);
  const cipcWithSeparators = raw.replace(/\s+/g, "");

  if (/^\d{10}$/.test(digits) && digits.length === alnum.length) {
    return { normalized: digits };
  }

  if (/^\d{4}\/\d{6}\/\d{2}$/.test(cipcWithSeparators)) {
    return { normalized: alphaNumericOnly(cipcWithSeparators) };
  }

  if (/^\d{12}$/.test(digits) && digits.length === alnum.length) {
    return { error: "Numero CIPC invalido. Para Africa do Sul, usa o formato XXXX/YYYYYY/ZZ. Ex: 2018/105664/07." };
  }

  if (digits.length > 0) {
    return { error: "VAT invalido. Para Africa do Sul, usa 10 digitos ou um numero CIPC no formato XXXX/YYYYYY/ZZ." };
  }

  return { error: "Para Africa do Sul, usa um VAT com 10 digitos ou um numero CIPC no formato XXXX/YYYYYY/ZZ." };
}

const COUNTRY_RULES = {
  angola: {
    dialCode: "244",
    phoneHint: "Ex: 923000000 ou 244923000000",
    phonePlaceholder: "923000000",
    phoneNational: /^9\d{8}$/,
    phoneIntl: /^2449\d{8}$/,
    taxLabel: "BI / NIF",
    taxHint: "Se usares BI, escreve 9 digitos, 2 letras e 3 digitos finais. Se usares NIF, escreve 10 digitos.",
    taxPlaceholder: "Ex: 003456789LA042 ou 5001234567",
    validateTaxId(value) {
      return validateAngolanTaxId(value);
    },
  },
  brasil: {
    dialCode: "55",
    phoneHint: "Ex: 11987654321 ou 5511987654321",
    phonePlaceholder: "11987654321",
    phoneNational: /^\d{10,11}$/,
    phoneIntl: /^55\d{10,11}$/,
    taxLabel: "CPF / CNPJ",
    taxHint: "Se usares CPF, escreve 11 digitos validos. Se usares CNPJ, escreve 14 digitos validos.",
    taxPlaceholder: "Ex: 12345678909 ou 12345678000195",
    validateTaxId(value) {
      return validateBrazilTaxId(value);
    },
  },
  portugal: {
    dialCode: "351",
    phoneHint: "Ex: 912345678 ou 351912345678",
    phonePlaceholder: "912345678",
    phoneNational: /^9\d{8}$/,
    phoneIntl: /^3519\d{8}$/,
    taxLabel: "NIF",
    taxHint: "O NIF de Portugal deve ter 9 digitos validos.",
    taxPlaceholder: "Ex: 123456789",
    validateTaxId(value) {
      return validatePortugueseTaxId(value);
    },
  },
  mocambique: {
    dialCode: "258",
    phoneHint: "Ex: 841234567 ou 258841234567",
    phonePlaceholder: "841234567",
    phoneNational: /^(82|83|84|85|86|87)\d{7}$/,
    phoneIntl: /^258(82|83|84|85|86|87)\d{7}$/,
    taxLabel: "NUIT",
    taxHint: "O NUIT de Mocambique deve ter 9 digitos.",
    taxPlaceholder: "Ex: 400123456",
    validateTaxId(value) {
      return validateMozambicanTaxId(value);
    },
  },
  namibia: {
    dialCode: "264",
    phoneHint: "Ex: 812345678 ou 264812345678",
    phonePlaceholder: "812345678",
    phoneNational: /^0?\d{9,10}$/,
    phoneIntl: /^264\d{9}$/,
    taxLabel: "TIN",
    taxHint: "Usa o TIN da NamRA com 8 digitos.",
    taxPlaceholder: "Ex: 07096499",
    validateTaxId(value) {
      return validateNamibianTin(value);
    },
  },
  "africa do sul": {
    dialCode: "27",
    phoneHint: "Ex: 0821234567 ou 27821234567",
    phonePlaceholder: "0821234567",
    phoneNational: /^0\d{9}$/,
    phoneIntl: /^27\d{9}$/,
    taxLabel: "VAT / CIPC",
    taxHint: "Usa o VAT com 10 digitos ou o numero CIPC no formato XXXX/YYYYYY/ZZ.",
    taxPlaceholder: "Ex: 4123456789 ou 2018/105664/07",
    validateTaxId(value) {
      return validateSouthAfricanTaxId(value);
    },
  },
  "estados unidos": {
    dialCode: "1",
    phoneHint: "Ex: 2025550123 ou 12025550123",
    phonePlaceholder: "2025550123",
    phoneNational: /^\d{10}$/,
    phoneIntl: /^1\d{10}$/,
    taxLabel: "EIN",
    taxHint: "O EIN deve ter 9 digitos.",
    taxPlaceholder: "Ex: 123456789",
    validateTaxId(value) {
      return validateUsEin(value);
    },
  },
};

function getCountryRule(country) {
  return COUNTRY_RULES[normalizeCountryKey(country)] || null;
}

function normalizeLocalPhone(rule, digits) {
  const trimmed = String(digits || "");
  if (!trimmed) return "";
  if (!rule) return trimmed;
  return `${rule.dialCode}${trimmed.replace(/^0/, "")}`;
}

export function getStoreFieldMeta(country) {
  const rule = getCountryRule(country);
  return {
    dialCode: rule?.dialCode || "",
    whatsappHint: `${rule?.phoneHint || "Usa um numero valido com DDI ou no formato local do pais."} Tambem podes colar um link direto do WhatsApp, como https://wa.me/244923000000.`,
    whatsappPlaceholder: rule?.phonePlaceholder ? `${rule.phonePlaceholder} ou https://wa.me/${rule.dialCode}${rule.phonePlaceholder.replace(/^0/, "")}` : "Ex: 244923000000 ou https://wa.me/244923000000",
    businessPhoneHint: rule?.phoneHint || "Usa um telefone comercial valido.",
    businessPhonePlaceholder: rule?.phonePlaceholder || "Ex: 244923000000",
    taxLabel: rule?.taxLabel || "Documento fiscal / registo",
    taxHint: rule?.taxHint || "Usa o NIF, documento fiscal ou registo comercial da empresa.",
    taxPlaceholder: rule?.taxPlaceholder || "Numero fiscal ou documento da empresa",
  };
}

export function validateBusinessEmail(value, fieldLabel = "Email") {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return { normalized: "" };
  if (!EMAIL_RE.test(email)) {
    return { error: `${fieldLabel} invalido.` };
  }
  return { normalized: email };
}

export function validatePhoneForCountry(country, value, fieldLabel = "Telefone") {
  const digits = digitsOnly(value);
  if (!digits) {
    return { normalized: "" };
  }

  const rule = getCountryRule(country);
  if (!rule) {
    if (digits.length < 8 || digits.length > 15) {
      return { error: `${fieldLabel} invalido. Usa entre 8 e 15 digitos.` };
    }
    return { normalized: digits };
  }

  if (rule.phoneIntl?.test(digits)) {
    return { normalized: digits };
  }

  if (rule.phoneNational?.test(digits)) {
    return { normalized: normalizeLocalPhone(rule, digits) };
  }

  return {
    error: `${fieldLabel} invalido para ${String(country || "o pais escolhido").trim()}. ${rule.phoneHint}`,
  };
}

export function validateWhatsAppForCountry(country, value, fieldLabel = "WhatsApp") {
  const raw = String(value || "").trim();
  if (!raw) {
    return { normalized: "" };
  }

  const extractedValue = extractWhatsAppPhoneCandidate(raw);
  if (!String(extractedValue || "").trim()) {
    return {
      error: `${fieldLabel} invalido. Usa o numero do WhatsApp da loja ou um link direto como https://wa.me/244923000000.`,
    };
  }

  return validatePhoneForCountry(country, extractedValue, fieldLabel);
}

export function validateTaxIdForCountry(country, value, fieldLabel = "Documento fiscal") {
  const raw = String(value || "").trim();
  if (!raw) {
    return { normalized: "" };
  }

  const rule = getCountryRule(country);
  if (rule?.validateTaxId) {
    return rule.validateTaxId(raw);
  }

  const generic = alphaNumericOnly(raw);
  if (generic.length < 5 || generic.length > 20) {
    return { error: `${fieldLabel} invalido. Usa entre 5 e 20 caracteres alfanumericos.` };
  }

  return { normalized: generic };
}

export function normalizeIdentityForLookup(value) {
  return alphaNumericOnly(value).toLowerCase();
}
