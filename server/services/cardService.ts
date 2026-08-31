import { db } from '../database/db';
import { Card, CardSettings, CardProfile, PasswordMode, ActiveUser } from '../types';
import { mikrotikService } from '../mikrotik/MikrotikService';
import { generateRandomCode } from '../security/crypto';

export class CardService {
  async getSettings(userId: string, serverId?: string): Promise<CardSettings> {
    let settings = db.cardSettings.find((s) => s.userId === userId && (!serverId || s.serverId === serverId));
    if (!settings) {
      settings = {
        id: `set_${Date.now()}`,
        userId,
        serverId,
        cardPrefix: 'MK',
        usernameLength: 6,
        startingNumber: 1001,
        passwordMode: 'RANDOM',
        defaultProfile: '1d-Daily',
        defaultPrice: 5.0,
        defaultDuration: '1d',
        cardTemplate: 'modern',
        cardsPerPage: 24,
        showPassword: true,
        showQrCode: true,
        networkName: 'شبكة مكين الذكية | Makeen WiFi',
      };
      db.cardSettings.push(settings);
      db.save();
    }
    return settings;
  }

  async updateSettings(userId: string, settingsData: Partial<CardSettings>): Promise<CardSettings> {
    const current = await this.getSettings(userId, settingsData.serverId);
    Object.assign(current, settingsData);
    db.save();
    return current;
  }

  async getProfiles(serverId: string): Promise<CardProfile[]> {
    return db.cardProfiles.filter((p) => p.serverId === serverId);
  }

  async createProfile(serverId: string, data: Omit<CardProfile, 'id' | 'serverId'>): Promise<CardProfile> {
    const profile: CardProfile = {
      id: `prof_${Date.now()}`,
      serverId,
      ...data,
    };
    db.cardProfiles.push(profile);
    db.save();
    return profile;
  }

  async getCards(serverId: string, filter?: { status?: string; posId?: string; search?: string }): Promise<Card[]> {
    let cards = db.cards.filter((c) => c.serverId === serverId);

    if (filter?.status && filter.status !== 'ALL') {
      cards = cards.filter((c) => c.status === filter.status);
    }

    if (filter?.posId && filter.posId !== 'ALL') {
      cards = cards.filter((c) => c.posId === filter.posId);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      cards = cards.filter(
        (c) => c.username.toLowerCase().includes(q) || (c.password && c.password.toLowerCase().includes(q))
      );
    }

    return cards;
  }

