/**
 * Amount parsing and INR display.
 *
 * docs/data-model.md is explicit on two points: "Do not use floating-point
 * arithmetic carelessly for financial calculations" and "Prefer integer minor
 * units if appropriate for the implementation, e.g. paise: ₹250.50 → 25050".
 *
 * So the amount field holds a *display string* while the user types — that is
 * the only honest representation for a text field — and everything downstream
 * converts once, on the way in, to whole paise. Nothing downstream ever holds a
 * fractional rupee value.
 */

const PAISE_PER_RUPEE = 100;

/** Digits allowed before the decimal point. Caps the input at ₹99,99,999.99. */
export const MAX_RUPEE_DIGITS = 7;

/** Paise precision, per docs/data-model.md's ₹250.50 example. */
export const MAX_DECIMAL_DIGITS = 2;

/**
 * Largest amount the field accepts, in paise.
 *
 * Derived from the digit cap rather than hard-coded separately, so the two
 * cannot drift apart.
 */
export const MAX_AMOUNT_PAISE =
  Math.pow(10, MAX_RUPEE_DIGITS) * PAISE_PER_RUPEE - 1;

/**
 * Formatters are hoisted to module scope.
 *
 * Constructing an `Intl.NumberFormat` parses locale data and builds lookup
 * tables, which is far too expensive to repeat per render or per list row
 * (vercel-react-native-skills/rules/js-hoist-intl.md).
 */
const wholeRupeesFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const rupeesAndPaiseFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Render paise as INR.
 *
 * Drops the decimals when the amount is whole, which keeps the dashboard's
 * "₹0"/"₹1,240" style consistent with the amount shown in the entry field.
 */
export function formatInr(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE;
  return paise % PAISE_PER_RUPEE === 0
    ? wholeRupeesFormatter.format(rupees)
    : rupeesAndPaiseFormatter.format(rupees);
}

/**
 * Reduce raw keypad input to a shape `parseAmountToPaise` can always read.
 *
 * Runs on every keystroke, so it is the only thing standing between the user
 * and an unparseable field. It enforces, in order: digits and dots only, a
 * single decimal point, at most `MAX_DECIMAL_DIGITS` of paise, and at most
 * `MAX_RUPEE_DIGITS` of rupees.
 *
 * A trailing dot is preserved because "12." is a legitimate in-progress state:
 * the user has committed to paise and has not typed them yet, and dropping the
 * dot would fight them for the next keystroke.
 */
export function sanitizeAmountInput(raw: string): string {
  const digitsAndDots = raw.replace(/[^0-9.]/g, '');
  const firstDotIndex = digitsAndDots.indexOf('.');

  const wholeRaw =
    firstDotIndex === -1
      ? digitsAndDots
      : digitsAndDots.slice(0, firstDotIndex);
  const fractionRaw =
    firstDotIndex === -1 ? '' : digitsAndDots.slice(firstDotIndex + 1);

  const whole = wholeRaw.slice(0, MAX_RUPEE_DIGITS);
  // Later dots in the fraction are dropped rather than truncating the number.
  const fraction = fractionRaw.replace(/\./g, '').slice(0, MAX_DECIMAL_DIGITS);

  if (firstDotIndex === -1) {
    return whole;
  }

  return `${whole}.${fraction}`;
}

/**
 * Convert a sanitized amount string to whole paise.
 *
 * Returns `null` when there is no amount to read yet, which the screen treats
 * as "not entered" rather than as zero — the difference matters, because zero
 * is a value the user could have meant and `null` is not.
 */
export function parseAmountToPaise(input: string): number | null {
  const trimmed = input.trim();

  if (trimmed === '' || trimmed === '.') {
    return null;
  }

  const match = /^(\d*)(?:\.(\d*))?$/.exec(trimmed);

  if (match == null) {
    return null;
  }

  const [, whole = '', fraction = ''] = match;

  if (whole === '' && fraction === '') {
    return null;
  }

  const paise = (fraction + '00').slice(0, MAX_DECIMAL_DIGITS);

  return Number(whole || '0') * PAISE_PER_RUPEE + Number(paise);
}