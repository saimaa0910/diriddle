import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecordConsentDto {
  @ApiProperty({ example: 'TERMS_OF_SERVICE', description: 'Type of consent (e.g. TERMS_OF_SERVICE, PRIVACY_POLICY, AGE_18_PLUS, LOCATION_DATA)' })
  @IsString()
  @IsNotEmpty()
  consent_type!: string;

  @ApiProperty({ example: 'v2.1', description: 'Version of the policy consented to' })
  @IsString()
  @IsNotEmpty()
  version!: string;

  @ApiProperty({ example: true, description: 'Whether consent was granted or withdrawn' })
  @IsBoolean()
  granted!: boolean;

  @ApiProperty({ example: '127.0.0.1', required: false })
  @IsString()
  @IsOptional()
  ip_address?: string;
}
