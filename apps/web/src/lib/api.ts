export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
  /** Código estável enviado pela API (ex.: AUTH_REQUIRED, BAD_ORIGIN). */
  get code(): string | undefined {
    return (this.body as { code?: string } | undefined)?.code;
  }
}

/** Chamado quando a API responde "precisa do PIN" (sessão expirada ou ausente). */
let onAuthRequired: (() => void) | null = null;
export const setAuthRequiredHandler = (fn: (() => void) | null) => {
  onAuthRequired = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : undefined;
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error ?? res.statusText, data);
    if (res.status === 401 && err.code === 'AUTH_REQUIRED') onAuthRequired?.();
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
