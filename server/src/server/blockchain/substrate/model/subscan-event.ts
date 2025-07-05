export interface SubscanEvent {
  id: number;
  timestamp: number;
  event_index: string;
  extrinsic_index: string;
  phase: number;
  module_id: string;
  event_id: string;
  extrinsic_hash: string;
  finalized: boolean;
}

export interface EventDetails {
  id: number;
  extrinsic_idx: number;
  event_index: string;
  block_num: number;
  module_id: string;
  event_id: string;
  extrinsic_index?: string;
  timestamp?: number;
  original_event_index?: string;
  params: [
    {
      type: string;
      type_name: string;
      value: any;
      name: string;
    },
  ];
  extrinsic_hash: string;
  finalized: boolean;
}
