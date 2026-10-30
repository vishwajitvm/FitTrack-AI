"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { Toaster } from "sonner";
import { fetcher } from "@/lib/api";
import { PrefsProvider } from "./prefs-provider";
import { ThemeProvider, useTheme } from "./theme-provider";

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={resolved} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <SWRConfig value={{ fetcher, revalidateOnFocus: false, shouldRetryOnError: false }}>
          {children}
          <ThemedToaster />
        </SWRConfig>
      </PrefsProvider>
    </ThemeProvider>
  );
}
