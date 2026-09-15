export const DEFAULT_NUMBER_LOCALE = "da-DK";

export function normalizeLocalizedNumber(
  value: string,
  locale = DEFAULT_NUMBER_LOCALE,
): string | undefined {
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(locale);
  } catch {
    return;
  }

  const parts = formatter.formatToParts(1234567.89);
  const groupSymbol = parts.find((part) => part.type === "group")?.value;
  const decimalSymbol = parts.find((part) => part.type === "decimal")?.value;
  if (!groupSymbol || !decimalSymbol || groupSymbol === decimalSymbol) return;

  const trimmedValue = value.trim();
  if (!trimmedValue) return;

  const separatorIndex = trimmedValue.indexOf(decimalSymbol);
  const integerPart = separatorIndex === -1 ? trimmedValue : trimmedValue.slice(0, separatorIndex);
  const fractionalPart =
    separatorIndex === -1 ? undefined : trimmedValue.slice(separatorIndex + decimalSymbol.length);
  if (separatorIndex !== -1 && trimmedValue.indexOf(decimalSymbol, separatorIndex + 1) !== -1) {
    return;
  }

  let normalizedInteger = integerPart;
  if (integerPart.includes(groupSymbol)) {
    normalizedInteger = integerPart.split(groupSymbol).join("");
    if (!/^\d+$/.test(normalizedInteger)) return;
    try {
      if (formatter.format(BigInt(normalizedInteger)) !== integerPart) return;
    } catch {
      return;
    }
  } else if (!/^\d+$/.test(integerPart)) {
    return;
  }

  if (fractionalPart !== undefined && !/^\d{1,2}$/.test(fractionalPart)) return;
  return fractionalPart === undefined
    ? normalizedInteger
    : `${normalizedInteger}.${fractionalPart}`;
}

export function toMinorUnits(value: string, locale = DEFAULT_NUMBER_LOCALE): number | undefined {
  const normalizedValue = normalizeLocalizedNumber(value, locale);
  if (normalizedValue === undefined) return;

  const [wholeUnits, fractionalUnits = ""] = normalizedValue.split(".");
  const minorUnits = Number(wholeUnits) * 100 + Number(fractionalUnits.padEnd(2, "0"));
  return Number.isSafeInteger(minorUnits) ? minorUnits : undefined;
}
