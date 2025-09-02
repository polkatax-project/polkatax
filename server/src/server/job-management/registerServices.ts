import { asClass, AwilixContainer, Lifetime } from "awilix";
import { JobsService } from "./jobs.service";
import { JobManager } from "./job.manager";
import { JobProcessor } from "./job.processor";
import { JobRepository } from "./job.repository";
import { JobPostProcessor } from "./job.post-processor";

export const registerServices = (container: AwilixContainer) => {
  container.register({
    jobsService: asClass(JobsService, {
      lifetime: Lifetime.SINGLETON,
    }),
    jobManager: asClass(JobManager, {
      lifetime: Lifetime.SINGLETON,
    }),
    jobProcessor: asClass(JobProcessor),
    jobPostProcessor: asClass(JobPostProcessor),
    jobRepository: asClass(JobRepository, {
      lifetime: Lifetime.SINGLETON,
    }),
  });
};
