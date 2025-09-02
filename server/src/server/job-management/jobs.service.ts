import { Job } from "../../model/job";
import { from, Observable, shareReplay, switchMap } from "rxjs";
import { logger } from "../logger/logger";
import { WsError } from "../model/ws-error";
import { JobRepository } from "./job.repository";
import { createJobId } from "./helper/create-job-id";

export class JobsService {
  pendingJobs$: Observable<Job[]>;

  constructor(private jobRepository: JobRepository) {
    this.pendingJobs$ = this.jobRepository.pendingJobsChanged$.pipe(
      switchMap((_) => from(this.jobRepository.fetchAllPendingJobs())),
      shareReplay(1),
    );
  }

  async addJob(
    reqId: string,
    wallet: string,
    blockchain: string,
    syncFromDate: number,
    syncUntilDate: number,
    currency: string,
    data?: any,
  ) {
    logger.info(
      `Adding job: ${reqId}, ${wallet}, ${blockchain}, syncFromDate: ${new Date(syncFromDate).toISOString()}, syncUntilDate: ${new Date(syncUntilDate).toISOString()}, ${currency}`,
    );

    const job: Job = {
      reqId,
      wallet,
      blockchain,
      status: "pending",
      lastModified: Date.now(),
      currency,
      syncFromDate,
      syncUntilDate,
      data,
      id: createJobId({
        blockchain,
        currency,
        wallet,
        syncFromDate,
        syncUntilDate,
      }),
    };

    await this.jobRepository.insertJob(job);
    return job;
  }

  delete(job: Job) {
    this.jobRepository.deleteJob(job);
  }

  fetchJob(jobId: string): Promise<Job | undefined> {
    return this.jobRepository.findJob(jobId);
  }

  async setInProgress(jobId: string): Promise<boolean> {
    const jobs = await this.jobRepository.setInProgress(jobId);
    return jobs.length > 0;
  }

  setDone(job: Job) {
    return this.jobRepository.updateJobData(job.id, job.data, "done");
  }

  setToPostProcessing(job: Job) {
    return this.jobRepository.updateJobData(
      job.id,
      job.data,
      "post_processing",
    );
  }

  setError(error: WsError, jobId: string) {
    this.jobRepository.setError(jobId, error);
  }

  fetchJobs(wallet: string): Promise<Job[]> {
    return this.jobRepository.findJobysByWallet(wallet);
  }

  fetchAllPendingJobs() {
    return this.jobRepository.fetchAllPendingJobs();
  }
}
