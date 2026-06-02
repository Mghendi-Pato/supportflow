import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPlan } from '@prisma/client';
import { PLAN_PRICING } from '../../common/constants/plan-limits';
import * as crypto from 'crypto';

const FLW_BASE = 'https://api.flutterwave.com/v3';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string;
  private readonly frontendUrl: string;
  private readonly backendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.secretKey  = config.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.frontendUrl = config.get<string>('FRONTEND_URL')  || 'http://localhost:3001';
    this.backendUrl  = config.get<string>('APP_URL')        || 'http://localhost:3002';
  }

  /**
   * Creates a Flutterwave hosted payment page and returns the redirect URL.
   * Called after account creation when the user selects a paid plan.
   */
  async initiatePayment(
    tenantId: string,
    userId: string,
    plan: Extract<TenantPlan, 'STANDARD' | 'PREMIUM'>,
    customerEmail: string,
    customerName: string,
  ) {
    const amount = PLAN_PRICING[plan];
    const txRef = `sf-${tenantId}-${plan.toLowerCase()}-${Date.now()}`;
    const redirectUrl = `${this.frontendUrl}/register/payment-callback`;

    const payload = {
      tx_ref: txRef,
      amount,
      currency: 'KES',
      redirect_url: redirectUrl,
      customer: {
        email: customerEmail,
        name: customerName,
      },
      customizations: {
        title: 'SupportFlow',
        description: `${plan} plan — monthly subscription`,
        logo: `${this.frontendUrl}/logo.png`,
      },
      meta: {
        tenantId,
        userId,
        plan,
      },
    };

    const res = await fetch(`${FLW_BASE}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as any;

    if (data?.status !== 'success') {
      this.logger.error('Flutterwave payment initiation failed', data);
      throw new BadRequestException('Could not create payment link. Please try again.');
    }

    // Store the tx_ref so we can validate the webhook
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { txRef, pendingPlan: plan } },
    });

    return {
      paymentUrl: data.data.link,
      txRef,
    };
  }

  /**
   * Verifies a Flutterwave transaction and upgrades the tenant plan.
   * Called from the frontend redirect callback with ?transaction_id=xxx
   */
  async verifyAndUpgrade(transactionId: string, tenantId: string) {
    const verifyRes = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const verifyData = await verifyRes.json() as any;

    const txData = verifyData?.data;

    if (
      !txData ||
      verifyData.status !== 'success' ||
      txData.status !== 'successful'
    ) {
      throw new BadRequestException('Payment verification failed. Please contact support if you were charged.');
    }

    const meta = txData.meta as { tenantId?: string; plan?: string };

    if (!meta?.tenantId || meta.tenantId !== tenantId) {
      throw new BadRequestException('Transaction does not match this workspace.');
    }

    const plan = meta.plan as TenantPlan;
    if (!['STANDARD', 'PREMIUM'].includes(plan)) {
      throw new BadRequestException('Invalid plan in transaction metadata.');
    }

    // Upgrade the tenant plan — set renewal date to 30 days from now
    const planRenewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan, planRenewsAt, settings: {} },
      select: { id: true, name: true, slug: true, plan: true, planRenewsAt: true },
    });

    this.logger.log(`Tenant ${tenantId} upgraded to ${plan}`);

    return { success: true, tenant };
  }

  /**
   * Flutterwave webhook handler — validates signature + upgrades plan.
   * Flutterwave sends POST to /api/v1/payments/webhook with payment events.
   */
  async handleWebhook(payload: any, signature: string) {
    const webhookSecret = this.config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET') || '';

    if (webhookSecret) {
      if (signature !== webhookSecret) {
        this.logger.warn('Flutterwave webhook signature mismatch');
        return; // Silently reject — don't throw (return 200 to prevent retries)
      }
    }

    if (payload.event !== 'charge.completed') return;

    const txData = payload.data;
    if (txData?.status !== 'successful') return;

    const meta = txData.meta as { tenantId?: string; plan?: string };
    if (!meta?.tenantId || !meta?.plan) return;

    try {
      await this.verifyAndUpgrade(txData.id.toString(), meta.tenantId);
    } catch (err) {
      this.logger.error(`Webhook upgrade failed for tenant ${meta.tenantId}`, err);
    }
  }
}
