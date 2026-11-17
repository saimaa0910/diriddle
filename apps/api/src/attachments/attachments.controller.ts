import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AttachmentsService, InitiateUploadDto } from './attachments.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate a secure media upload session' })
  initiateUpload(@CurrentUser() user: RequestUser, @Body() dto: InitiateUploadDto) {
    return this.attachmentsService.initiateUpload(user.id, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm media upload completion' })
  confirmUpload(@CurrentUser() user: RequestUser, @Param('id') attachmentId: string) {
    return this.attachmentsService.confirmUpload(user.id, attachmentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  deleteAttachment(@CurrentUser() user: RequestUser, @Param('id') attachmentId: string) {
    return this.attachmentsService.deleteAttachment(user.id, attachmentId);
  }

  @Get('posts/:postId')
  @ApiOperation({ summary: 'Get attachments associated with a post' })
  getPostAttachments(@Param('postId') postId: string) {
    return this.attachmentsService.getPostAttachments(postId);
  }
}
