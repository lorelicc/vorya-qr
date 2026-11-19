/** Formal checks for Italian P.IVA and codice fiscale (same rules as the backend). */

export function validVat(value: string): boolean {
  if (!/^\d{11}$/.test(value) || value.startsWith("0000000")) return false;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    let digit = Number(value[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
  }
  return (10 - (total % 10)) % 10 === Number(value[10]);
}

const ODD = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
];
const PERSON =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

export function validTaxCode(value: string): boolean {
  if (/^\d{11}$/.test(value)) return validVat(value);
  if (!PERSON.test(value)) return false;
  let total = 0;
  for (let i = 0; i < 15; i++) {
    const char = value[i];
    const isDigit = char >= "0" && char <= "9";
    const index = isDigit ? Number(char) : char.charCodeAt(0) - 65;
    // Odd (1-based) positions use the table, even positions the plain index.
    total += i % 2 === 0 ? ODD[index] : index;
  }
  return String.fromCharCode(65 + (total % 26)) === value[15];
}

export const clean = (value: string) => value.replace(/\s/g, "").toUpperCase();
