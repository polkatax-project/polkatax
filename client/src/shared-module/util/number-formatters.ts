export const currencyFormatterWithoutSymbol = new Intl.NumberFormat(
  navigator.language || 'en-US',
  {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }
);

export const formatCurrencyWithoutSymbol = (value: number) => {
  if (value === undefined || isNaN(value)) {
    return '-';
  }
  return currencyFormatterWithoutSymbol.format(value);
};

export const currencyFormatter = (currency: string | undefined) =>
  new Intl.NumberFormat(navigator?.language || 'en-US', {
    style: 'currency',
    currency: currency!.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currencyDisplay: 'symbol',
  });

export const formatCurrency = (value: number | undefined, currency: string) => {
  if (value === undefined || isNaN(value)) {
    return '-';
  }
  return currencyFormatter(currency).format(value);
};

export const formatCryptoAmount = (value: number): string => {
  return (value < 0 ? '-' : '') + formatAbsCryptoAmount(Math.abs(value));
};

const formatAbsCryptoAmount = (value: number): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  if (value === 0) {
    return '0';
  }

  if (value >= 1000000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (value >= 0.01) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 4,
    });
  }

  if (value >= 0.0001) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
};
