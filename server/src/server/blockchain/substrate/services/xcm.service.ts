import BigNumber from "bignumber.js";
import { SubscanService } from "../api/subscan.service";
import { mapPublicKeyToAddress } from "../util/map-public-key-to-address";
import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import * as otherSubstrateChains from "../../../../../res/other-substrate-chains.json";
import { logger } from "../../../logger/logger";
import { isEvmAddress } from "../../../data-aggregation/helper/is-evm-address";
import { XcmTransfer } from "../model/xcm-transfer";
import { getAddress } from "ethers";

export class XcmService {
  constructor(private subscanService: SubscanService) {}

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
  }): Promise<XcmTransfer[]> {
    logger.info(
      `Enter fetchXcmTransfers from ${data.chainName} for address ${data.address}, from ${new Date(data.minDate).toUTCString()}`,
    );
    const chain = subscanChains.chains.find((c) => c.domain === data.chainName);
    if ((!chain.relay || !chain.paraId) && !chain.isRelay) {
      logger.info(
        `Exit fetchXcmTransfers from ${data.chainName} for address ${data.address} with zero xcm`,
      );
      return [];
    }
    const relayChain = chain.isRelay ? chain.domain : chain.relay;
    const paraId = chain.paraId;

    const token = await this.subscanService.fetchNativeToken(data.chainName);
    logger.info(
      `XCM Service: Fetched native Token`,
    );
    const rawXcmList = await this.subscanService.fetchXcmList(
      relayChain,
      data.address,
      paraId,
      data.minDate,
    );

    const xcmList = await Promise.all(rawXcmList.map(async (xcm) => {
        const from = this.mapAccountIdToAddress(xcm.from_account_id);
        const to = this.mapAccountIdToAddress(xcm.to_account_id);

        const outgoingTransfer = paraId === xcm.origin_para_id;
        const timestamp = outgoingTransfer
          ? xcm.origin_block_timestamp
          : xcm.confirm_block_timestamp ||
            xcm.relayed_block_timestamp ||
            xcm.origin_block_timestamp;
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

        if (!xcm.assets || xcm.assets.length === 0) {
          // msg without transfer
          return;
        }

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

        return {
          messageHash: xcm.message_hash,
          timestamp,
          // xcm.block_num > 0 is indeed needed because occasionally the value is indeed zero.
          block: chain.isRelay && xcm.block_num > 0 ? xcm.block_num : undefined,
          fee:
            xcm.used_fee && fromChain === data.chainName
              ? Number(xcm.used_fee) / Math.pow(10, token.token_decimals)
              : 0,
          extrinsic_index,
          transfers: (
            await Promise.all(xcm.assets.map(async (a) => {
                const symbol = a?.symbol?.replace(/^xc/, "");

                if (!symbol) {
                  logger.warn(
                    "Token symbol not found for xcm transfer " +
                      xcm.id +
                      "/" +
                      xcm.message_hash,
                  );
                  return undefined;
                }

                if (!a.decimals && data.chainName === fromChain) {
                  logger.warn(
                    "Token decimals not found for xcm transfer " +
                      xcm.id +
                      "/" +
                      xcm.message_hash,
                  );
                  return undefined;
                }

                const amount = new BigNumber(a.amount)
                  .multipliedBy(new BigNumber(Math.pow(10, -a.decimals)))
                  .toNumber();

                return {
                  symbol,
                  asset_unique_id: a?.asset_unique_id,
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
            )
          ).filter((t) => !!t),
        };
      }),
    );
    const filtered = this.filterOnDate(
      xcmList.filter((x) => !!x && x.transfers.length > 0),
      data.minDate,
      data.maxDate,
    );
    logger.info(
      `Exit fetchXcmTransfers with ${filtered.length} cross-chain messages.`,
    );
    return filtered;
  }
}
