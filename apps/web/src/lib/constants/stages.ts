export const PRODUCT_STAGES = [
  "Intake",
  "Development",
  "QA",
  "Security",
  "Deployment",
  "Live",
  "On Hold",
] as const;

export type ProductStage = (typeof PRODUCT_STAGES)[number];
