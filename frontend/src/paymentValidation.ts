export type PaymentForm = {
  cardHolderName: string;
  cardNumber: string;
  expirationDate: string;
  securityCode: string;
  zipCode: string;
};

export function validatePaymentForm(paymentForm: PaymentForm, currentDate = new Date()): string | null {
  if (!paymentForm.cardHolderName.trim()) {
    return "Please enter the card holder's name.";
  }

  // Allow letters (including Unicode), marks, spaces, periods, apostrophes and hyphens.
  // Only allow Unicode letters and spaces (no digits or punctuation).
  const nameRegex = /^[\p{L} ]+$/u;
  if (!nameRegex.test(paymentForm.cardHolderName.trim())) {
    return "Please enter a valid card holder name (letters and spaces only).";
  }

  const cardNumber = paymentForm.cardNumber.replace(/\D/g, "");
  if (!/^\d{16}$/.test(cardNumber)) {
    return "Please enter a valid 16 digit card number.";
  }

  if (!/^\d{3}$/.test(paymentForm.securityCode)) {
    return "Please enter a valid 3 digit security code.";
  }

  if (!/^\d{5}$/.test(paymentForm.zipCode)) {
    return "Please enter a valid 5 digit zip code.";
  }

  const normalizedExpiration = paymentForm.expirationDate.trim();
  const match = /^(\d{1,2})\/(\d{2})$/.exec(normalizedExpiration);
  if (!match) {
    return "Please enter a valid expiration date in MM/YY format like 12/28.";
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "Please enter a valid expiration date in MM/YY format like 12/28.";
  }

  const fullYear = 2000 + year;
  const expirationDate = new Date(fullYear, month, 0, 23, 59, 59, 999);

  if (currentDate > expirationDate) {
    return "The card expiration date must be current or in the future.";
  }

  return null;
}
