import { IsArray, IsOptional, IsString, MaxLength, ArrayMaxSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Private display name', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  display_name?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({ description: 'User interests', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  interests?: string[];

  @ApiPropertyOptional({ description: 'Age band (e.g., 18-24, 25-34)' })
  @IsOptional()
  @IsString()
  age_band?: string;

  @ApiPropertyOptional({ description: 'Optional gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Preferred language (e.g., en, hi)' })
  @IsOptional()
  @IsString()
  preferred_language?: string;
}
