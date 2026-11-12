import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ enum: ['phone', 'email'] })
  @IsEnum(['phone', 'email'])
  type!: 'phone' | 'email';
}
