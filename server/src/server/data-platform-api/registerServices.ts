import { asClass, AwilixContainer } from "awilix";
import { DataPlatformApi } from "./data-platform.api";
import { DataPlatformLiquidStakingService } from "./data-platform-liquidstaking.service";
import { DataPlatformStakingService } from "./data-platform-staking.service";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    dataPlatformApi: asClass(DataPlatformApi),
    dataPlatformStakingService: asClass(DataPlatformStakingService),
    dataPlatformLiquidStakingService: asClass(DataPlatformLiquidStakingService),
  });
};
