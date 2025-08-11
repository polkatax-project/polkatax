import { Job, JobId } from "../../model/job";
import { from, Observable, shareReplay, switchMap } from "rxjs";
import { logger } from "../logger/logger";
import { WsError } from "../model/ws-error";
import { JobRepository } from "./job.repository";

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
    currency: string,
    data?: any,
  ) {
    logger.info(
      `Adding job: ${reqId}, ${wallet}, ${blockchain}, syncFromDate: ${new Date(syncFromDate).toISOString()}, ${currency}`,
    );

    const job: Job = {
      reqId,
      wallet,
      blockchain,
      status: "pending",
      lastModified: Date.now(),
      currency,
      syncFromDate,
      data,
    };

    await this.jobRepository.insertJob(job);
    return job;
  }

  delete(job: Job) {
    this.jobRepository.deleteJob(job);
  }

  fetchJob(
    wallet: string,
    blockchain: string,
    currency: string,
  ): Promise<Job | undefined> {
    return this.jobRepository.findJob({ wallet, blockchain, currency });
  }

  async setInProgress(jobId: JobId): Promise<boolean> {
    const jobs = await this.jobRepository.setInProgress(jobId);
    return jobs.length > 0;
  }

  async setDone(data: any, jobId: JobId) {
    const eightDaysMs = 6 * 24 * 60 * 60 * 1000;
    const syncedUntil = Date.now() - eightDaysMs; // "guaranteed" to be synced until 6 days ago, because backend data is not updated daily!
    this.jobRepository.setDone(jobId, data, syncedUntil);
  }

  setError(error: WsError, jobId: JobId) {
    this.jobRepository.setError(jobId, error);
  }

  fetchJobs(wallet: string): Promise<Job[]> {
    return this.jobRepository.findJobysByWallet(wallet);
  }
}
