export class AssessmentResultDto {
  claimId!: string;
  assessmentId!: string;
  productName!: string;
  claimText!: string;
  status!: string;
  justified!: boolean;
  confidence!: number;
  reasoning!: string;
  model!: string;
  assessedAt!: Date;
}
