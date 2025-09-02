import { WsError } from "../server/model/ws-error";

export interface Job {
  id: string;
  wallet: string;
  blockchain: string;
  currency: string;
  syncUntilDate: number;
  syncFromDate: number;
  reqId: string;
  status: "pending" | "in_progress" | "post_processing" | "done" | "error";
  data?: any;
  error?: WsError;
  lastModified: number;
  deleted?: boolean;
}
