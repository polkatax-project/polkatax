import BigNumber from "bignumber.js";
import { SubscanService } from "../api/subscan.service";
import { mapPublicKeyToAddress } from "../util/map-public-key-to-address";
import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import { logger } from "../../../logger/logger";
import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { XcmTransfer } from "../model/xcm-transfer";

export class XcmService {
  constructor(private subscanService: SubscanService) {}

  private findChainName(relayOrMain: string, paraId: number) {
    if (
      relayOrMain === "kusama" ||
      relayOrMain === "polkadot" ||
      relayOrMain === "enjin"
    ) {
      return subscanChains.chains.find(
        (c) => c.paraId === paraId && c.relay === relayOrMain,
      )?.domain;
    }
    return relayOrMain;
  }

  private getDecimalsNativeToken(chain: string) {
    switch (chain) {
      case "ethereum":
        return 18;
      default:
        return 18;
    }
  }

  private getSymbolNativeToken(chain: string): string | undefined {
    switch (chain) {
      case "ethereum":
        return "ETH";
      default:
        return subscanChains.chains.find((c) => c.domain === chain)?.token;
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
      return id;
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
  }): Promise<XcmTransfer[]> {
    logger.info(
      `Enter fetchXcmTransfers from ${data.chainName} for address ${data.address}, from ${new Date(data.minDate).toUTCString()}`,
    );
    const token = await this.subscanService.fetchNativeToken(data.chainName);
    const chain = subscanChains.chains.find((c) => c.domain === data.chainName);
    if ((!chain.relay || !chain.paraId) && !chain.isRelay) {
      return [];
    }
    const relayChain = chain.isRelay ? chain.domain : chain.relay;
    const paraId = chain.paraId;

    const rawXcmList = await this.subscanService.fetchXcmList(
      relayChain,
      data.address,
      paraId,
      data.minDate,
    );

    const xcmList = rawXcmList
      .filter(
        (xcm) => xcm.origin_para_id === paraId || xcm.dest_para_id === paraId,
      )
      .map((xcm) => {
        const from = this.mapAccountIdToAddress(xcm.from_account_id);
        const to = this.mapAccountIdToAddress(xcm.to_account_id);
        const outgoingTransfer = paraId === xcm.origin_para_id;
        const timestamp = outgoingTransfer
          ? xcm.origin_block_timestamp
          : xcm.confirm_block_timestamp;
        const fromChain =
          this.findChainName(
            xcm.from_chain || chain.relay,
            xcm.s2s_origin_para_id || xcm.origin_para_id,
          ) || String(xcm.origin_para_id);
        const destChain =
          this.findChainName(
            xcm.dest_chain || chain.relay,
            xcm.s2s_dest_para_id || xcm.dest_para_id,
          ) || String(xcm.dest_para_id);
        const extrinsic_index = outgoingTransfer
          ? xcm.extrinsic_index
          : xcm.dest_extrinsic_index;

        /*if (destChain === data.chainName) {
          return undefined // TODO:
        }*/

        if ((fromChain === data.chainName && from !== data.address) || (destChain === data.chainName && to !== data.address)) {
          // transfer NOT TO requested address and NOT FROM the addresses (for requested chain).
          return
        }

        return {
          timestamp,
          block:
            xcm.block_num !== 0
              ? xcm.block_num
              : undefined,
          fee:
            xcm.used_fee && fromChain === data.chainName
              ? Number(xcm.used_fee) / Math.pow(10, token.token_decimals)
              : 0,
          extrinsic_index,
          transfers: xcm.assets.map((a) => {
            a.symbol =
              a.symbol ?? this.getSymbolNativeToken(a.network ?? fromChain);
            if (a.symbol) {
              a.symbol = a.symbol.replace(/^xc/, ""); // Moonbeam ads 'xc' as prefix to all its cross-chain assets.
            }
            const decimals =
              a.decimals ?? this.getDecimalsNativeToken(a.network);
            const amount = new BigNumber(a.amount)
              .multipliedBy(new BigNumber(Math.pow(10, -decimals)))
              .toNumber();
            return {
              symbol: a.symbol,
              tokenId: a.asset_unique_id,
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
        };
      });
    const filtered = this.filterOnDate(xcmList.filter(x => !!x), data.minDate, data.maxDate);
    logger.info(
      `Exit Fetching XcmTransfers. Found ${filtered.length} cross-chain messages.`,
    );
    return filtered;
  }
}
