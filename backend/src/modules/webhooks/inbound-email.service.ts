import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email/email.service';
import { ConfigService } from '@nestjs/config';

export interface ResendInboundPayload {
  from:        string;              // "John Doe <john@example.com>" or "john@example.com"
  to:          string[];            // ["acme@inbound.supportflow.app"]
  subject:     string;
  text?:       string;              // plain-text body
  html?:       string;
  attachments?: {
    filename:    string;
    content:     string;           // base64
    contentType: string;
  }[];
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') || 'http://localhost:3001';
  }

  async handle(payload: ResendInboundPayload): Promise<void> {
    const senderEmail = this.extractEmail(payload.from);
    const recipientAddress = payload.to?.[0] ?? '';

    this.logger.log(`Inbound email from ${senderEmail} → ${recipientAddress}`);

    // ── 1. Resolve workspace from recipient address ──────────────────────────
    const tenant = await this.prisma.tenant.findFirst({
      where: { inboundEmail: recipientAddress, isActive: true, deletedAt: null },
    });

    if (!tenant) {
      this.logger.warn(`No workspace found for inbound address: ${recipientAddress}`);
      return; // silently drop — unknown address
    }

    // ── 2. Match sender to a registered client ───────────────────────────────
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: tenant.id,
        email: senderEmail.toLowerCase(),
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!client) {
      this.logger.warn(`Unregistered sender ${senderEmail} for workspace ${tenant.slug}`);
      await this.sendUnregisteredReply(senderEmail, tenant.name, recipientAddress);
      return;
    }

    // ── 3. Build ticket title & description from email ───────────────────────
    const title = this.sanitiseSubject(payload.subject || 'Support request');
    const description = this.extractBody(payload.text, payload.html);

    // ── 4. Get next ticket number ────────────────────────────────────────────
    const ticketNumber = await this.prisma.getNextTicketNumber(tenant.id);

    // ── 5. Create the ticket ─────────────────────────────────────────────────
    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId:        tenant.id,
        ticketNumber,
        clientId:        client.id,
        title,
        description,
        priority:        'MEDIUM',
        status:          'OPEN',
        createdByUserId: client.userId!,
        createdByType:   'client',
        assignedTo:      null,
      } as any,
    });

    // ── 6. Log activity ──────────────────────────────────────────────────────
    await this.prisma.ticketActivityLog.create({
      data: {
        ticketId:    ticket.id,
        tenantId:    tenant.id,
        actorUserId: client.userId!,
        action:      'TICKET_CREATED' as any,
        metadata:    { source: 'email' } as any,
      },
    });

    // ── 7. Notify workspace admins ───────────────────────────────────────────
    const admins = await this.prisma.tenantMember.findMany({
      where: { tenantId: tenant.id, role: 'WORKSPACE_ADMIN', isActive: true },
      include: { user: { select: { id: true, firstName: true, email: true } } },
    });

    const ticketUrl = `${this.frontendUrl}/tickets/${ticketNumber}`;

    await Promise.all(
      admins.map((m) =>
        this.email.sendTicketNotification({
          to:            m.user.email,
          recipientName: m.user.firstName,
          subject:       `New ticket via email: ${ticketNumber}`,
          heading:       `New ticket: ${ticketNumber}`,
          body:          `<strong>${client.contactName}</strong> submitted a ticket via email.<br/><br/><strong>Subject:</strong> ${title}`,
          ticketNumber,
          ticketUrl,
          workspaceName: tenant.name,
        }).catch(() => {}),
      ),
    );

    // ── 8. Send confirmation to client ───────────────────────────────────────
    await this.sendConfirmationReply(
      senderEmail,
      client.contactName,
      ticketNumber,
      title,
      tenant.name,
      ticketUrl,
    );

    this.logger.log(`Created ticket ${ticketNumber} from email for workspace ${tenant.slug}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Extract bare email address from "Name <email@domain.com>" or plain address */
  private extractEmail(from: string): string {
    const match = from.match(/<(.+?)>/);
    return (match ? match[1] : from).trim().toLowerCase();
  }

  /** Strip Re:, Fwd:, fw: prefixes and trim */
  private sanitiseSubject(subject: string): string {
    return subject.replace(/^(re|fwd?|fw):\s*/gi, '').trim() || 'Support request';
  }

  /** Prefer plain text; strip basic HTML tags as fallback */
  private extractBody(text?: string, html?: string): string {
    if (text?.trim()) return text.trim();
    if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return '';
  }

  private async sendConfirmationReply(
    to: string,
    name: string,
    ticketNumber: string,
    title: string,
    workspaceName: string,
    ticketUrl: string,
  ) {
    await this.email.sendTicketNotification({
      to,
      recipientName: name,
      subject:       `We received your request — ${ticketNumber}`,
      heading:       'Your support request has been received',
      body:          `Thanks for reaching out! We've created ticket <strong>${ticketNumber}</strong> for your request: "${title}". Our team will be in touch shortly.`,
      ticketNumber,
      ticketUrl,
      workspaceName,
    }).catch(() => {});
  }

  private async sendUnregisteredReply(
    to: string,
    workspaceName: string,
    inboundAddress: string,
  ) {
    await this.email.sendTicketNotification({
      to,
      recipientName: 'there',
      subject:       `We couldn't process your request — ${workspaceName}`,
      heading:       'Email not recognised',
      body:          `We received your email but couldn't match it to a registered account with <strong>${workspaceName}</strong>. Please contact the workspace directly or use the client portal to submit your request.`,
      ticketNumber:  'N/A',
      ticketUrl:     '',
      workspaceName,
    }).catch(() => {});
  }
}
