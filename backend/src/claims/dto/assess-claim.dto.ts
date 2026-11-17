import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AssessClaimDto {
  /**
   * Optional: re-assess an existing claim with new evidence.
   * When set, productName and claimText are taken from the stored claim.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  claimId?: string;

  @ValidateIf((dto: AssessClaimDto) => !dto.claimId)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName?: string;

  @ValidateIf((dto: AssessClaimDto) => !dto.claimId)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  claimText?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  evidence!: string;
}
