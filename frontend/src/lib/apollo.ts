// NOTE: no 'use client' here — this is a utility module imported by Providers.tsx
// which itself is 'use client'. Keeping this as a plain TS file avoids Next.js
// treating it as a boundary and accidentally evaluating it server-side.

import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  HttpLink,
  split,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';

// ── Shared HTTP link (used on both server and browser) ───────────────────────

function makeHttpLink() {
  return new HttpLink({ uri: `${BACKEND}/graphql` });
}

function makeAuthLink() {
  // Synchronous ApolloLink avoids the async Promise chain in setContext,
  // which has a bug in Apollo 3.11 where .then(operation.setContext) is called
  // unbound and can cause "Cannot read properties of undefined (reading 'method')".
  return new ApolloLink((operation, forward) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      operation.setContext(({ headers = {} }: { headers: Record<string, string> }) => ({
        headers: { ...headers, authorization: `Bearer ${token}` },
      }));
    }
    return forward(operation);
  });
}

// ── WebSocket link — browser only ───────────────────────────────────────────

function makeWsLink() {
  const wsUrl = BACKEND.replace(/^http/, 'ws') + '/graphql';
  return new GraphQLWsLink(
    createClient({
      url: wsUrl,
      connectionParams: () => {
        const token =
          typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      retryAttempts: 5,
    }),
  );
}

// ── Cache policy ─────────────────────────────────────────────────────────────

function makeCache() {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          messages: {
            // Only ticketId determines the cache key — cursor/limit are pagination args
            keyArgs: ['ticketId'],
            merge(existing, incoming, { args }) {
              // Fresh / initial load (no cursor): always replace.
              // This prevents the cache from doubling messages each time the
              // component remounts and re-fires the query.
              if (!args?.cursor) return incoming;

              // "Load more" (cursor present): prepend the older page before
              // whatever is already cached.
              return {
                ...incoming,
                items: [
                  ...(incoming?.items ?? []),
                  ...(existing?.items ?? []),
                ],
              };
            },
          },
        },
      },
    },
  });
}

// ── Client factory ───────────────────────────────────────────────────────────
//
// Call this exactly once in a browser context (inside Providers' useState).
// Never call it during SSR — ChatPanel is loaded with ssr:false so this should
// only ever execute in the browser.

export function makeApolloClient(): ApolloClient<any> {
  const httpLink  = makeHttpLink();
  const authLink  = makeAuthLink();

  // Split: subscriptions → WebSocket, everything else → HTTP+auth
  const splitLink = split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return (
        def.kind === 'OperationDefinition' &&
        def.operation === 'subscription'
      );
    },
    makeWsLink(),
    authLink.concat(httpLink),
  );

  return new ApolloClient({
    link: splitLink,
    cache: makeCache(),
    ssrMode: false,
  });
}
