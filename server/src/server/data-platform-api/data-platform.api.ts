import { REFUSED } from "dns";
import { RequestHelper } from "../../common/util/request.helper";
import { StakingResultItem } from "./model/staking-result-item";

export class DataPlatformApi {
  private requestHelper: RequestHelper;

  constructor() {
    this.requestHelper = new RequestHelper();
    this.requestHelper.defaultHeader = {
      "Content-Type": "application/json",
    };
  }

  fetch(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ items: StakingResultItem[] }> {
    return this.requestHelper.req(
      "http://localhost:8080/api/rewards/list-account-rewards",
      "POST",
      {
        accountId,
        startDate,
        endDate,
      },
    );
  }
}
