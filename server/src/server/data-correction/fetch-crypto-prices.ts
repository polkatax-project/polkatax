import { FetchedDataRepository } from "../../common/util/fetched-data.repository";
import { RequestHelper } from "../../common/util/request.helper";
import { ResponseCache } from "../../common/util/response.cache";

export class FetchCurrentPrices {
  requestHelper: RequestHelper;
  responseCache: ResponseCache;

  constructor() {
    this.requestHelper = new RequestHelper();
    this.requestHelper.defaultHeader = {
      "Content-Type": "application/json",
    };
    this.responseCache = new ResponseCache(
      new FetchedDataRepository(),
      this.requestHelper,
    );
  }

  fetchPrices(
    tokenIds: string[],
    currency: string,
  ): Promise<{ [tokenId: string]: { [currency: string]: number } }> {
    return this.responseCache.fetchAndStoreData(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds.join(",")}&vs_currencies=${currency}&include_market_cap=false&include_24hr_vol=false&include_24hr_change=false&include_last_updated_at=false`,
      "GET",
      undefined,
      24,
    );
  }
}
