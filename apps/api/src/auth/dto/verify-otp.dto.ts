import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  otp!: string;

  @ApiProperty({ enum: ['phone', 'email'] })
  @IsEnum(['phone', 'email'])
  type!: 'phone' | 'email';
}
