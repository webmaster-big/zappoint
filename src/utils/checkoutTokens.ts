const tokens: Record<string, string> = {};

export const rememberCheckoutToken = (type: string, id: number | undefined, token: unknown): void => {
  if (id && typeof token === 'string' && token !== '') {
    tokens[`${type}:${id}`] = token;
  }
};

export const checkoutTokenFor = (type: string, id: number): string | undefined => tokens[`${type}:${id}`];

export const checkoutTokenBody = (type: string, id: number): { checkout_token: string } | undefined => {
  const token = checkoutTokenFor(type, id);
  return token ? { checkout_token: token } : undefined;
};
