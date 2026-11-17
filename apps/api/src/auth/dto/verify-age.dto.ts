import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyAgeDto {
  @ApiPropertyOptional({ example: true, description: 'Shorthand confirmation flag for mobile clients' })
  @IsBoolean()
  @IsOptional()
  confirmed?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Explicit confirmation of 18+ age' })
  @IsBoolean()
  @IsOptional()
  confirmed_18_plus?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Acceptance of Terms of Service' })
  @IsBoolean()
  @IsOptional()
  accepted_terms?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Acceptance of Privacy Policy' })
  @IsBoolean()
  @IsOptional()
  accepted_privacy?: boolean;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  policy_version?: string;
}
