import { InjectionMode, asValue, createContainer } from "awilix";
import { registerServices as registerBlockchainServices } from "./blockchain/registerServices";
import { registerServices as registerDataAggregationServices } from "./data-aggregation/registerServices";
import { registerServices as registerJobServices } from "./job-management/registerServices";
import { registerServices as registerEndpointsServices } from "./endpoints/registerServices";
import { registerServices as registerDataPlatformServices } from "./data-platform-api/registerServices";
import { registerServices as registerDataCorrectionPlatformService } from "./data-correction/registerServices";

export const createDIContainer = () => {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC,
    strict: true,
  });
  registerBlockchainServices(container);
  registerDataAggregationServices(container);
  registerJobServices(container);
  registerEndpointsServices(container);
  registerDataPlatformServices(container);
  registerDataCorrectionPlatformService(container);
  container.register({
    DIContainer: asValue(container),
  });
  return container;
};
