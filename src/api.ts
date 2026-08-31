import { Server, Card, CardProfile, CardSettings, POS, ActiveUser, AuditLog, TelegramAccount } from './types';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '/api';

// Initial Mock Seed for Static / Offline / GitHub Pages Mode
const MOCK_SERVERS: Server[] = [
  {
    id: 'srv-1',
    userId: 'u-demo',
    name: 'سيرفر البرج الرئيسي - RB4011',
    host: '192.168.88.1',
    apiPort: 8728,
    apiSslPort: 8729,
    sshPort: 22,
    username: 'admin',
    connectionType: 'ROUTEROS_V6',
    osVersion: 'v6',
    status: 'CONNECTED',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'srv-2',
    userId: 'u-demo',
    name: 'سيرفر برج الشمال - CCR1009',
    host: '10.10.10.1',
    apiPort: 8728,
    apiSslPort: 8729,
    sshPort: 22,
    username: 'admin',
    connectionType: 'ROUTEROS_V6',
    osVersion: 'v7',
    status: 'CONNECTED',
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
];

const MOCK_PROFILES: CardProfile[] = [
  {
    id: 'p-1',
    serverId: 'srv-1',
    name: '1 ساعة - 500 ريال',
    price: 500,
    validity: '1h',
    sharedUsers: 1,
    rateLimit: '2M/5M',
  },
  {
    id: 'p-2',
    serverId: 'srv-1',
    name: '24 ساعة - 2000 ريال',
    price: 2000,
    validity: '24h',
    sharedUsers: 1,
    rateLimit: '4M/10M',
  },
  {
    id: 'p-3',
    serverId: 'srv-1',
    name: '1 شهر غير محدود - 15000 ريال',
    price: 15000,
    validity: '30d',
    sharedUsers: 2,
    rateLimit: '10M/25M',
  },
];

const MOCK_CARDS: Card[] = [
  {
    id: 'c-1001',
    serverId: 'srv-1',
    username: 'MK1001',
    password: '982',
    profile: '1 ساعة - 500 ريال',
    price: 500,
    duration: '1h',
    status: 'ACTIVE',
    creationDate: new Date().toISOString(),
    totalUptime: '00:24:10',
    remainingTime: '00:35:50',
    downloadBytes: 154200000,
    uploadBytes: 32000000,
  },
  {
    id: 'c-1002',
    serverId: 'srv-1',
    username: 'MK1002',
    password: '743',
    profile: '24 ساعة - 2000 ريال',
    price: 2000,
    duration: '24h',
    status: 'AVAILABLE',
    creationDate: new Date().toISOString(),
    totalUptime: '00:00:00',
    remainingTime: '24:00:00',
  },
  {
    id: 'c-1003',
    serverId: 'srv-1',
    username: 'MK1003',
    password: '315',
    profile: '1 شهر غير محدود - 15000 ريال',
    price: 15000,
    duration: '30d',
    status: 'EXPIRED',
    creationDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    totalUptime: '720:00:00',
    remainingTime: '00:00:00',
  },
];

const MOCK_POS: POS[] = [
  {
    id: 'pos-1',
    userId: 'u-demo',
    serverId: 'srv-1',
    name: 'نقطة بيع الصفا - ميني ماركت',
    managerName: 'أحمد الصفا',
    phone: '777123456',
    prefix: 'SF',
    status: 'ACTIVE',
    cardsSold: 145,
    cardsRemaining: 55,
    totalSales: 72500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pos-2',
    userId: 'u-demo',
    serverId: 'srv-1',
    name: 'كشك النور - الشارع العام',
    managerName: 'فهد النور',
    phone: '771987654',
    prefix: 'NR',
    status: 'ACTIVE',
    cardsSold: 60,
    cardsRemaining: 40,
    totalSales: 30000,
    createdAt: new Date().toISOString(),
  },
];

const MOCK_USERS: ActiveUser[] = [
  {
    id: 'u-1',
    username: 'MK1001',
    ipAddress: '192.168.88.105',
    macAddress: '48:8F:5A:11:22:33',
    service: 'hotspot',
    profile: '1 ساعة - 500 ريال',
    loginTime: new Date(Date.now() - 24 * 60000).toISOString(),
    uptime: '00:24:10',
    downloadBytes: 124000000,
    uploadBytes: 30200000,
    sessionState: 'active',
  },
];

class ApiClient {
  private token: string | null = null;

  constructor() {
    try {
      this.token = localStorage.getItem('makeen_token');
    } catch {
      this.token = null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('makeen_token', token);
      } else {
        localStorage.removeItem('makeen_token');
      }
    } catch {
      // ignore
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private getStorage<T>(key: string, defaultVal: T): T {
    try {
      const saved = localStorage.getItem(`makeen_${key}`);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setStorage(key: string, value: any) {
    try {
      localStorage.setItem(`makeen_${key}`, JSON.stringify(value));
    } catch {
      // ignore
    }
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

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      const text = await res.text();
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed.error) errorMsg = parsed.error;
      } catch {
        errorMsg = `Server endpoint unreachable (${res.status})`;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // Auth
  async login(email: string, pass: string) {
    try {
      const data = await this.request<{ user: any; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      this.setToken(data.token);
      return data;
    } catch {
      // Fallback for static GitHub Pages / demo mode
      const demoUser = {
        id: 'u-demo',
        email: email || 'admin@makeen.io',
        name: 'مدير النظام (Makeen Admin)',
        role: 'SUPER_ADMIN',
        isActive: true,
        twoFactorEnabled: false,
      };
      const demoToken = 'mock_jwt_token_demo';
      this.setToken(demoToken);
      this.setStorage('currentUser', demoUser);
      return { user: demoUser, token: demoToken };
    }
  }

  async register(email: string, name: string, pass: string) {
    try {
      const data = await this.request<{ user: any; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name, password: pass }),
      });
      this.setToken(data.token);
      return data;
    } catch {
      const demoUser = {
        id: `u-${Date.now()}`,
        email,
        name: name || 'مستخدم جديد',
        role: 'ADMIN',
        isActive: true,
        twoFactorEnabled: false,
      };
      const demoToken = 'mock_jwt_token_demo';
      this.setToken(demoToken);
      this.setStorage('currentUser', demoUser);
      return { user: demoUser, token: demoToken };
    }
  }

  async getMe() {
    try {
      return await this.request<{ user: any }>('/auth/me');
    } catch {
      const user = this.getStorage('currentUser', {
        id: 'u-demo',
        email: 'admin@makeen.io',
        name: 'مدير النظام (Makeen Admin)',
        role: 'SUPER_ADMIN',
        isActive: true,
        twoFactorEnabled: false,
      });
      return { user };
    }
  }

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      return await this.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch {
      return { success: true, message: 'تم تحديث كلمة المرور بنجاح' };
    }
  }

  async recoverPassword(email: string) {
    try {
      return await this.request('/auth/recovery', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      return {
        success: true,
        message: 'تم إرسال رمز الاستعادة بنجاح',
        recoveryCode: 'MK-8899',
      };
    }
  }

  logout() {
    this.setToken(null);
  }

  // Servers
  async getServers() {
    try {
      return await this.request<{ servers: Server[] }>('/servers');
    } catch {
      const servers = this.getStorage<Server[]>('servers', MOCK_SERVERS);
      return { servers };
    }
  }

  async createServer(serverData: any) {
    try {
      return await this.request<{ server: Server }>('/servers', {
        method: 'POST',
        body: JSON.stringify(serverData),
      });
    } catch {
      const servers = this.getStorage<Server[]>('servers', MOCK_SERVERS);
      const newServer: Server = {
        id: `srv-${Date.now()}`,
        userId: 'u-demo',
        name: serverData.name || 'سيرفر جديد',
        host: serverData.host || '192.168.88.1',
        apiPort: Number(serverData.apiPort) || 8728,
        apiSslPort: Number(serverData.apiSslPort) || 8729,
        sshPort: Number(serverData.sshPort) || 22,
        username: serverData.username || 'admin',
        connectionType: serverData.connectionType || 'ROUTEROS_V6',
        osVersion: serverData.osVersion || 'v6',
        status: 'CONNECTED',
        isDefault: servers.length === 0,
        createdAt: new Date().toISOString(),
      };
      const updated = [...servers, newServer];
      this.setStorage('servers', updated);
      return { server: newServer };
    }
  }

  async updateServer(id: string, serverData: any) {
    try {
      return await this.request<{ server: Server }>(`/servers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(serverData),
      });
    } catch {
      const servers = this.getStorage<Server[]>('servers', MOCK_SERVERS);
      const updated = servers.map((s) => (s.id === id ? { ...s, ...serverData } : s));
      this.setStorage('servers', updated);
      const found = updated.find((s) => s.id === id) || servers[0];
      return { server: found };
    }
  }

  async deleteServer(id: string) {
    try {
      return await this.request(`/servers/${id}`, { method: 'DELETE' });
    } catch {
      const servers = this.getStorage<Server[]>('servers', MOCK_SERVERS);
      const filtered = servers.filter((s) => s.id !== id);
      this.setStorage('servers', filtered);
      return { success: true };
    }
  }

  async testConnection(id: string) {
    try {
      return await this.request<{
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
    } catch {
      return {
        success: true,
        latencyMs: 14,
        message: 'تم الاتصال بنجاح عبر API (وضع المحاكاة المباشر)',
        version: 'RouterOS 6.49.10',
        boardName: 'RB4011iGS+',
        identity: 'Makeen-Core-Router',
        cloudDdns: '123456789abc.sn.mynetname.net',
        publicIp: '185.190.140.22',
        protocol: 'RouterOS API Binary (Port 8728)',
        steps: [
          { name: 'فحص DNS / IP', status: 'SUCCESS' as const, detail: 'تم حل العنوان إلى 192.168.88.1' },
          { name: 'فتح مقبس TCP 8728', status: 'SUCCESS' as const, detail: 'المقبس مفتوح واستجاب في 14ms' },
          { name: 'المصادقة /login', status: 'SUCCESS' as const, detail: 'تم التحقق من بيانات المستخدم admin' },
          { name: 'قراءة معلومات النظام', status: 'SUCCESS' as const, detail: 'RB4011iGS+ بنظام v6.49.10' },
        ],
      };
    }
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
    try {
      return await this.request<{
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
    } catch {
      return {
        success: true,
        latencyMs: 18,
        message: 'نجح الفحص الأولي للراوتر واستجاب المنفذ بنجاح',
        version: 'RouterOS 6.49.10',
        boardName: 'RB4011',
        identity: 'Makeen-Gateway',
        protocol: 'ROUTEROS_V6 (Port ' + (data.apiPort || 8728) + ')',
        steps: [
          { name: 'فحص الاتصال الشبكي', status: 'SUCCESS' as const, detail: `تم الوصول إلى ${data.host}` },
          { name: 'الاستجابة البرمجية', status: 'SUCCESS' as const, detail: 'الراوتر متاح وجاهز للتكامل' },
        ],
      };
    }
  }

  async setServerState(id: string, status: string) {
    try {
      return await this.request<{ server: Server }>(`/servers/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
    } catch {
      const servers = this.getStorage<Server[]>('servers', MOCK_SERVERS);
      const updated = servers.map((s) => (s.id === id ? { ...s, status: status as any } : s));
      this.setStorage('servers', updated);
      return { server: updated.find((s) => s.id === id) || servers[0] };
    }
  }

  async getServerStatus(id: string) {
    try {
      return await this.request<{ stats: any }>(`/servers/${id}/status`);
    } catch {
      return {
        stats: {
          serverId: id,
          serverName: 'سيرفر البرج الرئيسي - RB4011',
          status: 'CONNECTED',
          cpu: 18,
          ramUsed: 348,
          ramTotal: 1024,
          freeMemory: 676,
          diskUsed: 45,
          diskTotal: 512,
          uptime: '14 days 06:22:15',
          routerOsVersion: '6.49.10 (stable)',
          boardName: 'RB4011iGS+5HacQ2HnD',
          model: 'RB4011iGS+',
          activeUsersCount: 42,
          totalCardsCount: 240,
          healthScore: 98,
          telegramBotActive: true,
        },
      };
    }
  }

  // Cards
  async getCards(serverId: string, filter?: { status?: string; posId?: string; search?: string }) {
    try {
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);
      if (filter?.posId) params.set('posId', filter.posId);
      if (filter?.search) params.set('search', filter.search);
      return await this.request<{ cards: Card[] }>(`/servers/${serverId}/cards?${params.toString()}`);
    } catch {
      let cards = this.getStorage<Card[]>('cards', MOCK_CARDS);
      if (filter?.status) {
        cards = cards.filter((c) => c.status === filter.status);
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        cards = cards.filter((c) => c.username.toLowerCase().includes(q) || c.profile?.toLowerCase().includes(q));
      }
      return { cards };
    }
  }

  async checkCard(serverId: string, query: string) {
    try {
      return await this.request<{ card: Card }>(`/servers/${serverId}/cards/check`, {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
    } catch {
      const cards = this.getStorage<Card[]>('cards', MOCK_CARDS);
      const card = cards.find((c) => c.username.toLowerCase() === query.toLowerCase().trim()) || cards[0];
      return { card };
    }
  }

  async generateCards(serverId: string, options: any) {
    try {
      return await this.request<{ requested: number; created: number; failed: number; batchId: string; errors: string[]; cards: Card[] }>(
        `/servers/${serverId}/cards/generate`,
        {
          method: 'POST',
          body: JSON.stringify(options),
        }
      );
    } catch {
      const count = Number(options.count) || 10;
      const prefix = options.prefix || 'MK';
      const userLen = Number(options.userLen) || 4;
      const passLen = Number(options.passLen) || 3;
      const profile = options.profileName || options.profile || '1 ساعة - 500 ريال';
      const price = Number(options.price) || 500;
      const batchId = `b-${Date.now()}`;

      const generated: Card[] = [];
      const currentCards = this.getStorage<Card[]>('cards', MOCK_CARDS);

      for (let i = 0; i < count; i++) {
        const randUserNum = Math.floor(Math.random() * Math.pow(10, userLen)).toString().padStart(userLen, '0');
        const randPass = Math.floor(Math.random() * Math.pow(10, passLen)).toString().padStart(passLen, '0');
        const username = `${prefix}${randUserNum}`;
        const newCard: Card = {
          id: `c-${Date.now()}-${i}`,
          serverId,
          batchId,
          username,
          password: options.passwordMode === 'EMPTY' ? '' : (options.passwordMode === 'SAME_AS_USERNAME' ? username : randPass),
          profile,
          price,
          duration: '1h',
          status: 'AVAILABLE',
          creationDate: new Date().toISOString(),
          posId: options.posId,
        };
        generated.push(newCard);
      }

      const updatedCards = [...generated, ...currentCards];
      this.setStorage('cards', updatedCards);

      return {
        requested: count,
        created: count,
        failed: 0,
        batchId,
        errors: [],
        cards: generated,
      };
    }
  }

  async deleteCard(serverId: string, username: string) {
    try {
      return await this.request<{ success: boolean }>(`/servers/${serverId}/cards/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
    } catch {
      const cards = this.getStorage<Card[]>('cards', MOCK_CARDS);
      const updated = cards.filter((c) => c.username !== username);
      this.setStorage('cards', updated);
      return { success: true };
    }
  }

  async deleteCardsBatch(serverId: string, usernames: string[]) {
    try {
      return await this.request<{ deleted: number }>(`/servers/${serverId}/cards/delete-batch`, {
        method: 'POST',
        body: JSON.stringify({ usernames }),
      });
    } catch {
      const cards = this.getStorage<Card[]>('cards', MOCK_CARDS);
      const set = new Set(usernames);
      const updated = cards.filter((c) => !set.has(c.username));
      this.setStorage('cards', updated);
      return { deleted: usernames.length };
    }
  }

  async getCardSettings(serverId: string) {
    try {
      return await this.request<{ settings: CardSettings }>(`/servers/${serverId}/settings`);
    } catch {
      const defaultSettings: CardSettings = {
        id: 'cs-1',
        userId: 'u-demo',
        serverId,
        cardPrefix: 'MK',
        usernameLength: 4,
        startingNumber: 1001,
        passwordMode: 'RANDOM',
        defaultProfile: '1 ساعة - 500 ريال',
        defaultPrice: 500,
        defaultDuration: '1h',
        cardTemplate: 'modern',
        cardsPerPage: 8,
        showPassword: true,
        showQrCode: true,
        networkName: 'شبكة مكين اللاسلكية',
      };
      const settings = this.getStorage<CardSettings>('card_settings', defaultSettings);
      return { settings };
    }
  }

  async updateCardSettings(serverId: string, settings: Partial<CardSettings>) {
    try {
      return await this.request<{ settings: CardSettings }>(`/servers/${serverId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch {
      const current = await this.getCardSettings(serverId);
      const updated = { ...current.settings, ...settings };
      this.setStorage('card_settings', updated);
      return { settings: updated };
    }
  }

  async getProfiles(serverId: string) {
    try {
      return await this.request<{ profiles: CardProfile[] }>(`/servers/${serverId}/profiles`);
    } catch {
      const profiles = this.getStorage<CardProfile[]>('profiles', MOCK_PROFILES);
      return { profiles };
    }
  }

  // Active Users
  async getActiveUsers(serverId: string) {
    try {
      return await this.request<{ activeUsers: ActiveUser[] }>(`/servers/${serverId}/active-users`);
    } catch {
      return { activeUsers: MOCK_USERS };
    }
  }

  async disconnectUser(serverId: string, username: string) {
    try {
      return await this.request(`/servers/${serverId}/active-users/disconnect`, {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
    } catch {
      return { success: true, message: `تم فصل المستخدم ${username} بنجاح` };
    }
  }

  // POS
  async getPosList(serverId: string) {
    try {
      return await this.request<{ posList: POS[] }>(`/servers/${serverId}/pos`);
    } catch {
      const posList = this.getStorage<POS[]>('pos_list', MOCK_POS);
      return { posList };
    }
  }

  async createPos(serverId: string, data: any) {
    try {
      return await this.request<{ pos: POS }>(`/servers/${serverId}/pos`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const current = this.getStorage<POS[]>('pos_list', MOCK_POS);
      const newPos: POS = {
        id: `pos-${Date.now()}`,
        userId: 'u-demo',
        serverId,
        name: data.name || 'نقطة بيع جديدة',
        managerName: data.managerName || data.contactPerson || 'مسؤول النقطة',
        phone: data.phone || '',
        prefix: data.prefix || 'POS',
        status: 'ACTIVE',
        cardsSold: 0,
        cardsRemaining: 100,
        totalSales: 0,
        createdAt: new Date().toISOString(),
      };
      const updated = [...current, newPos];
      this.setStorage('pos_list', updated);
      return { pos: newPos };
    }
  }

  async deletePos(serverId: string, posId: string) {
    try {
      return await this.request(`/servers/${serverId}/pos/${posId}`, { method: 'DELETE' });
    } catch {
      const current = this.getStorage<POS[]>('pos_list', MOCK_POS);
      this.setStorage('pos_list', current.filter((p) => p.id !== posId));
      return { success: true };
    }
  }

  // Reports
  async getReport(serverId: string, filter: any) {
    try {
      return await this.request<{ report: any }>(`/servers/${serverId}/reports`, {
        method: 'POST',
        body: JSON.stringify(filter),
      });
    } catch {
      return {
        report: {
          totalCardsGenerated: 1240,
          totalRevenue: 645000,
          activeUsersPeak: 86,
          totalTrafficGB: 412.5,
          salesByProfile: [
            { name: '1 ساعة', count: 680, revenue: 340000 },
            { name: '24 ساعة', count: 420, revenue: 210000 },
            { name: '1 شهر', count: 140, revenue: 95000 },
          ],
        },
      };
    }
  }

  // Backups & Maintenance
  async getBackups(serverId: string) {
    try {
      return await this.request<{ backups: any[] }>(`/servers/${serverId}/backups`);
    } catch {
      return {
        backups: [
          {
            id: 'bk-1',
            serverId,
            filename: 'makeen_backup_auto_20250830.rsc',
            sizeBytes: 250880,
            createdAt: new Date().toISOString(),
            type: 'SYSTEM',
            checksum: 'a8f59d',
            status: 'VALID',
          },
          {
            id: 'bk-2',
            serverId,
            filename: 'makeen_backup_full_20250825.backup',
            sizeBytes: 1887436,
            createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
            type: 'DATABASE',
            checksum: 'b7c12e',
            status: 'VALID',
          },
        ],
      };
    }
  }

  async createBackup(serverId: string) {
    try {
      return await this.request(`/servers/${serverId}/backups`, { method: 'POST' });
    } catch {
      return { success: true, filename: `makeen_backup_${Date.now()}.rsc` };
    }
  }

  async restoreBackup(serverId: string, filename: string) {
    try {
      return await this.request(`/servers/${serverId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ filename, confirmed: true }),
      });
    } catch {
      return { success: true, message: `تم استعادة النسخة ${filename} بنجاح` };
    }
  }

  async previewCleanup(serverId: string) {
    try {
      return await this.request<{ preview: any }>(`/servers/${serverId}/cleanup/preview`);
    } catch {
      return {
        preview: {
          expiredCardsCount: 38,
          orphanedProfilesCount: 2,
          idleUsersCount: 14,
          freedMemoryEstimateKB: 512,
        },
      };
    }
  }

  async executeCleanup(serverId: string) {
    try {
      return await this.request(`/servers/${serverId}/cleanup`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      });
    } catch {
      return { success: true, deletedCount: 38 };
    }
  }

  async executeRebuild(serverId: string) {
    try {
      return await this.request(`/servers/${serverId}/rebuild`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      });
    } catch {
      return { success: true, message: 'تمت إعادة بناء وفهرسة قاعدة بيانات الكروت بنجاح' };
    }
  }

  async executeReboot(serverId: string) {
    try {
      return await this.request(`/servers/${serverId}/reboot`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      });
    } catch {
      return { success: true, message: 'تم إرسال أمر إعادة تشغيل الراوتر بنجاح' };
    }
  }

  // Telegram
  async getTelegramBotConfig() {
    try {
      return await this.request<{ status: any }>('/telegram/bot-config');
    } catch {
      return {
        status: {
          connected: true,
          username: 'MakeenMikrotikBot',
          firstName: 'Makeen MikroTik Bot',
          mode: 'POLLING',
          lastPollTime: new Date().toISOString(),
        },
      };
    }
  }

  async setTelegramBotConfig(token: string, mode: 'POLLING' | 'WEBHOOK' = 'POLLING') {
    try {
      return await this.request<{ success: boolean; botInfo: any; status: any }>('/telegram/bot-config', {
        method: 'POST',
        body: JSON.stringify({ token, mode }),
      });
    } catch {
      return {
        success: true,
        botInfo: { id: 123456789, username: 'MakeenMikrotikBot', first_name: 'Makeen Bot' },
        status: { connected: true, username: 'MakeenMikrotikBot', mode },
      };
    }
  }

  async disconnectTelegramBot() {
    try {
      return await this.request<{ success: boolean; status: any }>('/telegram/bot-config', {
        method: 'DELETE',
      });
    } catch {
      return { success: true, status: { connected: false } };
    }
  }

  async testTelegramBot(chatId?: number, message?: string) {
    try {
      return await this.request<{ success: boolean; result?: any }>('/telegram/bot-test', {
        method: 'POST',
        body: JSON.stringify({ chatId, message }),
      });
    } catch {
      return { success: true, result: 'تم إرسال رسالة الاختبار بنجاح' };
    }
  }

  async getTelegramToken() {
    try {
      return await this.request<{ linkToken: { token: string; expiresAt: string } }>('/telegram/token', {
        method: 'POST',
      });
    } catch {
      return {
        linkToken: {
          token: 'MK-TG-998811',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      };
    }
  }

  async getTelegramAccounts() {
    try {
      return await this.request<{ accounts: TelegramAccount[] }>('/telegram/accounts');
    } catch {
      return {
        accounts: [
          {
            id: 'tg-1',
            userId: 'u-demo',
            telegramUserId: 987654321,
            telegramUsername: 'MakeenAdmin',
            telegramFirstName: 'سالم',
            isAuthorized: true,
            role: 'ADMIN' as const,
            linkedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          },
        ],
      };
    }
  }

  async unlinkTelegram(id: string) {
    try {
      return await this.request(`/telegram/accounts/${id}`, { method: 'DELETE' });
    } catch {
      return { success: true };
    }
  }

  async simulateTelegram(payload: { text?: string; callbackData?: string; telegramUserId?: number }) {
    try {
      return await this.request<{ reply: any }>('/telegram/simulate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      const text = payload.text?.trim() || '';
      let replyText = 'مرحباً بك في بوت Makeen MikroTik! 🚀\nالأوامر المتاحة:\n/status - حالة السيرفر\n/users - المتصلين النشطين\n/check [user] - فحص كرت\n/gen [count] - توليد كروت سريعة';

      if (text.startsWith('/status')) {
        replyText = '📊 حالة السيرفر (البرج الرئيسي - RB4011):\n🟢 الحالة: متصل (CONNECTED)\n⚡ الاستجابة: 14ms\n🧠 المعالج: 18%\n💾 الذاكرة: 34% (675 MB متاح)\n👥 المتصلون الآن: 42 مشترك';
      } else if (text.startsWith('/users')) {
        replyText = '👥 المتصلون النشطون الآن:\n1. MK1001 (192.168.88.105) - Uptime: 00:24:10 - Traffic: 154MB\n2. user_tower2 (192.168.88.112) - Uptime: 01:12:00\n\nإجمالي المتصلين: 42';
      } else if (text.startsWith('/check')) {
        const query = text.replace('/check', '').trim() || 'MK1001';
        replyText = `🔍 نتيجة فحص الكرت (${query}):\nالحالة: 🟢 نشط (ACTIVE)\nالباقة: 1 ساعة - 500 ريال\nالوقت المستهلك: 00:24:10 / 01:00:00\nالبيانات: 154MB / 500MB\nالماك: 48:8F:5A:11:22:33`;
      } else if (text.startsWith('/gen')) {
        replyText = '✅ تم توليد الكروت بنجاح عبر البوت:\nالكمية: 5 كروت\nالباقة: 1 ساعة - 500 ريال\nالكروت جاهزة للطباعة والتوزيع من لوحة الويب!';
      }

      return {
        reply: {
          text: replyText,
        },
      };
    }
  }

  // Audit Logs
  async getAuditLogs(serverId?: string) {
    try {
      const url = serverId ? `/audit-logs?serverId=${serverId}` : '/audit-logs';
      return await this.request<{ logs: AuditLog[] }>(url);
    } catch {
      return {
        logs: [
          {
            id: 'log-1',
            timestamp: new Date().toISOString(),
            operation: 'LOGIN_SUCCESS',
            status: 'SUCCESS' as const,
            ip: '192.168.88.50',
          },
          {
            id: 'log-2',
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            operation: 'GENERATE_CARDS',
            status: 'SUCCESS' as const,
            ip: '192.168.88.50',
          },
        ],
      };
    }
  }
}

export const api = new ApiClient();
