export const PRODUCT_STAGES = [
  "Intake",
  "Development",
  "QA",
  "Security",
  "Dev Ready",
  "Soft Launch",
  "Launched",
  "Live",
  "On Hold",
] as const;

export type ProductStage = (typeof PRODUCT_STAGES)[number];
