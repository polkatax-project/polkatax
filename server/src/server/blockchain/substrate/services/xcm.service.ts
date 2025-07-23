import BigNumber from "bignumber.js";
import { SubscanService } from "../api/subscan.service";
import { mapPublicKeyToAddress } from "../util/map-public-key-to-address";
import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import * as otherSubstrateChains from "../../../../../res/other-substrate-chains.json";
import { logger } from "../../../logger/logger";
import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { XcmAssetTransfer, XcmTransfer } from "../model/xcm-transfer";
import { getAddress } from "ethers";
import { Asset } from "../model/asset";

const ignoreIncoming = [
  "hydration",
  "basilisk",
  "assethub-polkadot",
  "assethub-kusama",
  "coretime-polkadot",
  "coretime-kusama",
  "people-polkadot",
  "people-kusama",
  "collectives-polkadot",
  "collectives-kusama",
];

export class XcmService {
  constructor(private subscanService: SubscanService) {}

  private slitXcmTransfers(
    xcmList: XcmTransfer[],
    chain: string,
  ): { xcmMapToTransfer: XcmTransfer[]; xcmForEventContext: XcmTransfer[] } {
    const xcmMapToTransfer = [];
    const xcmForEventContext = [];

    const isForEventContextOnly = (xcm: XcmTransfer, chain: string) => {
      if (xcm.transfers.length === 0) {
        return true;
      }
      if (ignoreIncoming.includes(chain)) {
        if (xcm.transfers[0].destChain === chain) {
          return true;
        }
      }
      if (!xcm.transfers[0].from && chain === xcm.transfers[0].fromChain) {
        return true;
      }
      return false;
    };
    xcmList.forEach((xcm) => {
      if (isForEventContextOnly(xcm, chain)) {
        xcmForEventContext.push(xcm);
      } else {
        xcmMapToTransfer.push(xcm);
      }
    });
    return { xcmMapToTransfer, xcmForEventContext };
  }

  private async fetchAssets(chain: string): Promise<Asset[]> {
    const chainInfo = subscanChains.chains.find((c) => c.domain === chain);
    const results = (
      await Promise.all([
        this.subscanService.scanTokens(chain),
        chainInfo?.assetPallet
          ? this.subscanService.scanAssets(chain)
          : Promise.resolve(undefined),
        chainInfo?.foreignAssetsPallet
          ? this.subscanService.fetchForeignAssets(chain)
          : Promise.resolve(undefined),
      ])
    ).filter((v) => !!v);
    return results.flat();
  }

  async determineOriginToken(
    assetTransfer: XcmAssetTransfer,
    fromChain: string,
  ): Promise<{ symbol: string; unique_id?: string; decimals?: number }> {
    /**
     * case 1: asset_id refers to an asset in the token list of the source chain
     * case 2: asset_id refers to the relay chain token symbol, e.g. "DOT"
     * case 3: no asset_id or symbol given, indicating transfer of the native token, e.g. ETH or GLMR
     * case 4: asset_id refers to a different chain, e.g. "ethereum/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"
     * case 5: other / unkown case. Work with symbol.
     */

    // case 1
    const assetInfos: Asset[] = await this.fetchAssets(fromChain);
    const token = assetInfos.find(
      (t) => t.unique_id === assetTransfer.asset_unique_id,
    );
    if (token) {
      return token;
    }

    // case 2
    const relayChainToken = assetInfos.find(
      (t) =>
        t.symbol === assetTransfer.asset_unique_id ||
        t.symbol === "xc" + assetTransfer.asset_unique_id,
    );
    if (relayChainToken) {
      return relayChainToken;
    }

    // case 3
    if (!assetTransfer.symbol) {
      const nativeTokenSymbol = this.getSymbolNativeToken(fromChain);
      if (nativeTokenSymbol) {
        const decimals = await this.getDecimalsNativeToken(fromChain);
        return {
          symbol: nativeTokenSymbol,
          unique_id: nativeTokenSymbol,
          decimals,
        };
      } else {
        return undefined;
      }
    }

    // fallback for anything else
    const viaSymbol = assetInfos.filter(
      (t) => t.symbol === assetTransfer.symbol,
    );
    if (viaSymbol.length === 1) {
      return viaSymbol[0];
    }

    return { symbol: assetTransfer.symbol, unique_id: undefined };
  }

  private findChainName(relayOrMain: string, paraId: number) {
    if (
      relayOrMain === "kusama" ||
      relayOrMain === "polkadot" ||
      relayOrMain === "enjin"
    ) {
      const domain = subscanChains.chains.find(
        (c) => c.paraId === paraId && c.relay === relayOrMain,
      )?.domain;
      if (domain) {
        return domain;
      }
      return otherSubstrateChains.chains.find(
        (c) => c.paraId === paraId && c.relay === relayOrMain,
      )?.domain;
    }
    return relayOrMain;
  }

  private async getDecimalsNativeToken(chain: string): Promise<number> {
    switch (chain) {
      case "ethereum":
        return 18;
      default:
        return (await this.subscanService.fetchNativeToken(chain))
          ?.token_decimals;
    }
  }

  private getSymbolNativeToken(chain: string): string | undefined {
    switch (chain) {
      case "ethereum":
        return "ETH";
      default:
        const nativeToken = subscanChains.chains.find(
          (c) => c.domain === chain,
        )?.token;
        if (nativeToken) {
          return nativeToken;
        }
        return otherSubstrateChains.chains.find((c) => c.domain === chain)
          ?.token;
    }
  }

