export function normalizeLocalizedNumber(value: string) {
  const trimmedValue = value.trim();
  if (!/^\d[\d.,]*$/.test(trimmedValue)) return;

  const lastComma = trimmedValue.lastIndexOf(",");
  const lastPeriod = trimmedValue.lastIndexOf(".");
  const normalizedValue =
    lastComma > lastPeriod
      ? trimmedValue.replace(/\./g, "").replace(",", ".")
      : trimmedValue.replace(/,/g, "");

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedValue)) return;
  return Number(normalizedValue) >= 0 ? normalizedValue : undefined;
}
