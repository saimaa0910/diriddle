import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostCategory, Visibility } from '@prisma/client';

export class CreatePollDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  question!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options!: string[];

  @ApiPropertyOptional({ default: 24 })
  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  closes_in_hours?: number;
}

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  community_id!: string;

  @ApiProperty({ enum: PostCategory })
  @IsEnum(PostCategory)
  category!: PostCategory;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.COMMUNITY })
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  comments_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Target communities for SELECTED_COMMUNITIES visibility', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  audience_community_ids?: string[];

  @ApiPropertyOptional({ description: 'Save as unpublished draft', default: false })
  @IsBoolean()
  @IsOptional()
  is_draft?: boolean;

  @ApiPropertyOptional({ description: 'Attached media IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachment_ids?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotency_key?: string;

  @ApiPropertyOptional({ type: CreatePollDto })
  @ValidateNested()
  @Type(() => CreatePollDto)
  @IsOptional()
  poll?: CreatePollDto;
}