  /**
   *
   * @param key Subscan gives as id either an evm address or a substrate public key
   * @returns evm address or substrate address
   */
  private mapAccountIdToAddress(id: string) {
    if (!id) {
      return "";
    }
    if (isEvmAddress(id)) {
      /**
       * convert to checksumed / canonical address
       */
      return getAddress(id);
    }
    return mapPublicKeyToAddress("0x" + id);
  }

  private filterOnDate(
    xcmList: XcmTransfer[],
    minDate: number,
    maxDate?: number,
  ): XcmTransfer[] {
    return xcmList.filter(
      (r) => (!maxDate || r.timestamp <= maxDate) && r.timestamp >= minDate,
    );
  }

  async fetchXcmTransfers(data: {
    chainName: string;
    address: string;
    minDate: number;
    maxDate?: number;
  }): Promise<{
    xcmMapToTransfer: XcmTransfer[];
    xcmForEventContext: XcmTransfer[];
  }> {
    logger.info(
      `Enter fetchXcmTransfers from ${data.chainName} for address ${data.address}, from ${new Date(data.minDate).toUTCString()}`,
    );
    const token = await this.subscanService.fetchNativeToken(data.chainName);
    const chain = subscanChains.chains.find((c) => c.domain === data.chainName);
    if ((!chain.relay || !chain.paraId) && !chain.isRelay) {
      return { xcmMapToTransfer: [], xcmForEventContext: [] };
    }
    const relayChain = chain.isRelay ? chain.domain : chain.relay;
    const paraId = chain.paraId;

    const rawXcmList = await this.subscanService.fetchXcmList(
      relayChain,
      data.address,
      paraId,
      data.minDate,
    );

    const xcmList = await Promise.all([
      ...rawXcmList
        .filter(
          (xcm) => xcm.origin_para_id === paraId || xcm.dest_para_id === paraId,
        )
        .map(async (xcm) => {
          /**
           * sometimes "from_account_id" is missing for xcm from phala.
           * e.g. https://phala.subscan.io/xcm_message/polkadot-b169e22bf5d60da40c69a6a898dc79a73f07770a
           */
          const from =
            this.mapAccountIdToAddress(xcm.from_account_id) ||
            (data.chainName === "phala" ? data.address : "");
          const to = this.mapAccountIdToAddress(xcm.to_account_id);

          const outgoingTransfer = paraId === xcm.origin_para_id;
          const timestamp = outgoingTransfer
            ? xcm.origin_block_timestamp
            : xcm.confirm_block_timestamp;
          const fromChain = this.findChainName(
            xcm.from_chain || chain.relay,
            xcm.s2s_origin_para_id || xcm.origin_para_id,
          );
          const destChain = this.findChainName(
            xcm.dest_chain || chain.relay,
            xcm.s2s_dest_para_id || xcm.dest_para_id,
          );
          const extrinsic_index = outgoingTransfer
            ? xcm.extrinsic_index
            : xcm.dest_extrinsic_index;

          if (!destChain || !fromChain) {
            logger.warn(
              `Destination and/or origin chain for xcm ${xcm.id}/${xcm.message_hash} not found`,
            );
            return undefined;
          }

          if (
            (fromChain === data.chainName && from !== data.address && !!from) ||
            (destChain === data.chainName && to !== data.address)
          ) {
            // transfer NOT TO requested address and NOT FROM the addresses (for requested chain).
            return;
          }

          if (!xcm.assets || xcm.assets.length === 0) {
            // msg without transfer
            return;
          }

          return {
            timestamp,
            block: chain.isRelay ? xcm.block_num : undefined,
            fee:
              xcm.used_fee && fromChain === data.chainName
                ? Number(xcm.used_fee) / Math.pow(10, token.token_decimals)
                : 0,
            extrinsic_index,
            transfers: await Promise.all([
              ...xcm.assets.map(async (a) => {
                const originToken = await this.determineOriginToken(
                  a,
                  fromChain,
                );
                let symbol = originToken?.symbol ?? a.symbol;
                const decimals = a.decimals ?? originToken?.decimals;

                if (!symbol) {
                  logger.warn(
                    "Token symbol not found for transer " +
                      xcm.id +
                      "/" +
                      xcm.message_hash,
                  );
                  return undefined;
                }

                if (!decimals && data.chainName === fromChain) {
                  logger.warn(
                    "Token decimals not found for transer " +
                      xcm.id +
                      "/" +
                      xcm.message_hash,
                  );
                  return undefined;
                }

                const amount = new BigNumber(a.amount)
                  .multipliedBy(new BigNumber(Math.pow(10, -decimals)))
                  .toNumber();
                return {
                  messageHash: xcm.message_hash,
                  symbol: originToken?.symbol ?? symbol,
                  asset_unique_id: originToken?.unique_id,
                  rawAmount: a.amount,
                  amount: (fromChain === data.chainName ? -1 : 1) * amount,
                  from,
                  to,
                  module: "xcm",
                  timestamp,
                  extrinsic_index,
                  price: Number(a.current_currency_amount) / amount,
                  fiatValue: Number(a.history_currency_amount),
                  fromChain,
                  destChain,
                };
              }),
            ]),
          };
        }),
    ]);
    const filtered = this.filterOnDate(
      xcmList.filter((x) => !!x),
      data.minDate,
      data.maxDate,
    );
    logger.info(
      `Exit Fetching XcmTransfers. Found ${filtered.length} cross-chain messages.`,
    );
    return this.slitXcmTransfers(filtered, data.chainName);
  }
}
