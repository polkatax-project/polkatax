import { FastifyInstance } from "fastify";
import { AwilixContainer } from "awilix";
import { SubscanApi } from "../blockchain/substrate/api/subscan.api";

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
          after_id: { type: "string" },
        },
      },
    },
    handler: async (request) => {
      const { chainName, address, page, minDate, after_id } = request.body as {
        chainName: string;
        address: string;
        page: number;
        minDate: number;
        after_id: string;
      };
      return subscanApi.fetchXcmList(
        chainName,
        address,
        page,
        minDate,
        after_id,
      );
    },
  });
};
