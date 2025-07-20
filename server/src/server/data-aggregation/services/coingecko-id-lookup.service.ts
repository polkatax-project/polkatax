import coingeckoTokens from "../../../../res/coingecko-tokens.json";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";

interface CoingeckoToken {
  id: string;
  symbol: string;
  name: string;
  platforms: {
    [platform: string]: string;
  };
}

export class CoingeckoIdLookupService {
  addCoingeckoIds(transfers: Transfer[]): string[] {
    const tokenIdToCoingeckoIdMap: {
      [tokenId: string]: { id: string | undefined };
    } = {};
    transfers.forEach((t) => {
      if (!tokenIdToCoingeckoIdMap[t.asset_unique_id]) {
        tokenIdToCoingeckoIdMap[t.asset_unique_id] = {
          id: this.findCoingeckoId(t),
        };
      }
      // TODO: t.coingeckoId = tokenIdToCoingeckoIdMap[t.tokenId].id;
    });
    return Object.values(tokenIdToCoingeckoIdMap)
      .filter((v) => v.id)
      .map((v) => v.id);
  }

  findCoingeckoId(token: Transfer): string | undefined {
    const candidates = coingeckoTokens.filter(
      (t) => t.symbol == token.symbol.toLowerCase(),
    );
    if (candidates.length === 1) {
      return candidates[0].id;
    }
    // tokenId is either contract address (evm) or unique token Id
    return (
      this.findCoingeckoIdByContractAddress(
        candidates,
        token.asset_unique_id,
      ) || this.findCoingeckoIdByUniqueId(candidates, token.asset_unique_id)
    );
  }

  findCoingeckoIdByContractAddress(
    candidates: CoingeckoToken[],
    contract: string,
  ): string | undefined {
    return candidates.find(
      (t) => Object.values(t.platforms).indexOf(contract.toLowerCase()) > -1,
    )?.id;
  }

  findCoingeckoIdByUniqueId(
    candidates: CoingeckoToken[],
    asset_unique_id: string,
  ): string | undefined {
    return undefined; // #TODO
  }
}
