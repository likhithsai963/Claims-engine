import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimAssessorService } from '../llm/claim-assessor.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssessClaimDto } from './dto/assess-claim.dto';
import { AssessmentResultDto } from './dto/assessment-result.dto';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessor: ClaimAssessorService,
  ) {}

  /**
   * Assesses a claim against evidence and persists the verdict.
   *
   * The LLM is called BEFORE anything is written, so a provider failure
   * leaves no half-saved rows. Claim + assessment are then written in one
   * transaction.
   */
  async assess(dto: AssessClaimDto): Promise<AssessmentResultDto> {
    const subject = await this.resolveSubject(dto);

    const verdict = await this.assessor.assess({
      ...subject,
      evidence: dto.evidence,
    });

    const status = verdict.justified ? 'JUSTIFIED' : 'NOT_JUSTIFIED';
    const assessmentData = {
      evidence: dto.evidence,
      justified: verdict.justified,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      model: verdict.model,
      promptVersion: verdict.promptVersion,
    };

    const assessment = await this.prisma.$transaction(async (tx) => {
      const claim = dto.claimId
        ? await tx.claim.update({
            where: { id: dto.claimId },
            data: { status },
          })
        : await tx.claim.create({ data: { ...subject, status } });

      return tx.assessment.create({
        data: { ...assessmentData, claimId: claim.id },
        include: { claim: true },
      });
    });

    return {
      claimId: assessment.claim.id,
      assessmentId: assessment.id,
      productName: assessment.claim.productName,
      claimText: assessment.claim.claimText,
      status: assessment.claim.status,
      justified: assessment.justified,
      confidence: assessment.confidence,
      reasoning: assessment.reasoning,
      model: assessment.model,
      assessedAt: assessment.createdAt,
    };
  }

  /** The product + claim text to assess: from the stored claim, or the request. */
  private async resolveSubject(
    dto: AssessClaimDto,
  ): Promise<{ productName: string; claimText: string }> {
    if (!dto.claimId) {
      // Guaranteed present by DTO validation when claimId is absent.
      return { productName: dto.productName!, claimText: dto.claimText! };
    }

    const claim = await this.prisma.claim.findUnique({
      where: { id: dto.claimId },
    });
    if (!claim) {
      throw new NotFoundException(`Claim ${dto.claimId} not found`);
    }
    return { productName: claim.productName, claimText: claim.claimText };
  }
}
