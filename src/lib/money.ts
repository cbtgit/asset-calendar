export const DEFAULT_MONEY_LOCALE = "da-DK";
export const DEFAULT_MONEY_CURRENCY = "DKK";

export type MoneyFormatOptions = {
  locale?: string;
  currency?: string;
};

function numberFormatter(locale: string, options: Intl.NumberFormatOptions) {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    return undefined;
  }
}

export function formatMinorUnitsForInput(
  minorUnits: number,
  locale = DEFAULT_MONEY_LOCALE,
): string {
  const formatter = numberFormatter(locale, { maximumFractionDigits: 0 });
  if (!formatter || !Number.isSafeInteger(minorUnits)) return String(minorUnits / 100);

  const absoluteMinorUnits = BigInt(Math.abs(minorUnits));
  const wholeUnits = absoluteMinorUnits / 100n;
  const fractionalUnits = String(absoluteMinorUnits % 100n).padStart(2, "0");
  const separatorFormatter = numberFormatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const decimalSymbol = separatorFormatter
    ?.formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value;
  if (!decimalSymbol) return String(minorUnits / 100);

  const sign = minorUnits < 0 ? "-" : "";
  return `${sign}${formatter.format(wholeUnits)}${decimalSymbol}${fractionalUnits}`;
}

export function formatMinorUnitsForDisplay(
  minorUnits: number,
  { locale = DEFAULT_MONEY_LOCALE, currency = DEFAULT_MONEY_CURRENCY }: MoneyFormatOptions = {},
): string {
  const formatter = numberFormatter(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter?.format(minorUnits / 100) ?? formatMinorUnitsForInput(minorUnits, locale);
}
