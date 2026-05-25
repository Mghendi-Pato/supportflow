import { PubSub } from 'graphql-subscriptions';

// Singleton PubSub instance — swap for RedisPubSub in production
export const PUB_SUB = 'PUB_SUB';

export const pubSubProvider = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};
