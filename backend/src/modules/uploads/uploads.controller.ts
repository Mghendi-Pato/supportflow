import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

// Multer config — keep files in memory (we stream straight to Cloudinary)
const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit at transport layer
};

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * POST /uploads/tickets/:ticketId
   * Upload an attachment to a ticket.
   * Optional ?commentId= query to attach to a specific comment.
   */
  @Post('tickets/:ticketId')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload an attachment to a ticket' })
  uploadTicketAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
    @Query('commentId') commentId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadsService.uploadTicketAttachment(
      user.tenantId!,
      ticketId,
      commentId ?? null,
      user.sub,
      file as any,
    );
  }

  /**
   * GET /uploads/tickets/:ticketId
   * Get all attachments for a ticket.
   */
  @Get('tickets/:ticketId')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get all attachments for a ticket' })
  getTicketAttachments(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
  ) {
    return this.uploadsService.getTicketAttachments(user.tenantId ?? null, ticketId);
  }

  /**
   * DELETE /uploads/attachments/:attachmentId
   * Delete an attachment. Uploader or workspace admin only.
   */
  @Delete('attachments/:attachmentId')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an attachment' })
  deleteAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.uploadsService.deleteAttachment(
      user.tenantId!,
      attachmentId,
      user.sub,
      user.role,
    );
  }

  /**
   * POST /uploads/avatar
   * Upload or replace the current user's profile avatar.
   */
  @Post('avatar')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload user profile avatar' })
  uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadsService.uploadAvatar(user.sub, file as any);
  }

  /**
   * POST /uploads/logo
   * Upload workspace logo. Admin only.
   */
  @Post('logo')
  @Roles('WORKSPACE_ADMIN')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload workspace logo' })
  uploadLogo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadsService.uploadTenantLogo(user.tenantId!, file as any);
  }
}
