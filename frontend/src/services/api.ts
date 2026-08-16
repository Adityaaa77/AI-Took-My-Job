// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// Resilient API Client Layer with Transparent Live/Mock Dual-Mode
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export class ApiService {
  private static token: string | null = localStorage.getItem('token');
  private static isOfflineMode = false;

  public static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  public static getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  public static setOfflineMode(enabled: boolean) {
    this.isOfflineMode = enabled;
  }

  public static getOfflineMode(): boolean {
    return this.isOfflineMode;
  }

  public static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    fallbackData?: T
  ): Promise<{ success: boolean; data: T; isMock?: boolean; message?: string }> {
    // If offline mode is forced or no backend is desired
    if (this.isOfflineMode && fallbackData !== undefined) {
      return { success: true, data: fallbackData, isMock: true };
    }

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const currentToken = this.getToken();
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout before fallback

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return {
        success: json.success ?? true,
        data: json.data !== undefined ? json.data : (json as unknown as T),
        isMock: false,
      };
    } catch {
      // Backend not running or unreachable — gracefully fallback to mock data
      if (fallbackData !== undefined) {
        return {
          success: true,
          data: fallbackData,
          isMock: true,
          message: 'Running in resilient offline demo mode',
        };
      }
      return {
        success: false,
        data: null as unknown as T,
        isMock: true,
        message: 'Could not connect to backend and no mock fallback available.',
      };
    }
  }

  public static get<T>(endpoint: string, fallbackData?: T) {
    return this.request<T>(endpoint, { method: 'GET' }, fallbackData);
  }

  public static post<T>(endpoint: string, body: unknown, fallbackData?: T) {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      fallbackData
    );
  }

  public static patch<T>(endpoint: string, body?: unknown, fallbackData?: T) {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      },
      fallbackData
    );
  }

  public static delete<T>(endpoint: string, fallbackData?: T) {
    return this.request<T>(endpoint, { method: 'DELETE' }, fallbackData);
  }
}
