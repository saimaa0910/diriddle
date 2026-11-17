import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';

export class LinkIdentityDto {
  @ApiProperty({ enum: AuthProvider, description: 'Authentication provider' })
  @IsEnum(AuthProvider)
  provider!: AuthProvider;

  @ApiProperty({ description: 'Normalized identifier (email, phone, or oauth ID)' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}
