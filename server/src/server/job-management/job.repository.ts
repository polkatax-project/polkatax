import { Client } from "pg";
import { connectToDb } from "../database/db-connection";
import { Job } from "../../model/job";
import { WsError } from "../model/ws-error";
import { Subject } from "rxjs";
import { logger } from "../logger/logger";

const snakeToCamel = (str: string) =>
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const mapToCamelCase = (row: any) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [snakeToCamel(k), v]));

export class JobRepository {
  pendingJobsChanged$ = new Subject<void>();
  jobChanged$ = new Subject<string>();

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
            `JobRepository: Notification on ${msg.channel}, jobId: ${payload.id}`,
          );
          this.jobChanged$.next(payload.id);
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
    ["syncFromDate", "syncUntilDate", "lastModified"].forEach((field) => {
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
        wallet, blockchain, sync_from_date, sync_until_date, currency, req_id, last_modified, status, data, id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
    `;

    const values = [
      job.wallet,
      job.blockchain,
      new Date(job.syncFromDate),
      new Date(job.syncUntilDate),
      job.currency,
      job.reqId,
      new Date(),
      job.data,
      job.id,
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

  async findJob(jobId: string) {
    const jobs = await this.executeJobQuery(
      `SELECT * FROM jobs WHERE id = $1`,
      [jobId],
    );
    return jobs[0];
  }

  async fetchAllJobs() {
    return this.executeJobQuery(
      `SELECT id, req_id, wallet, error, blockchain, sync_from_date, status, last_modified, currency, sync_until_date FROM jobs`,
    );
  }

  async fetchAllPendingJobs() {
    return this.executeJobQuery(
      `SELECT id, req_id, wallet, error, blockchain, sync_from_date, status, last_modified, currency, sync_until_date FROM jobs WHERE status = 'pending'`,
    );
  }

  async deleteJob(job: Job) {
    const client = await this.getClient();
    const { rows } = await client.query(`DELETE FROM jobs WHERE id = $1`, [
      job.id,
    ]);
    return rows;
  }

  async setInProgress(jobId: string) {
    const query = `
      UPDATE jobs
      SET status = 'in_progress', last_modified = $1
      WHERE id = $2 AND status != 'in_progress'
      RETURNING *
    `;

    const values = [new Date(), jobId];
    const client = await this.getClient();
    const { rows } = await client.query(query, values);

    if (rows.length > 0) {
      await this.notifyJobChanged(jobId);
      await this.notifyPendingJobsChanged();
    }
    return rows;
  }

  async setError(jobId: string, error: WsError) {
    const query = `
      UPDATE jobs
      SET status = 'error', error = $1, last_modified = $2
      WHERE id = $3
    `;

    const values = [error, new Date(), jobId];
    const client = await this.getClient();
    await client.query(query, values);
    await this.notifyJobChanged(jobId);
  }

  async updateJobData(
    jobId: string,
    data: any,
    newStatus: "post_processing" | "done",
  ) {
    const query = `
      UPDATE jobs
      SET status = $1, error = 'null', last_modified = $2, data = $3 
      WHERE id = $4
    `;

    const values = [newStatus, new Date(), JSON.stringify(data), jobId];
    const client = await this.getClient();
    await client.query(query, values);
    await this.notifyJobChanged(jobId);
  }

  private async notifyJobChanged(jobId: string) {
    const payload = JSON.stringify({
      id: jobId,
    });
    const client = await this.getClient();
    await client.query(`NOTIFY job_changed, '${payload}';`);
  }

  private async notifyPendingJobsChanged() {
    const client = await this.getClient();
    await client.query(`NOTIFY pending_jobs_changed;`);
  }
}
