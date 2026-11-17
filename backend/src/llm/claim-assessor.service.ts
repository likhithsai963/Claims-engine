import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ASSESSMENT_JSON_SCHEMA,
  buildUserPrompt,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './assessment.prompt';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

export interface AssessmentInput {
  productName: string;
  claimText: string;
  evidence: string;
}

export interface AssessmentVerdict {
  justified: boolean;
  confidence: number;
  reasoning: string;
  model: string;
  promptVersion: string;
}

@Injectable()
export class ClaimAssessorService {
  private readonly logger = new Logger(ClaimAssessorService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI | null,
    config: ConfigService,
  ) {
    this.model = config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  async assess(input: AssessmentInput): Promise<AssessmentVerdict> {
    if (!this.openai) {
      throw new ServiceUnavailableException(
        'LLM is not configured: set OPENAI_API_KEY in backend/.env',
      );
    }

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: ASSESSMENT_JSON_SCHEMA,
        },
      });
    } catch (err) {
      this.logger.error(`OpenAI request failed: ${(err as Error).message}`);
      throw new BadGatewayException('The LLM provider request failed');
    }

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      this.logger.warn(`Model refused: ${message.refusal}`);
      throw new BadGatewayException('The LLM declined to assess this claim');
    }

    return {
      ...parseVerdict(message?.content),
      model: completion.model ?? this.model,
      promptVersion: PROMPT_VERSION,
    };
  }
}

/**
 * Validates the model output. Structured Outputs should guarantee the
 * shape, but LLM output is still external input - never trust it blindly.
 */
export function parseVerdict(
  content: string | null | undefined,
): Pick<AssessmentVerdict, 'justified' | 'confidence' | 'reasoning'> {
  let data: unknown;
  try {
    data = JSON.parse(content ?? '');
  } catch {
    throw new BadGatewayException('The LLM returned a malformed response');
  }

  const { justified, confidence, reasoning } = (data ?? {}) as Record<
    string,
    unknown
  >;
  if (
    typeof justified !== 'boolean' ||
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    typeof reasoning !== 'string' ||
    reasoning.trim() === ''
  ) {
    throw new BadGatewayException('The LLM returned an invalid assessment');
  }

  return {
    justified,
    confidence: Math.min(1, Math.max(0, confidence)),
    reasoning: reasoning.trim(),
  };
}
