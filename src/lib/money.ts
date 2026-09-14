export type MoneyParseResult = { value: number } | { error: string };

function separators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567890123.89);
  const integerParts = parts.filter((part) => part.type === "integer").map((part) => part.value);
  const primaryGroupSize = integerParts.at(-1)?.length ?? 3;
  const secondaryGroupSize = integerParts.at(-2)?.length ?? primaryGroupSize;
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    primaryGroupSize,
    secondaryGroupSize,
  };
}

export function formatMoney(minorUnits: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minorUnits / 100);
}

export function formatMoneyInput(minorUnits: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function parseMoney(value: string, locale: string): MoneyParseResult {
  const input = value.trim();
  if (!input) return { error: "Enter a base rate." };

  let group: string;
  let decimal: string;
  let primaryGroupSize: number;
  let secondaryGroupSize: number;
  try {
    ({ group, decimal, primaryGroupSize, secondaryGroupSize } = separators(locale));
  } catch {
    return { error: "Enter a valid base rate." };
  }

  const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedDecimal = decimal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const groupedInteger = `\\d{1,${secondaryGroupSize}}(?:${escapedGroup}\\d{${secondaryGroupSize}})*${escapedGroup}\\d{${primaryGroupSize}}`;
  const pattern = new RegExp(`^(?:${groupedInteger}|\\d+)(?:${escapedDecimal}\\d{1,2})?$`);
  if (!pattern.test(input)) return { error: "Use the format for the selected locale." };

  const normalized = input.split(group).join("").replace(decimal, ".");
  const amount = Number(normalized);
  const minorUnits = Math.round(amount * 100);
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    return { error: "Enter a valid non-negative base rate." };
  }
  return { value: minorUnits };
}
