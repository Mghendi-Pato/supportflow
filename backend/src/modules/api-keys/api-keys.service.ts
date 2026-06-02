import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /** Generate a new API key and return the raw value exactly once. */
  async create(tenantId: string, dto: CreateApiKeyDto) {
    const raw = `sk_live_${randomBytes(32).toString('hex')}`; // 72 chars total
    const keyHash = sha256(raw);
    const keyPrefix = raw.substring(0, 16); // "sk_live_" + 8 hex chars

    const record = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyHash,
        keyPrefix,
      },
    });

    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      createdAt: record.createdAt,
      // Raw key returned ONCE — never stored, never returned again
      rawKey: raw,
    };
  }

  /** List all active keys for a tenant (never returns hashes or raw keys). */
  async list(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return keys;
  }

  /** Revoke (soft-delete) a key. Only the owning tenant can revoke. */
  async revoke(tenantId: string, keyId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.tenantId !== tenantId || !key.isActive) {
      throw new NotFoundException('API key not found');
    }
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false, revokedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Validate an incoming raw key. Returns the tenant + resolved JwtPayload
   * shape so guards work uniformly with JWT auth.
   */
  async validate(rawKey: string) {
    const keyHash = sha256(rawKey);

    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        tenant: {
          select: {
            id: true,
            plan: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                email: true,
                platformRole: true,
              },
            },
          },
        },
      },
    });

    if (!key || !key.isActive) return null;

    // Touch lastUsedAt asynchronously — no need to await
    this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    // Return a payload that mirrors JwtPayload so all role-based guards work
    return {
      sub: key.tenant.ownerId,
      email: key.tenant.owner.email,
      platformRole: key.tenant.owner.platformRole,
      tenantId: key.tenantId,
      role: 'WORKSPACE_ADMIN' as const, // API keys carry admin scope
      apiKeyId: key.id,
    };
  }
}
