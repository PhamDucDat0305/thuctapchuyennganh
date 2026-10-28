// Same-origin by default when Express serves the frontend and API together.
// Keep compatibility with the previously configured Live Server ports.
const legacyLiveServer = ['5500', '5501'].includes(location.port);
const legacyApiBase = `${location.protocol}//${location.hostname || 'localhost'}:3000/api`;
const API_BASE_URL = window.JV_API_BASE_URL || (legacyLiveServer ? legacyApiBase : '/api');

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
