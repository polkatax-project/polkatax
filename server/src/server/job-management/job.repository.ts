import { Client } from "pg";
import { connectToDb } from "../database/db-connection";
import { Job, JobId } from "../../model/job";
import { WsError } from "../model/ws-error";
import { Subject } from "rxjs";
import { logger } from "../logger/logger";

const snakeToCamel = (str: string) =>
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const mapToCamelCase = (row: any) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [snakeToCamel(k), v]));

export class JobRepository {
  pendingJobsChanged$ = new Subject<void>();
  jobChanged$ = new Subject<JobId>();

  private _clientPromise: Promise<Client>;

  constructor() {
    this._clientPromise = this.init();
  }

  private async init(): Promise<Client> {
    logger.info("Init JobRepository");
    const client = await this.client;

    await client.query(`
      LISTEN job_changed;
      LISTEN pending_jobs_changed;
    `);

    client.on("notification", (msg) => {
      try {
        const payload = JSON.parse(msg.payload || "{}");
        if (msg.channel === "job_changed") {
          logger.info(
            `JobRepository: Notification on ${msg.channel}, wallet: ${payload.wallet}, blockchain: ${payload.blockchain}`,
          );
          this.jobChanged$.next(payload);
        } else if (msg.channel === "pending_jobs_changed") {
          logger.info(`JobRepository: Notification on ${msg.channel}.`);
          this.pendingJobsChanged$.next(payload);
        }
      } catch {
        logger.error("JobRepository: Failed to parse payload:", msg.payload);
      }
    });

    logger.info("Init JobRepository complete.");

    // initial notification to check for pending jobs after startup.
    this.pendingJobsChanged$.next();

    return client;
  }

  get client() {
    return connectToDb();
  }

  private async getClient() {
    // wait for init client promise, useful to guarantee init is done
    return this._clientPromise ?? this.client;
  }

  mapToJob(row: any): Job {
    const job = mapToCamelCase(row);
    ["syncFromDate", "syncedUntil", "lastModified"].forEach((field) => {
      if (job[field] instanceof Date) job[field] = job[field].getTime();
    });
    return job as unknown as Job;
  }

  private async executeJobQuery(query: string, values?: any[]): Promise<Job[]> {
    const client = await this.getClient();
    const { rows } = await client.query(query, values);
    return rows.map(this.mapToJob.bind(this));
  }

  async insertJob(job: Job) {
    const query = `
      INSERT INTO jobs (
        wallet, blockchain, sync_from_date, currency, req_id, last_modified, status, data
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
    `;

    const values = [
      job.wallet,
      job.blockchain,
      new Date(job.syncFromDate),
      job.currency,
      job.reqId,
      new Date(),
      job.data,
    ];

    const client = await this.getClient();
    await client.query(query, values);
    await this.notifyPendingJobsChanged();
    return job;
  }

  async findJobysByWallet(wallet: string) {
    return this.executeJobQuery(`SELECT * FROM jobs WHERE wallet = $1`, [
      wallet,
    ]);
  }

  async findJob(jobId: JobId) {
    const jobs = await this.executeJobQuery(
      `SELECT * FROM jobs WHERE wallet = $1 AND blockchain = $2 AND currency = $3`,
      [jobId.wallet, jobId.blockchain, jobId.currency],
    );
    return jobs[0];
  }

  async fetchAllJobs() {
    return this.executeJobQuery(
      `SELECT req_id, wallet, error, blockchain, sync_from_date, status, last_modified, currency, synced_until FROM jobs`,
    );
  }

  async fetchAllPendingJobs() {
    return this.executeJobQuery(
      `SELECT req_id, wallet, error, blockchain, sync_from_date, status, last_modified, currency, synced_until FROM jobs WHERE status = 'pending'`,
    );
  }

  async deleteJob(job: Job) {
    const client = await this.getClient();
    const { rows } = await client.query(
      `DELETE FROM jobs WHERE wallet = $1 AND blockchain = $2 AND currency = $3`,
      [job.wallet, job.blockchain, job.currency],
    );
    return rows;
  }

  async setInProgress(jobId: JobId) {
    const query = `
      UPDATE jobs
      SET status = 'in_progress', last_modified = $1
      WHERE wallet = $2 AND blockchain = $3 AND currency = $4 AND status != 'in_progress'
      RETURNING *
    `;

    const values = [new Date(), jobId.wallet, jobId.blockchain, jobId.currency];
    const client = await this.getClient();
    const { rows } = await client.query(query, values);

    if (rows.length > 0) {
      await this.notifyJobChanged(jobId);
      await this.notifyPendingJobsChanged();
    }
    return rows;
  }

  async setError(jobId: JobId, error: WsError) {
    const query = `
      UPDATE jobs
      SET status = 'error', error = $1, last_modified = $2
      WHERE wallet = $3 AND blockchain = $4 AND currency = $5
    `;

    const values = [
      error,
      new Date(),
      jobId.wallet,
      jobId.blockchain,
      jobId.currency,
    ];
    const client = await this.getClient();
    await client.query(query, values);
    await this.notifyJobChanged(jobId);
  }

  async setDone(jobId: JobId, data: any, syncedUntil: number) {
    const query = `
      UPDATE jobs
      SET status = 'done', error = 'null', last_modified = $1, data = $2, synced_until = $3
      WHERE wallet = $4 AND blockchain = $5 AND currency = $6
    `;

    const values = [
      new Date(),
      data,
      new Date(syncedUntil),
      jobId.wallet,
      jobId.blockchain,
      jobId.currency,
    ];
    const client = await this.getClient();
    await client.query(query, values);
    await this.notifyJobChanged(jobId);
  }

  private async notifyJobChanged(jobId: JobId) {
    /**
     * Just using blockchain, currency, wallet is necessary bc the interface can be called with
     * Job object which is too large for Notify
     */
    const payload = JSON.stringify({
      wallet: jobId.wallet,
      blockchain: jobId.blockchain,
      currency: jobId.currency,
    } as JobId);
    const client = await this.getClient();
    await client.query(`NOTIFY job_changed, '${payload}';`);
  }

  private async notifyPendingJobsChanged() {
    const client = await this.getClient();
    await client.query(`NOTIFY pending_jobs_changed;`);
  }
}
