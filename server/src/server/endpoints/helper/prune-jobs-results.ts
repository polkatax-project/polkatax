import { Job } from "../../../model/job";
import { PortfolioMovement } from "../../data-aggregation/model/portfolio-movement";

export const pruneJobResult = (job: Job): Job => {
  const jobDataValues =
    job?.data?.values && job.status !== "post_processing"
      ? prunePortfolioMovements(job.data.values)
      : undefined;

  return {
    ...job,
    data:
      job.data && job.status !== "post_processing"
        ? {
            ...job.data,
            values: jobDataValues,
          }
        : undefined,
  };
};

export const prunePortfolioMovements = (
  portfolioMovement: PortfolioMovement[],
) => {
  const pruned = [];
  portfolioMovement.forEach(({ hash, events, provenance, ...p }) => {
    pruned.push({
      ...p,
      transfers: p.transfers.map(
        ({
          extrinsic_index,
          hash,
          module,
          event_index,
          semanticEventIndex,
          label,
          semanticGroupId,
          ...t
        }) => ({
          ...t,
        }),
      ),
    });
  });
  return pruned;
};
