import { BASE_URL, API_TIMEOUT } from '../config/constants';

// ==================== API LAYER ====================
export const H = (token) => ({
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const fetchWithTimeout = async (url, options, timeout = API_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') throw new Error('Request timeout');
    throw error;
  }
};

export const createApi = (onUnauthorized) => ({

  // ─────────────────────────────────────────────────────────────
  // post — standard POST, throws on any non-2xx response.
  // Use this for login, set-password, verify-otp, reset-password.
  // ─────────────────────────────────────────────────────────────
  post: async (path, body, token) => {
    try {
      const r = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: 'POST', headers: H(token), body: JSON.stringify(body),
      });
      if (r.status === 401) {
        onUnauthorized?.();
        throw new Error('Session expired. Please log in again.');
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || 'Request failed');
      return d;
    } catch (error) {
      console.error(`API POST ${path} error:`, error.message);
      throw new Error(error.message || 'Network error');
    }
  },

  // ─────────────────────────────────────────────────────────────
  // postSoft — POST that NEVER throws on non-2xx.
  // Returns { ok, status, data } always.
  //
  // Use this for:
  //   • /auth/forgot-password  → backend may return 404 for unknown
  //     email, but we must NOT reveal that to the user or block flow.
  //   • Any endpoint where you want to inspect the result yourself.
  //
  // Usage:
  //   const { ok, status, data } = await api.postSoft('/auth/forgot-password', { email });
  //   // navigate regardless — don't check ok here
  // ─────────────────────────────────────────────────────────────
  postSoft: async (path, body, token) => {
    try {
      const r = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: 'POST', headers: H(token), body: JSON.stringify(body),
      });
      if (r.status === 401) {
        onUnauthorized?.();
        // Even on 401 return soft result — don't throw
        return { ok: false, status: 401, data: { message: 'Session expired.' } };
      }
      let data = {};
      try { data = await r.json(); } catch (_) { /* empty body */ }
      console.log(`API postSoft ${path} → status ${r.status}`, data);
      return { ok: r.ok, status: r.status, data };
    } catch (error) {
      // Only true network/timeout errors reach here
      console.error(`API postSoft ${path} network error:`, error.message);
      // Re-throw ONLY for real connectivity failures so caller can show
      // "check your internet" message
      throw new Error(error.message || 'Network error');
    }
  },

  // ─────────────────────────────────────────────────────────────
  // get
  // ─────────────────────────────────────────────────────────────
  get: async (path, token) => {
    try {
      const r = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: 'GET', headers: H(token),
      });
      if (r.status === 401) {
        onUnauthorized?.();
        throw new Error('Session expired. Please log in again.');
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || 'Request failed');
      return d;
    } catch (error) {
      console.error(`API GET ${path} error:`, error.message);
      throw new Error(error.message || 'Network error');
    }
  },

  // ─────────────────────────────────────────────────────────────
  // put
  // ─────────────────────────────────────────────────────────────
  put: async (path, body, token) => {
    try {
      const r = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: 'PUT', headers: H(token), body: JSON.stringify(body),
      });
      if (r.status === 401) {
        onUnauthorized?.();
        throw new Error('Session expired. Please log in again.');
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || 'Request failed');
      return d;
    } catch (error) {
      console.error(`API PUT ${path} error:`, error.message);
      throw new Error(error.message || 'Network error');
    }
  },

  // ─────────────────────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────────────────────
  delete: async (path, token) => {
    try {
      const r = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: 'DELETE', headers: H(token),
      });
      if (r.status === 401) {
        onUnauthorized?.();
        throw new Error('Session expired. Please log in again.');
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || 'Request failed');
      return d;
    } catch (error) {
      console.error(`API DELETE ${path} error:`, error.message);
      throw new Error(error.message || 'Network error');
    }
  },
});

// ── api is a mutable container. App.js calls:
//    Object.assign(api, createApi(handleLogout))
// after mount to inject the real logout handler.
export const api = createApi(null);
export default api;