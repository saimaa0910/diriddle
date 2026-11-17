import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BlocksService } from './blocks.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

class CreateBlockDto {
  @IsString()
  @IsNotEmpty()
  user_id!: string;
}

class BlockByContentDto {
  @IsEnum(['POST', 'COMMENT'])
  target_type!: 'POST' | 'COMMENT';

  @IsString()
  @IsNotEmpty()
  target_id!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

@ApiTags('Safety')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post('blocks')
  @ApiOperation({ summary: 'Block another user' })
  block(@Body() dto: CreateBlockDto, @CurrentUser() user: RequestUser) {
    return this.blocksService.block(user.id, dto.user_id);
  }

  @Post('by-content')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Block author of post or comment without exposing author user ID' })
  blockByContent(
    @CurrentUser() user: RequestUser,
    @Body() dto: BlockByContentDto,
  ) {
    return this.blocksService.blockByContent(user.id, dto.target_type, dto.target_id, dto.reason);
  }

  @Post('blocks/by-content')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Block author of post or comment without exposing author user ID (alias)' })
  blockByContentAlias(
    @CurrentUser() user: RequestUser,
    @Body() dto: BlockByContentDto,
  ) {
    return this.blocksService.blockByContent(user.id, dto.target_type, dto.target_id, dto.reason);
  }

  @Delete('blocks/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblock(@Param('userId') blockedId: string, @CurrentUser() user: RequestUser) {
    return this.blocksService.unblock(user.id, blockedId);
  }

  @Get('safety/blocked')
  @ApiOperation({ summary: 'List blocked user IDs' })
  getBlocked(@CurrentUser() user: RequestUser) {
    return this.blocksService.getBlocked(user.id);
  }
}
