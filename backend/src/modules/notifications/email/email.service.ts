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

export interface PasswordResetEmailPayload {
  to: string;
  firstName: string;
  resetUrl: string; // e.g. https://app.supportflow.com/reset-password?token=xxx
}

export interface RegistrationVerificationEmailPayload {
  to: string;
  verifyUrl: string; // e.g. https://app.supportflow.com/register/complete?token=xxx
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
  // PASSWORD RESET EMAIL
  // ============================================================
  async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
    const html = this.buildPasswordResetHtml(payload);
    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to: payload.to,
        subject: 'Reset your SupportFlow password',
        html,
      });
      this.logger.log(`Password reset email sent to ${payload.to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${payload.to}`, error);
    }
  }

  // ============================================================
  // REGISTRATION VERIFICATION EMAIL
  // ============================================================
  async sendRegistrationVerificationEmail(
    payload: RegistrationVerificationEmailPayload,
  ): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#4f46e5;padding:28px 40px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">SupportFlow</span>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Verify your email address</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
            You requested to create a SupportFlow workspace. Click the button below to verify your email and continue setting up your account.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${payload.verifyUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:8px;">
              Verify Email &amp; Continue
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">This link expires in <strong>24 hours</strong>. If you didn't request this, you can safely ignore this email.</p>
          <p style="margin:16px 0 0;font-size:12px;color:#d1d5db;word-break:break-all;">
            Or copy this link: ${payload.verifyUrl}
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            &copy; ${new Date().getFullYear()} SupportFlow &mdash; <a href="${this.frontendUrl}" style="color:#6b7280;text-decoration:none;">supportflow.app</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to: payload.to,
        subject: 'Verify your email to create your SupportFlow workspace',
        html,
      });
      this.logger.log(`Registration verification email sent to ${payload.to}`);
    } catch (error) {
      this.logger.error(`Failed to send registration verification email to ${payload.to}`, error);
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

  private buildPasswordResetHtml(payload: PasswordResetEmailPayload): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:28px 40px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">SupportFlow</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
              Hi <strong>${payload.firstName}</strong>, we received a request to reset the password for your SupportFlow account.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#52525b;line-height:1.6;">
              Click the button below to choose a new password. This link is valid for <strong>30 minutes</strong>.
              If you didn't request a password reset, you can safely ignore this email.
            </p>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#4f46e5;border-radius:6px;">
                  <a href="${payload.resetUrl}"
                     style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Reset Password →
                  </a>
                </td>
              </tr>
            </table>
            <!-- Fallback link -->
            <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">
              Or copy this link: <a href="${payload.resetUrl}" style="color:#4f46e5;">${payload.resetUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              This link expires in 30 minutes. If you need a new one, visit the login page and click "Forgot Password?" again.
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
