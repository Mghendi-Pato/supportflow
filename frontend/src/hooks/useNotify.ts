import { useSnackbar } from 'notistack';

/**
 * Thin wrapper around notistack's useSnackbar.
 * Provides shorthand methods: notify.success(), notify.error(), etc.
 */
export function useNotify() {
  const { enqueueSnackbar } = useSnackbar();
  // Explicit `: void` return type so these can be used directly inside
  // react-query onSuccess / onError callbacks without a type mismatch
  // (enqueueSnackbar returns SnackbarKey which is not assignable to void).
  return {
    success: (msg: string): void => { enqueueSnackbar(msg, { variant: 'success' }); },
    error:   (msg: string): void => { enqueueSnackbar(msg, { variant: 'error' }); },
    info:    (msg: string): void => { enqueueSnackbar(msg, { variant: 'info' }); },
    warning: (msg: string): void => { enqueueSnackbar(msg, { variant: 'warning' }); },
  };
}

/** Extract a user-facing message from an Axios-style error. */
export function errMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } } | null;
  return e?.response?.data?.message ?? fallback;
}
