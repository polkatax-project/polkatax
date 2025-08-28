export const isTokenVisible = (
  visibleTokens: { name: string; value: boolean }[],
  token: string
) => visibleTokens.find((v) => v.name === token.toUpperCase())?.value;
