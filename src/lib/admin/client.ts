// Pemanggil API untuk island panel admin. Selalu mengembalikan envelope; kegagalan jaringan
// diubah jadi envelope error Bahasa Indonesia supaya pemanggil cukup satu cabang `if`.

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, string>;
}

export type ApiResult<T = unknown> =
  { success: true; data: T } | { success: false; error: ApiError };

const NETWORK_ERROR: ApiResult<never> = {
  success: false,
  error: { code: 'NETWORK', message: 'Koneksi bermasalah. Coba lagi.', details: {} },
};

export async function callApi<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401) {
      // Sesi habis: kembali ke login dengan tujuan halaman ini.
      const target = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/admin/login?redirect=${encodeURIComponent(target)}`);
    }
    const json = (await response.json()) as ApiResult<T>;
    if (!json.success) json.error.details ??= {};
    return json;
  } catch {
    return NETWORK_ERROR;
  }
}
