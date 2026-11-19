export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Something went wrong. Try again.');
    this.status = status;
    this.code = body?.code || 'ERROR';
    this.fields = body?.fields || {};
    this.details = body || {};
  }
}

// Every endpoint answers errors as { error: { code, message } }. This turns them into ApiError.
export async function api(method, path, { json, form } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: json !== undefined ? JSON.stringify(json) : form,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: 'Cannot reach the server. Check your connection.' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data;
}

export const get = (path) => api('GET', path);
export const post = (path, json) => api('POST', path, { json });
export const put = (path, json) => api('PUT', path, { json });
export const patch = (path, json) => api('PATCH', path, { json });
export const del = (path) => api('DELETE', path);

export const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};