  async checkCard(serverId: string, query: string): Promise<Card | null> {
    const server = db.servers.find((s) => s.id === serverId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const adapter = mikrotikService.getAdapter(server);
    return adapter.getUser(query.trim());
  }

  async generateCardsBatch(
    serverId: string,
    userId: string,
    options: {
      profileName: string;
      quantity: number;
      prefix?: string;
      digitsCount?: number;
      usernameLength?: number;
      startingNumber?: number;
      passwordMode?: PasswordMode;
      customPassword?: string;
      posId?: string;
    },
    onProgress?: (pct: number) => void
  ) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const profile = db.cardProfiles.find((p) => p.serverId === serverId && p.name === options.profileName);
    const settings = await this.getSettings(userId, serverId);
    const pos = options.posId ? db.posList.find((p) => p.id === options.posId) : undefined;

    // Digits count specified by user (default 6, or from settings)
    const digitsCount = options.digitsCount || options.usernameLength || settings.usernameLength || 6;
    const prefix = options.prefix !== undefined ? options.prefix.trim() : (settings.cardPrefix || '');
    
    // Default starting number matching the digits count (e.g. 100000 for 6 digits, 10000 for 5 digits)
    const defaultStart = Math.pow(10, Math.max(1, digitsCount - 1));
    const startingNo = options.startingNumber !== undefined && !isNaN(options.startingNumber)
      ? options.startingNumber
      : (settings.startingNumber || defaultStart);

    const mode = options.passwordMode || settings.passwordMode || 'RANDOM';
    const qty = Math.min(Math.max(1, options.quantity), 5000);

    const batchId = `bat_${Date.now()}`;
    const cardsToCreate: Partial<Card>[] = [];

    // Collect existing usernames to guarantee no duplicates
    const existingUsernames = new Set(
      db.cards.filter((c) => c.serverId === serverId).map((c) => c.username.toLowerCase())
    );

    let currentNumber = startingNo;

    for (let i = 0; i < qty; i++) {
      let numStr = String(currentNumber).padStart(digitsCount, '0');
      let username = prefix ? `${prefix}${numStr}` : numStr;
      while (existingUsernames.has(username.toLowerCase())) {
        currentNumber++;
        numStr = String(currentNumber).padStart(digitsCount, '0');
        username = prefix ? `${prefix}${numStr}` : numStr;
      }
      existingUsernames.add(username.toLowerCase());
      currentNumber++;

      let password = '';
      if (mode === 'SAME_AS_USERNAME') {
        password = username;
      } else if (mode === 'CUSTOM') {
        password = options.customPassword || `${prefix || ''}123`;
      } else if (mode === 'EMPTY') {
        password = '';
      } else if (mode === 'RANDOM') {
        // Random digits with length matching digitsCount (or 4 digits)
        const randLen = Math.min(Math.max(4, digitsCount), 8);
        const minVal = Math.pow(10, randLen - 1);
        const maxVal = Math.pow(10, randLen) - 1;
        password = `${Math.floor(minVal + Math.random() * (maxVal - minVal + 1))}`;
      }

      cardsToCreate.push({
        serverId,
        username,
        password,
        profile: options.profileName,
        status: 'AVAILABLE',
        price: profile?.price || settings.defaultPrice || 5.0,
        duration: profile?.validity || settings.defaultDuration || '1d',
        posId: pos?.id,
        posName: pos?.name,
        batchId,
      });
    }

    const adapter = mikrotikService.getAdapter(server);
    const result = await adapter.createUsersBatch(cardsToCreate, onProgress);

    // If POS assigned, increment cardsRemaining
    if (pos) {
      pos.cardsRemaining += result.created;
      db.save();
    }

    return {
      batchId,
      ...result,
    };
  }

  async deleteCard(serverId: string, userId: string, username: string): Promise<boolean> {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const adapter = mikrotikService.getAdapter(server);
    return adapter.deleteUser(username);
  }

  async deleteCardsBatch(serverId: string, userId: string, usernames: string[]): Promise<{ deleted: number }> {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const adapter = mikrotikService.getAdapter(server);
    let count = 0;
    for (const username of usernames) {
      try {
        await adapter.deleteUser(username);
        count++;
      } catch (err) {
        console.warn(`Failed to delete card ${username}:`, err);
      }
    }
    return { deleted: count };
  }

  async getActiveUsers(serverId: string, userId: string): Promise<ActiveUser[]> {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const adapter = mikrotikService.getAdapter(server);
    return adapter.getActiveUsers();
  }

  async disconnectUser(serverId: string, userId: string, username: string): Promise<boolean> {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const adapter = mikrotikService.getAdapter(server);
    return adapter.disconnectActiveUser(username);
  }

  async previewCleanup(serverId: string, userId: string) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');
    const adapter = mikrotikService.getAdapter(server);
    return adapter.previewCleanup();
  }

  async executeCleanup(serverId: string, userId: string) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');
    const adapter = mikrotikService.getAdapter(server);
    return adapter.cleanup();
  }

  async executeRebuild(serverId: string, userId: string) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');
    const adapter = mikrotikService.getAdapter(server);
    return adapter.rebuild();
  }

  async executeReboot(serverId: string, userId: string) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');
    const adapter = mikrotikService.getAdapter(server);
    return adapter.reboot();
  }

  async createBackup(serverId: string, userId: string) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');
    const adapter = mikrotikService.getAdapter(server);
    return adapter.backup('makeen_manual');
  }

  async restoreBackup(serverId: string, userId: string, filename: string) {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    if (!server) throw new Error('السيرفر غير موجود.');
    const adapter = mikrotikService.getAdapter(server);
    return adapter.restore(filename);
  }
}

export const cardService = new CardService();
