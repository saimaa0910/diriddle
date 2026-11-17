import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommunityType } from '@prisma/client';

export class CreateCommunityDto {
  @ApiProperty({ description: 'Community name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ enum: CommunityType, description: 'Type of community' })
  @IsEnum(CommunityType)
  type!: CommunityType;

  @ApiPropertyOptional({ description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State name' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Coarse geo-cell code' })
  @IsOptional()
  @IsString()
  geo_cell?: string;

  @ApiPropertyOptional({ description: 'Community description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  cover_url?: string;

  @ApiPropertyOptional({ description: 'Whether joining requires approval', default: false })
  @IsOptional()
  @IsBoolean()
  is_private?: boolean;

  @ApiPropertyOptional({ description: 'Max members limit' })
  @IsOptional()
  @IsNumber()
  max_members?: number;
}
