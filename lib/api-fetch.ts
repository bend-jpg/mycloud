// Wrapper fetch côté client avec :
//   - Content-Type JSON automatique
//   - Parse de la réponse JSON
//   - Retry × N pour les 5xx (default 1 retry, exponentiel)
//   - Erreur structurée avec status + body
//
// Usage :
//   const data = await apiFetch<{ ok: true; user: User }>("/api/me", { method: "PATCH", body: { name: "..." } });

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Combien de fois réessayer sur 5xx. Default 1. */
  retries?: number;
  /** Délai initial entre retries en ms. Doublé à chaque retry. Default 300. */
  retryDelay?: number;
  /** Si true, on ne parse pas le body en JSON (utile pour blobs / streams). */
  raw?: boolean;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    body,
    retries = 1,
    retryDelay = 300,
    raw = false,
    headers,
    method = body ? "POST" : "GET",
    ...rest
  } = options;

  const headersFinal: Record<string, string> = {
    ...(body && !raw ? { "Content-Type": "application/json" } : {}),
    ...((headers as Record<string, string>) ?? {}),
  };

  const init: RequestInit = {
    method,
    headers: headersFinal,
    ...rest,
  };
  if (body !== undefined) {
    init.body = raw ? (body as BodyInit) : JSON.stringify(body);
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      // 5xx → retry si possible
      if (res.status >= 500 && attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt));
        continue;
      }
      // Parse body
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
      if (!res.ok) {
        const dataObj = data as { error?: string; message?: string } | null;
        const msg = dataObj?.message ?? dataObj?.error ?? `HTTP ${res.status}`;
        throw new ApiError(msg, res.status, data);
      }
      return data as T;
    } catch (e) {
      lastError = e;
      // ApiError → on relance immédiatement, pas de retry
      if (e instanceof ApiError) throw e;
      // Erreur réseau (fetch fail) → retry
      if (attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
