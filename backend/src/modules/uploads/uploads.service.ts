import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
  }

  // ============================================================
  // UPLOAD TICKET ATTACHMENT
  // ============================================================
  async uploadTicketAttachment(
    tenantId: string,
    ticketId: string,
    commentId: string | null,
    uploadedByUserId: string,
    file: UploadedFile,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId, deletedAt: null },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    this.validateFile(file);

    const folder = `supportflow/${tenantId}/tickets/${ticketId}`;
    const result = await this.streamToCloudinary(file.buffer, file.mimetype, folder);

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        tenantId,
        ticketId,
        commentId: commentId ?? null,
        uploadedBy: uploadedByUserId,
        fileName: file.originalname,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
      },
    });

    await this.prisma.ticketActivityLog.create({
      data: {
        ticketId,
        tenantId,
        actorUserId: uploadedByUserId,
        action: 'ATTACHMENT_ADDED',
        toValue: file.originalname,
        metadata: { fileUrl: result.secure_url, mimeType: file.mimetype },
      },
    });

    return attachment;
  }

  // ============================================================
  // UPLOAD USER AVATAR
  // ============================================================
  async uploadAvatar(userId: string, file: UploadedFile) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Avatar must be JPEG, PNG, or WebP');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Avatar must be smaller than 2MB');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // Delete old avatar from Cloudinary
    if (user?.avatarUrl) {
      const publicId = this.extractPublicId(user.avatarUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    const result = await this.streamToCloudinary(
      file.buffer,
      file.mimetype,
      'supportflow/avatars',
      { transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }] },
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.secure_url },
    });

    return { avatarUrl: result.secure_url };
  }

  // ============================================================
  // UPLOAD TENANT LOGO
  // ============================================================
  async uploadTenantLogo(tenantId: string, file: UploadedFile) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      throw new BadRequestException('Logo must be JPEG, PNG, WebP, or SVG');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be smaller than 2MB');
    }

    const result = await this.streamToCloudinary(
      file.buffer,
      file.mimetype,
      'supportflow/logos',
      { transformation: [{ width: 400, height: 400, crop: 'limit' }] },
    );

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: result.secure_url },
    });

    return { logoUrl: result.secure_url };
  }

  // ============================================================
  // DELETE ATTACHMENT
  // ============================================================
  async deleteAttachment(
    tenantId: string,
    attachmentId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, tenantId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploadedBy !== requesterId && requesterRole !== 'WORKSPACE_ADMIN') {
      throw new ForbiddenException('You can only delete your own attachments');
    }

    await cloudinary.uploader.destroy(attachment.publicId).catch((err) =>
      this.logger.warn(`Cloudinary delete failed for ${attachment.publicId}: ${err.message}`),
    );

    await this.prisma.ticketAttachment.delete({ where: { id: attachmentId } });
    return { message: 'Attachment deleted successfully' };
  }

  // ============================================================
  // GET ATTACHMENTS FOR A TICKET
  // ============================================================
  async getTicketAttachments(tenantId: string | null, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, ...(tenantId && { tenantId }), deletedAt: null },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.ticketAttachment.findMany({
      where: { ticketId, ...(tenantId && { tenantId }) },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private validateFile(file: UploadedFile) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: images (JPEG, PNG, GIF, WebP) and PDF`,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB maximum size limit');
    }
  }

  private streamToCloudinary(
    buffer: Buffer,
    mimetype: string,
    folder: string,
    options: Record<string, unknown> = {},
  ): Promise<UploadApiResponse> {
    const resourceType = mimetype === 'application/pdf' ? 'raw' : 'image';
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, ...options },
        (err, result) => {
          if (err || !result) return reject(err ?? new Error('Upload failed'));
          resolve(result);
        },
      );
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  private extractPublicId(url: string): string | null {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : null;
  }
}
