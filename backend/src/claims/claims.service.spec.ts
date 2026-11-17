import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ClaimAssessorService } from '../llm/claim-assessor.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimsService } from './claims.service';

const verdict = {
  justified: true,
  confidence: 0.9,
  reasoning: 'Evidence supports the claim.',
  model: 'test-model',
  promptVersion: 'v1',
};

const claimRow = {
  id: 'claim-1',
  productName: 'Serum',
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  status: 'JUSTIFIED',
};

function setup() {
  const tx = {
    claim: {
      create: jest.fn().mockResolvedValue(claimRow),
      update: jest.fn().mockResolvedValue(claimRow),
    },
    assessment: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'assessment-1',
          createdAt: new Date('2026-01-01'),
          ...data,
          claim: claimRow,
        }),
      ),
    },
  };
  const prisma = {
    claim: { findUnique: jest.fn() },
    $transaction: jest.fn((run: (t: typeof tx) => unknown) => run(tx)),
  };
  const assessor = { assess: jest.fn().mockResolvedValue(verdict) };
  const service = new ClaimsService(
    prisma as unknown as PrismaService,
    assessor as unknown as ClaimAssessorService,
  );
  return { service, prisma, tx, assessor };
}

const newClaim = {
  productName: 'Serum',
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  evidence: 'n=60, 23% reduction at week 4',
};

describe('ClaimsService.assess', () => {
  it('creates the claim and assessment and returns the result', async () => {
    const { service, tx } = setup();

    const result = await service.assess(newClaim);

    expect(tx.claim.create).toHaveBeenCalledWith({
      data: {
        productName: newClaim.productName,
        claimText: newClaim.claimText,
        status: 'JUSTIFIED',
      },
    });
    expect(tx.assessment.create.mock.calls[0][0].data).toEqual({
      claimId: 'claim-1',
      evidence: newClaim.evidence,
      ...verdict,
    });
    expect(result).toMatchObject({
      claimId: 'claim-1',
      assessmentId: 'assessment-1',
      justified: true,
      confidence: 0.9,
      reasoning: verdict.reasoning,
    });
  });

  it('marks the claim NOT_JUSTIFIED on a negative verdict', async () => {
    const { service, tx, assessor } = setup();
    assessor.assess.mockResolvedValue({ ...verdict, justified: false });

    await service.assess(newClaim);

    expect(tx.claim.create.mock.calls[0][0].data.status).toBe('NOT_JUSTIFIED');
  });

  it('re-assesses an existing claim using its stored text', async () => {
    const { service, prisma, tx, assessor } = setup();
    prisma.claim.findUnique.mockResolvedValue(claimRow);

    await service.assess({ claimId: 'claim-1', evidence: 'new study' });

    expect(assessor.assess).toHaveBeenCalledWith({
      productName: claimRow.productName,
      claimText: claimRow.claimText,
      evidence: 'new study',
    });
    expect(tx.claim.update).toHaveBeenCalledWith({
      where: { id: 'claim-1' },
      data: { status: 'JUSTIFIED' },
    });
    expect(tx.claim.create).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown claimId without calling the LLM', async () => {
    const { service, prisma, assessor } = setup();
    prisma.claim.findUnique.mockResolvedValue(null);

    await expect(
      service.assess({ claimId: 'missing', evidence: 'e' }),
    ).rejects.toThrow(NotFoundException);
    expect(assessor.assess).not.toHaveBeenCalled();
  });

  it('writes nothing when the LLM fails', async () => {
    const { service, prisma, assessor } = setup();
    assessor.assess.mockRejectedValue(new BadGatewayException());

    await expect(service.assess(newClaim)).rejects.toThrow(BadGatewayException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
