import { getAddress } from "ethers";
import { expect, it, describe } from "@jest/globals";
import { WebSocketIncomingMessageSchema } from "./incoming-message-schema";

describe("WebSocketIncomingMessageSchema", () => {
  const validEvmAddress = getAddress(
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  ); // checksummed
  const validSubstrateAddress =
    "5GQsj8Q9CjKq7vu4vPX6XueceWyvj7Tynf9C5GgssUQPJx5o";
  const invalidAddress = "invalid_wallet_address";

  const baseMessage = {
    type: "fetchDataRequest",
    timestamp: Date.now(),
    reqId: "abc-123",
    payload: {
      currency: "USD",
      blockchains: ["ethereum", "polkadot"],
    },
  };

  it("validates a correct EVM address", () => {
    const result = WebSocketIncomingMessageSchema.safeParse({
      ...baseMessage,
      payload: {
        ...baseMessage.payload,
        wallet: validEvmAddress,
      },
    });

    expect(result.success).toBe(true);
  });

  it("validates a correct Substrate address", () => {
    const result = WebSocketIncomingMessageSchema.safeParse({
      ...baseMessage,
      payload: {
        ...baseMessage.payload,
        wallet: validSubstrateAddress,
      },
    });

    expect(result.success).toBe(true);
  });

  it("fails validation for an invalid wallet address", () => {
    const result = WebSocketIncomingMessageSchema.safeParse({
      ...baseMessage,
      payload: {
        ...baseMessage.payload,
        wallet: invalidAddress,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.format().payload?.wallet?._errors[0]).toContain(
        "Wallet must be a valid EVM or Substrate address",
      );
    }
  });
});
