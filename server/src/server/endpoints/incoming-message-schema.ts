import { z } from "zod";
import { isValidWalletAddress } from "../../common/util/is-valid-address";

export const WalletInfoSchema = z.object({
  wallet: z.string().refine(isValidWalletAddress, {
    message: "Wallet must be a valid EVM or Substrate address",
  }),
  currency: z.string(),
  blockchains: z.array(z.string()).optional(),
  syncFromDate: z.number(),
  syncUntilDate: z.number(),
});

export const WebSocketIncomingMessageSchema = z.object({
  type: z.union([
    z.literal("fetchDataRequest"),
    z.literal("unsubscribeRequest"),
  ]),
  timestamp: z.number(),
  reqId: z.string(),
  payload: WalletInfoSchema,
});

export type WalletInfo = z.infer<typeof WalletInfoSchema>;
export type WebSocketIncomingMessage = z.infer<
  typeof WebSocketIncomingMessageSchema
>;
