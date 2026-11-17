import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ClaimAssessorService, OPENAI_CLIENT } from './claim-assessor.service';

const PLACEHOLDER_KEY = 'your-openai-api-key-here';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      // No key (or the .env.example placeholder) -> null, so the app still
      // boots and the endpoint answers 503 with a clear message.
      useFactory: (config: ConfigService): OpenAI | null => {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        if (!apiKey || apiKey === PLACEHOLDER_KEY) return null;
        return new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 });
      },
    },
    ClaimAssessorService,
  ],
  exports: [ClaimAssessorService],
})
export class LlmModule {}
