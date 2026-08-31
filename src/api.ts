const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('makeen_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('makeen_token', token);
    } else {
      localStorage.removeItem('makeen_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errorData.error || `HTTP Error ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, pass: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(email: string, name: string, pass: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password: pass }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async recoverPassword(email: string) {
    return this.request('/auth/recovery', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  logout() {
    this.setToken(null);
  }

  // Servers
  async getServers() {
    return this.request<{ servers: any[] }>('/servers');
  }

  async createServer(serverData: any) {
    return this.request<{ server: any }>('/servers', {
      method: 'POST',
      body: JSON.stringify(serverData),
    });
  }

  async updateServer(id: string, serverData: any) {
    return this.request<{ server: any }>(`/servers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serverData),
    });
  }

  async deleteServer(id: string) {
    return this.request(`/servers/${id}`, { method: 'DELETE' });
  }

  async testConnection(id: string) {
    return this.request<{
      success: boolean;
      latencyMs: number;
      message: string;
      version?: string;
      boardName?: string;
      identity?: string;
      cloudDdns?: string;
      publicIp?: string;
      protocol?: string;
      steps?: Array<{ name: string; status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'INFO'; detail: string }>;
      troubleshooting?: string[];
    }>(`/servers/${id}/test`, { method: 'POST' });
  }

  async probeServer(data: {
    host: string;
    username: string;
    password?: string;
    apiPort?: string | number;
    apiSslPort?: string | number;
    connectionType?: string;
    osVersion?: string;
  }) {
    return this.request<{
      success: boolean;
      latencyMs: number;
      message: string;
      version?: string;
      boardName?: string;
      identity?: string;
      cloudDdns?: string;
      publicIp?: string;
      protocol?: string;
      steps?: Array<{ name: string; status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'INFO'; detail: string }>;
      troubleshooting?: string[];
    }>('/servers/probe', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async setServerState(id: string, status: string) {
    return this.request<{ server: any }>(`/servers/${id}/state`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async getServerStatus(id: string) {
    return this.request<{ stats: any }>(`/servers/${id}/status`);
  }

  // Cards
  async getCards(serverId: string, filter?: { status?: string; posId?: string; search?: string }) {
    const params = new URLSearchParams();
    if (filter?.status) params.set('status', filter.status);
    if (filter?.posId) params.set('posId', filter.posId);
    if (filter?.search) params.set('search', filter.search);
    return this.request<{ cards: any[] }>(`/servers/${serverId}/cards?${params.toString()}`);
  }

  async checkCard(serverId: string, query: string) {
    return this.request<{ card: any }>(`/servers/${serverId}/cards/check`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async generateCards(serverId: string, options: any) {
    return this.request<{ requested: number; created: number; failed: number; batchId: string; errors: string[]; cards: any[] }>(
      `/servers/${serverId}/cards/generate`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
  }

  async deleteCard(serverId: string, username: string) {
    return this.request<{ success: boolean }>(`/servers/${serverId}/cards/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
  }

  async deleteCardsBatch(serverId: string, usernames: string[]) {
    return this.request<{ deleted: number }>(`/servers/${serverId}/cards/delete-batch`, {
      method: 'POST',
      body: JSON.stringify({ usernames }),
    });
  }

  async getCardSettings(serverId: string) {
    return this.request<{ settings: any }>(`/servers/${serverId}/settings`);
  }

  async updateCardSettings(serverId: string, settings: any) {
    return this.request<{ settings: any }>(`/servers/${serverId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getProfiles(serverId: string) {
    return this.request<{ profiles: any[] }>(`/servers/${serverId}/profiles`);
  }

  // Active Users
  async getActiveUsers(serverId: string) {
    return this.request<{ activeUsers: any[] }>(`/servers/${serverId}/active-users`);
  }

  async disconnectUser(serverId: string, username: string) {
    return this.request(`/servers/${serverId}/active-users/disconnect`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  // POS
  async getPosList(serverId: string) {
    return this.request<{ posList: any[] }>(`/servers/${serverId}/pos`);
  }

  async createPos(serverId: string, data: any) {
    return this.request<{ pos: any }>(`/servers/${serverId}/pos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePos(serverId: string, posId: string) {
    return this.request(`/servers/${serverId}/pos/${posId}`, { method: 'DELETE' });
  }

  // Reports
  async getReport(serverId: string, filter: any) {
    return this.request<{ report: any }>(`/servers/${serverId}/reports`, {
      method: 'POST',
      body: JSON.stringify(filter),
    });
  }

  // Backups & Maintenance
  async getBackups(serverId: string) {
    return this.request<{ backups: any[] }>(`/servers/${serverId}/backups`);
  }

  async createBackup(serverId: string) {
    return this.request(`/servers/${serverId}/backups`, { method: 'POST' });
  }

  async restoreBackup(serverId: string, filename: string) {
    return this.request(`/servers/${serverId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ filename, confirmed: true }),
    });
  }

  async previewCleanup(serverId: string) {
    return this.request<{ preview: any }>(`/servers/${serverId}/cleanup/preview`);
  }

  async executeCleanup(serverId: string) {
    return this.request(`/servers/${serverId}/cleanup`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  }

  async executeRebuild(serverId: string) {
    return this.request(`/servers/${serverId}/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  }

  async executeReboot(serverId: string) {
    return this.request(`/servers/${serverId}/reboot`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  }

  // Telegram
  async getTelegramBotConfig() {
    return this.request<{ status: any }>('/telegram/bot-config');
  }

  async setTelegramBotConfig(token: string, mode: 'POLLING' | 'WEBHOOK' = 'POLLING') {
    return this.request<{ success: boolean; botInfo: any; status: any }>('/telegram/bot-config', {
      method: 'POST',
      body: JSON.stringify({ token, mode }),
    });
  }

  async disconnectTelegramBot() {
    return this.request<{ success: boolean; status: any }>('/telegram/bot-config', {
      method: 'DELETE',
    });
  }

  async testTelegramBot(chatId?: number, message?: string) {
    return this.request<{ success: boolean; result?: any }>('/telegram/bot-test', {
      method: 'POST',
      body: JSON.stringify({ chatId, message }),
    });
  }

  async getTelegramToken() {
    return this.request<{ linkToken: { token: string; expiresAt: string } }>('/telegram/token', {
      method: 'POST',
    });
  }

  async getTelegramAccounts() {
    return this.request<{ accounts: any[] }>('/telegram/accounts');
  }

  async unlinkTelegram(id: string) {
    return this.request(`/telegram/accounts/${id}`, { method: 'DELETE' });
  }

  async simulateTelegram(payload: { text?: string; callbackData?: string; telegramUserId?: number }) {
    return this.request<{ reply: any }>('/telegram/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Audit Logs
  async getAuditLogs(serverId?: string) {
    const url = serverId ? `/audit-logs?serverId=${serverId}` : '/audit-logs';
    return this.request<{ logs: any[] }>(url);
  }
}

export const api = new ApiClient();
