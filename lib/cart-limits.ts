// One source of truth for how many of the same item can be bought at once.
// The server (checkout pricing) enforces it; the cart only keeps people from reaching it.
export const MAX_CART_QUANTITY = 10

export const clampCartQuantity = (quantity: number) => Math.min(MAX_CART_QUANTITY, Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0)))
