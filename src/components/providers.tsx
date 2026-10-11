"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }));
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <ToastCtx.Provider value={show}>
        {children}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          {toast ? <div className="rounded-lg bg-[#14213d] px-4 py-2.5 text-sm font-medium text-[#f7f8f2] shadow-lg dark:bg-[#d6f85a] dark:text-[#14213d]">{toast}</div> : null}
        </div>
      </ToastCtx.Provider>
    </QueryClientProvider>
  );
}
