import { QueryClient } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") return new QueryClient();
  browserClient ??= new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return false;
          return failureCount < 1;
        },
      },
    },
  });
  return browserClient;
}

export async function clearQueryClient() {
  if (!browserClient) return;
  try {
    await browserClient.cancelQueries();
  } catch {
    // Ignore cancellation errors
  }
  browserClient.clear();
}
