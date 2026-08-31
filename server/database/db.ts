import fs from 'fs';
import path from 'path';
import {
  User,
  Server,
  TelegramAccount,
  TelegramLinkToken,
  Card,
  CardProfile,
  CardSettings,
  POS,
  BackupItem,
  AuditLog,
  Job,
} from '../types';
import { hashPassword, encryptCredential } from '../security/crypto';

export interface TelegramSettings {
  botToken?: string;
  botUsername?: string;
  botFirstName?: string;
  mode: 'POLLING' | 'WEBHOOK';
  isActive: boolean;
  webhookUrl?: string;
  updatedAt?: string;
}

interface DatabaseSchema {
  users: User[];
  servers: Server[];
  telegramAccounts: TelegramAccount[];
  telegramLinkTokens: TelegramLinkToken[];
  telegramSettings?: TelegramSettings;
  cards: Card[];
  cardProfiles: CardProfile[];
  cardSettings: CardSettings[];
  posList: POS[];
  backups: BackupItem[];
  auditLogs: AuditLog[];
  jobs: Job[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'makeen_db.json');

class Database {
  private data: DatabaseSchema = {
    users: [],
    servers: [],
    telegramAccounts: [],
    telegramLinkTokens: [],
    cards: [],
    cardProfiles: [],
    cardSettings: [],
    posList: [],
    backups: [],
    auditLogs: [],
    jobs: [],
  };

  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(content);
        // Exclude any fake or unverified placeholder routers
        this.data.servers = (this.data.servers || []).filter(
          (s) => s.id !== 'srv_mikrotik_001' && !s.host.includes('192.168.88.1')
        );
        const connected = this.data.servers.find((s) => s.status === 'CONNECTED');
        if (connected) {
          this.data.servers.forEach((s) => (s.isDefault = s.id === connected.id));
        }
        this.isLoaded = true;
      } else {
        this.seedInitialData();
        this.save();
      }
    } catch (err) {
      console.warn('DB initialization error, seeding defaults in memory:', err);
      this.seedInitialData();
    }
  }

  getConnectedServer(): Server | undefined {
    return (
      this.servers.find((s) => s.status === 'CONNECTED') ||
      this.servers.find((s) => s.isDefault) ||
      this.servers[0]
    );
  }

  private seedInitialData() {
    const { hash, salt } = hashPassword('Makeen@2025');

    const adminUser: User = {
      id: 'usr_admin_001',
      email: 'admin@makeen.io',
      name: 'مدير النظام (Admin)',
      passwordHash: hash,
      salt: salt,
      role: 'OWNER',
      isActive: true,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.users = [adminUser];
    this.data.servers = [];
    this.data.cardProfiles = [];
    this.data.cardSettings = [];
    this.data.posList = [];
    this.data.cards = [];
    this.data.backups = [];
    this.data.auditLogs = [];
    this.data.jobs = [];
    this.data.telegramAccounts = [];
    this.data.telegramLinkTokens = [];
  }

  public save() {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Failed to save makeen database to file:', err);
    }
  }

  // Getters & Setters
  get users() { return this.data.users; }
  set users(val) { this.data.users = val; }

  get servers() { return this.data.servers; }
  set servers(val) { this.data.servers = val; }

  get telegramAccounts() { return this.data.telegramAccounts; }
  set telegramAccounts(val) { this.data.telegramAccounts = val; }

  get telegramLinkTokens() { return this.data.telegramLinkTokens; }
  set telegramLinkTokens(val) { this.data.telegramLinkTokens = val; }

  get telegramSettings(): TelegramSettings {
    if (!this.data.telegramSettings) {
      this.data.telegramSettings = {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        mode: 'POLLING',
        isActive: false,
      };
    }
    return this.data.telegramSettings;
  }
  set telegramSettings(val: TelegramSettings) { this.data.telegramSettings = val; }

  get cards() { return this.data.cards; }
  set cards(val) { this.data.cards = val; }

  get cardProfiles() { return this.data.cardProfiles; }
  set cardProfiles(val) { this.data.cardProfiles = val; }

  get cardSettings() { return this.data.cardSettings; }
  set cardSettings(val) { this.data.cardSettings = val; }

  get posList() { return this.data.posList; }
  set posList(val) { this.data.posList = val; }

  get backups() { return this.data.backups; }
  set backups(val) { this.data.backups = val; }

  get auditLogs() { return this.data.auditLogs; }
  set auditLogs(val) { this.data.auditLogs = val; }

  get jobs() { return this.data.jobs; }
  set jobs(val) { this.data.jobs = val; }
}

export const db = new Database();
