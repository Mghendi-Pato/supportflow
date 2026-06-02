import { TenantPlan } from '@prisma/client';

export interface PlanLimits {
  /** Max staff members (agents + admins). null = unlimited */
  maxAgents: number | null;
  /** Max client accounts. null = unlimited */
  maxClients: number | null;
  /** Max tickets per calendar month. null = unlimited */
  maxTicketsPerMonth: number | null;
  /** Max file size per upload in bytes */
  maxFileSizeBytes: number;
  /** Max attachments per ticket */
  maxFilesPerTicket: number;
  /** Feature flags */
  features: {
    analytics: boolean;
    liveChat: boolean;
    customBranding: boolean;
    advancedAnalytics: boolean;
    apiAccess: boolean;
    billing: boolean;
    emailToTicket: boolean;
    prioritySupport: boolean;
  };
}

export const PLAN_LIMITS: Record<TenantPlan, PlanLimits> = {
  FREE: {
    maxAgents: 1,
    maxClients: 1,
    maxTicketsPerMonth: 10,
    maxFileSizeBytes: 5 * 1024 * 1024,   // 5 MB
    maxFilesPerTicket: 1,
    features: {
      analytics: false,
      liveChat: false,
      customBranding: false,
      advancedAnalytics: false,
      apiAccess: false,
      billing: false,
      emailToTicket: false,
      prioritySupport: false,
    },
  },
  STANDARD: {
    maxAgents: 5,
    maxClients: 3,
    maxTicketsPerMonth: 50,
    maxFileSizeBytes: 10 * 1024 * 1024,  // 10 MB
    maxFilesPerTicket: 10,
    features: {
      analytics: true,
      liveChat: true,
      customBranding: false,
      advancedAnalytics: false,
      apiAccess: false,
      billing: true,
      emailToTicket: true,
      prioritySupport: false,
    },
  },
  PREMIUM: {
    maxAgents: null,
    maxClients: null,
    maxTicketsPerMonth: null,
    maxFileSizeBytes: 50 * 1024 * 1024,  // 50 MB
    maxFilesPerTicket: 50,
    features: {
      analytics: true,
      liveChat: true,
      customBranding: true,
      advancedAnalytics: true,
      apiAccess: true,
      billing: true,
      emailToTicket: true,
      prioritySupport: true,
    },
  },
};

/** Pricing in KES (monthly) */
export const PLAN_PRICING: Record<TenantPlan, number> = {
  FREE: 0,
  STANDARD: 2500,
  PREMIUM: 7500,
};

/** Human-readable plan names */
export const PLAN_NAMES: Record<TenantPlan, string> = {
  FREE: 'Free',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
};
