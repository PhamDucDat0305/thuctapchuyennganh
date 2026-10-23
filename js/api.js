// Shared HTTP client for the SQL Server backed Express API.
// Change this value if the API runs on another host or port.
// Keep host consistent with the page URL so the browser treats the session
// cookie as same-site (open the frontend via localhost or 127.0.0.1, not file://).
const API_BASE_URL = `${location.protocol}//${location.hostname || 'localhost'}:3000/api`;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Yêu cầu thất bại (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

window.JVApi = { request: apiRequest };
export { apiRequest };
