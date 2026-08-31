export type UserRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
}

export type ConnectionType = 'AUTO' | 'ROUTEROS_V6' | 'REST_SSL' | 'REST' | 'API' | 'API_SSL' | 'MOCK';

export type ServerStatus =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'AUTH_FAILED'
  | 'TIMEOUT';

export interface Server {
  id: string;
  userId: string;
  name: string;
  host: string;
  apiPort: number;
  apiSslPort: number;
  sshPort: number;
  username: string;
  password?: string;
  connectionType: ConnectionType;
  osVersion?: 'v6' | 'v7' | 'auto';
  status: ServerStatus;
  lastConnectedAt?: string;
  lastErrorMessage?: string;
  boardModel?: string;
  cloudDdns?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ServerStats {
  serverId: string;
  serverName: string;
  status: ServerStatus;
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  freeMemory: number;
  diskUsed: number;
  diskTotal: number;
  uptime: string;
  routerOsVersion: string;
  boardName: string;
  model: string;
  activeUsersCount: number;
  totalCardsCount: number;
  healthScore: number;
  lastOperation?: string;
  lastBackupDate?: string;
  telegramBotActive: boolean;
}

export type CardStatus = 'AVAILABLE' | 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'USED' | 'UNKNOWN';
export type PasswordMode = 'EMPTY' | 'SAME_AS_USERNAME' | 'CUSTOM' | 'RANDOM';

export interface Card {
  id: string;
  serverId: string;
  username: string;
  password?: string;
  profile: string;
  status: CardStatus;
  price: number;
  duration: string;
  posId?: string;
  posName?: string;
  batchId?: string;
  creationDate: string;
  expirationDate?: string;
  firstLogin?: string;
  lastLogin?: string;
  totalUptime?: string;
  remainingTime?: string;
  downloadBytes?: number;
  uploadBytes?: number;
}

export interface CardProfile {
  id: string;
  serverId: string;
  name: string;
  nameForUsers?: string;
  validity: string;
  price: number;
  rateLimit?: string;
  sharedUsers?: number;
}

export interface CardSettings {
  id: string;
  userId: string;
  serverId?: string;
  cardPrefix: string;
  usernameLength: number;
  startingNumber: number;
  passwordMode: PasswordMode;
  defaultProfile: string;
  defaultPrice: number;
  defaultDuration: string;
  cardTemplate: 'default' | 'clean' | 'voucher' | 'modern';
  cardsPerPage: number;
  showPassword: boolean;
  showQrCode: boolean;
  networkName: string;
  networkLogoUrl?: string;
}

export interface POS {
  id: string;
  userId: string;
  serverId: string;
  name: string;
  managerName: string;
  phone?: string;
  prefix: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  cardsSold: number;
  cardsRemaining: number;
  totalSales: number;
  createdAt: string;
}

export interface ActiveUser {
  id: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  service: 'hotspot' | 'pppoe' | 'userman' | 'dhcp';
  profile: string;
  loginTime: string;
  uptime: string;
  downloadBytes: number;
  uploadBytes: number;
  sessionState: 'authorized' | 'active' | 'idle';
}

export interface BackupItem {
  id: string;
  serverId: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: 'DATABASE' | 'SYSTEM' | 'USER_MANAGER';
  description?: string;
  checksum: string;
  status: 'VALID' | 'CORRUPTED';
}

export interface AuditLog {
  id: string;
  userId?: string;
  telegramId?: number;
  serverId?: string;
  operation: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  ip?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TelegramAccount {
  id: string;
  userId: string;
  telegramUserId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  isAuthorized: boolean;
  role: UserRole;
  linkedAt: string;
  lastActiveAt?: string;
}
