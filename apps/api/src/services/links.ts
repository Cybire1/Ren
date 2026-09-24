/** Kova Pay opens a charge from this link; any other device lands on the web pay page. */
export const encodeCheckoutLink = (intentId: string) => `kova://pay/${intentId}`
