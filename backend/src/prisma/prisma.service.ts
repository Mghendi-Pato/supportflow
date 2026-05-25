import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter: new PrismaPg(pool) });
    // Store pool so we can close it gracefully on shutdown
    (this as any).pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await (this as any).pool.end();
  }

  /**
   * Atomically increment the ticket sequence for a tenant and return the
   * human-friendly ticket number (e.g. "SUP-1042").
   * Uses raw SQL UPDATE ... RETURNING to avoid race conditions under
   * concurrent requests.
   */
  async getNextTicketNumber(tenantId: string): Promise<string> {
    const result = await this.$queryRaw<{ prefix: string; current_value: number }[]>`
      UPDATE tenant_ticket_sequences
      SET current_value = current_value + 1
      WHERE tenant_id = ${tenantId}
      RETURNING prefix, current_value
    `;

    if (!result.length) {
      throw new Error(`No ticket sequence found for tenant ${tenantId}`);
    }

    const { prefix, current_value } = result[0];
    return `${prefix}-${current_value}`;
  }
}
