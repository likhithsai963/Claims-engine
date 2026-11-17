import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { AssessClaimDto } from './dto/assess-claim.dto';
import { AssessmentResultDto } from './dto/assessment-result.dto';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post('assess')
  @HttpCode(HttpStatus.CREATED)
  assess(@Body() dto: AssessClaimDto): Promise<AssessmentResultDto> {
    return this.claims.assess(dto);
  }
}
