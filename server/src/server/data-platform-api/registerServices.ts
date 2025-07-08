import { asClass, AwilixContainer } from "awilix";
import { DataPlatformApi } from "./data-platform.api";
import { DataPlatformService } from "./data-platform.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    dataPlatformApi: asClass(DataPlatformApi),
    dataPlatformService: asClass(DataPlatformService),
  });
};
