import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface InviteEmailPayload {
  to: string;
  inviteeName: string;   // e.g. "Patrick" (if known) or full name
  inviterName: string;   // person who sent the invite
  workspaceName: string;
  role: 'WORKSPACE_ADMIN' | 'AGENT' | 'CLIENT';
  inviteUrl: string;     // e.g. https://app.supportflow.com/invite?token=xxx
  expiresInDays?: number;
}

export interface TicketNotificationPayload {
  to: string;
  recipientName: string;
  subject: string;
  heading: string;
  body: string;
  ticketNumber: string;
  ticketUrl: string;
  workspaceName: string;
}

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.from = config.get<string>('RESEND_FROM_EMAIL') || 'support@supportflow.app';
    this.fromName = config.get<string>('RESEND_FROM_NAME') || 'SupportFlow';
    this.frontendUrl = config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  // ============================================================
  // INVITATION EMAIL — sent to agents and clients being invited
  // ============================================================
  async sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
    const roleLabel =
      payload.role === 'CLIENT'
        ? 'client portal'
        : payload.role === 'AGENT'
        ? 'support team member'
        : 'workspace admin';

    const html = this.buildInviteHtml(payload, roleLabel);

    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to: payload.to,
        subject: `You've been invited to ${payload.workspaceName} on SupportFlow`,
        html,
      });
      this.logger.log(`Invite email sent to ${payload.to}`);
    } catch (error) {
      this.logger.error(`Failed to send invite email to ${payload.to}`, error);
      // Don't throw — email failure shouldn't break the invite creation
    }
  }

  // ============================================================
  // TICKET NOTIFICATION EMAIL — status changes, new comments, etc.
  // ============================================================
  async sendTicketNotification(payload: TicketNotificationPayload): Promise<void> {
    const html = this.buildTicketNotificationHtml(payload);

    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to: payload.to,
        subject: payload.subject,
        html,
      });
      this.logger.log(`Ticket notification sent to ${payload.to} — ${payload.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send ticket notification to ${payload.to}`, error);
    }
  }

  // ============================================================
  // HTML TEMPLATES
  // ============================================================

  private buildInviteHtml(payload: InviteEmailPayload, roleLabel: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're Invited</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:28px 40px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">SupportFlow</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;">You've been invited</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
              <strong>${payload.inviterName}</strong> has invited you to join
              <strong>${payload.workspaceName}</strong> as a ${roleLabel}.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#52525b;line-height:1.6;">
              Click the button below to create your account and get started.
              This invitation ${payload.expiresInDays ? `expires in ${payload.expiresInDays} days` : 'will expire'}.
            </p>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#18181b;border-radius:6px;">
                  <a href="${payload.inviteUrl}"
                     style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Accept Invitation →
                  </a>
                </td>
              </tr>
            </table>
            <!-- Fallback link -->
            <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">
              Or copy this link: <a href="${payload.inviteUrl}" style="color:#18181b;">${payload.inviteUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildTicketNotificationHtml(payload: TicketNotificationPayload): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${payload.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:28px 40px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">SupportFlow</p>
            <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">${payload.workspaceName}</p>
          </td>
        </tr>
        <!-- Ticket badge -->
        <tr>
          <td style="padding:24px 40px 0;">
            <span style="display:inline-block;background:#f4f4f5;color:#52525b;font-size:12px;font-weight:600;padding:4px 10px;border-radius:4px;letter-spacing:0.5px;">
              ${payload.ticketNumber}
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:16px 40px 40px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#18181b;">${payload.heading}</h1>
            <p style="margin:0 0 32px;font-size:15px;color:#52525b;line-height:1.6;">${payload.body}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#18181b;border-radius:6px;">
                  <a href="${payload.ticketUrl}"
                     style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                    View Ticket →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              Hi ${payload.recipientName}, you're receiving this because you're involved in this support ticket.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
