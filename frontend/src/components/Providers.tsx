'use client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { SuperAdminTenantProvider } from '@/contexts/SuperAdminTenantContext';
import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ApolloProvider, ApolloClient } from '@apollo/client';
import { makeApolloClient } from '@/lib/apollo';
import { SnackbarProvider } from 'notistack';

const muiTheme = createTheme({
  palette: {
    primary: { main: '#6366f1' },
    error:   { main: '#ef4444' },
  },
  typography: { fontFamily: 'inherit' },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: 'transparent' } } },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      })
  );

  // Apollo client is created browser-side only.
  const [apolloClient, setApolloClient] = useState<ApolloClient<any> | null>(null);

  useEffect(() => {
    setApolloClient(makeApolloClient());
  }, []);

  const inner = (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline enableColorScheme={false} />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        dense
      >
        <SuperAdminTenantProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        </SuperAdminTenantProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );

  if (!apolloClient) return inner;

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline enableColorScheme={false} />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        dense
      >
        <ApolloProvider client={apolloClient}>
          <SuperAdminTenantProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>{children}</AuthProvider>
            </QueryClientProvider>
          </SuperAdminTenantProvider>
        </ApolloProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
