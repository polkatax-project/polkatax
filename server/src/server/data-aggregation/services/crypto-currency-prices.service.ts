import { firstValueFrom, ReplaySubject, Subject } from "rxjs";
import { RequestHelper } from "../../../common/util/request.helper";
import { CurrencyQuotes } from "../../../model/crypto-currency-prices/crypto-currency-quotes";

export class CryptoCurrencyPricesService {
  private pendingRequests: Record<string, Subject<any>> = {};

  get port() {
    return process.env["CRYPTO_CURRENCY_PRICES_PORT"] || 3003;
  }

  fetchHistoricalPrices(
    tokenId: string,
    currency: string,
  ): Promise<CurrencyQuotes> {
    const key = tokenId + currency;
    if (this.pendingRequests[key]) {
      return firstValueFrom(this.pendingRequests[key]);
    }

    this.pendingRequests[key] = new ReplaySubject<any>(1);

    try {
      const result = new RequestHelper().req(
        `http://localhost:${this.port}/crypto-historic-prices/${tokenId}?currency=${currency}`,
        "GET",
      );
      this.pendingRequests[key].next(result);
      delete this.pendingRequests[key];
      return result;
    } catch (error) {
      this.pendingRequests[key].error(error);
      delete this.pendingRequests[key];
      throw error;
    }
  }
}
