import { SubscanApi } from "../../blockchain/substrate/api/subscan.api";
import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { BlockTimeService } from "../../blockchain/substrate/services/block-time.service";
import { determineMinMaxBlock } from "../helper/determine-min-max-block";
import { isEvmAddress } from "../helper/is-evm-address";
import { PortfolioMovement } from "../model/portfolio-movement";
import { PortfolioEntry, PortfolioService } from "./portfolio.service";

const autoAccruingTokens: Record<
  string,
  {
    name: string;
    symbol: string;
    decimals: number;
    unique_id: string;
    token_id: number;
  }[]
> = {
  hydration: [
    {
      name: "aUSDT",
      symbol: "aUSDT",
      decimals: 6,
      unique_id: "asset_registry/bb0fce0a981352d43b40f5b844859ebdc246c705",
      token_id: 1002,
    },
    {
      name: "aUSDC",
      symbol: "aUSDC",
      decimals: 6,
      unique_id: "asset_registry/fd534edb7473e15a21281557eaa8651b87b95927",
      token_id: 1003,
    },
    {
      name: "aDOT",
      symbol: "aDOT",
      decimals: 10,
      unique_id: "asset_registry/026fadfabedc8fb74b6541384357664505c7ce45",
      token_id: 1001,
    },
    {
      name: "avDOT",
      symbol: "avDOT",
      decimals: 10,
      token_id: 1005,
      unique_id: "asset_registry/0bc1deec7b300ad1476c274628de468cc5a91d2e",
    },
    {
      name: "aETH",
      symbol: "aETH",
      decimals: 18,
      unique_id: "asset_registry/85c560c25b984c937406b2e1d4945f84a0d3e1b8",
      token_id: 1007,
    },
    {
      name: "atBTC",
      symbol: "atBTC",
      decimals: 18,
      unique_id: "asset_registry/70f6744f9d7068448c08697e3d0a4bcb4b771570",
      token_id: 1006,
    },
    {
      name: "aWBTC",
      symbol: "aWBTC",
      decimals: 8,
      unique_id: "asset_registry/de9d2c2c7fd3fb4e6f79e79c3d17d267d94c3a03",
      token_id: 1004,
    },
  ],
};

export class AutoAccruingTokenService {
  constructor(
    private portfolioService: PortfolioService,
    private blockTimeService: BlockTimeService,
    private subscanService: SubscanService,
    private subscanApi: SubscanApi,
  ) {}

  private async findBlocksOfInterest(
    chainInfo: { domain: string; token: string },
    portfolioMovements: PortfolioMovement[],
    minDate: number,
    maxDate: number,
  ): Promise<number[]> {
    const { blockMin, blockMax } = await determineMinMaxBlock(
      chainInfo,
      portfolioMovements,
      minDate,
      maxDate,
      this.blockTimeService,
    );

    const uniqueIdsOfInterest = autoAccruingTokens[chainInfo.domain].map(
      (t) => t.unique_id,
    );
    const blocksOfInterest = portfolioMovements
      .filter((p) =>
        p.transfers.find(
          (t) => uniqueIdsOfInterest.indexOf(t.asset_unique_id) > -1,
        ),
      )
      .map((p) => p.block);
    const allBlocksOfInterst = [
      ...new Set([blockMin, ...blocksOfInterest, blockMax]),
    ].sort((a, b) => a - b);
    return allBlocksOfInterst;
  }

  private async addInterest(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    blocks: number[],
  ) {
    let previousPortfolio: PortfolioEntry[] = undefined;
    let portfolio: PortfolioEntry[] = undefined;
    for (const block of blocks) {
      const relevantMovements = portfolioMovements.filter(
        (p) => p.block === block,
      );
      const timestamp =
        relevantMovements?.[0]?.timestamp ??
        (await this.subscanApi.fetchBlock(chainInfo.domain, block)).timestamp;
      previousPortfolio = portfolio;
      portfolio = await this.portfolioService.fetchTokenPortfolio(
        chainInfo,
        address,
        block,
      );
      if (previousPortfolio === undefined) {
        continue;
      }
      for (const token of autoAccruingTokens[chainInfo.domain]) {
        const balanceChangeViaMovement = relevantMovements.reduce(
          (sum, p) =>
            sum +
            p.transfers
              .filter((t) => t.asset_unique_id === token.unique_id)
              .reduce((sum, t) => sum + t.amount, 0),
          0,
        );
        const changeToAdd =
          (portfolio.find((p) => p.asset_unique_id === token.unique_id)
            ?.balance ?? 0) -
          balanceChangeViaMovement -
          (previousPortfolio.find((p) => p.asset_unique_id === token.unique_id)
            ?.balance ?? 0);
        if (changeToAdd !== 0) {
          portfolioMovements.push({
            block,
            timestamp,
            label: "Interest payment",
            events: [],
            extrinsic_index: undefined,
            transfers: [
              {
                amount: changeToAdd,
                to: address,
                from: undefined,
                symbol: token.symbol,
                asset_unique_id: token.unique_id,
              },
            ],
          });
        }
      }
    }
  }

  async adjust(
    chainInfo: { domain: string; token: string },
    address: string,
    portfolioMovements: PortfolioMovement[],
    minDate: number,
    maxDate: number,
  ) {
    if (autoAccruingTokens[chainInfo.domain] === undefined) {
      return;
    }
    if (isEvmAddress(address)) {
      address =
        (await this.subscanService.mapToSubstrateAccount(
          chainInfo.domain,
          address,
        )) || address;
    }
    const blocks = await this.findBlocksOfInterest(
      chainInfo,
      portfolioMovements,
      minDate,
      maxDate,
    );
    await this.addInterest(chainInfo, address, portfolioMovements, blocks);
    this.portfolioService.disconnectApi();
  }
}
