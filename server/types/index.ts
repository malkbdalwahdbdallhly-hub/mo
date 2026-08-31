/**
 * Makeen Platform - Core Domain Types & Data Contracts
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
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
  host: string; // IP, Domain, or MikroTik Cloud DNS (*.sn.mynetname.net)
  apiPort: number; // default 8728
  apiSslPort: number; // default 8729
  sshPort: number; // default 22
  username: string;
  encryptedPassword: string; // Encrypted with AES-256-GCM
  connectionType: ConnectionType;
  osVersion?: 'v6' | 'v7' | 'auto';
  status: ServerStatus;
  lastConnectedAt?: string;
  lastErrorMessage?: string;
  boardModel?: string;
  cloudDdns?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerStats {
  serverId: string;
  serverName: string;
  status: ServerStatus;
  cpu: number; // %
  ramUsed: number; // MB
  ramTotal: number; // MB
  freeMemory: number; // MB
  diskUsed: number; // MB
  diskTotal: number; // MB
  uptime: string;
  routerOsVersion: string;
  boardName: string;
  model: string;
  activeUsersCount: number;
  totalCardsCount: number;
  healthScore: number; // 0 - 100
  lastOperation?: string;
  lastBackupDate?: string;
  telegramBotActive: boolean;
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
  allowedServerIds?: string[];
}

export interface TelegramLinkToken {
  token: string;
  userId: string;
  expiresAt: string;
}

export type PasswordMode = 'EMPTY' | 'SAME_AS_USERNAME' | 'CUSTOM' | 'RANDOM';

export type CardStatus = 'AVAILABLE' | 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'USED' | 'UNKNOWN';

export interface Card {
  id: string;
  serverId: string;
  username: string;
  password?: string;
  profile: string;
  status: CardStatus;
  price: number;
  duration: string; // e.g. "1d", "1w", "1m"
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
  rateLimit?: string; // e.g. "5M/10M"
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
  customPasswordPrefix?: string;
  defaultProfile: string;
  defaultPrice: number;
  defaultDuration: string;
  cardTemplate: 'default' | 'clean' | 'voucher' | 'modern';
  cardsPerPage: number; // 1 to 120
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
  prefix: string; // e.g. POS001
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

export interface DiagnosticData {
  serverId: string;
  cpuLoad: number;
  freeMemoryMB: number;
  totalMemoryMB: number;
  freeDiskMB: number;
  totalDiskMB: number;
  uptime: string;
  routerOsVersion: string;
  routerModel: string;
  routerBoardModel: string;
  interfaces: Array<{ name: string; type: string; running: boolean; rxRate: number; txRate: number }>;
  ipAddresses: Array<{ address: string; interface: string }>;
  activeConnectionsCount: number;
  userManagerStatus: 'RUNNING' | 'STOPPED' | 'NOT_INSTALLED';
  apiStatus: 'ONLINE' | 'OFFLINE';
  sshStatus: 'ONLINE' | 'OFFLINE';
  healthScore: number;
  recentErrors: string[];
}

export type AuditOperation =
  | 'CARD_GENERATION'
  | 'CARD_DELETED'
  | 'BACKUP_CREATED'
  | 'BACKUP_DELETED'
  | 'RESTORE_STARTED'
  | 'RESTORE_COMPLETED'
  | 'REBOOT_REQUESTED'
  | 'USER_DISCONNECTED'
  | 'CLEANUP_EXECUTED'
  | 'REBUILD_EXECUTED'
  | 'SERVER_CREATED'
  | 'SERVER_UPDATED'
  | 'SERVER_CONNECTED'
  | 'TELEGRAM_LINKED'
  | 'TELEGRAM_UNLINKED'
  | 'POS_CREATED'
  | 'SETTINGS_UPDATED';

export interface AuditLog {
  id: string;
  userId?: string;
  telegramId?: number;
  serverId?: string;
  operation: AuditOperation;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  ip?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Job {
  id: string;
  userId: string;
  serverId: string;
  type: 'GENERATE_CARDS' | 'GENERATE_PDF' | 'BACKUP' | 'RESTORE' | 'CLEANUP' | 'REPORT';
  status: JobStatus;
  progress: number; // 0 - 100
  totalItems?: number;
  processedItems?: number;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
