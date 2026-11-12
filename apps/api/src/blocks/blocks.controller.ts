import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsNotEmpty } from 'class-validator';
import { BlocksService } from './blocks.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

class CreateBlockDto {
  @IsString()
  @IsNotEmpty()
  user_id!: string;
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
