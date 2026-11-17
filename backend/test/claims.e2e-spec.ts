import { execSync } from 'child_process';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

// Isolated SQLite file so tests never touch dev.db. Must be set before
// AppModule (and so PrismaClient) is loaded.
process.env.DATABASE_URL = 'file:./test.db';

import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/llm/claim-assessor.service';
import { PrismaService } from '../src/prisma/prisma.service';

const body = {
  productName: 'Revitalift Serum',
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  evidence: 'n=60, placebo-controlled, 12% mean reduction at week 4',
};

describe('POST /api/claims/assess (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const create = jest.fn();

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', {
      env: process.env,
      stdio: 'ignore',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OPENAI_CLIENT)
      .useValue({ chat: { completions: { create } } })
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  }, 60_000);

  beforeEach(async () => {
    create.mockReset();
    await prisma.claim.deleteMany();
  });

  afterAll(() => app.close());

  it('assesses, persists and returns the verdict', async () => {
    create.mockResolvedValue({
      model: 'fake-model',
      choices: [
        {
          message: {
            content: JSON.stringify({
              justified: false,
              confidence: 0.92,
              reasoning: 'Study shows 12%, below the claimed 20%.',
            }),
          },
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .post('/api/claims/assess')
      .send(body)
      .expect(201);

    expect(res.body).toMatchObject({
      productName: body.productName,
      claimText: body.claimText,
      status: 'NOT_JUSTIFIED',
      justified: false,
      confidence: 0.92,
      reasoning: 'Study shows 12%, below the claimed 20%.',
      model: 'fake-model',
    });

    const saved = await prisma.assessment.findUniqueOrThrow({
      where: { id: res.body.assessmentId },
      include: { claim: true },
    });
    expect(saved.evidence).toBe(body.evidence);
    expect(saved.claim.id).toBe(res.body.claimId);
    expect(saved.claim.status).toBe('NOT_JUSTIFIED');
  });

  it('rejects an invalid body with 400 and never calls the LLM', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/claims/assess')
      .send({ claimText: 'only a claim', hacker: true })
      .expect(400);

    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'property hacker should not exist',
        'evidence should not be empty',
      ]),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 502 and saves nothing when the LLM fails', async () => {
    create.mockRejectedValue(new Error('provider down'));

    await request(app.getHttpServer())
      .post('/api/claims/assess')
      .send(body)
      .expect(502);

    expect(await prisma.claim.count()).toBe(0);
  });
});
