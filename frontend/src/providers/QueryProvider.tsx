import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "./queryClient.js";

/**
 * アプリ全体を React Query でラップするプロバイダー。
 * @param children - 子要素
 * @returns QueryClientProvider でラップした JSX
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
