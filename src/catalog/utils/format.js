const CURRENCY_CONFIG = {
  AOA: { symbol: "Kz", decimal: ",", thousand: "." },
  BRL: { symbol: "R$", decimal: ",", thousand: "." },
  USD: { symbol: "$", decimal: ".", thousand: "," },
  EUR: { symbol: "EUR", decimal: ",", thousand: "." },
};

export function getCurrencyConfig(currencyCode = "AOA") {
  return CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.AOA;
}

export function getCurrencySymbol(currencyCode = "AOA") {
  return getCurrencyConfig(currencyCode).symbol;
}

export function fmtMoney(value, currencyCode = "AOA") {
  const amount = Number(value) || 0;
  const { symbol, decimal, thousand } = getCurrencyConfig(currencyCode);
  const [integerPart, decimalPart] = amount.toFixed(2).split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
  return `${symbol} ${groupedInteger}${decimal}${decimalPart}`;
}

export function fmtR(value) {
  return fmtMoney(value, "BRL");
}

export function parseMoney(value) {
  if (value === "" || value == null) return 0;

  const raw = String(value).replace(/[^\d,.-]/g, "").trim();
  if (!raw) return 0;

  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) {
    normalized =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
