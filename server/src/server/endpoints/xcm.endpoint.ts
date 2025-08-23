import { FastifyInstance } from "fastify";
import { AwilixContainer } from "awilix";
import { SubscanApi } from "../blockchain/substrate/api/subscan.api";

/**
 * Facade to call subscans xcm endpoint. This is useful node processes that don't have paid key and
 * activated by the DELEGATE_XCM_REQUESTS_TO env var on the calling node.
 */
export const registerXcmEndpoint = (
  fastify: FastifyInstance,
  container: AwilixContainer,
) => {
  const subscanApi: SubscanApi = container.resolve("subscanApi");

  fastify.post("/api/xcm", {
    schema: {
      body: {
        type: "object",
        required: ["chainName", "address", "minDate", "page"],
        properties: {
          chainName: { type: "string" },
          address: { type: "string" },
          page: { type: "number" },
          minDate: { type: "number" },
          block_range: { type: "string" },
        },
      },
    },
    handler: async (request) => {
      const { chainName, address, page, minDate, block_range } =
        request.body as {
          chainName: string;
          address: string;
          page: number;
          minDate: number;
          block_range: string;
        };
      return subscanApi.fetchXcmList(
        chainName,
        address,
        page,
        minDate,
        block_range,
      );
    },
  });
};
