export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) return apiFetch(path, init, false);
  }
  return response;
}

export async function responseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return Array.isArray(body.message) ? body.message.join(". ") : body.message ?? fallback;
  } catch {
    return fallback;
  }
}

