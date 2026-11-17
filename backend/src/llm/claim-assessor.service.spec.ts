import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PROMPT_VERSION } from './assessment.prompt';
import { ClaimAssessorService, parseVerdict } from './claim-assessor.service';

const input = {
  productName: 'Revitalift Serum',
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  evidence: 'n=60, placebo-controlled, 23% mean reduction at week 4, p<0.01',
};

const config = { get: () => 'test-model' } as unknown as ConfigService;

function setup(create: jest.Mock) {
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  return new ClaimAssessorService(client, config);
}

const reply = (message: object) => ({
  model: 'test-model-2026',
  choices: [{ message }],
});

describe('ClaimAssessorService', () => {
  it('returns the verdict with model and prompt provenance', async () => {
    const create = jest.fn().mockResolvedValue(
      reply({
        content: JSON.stringify({
          justified: true,
          confidence: 0.87,
          reasoning: '23% exceeds the claimed 20% at week 4.',
        }),
      }),
    );

    await expect(setup(create).assess(input)).resolves.toEqual({
      justified: true,
      confidence: 0.87,
      reasoning: '23% exceeds the claimed 20% at week 4.',
      model: 'test-model-2026',
      promptVersion: PROMPT_VERSION,
    });
  });

  it('sends claim and evidence as user data with a strict JSON schema', async () => {
    const create = jest.fn().mockResolvedValue(
      reply({
        content: '{"justified":false,"confidence":0.5,"reasoning":"weak"}',
      }),
    );

    await setup(create).assess(input);

    const request = create.mock.calls[0][0];
    expect(request.model).toBe('test-model');
    expect(request.temperature).toBe(0);
    expect(request.response_format.type).toBe('json_schema');
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.messages[0].role).toBe('system');
    expect(request.messages[1].content).toContain(input.claimText);
    expect(request.messages[1].content).toContain(input.evidence);
  });

  it('answers 503 when no API key is configured', async () => {
    const service = new ClaimAssessorService(null, config);
    await expect(service.assess(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('maps a provider failure to 502 without leaking its message', async () => {
    const create = jest
      .fn()
      .mockRejectedValue(new Error('401 invalid api key sk-secret'));

    const error = await setup(create)
      .assess(input)
      .catch((e) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).not.toContain('sk-secret');
  });

  it('maps a model refusal to 502', async () => {
    const create = jest
      .fn()
      .mockResolvedValue(reply({ content: null, refusal: 'I cannot help' }));
    await expect(setup(create).assess(input)).rejects.toThrow(
      BadGatewayException,
    );
  });
});

describe('parseVerdict', () => {
  const valid = { justified: true, confidence: 0.5, reasoning: 'ok' };

  it('clamps confidence into 0..1 and trims reasoning', () => {
    expect(
      parseVerdict(
        JSON.stringify({ ...valid, confidence: 1.7, reasoning: ' ok ' }),
      ),
    ).toEqual({ justified: true, confidence: 1, reasoning: 'ok' });
    expect(
      parseVerdict(JSON.stringify({ ...valid, confidence: -3 })).confidence,
    ).toBe(0);
  });

  it.each([
    ['non-JSON text', 'not json'],
    ['empty content', null],
    ['JSON null', 'null'],
    ['string boolean', JSON.stringify({ ...valid, justified: 'yes' })],
    ['string confidence', JSON.stringify({ ...valid, confidence: '0.9' })],
    ['blank reasoning', JSON.stringify({ ...valid, reasoning: '  ' })],
    ['missing field', JSON.stringify({ justified: true, confidence: 0.5 })],
  ])('rejects %s', (_label, content) => {
    expect(() => parseVerdict(content)).toThrow(BadGatewayException);
  });
});
