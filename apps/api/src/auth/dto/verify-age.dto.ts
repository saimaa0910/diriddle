import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyAgeDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  confirmed_18_plus!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  accepted_terms!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  accepted_privacy!: boolean;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  policy_version?: string;
}
