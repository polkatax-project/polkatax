import { asClass, AwilixContainer, Lifetime } from "awilix";
import { JobsService } from "./jobs.service";
import { JobManager } from "./job.manager";
import { JobConsumer } from "./job.consumer";
import { JobRepository } from "./job.repository";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    jobsService: asClass(JobsService, {
      lifetime: Lifetime.SINGLETON,
    }),
    jobManager: asClass(JobManager, {
      lifetime: Lifetime.SINGLETON,
    }),
    jobConsumer: asClass(JobConsumer),
    jobRepository: asClass(JobRepository, {
      lifetime: Lifetime.SINGLETON,
    }),
  });
};
