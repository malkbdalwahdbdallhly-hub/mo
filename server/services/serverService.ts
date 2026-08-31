import { db } from '../database/db';
import { Server, ServerStats, ConnectionType, ServerStatus } from '../types';
import { encryptCredential } from '../security/crypto';
import { mikrotikService } from '../mikrotik/MikrotikService';

export class ServerService {
  async getServers(userId: string): Promise<Omit<Server, 'encryptedPassword'>[]> {
    return db.servers
      .filter((s) => s.userId === userId)
      .map(({ encryptedPassword, ...safeServer }) => safeServer);
  }

  async getServerById(serverId: string, userId: string): Promise<Server | null> {
    const server = db.servers.find((s) => s.id === serverId && s.userId === userId);
    return server || null;
  }

  async createServer(
    userId: string,
    data: {
      name: string;
      host: string;
      apiPort?: number;
      apiSslPort?: number;
      sshPort?: number;
      username: string;
      password?: string;
      connectionType?: ConnectionType;
      osVersion?: 'v6' | 'v7' | 'auto';
    }
  ): Promise<Omit<Server, 'encryptedPassword'>> {
    const isFirst = db.servers.filter((s) => s.userId === userId).length === 0;

    const server: Server = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      name: data.name.trim(),
      host: data.host.trim(),
      apiPort: data.apiPort || 8728,
      apiSslPort: data.apiSslPort || 8729,
      sshPort: data.sshPort || 22,
      username: data.username.trim(),
      encryptedPassword: encryptCredential(data.password || ''),
      connectionType: data.connectionType || (data.osVersion === 'v6' ? 'ROUTEROS_V6' : 'AUTO'),
      osVersion: data.osVersion || (data.connectionType === 'ROUTEROS_V6' ? 'v6' : 'auto'),
      status: 'CONNECTING',
      isDefault: isFirst,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.servers.push(server);
    db.save();

    const { encryptedPassword, ...safeServer } = server;
    return safeServer;
  }

  async updateServer(
    serverId: string,
    userId: string,
    data: Partial<{
      name: string;
      host: string;
      apiPort: number;
      apiSslPort: number;
      sshPort: number;
      username: string;
      password?: string;
      connectionType: ConnectionType;
      osVersion?: 'v6' | 'v7' | 'auto';
      isDefault?: boolean;
    }>
  ): Promise<Omit<Server, 'encryptedPassword'>> {
    const server = await this.getServerById(serverId, userId);
    if (!server) throw new Error('السيرفر غير موجود أو غير مصرح لك بالوصول إليه.');

    if (data.name !== undefined) server.name = data.name.trim();
    if (data.host !== undefined) server.host = data.host.trim();
    if (data.apiPort !== undefined) server.apiPort = data.apiPort;
    if (data.apiSslPort !== undefined) server.apiSslPort = data.apiSslPort;
    if (data.sshPort !== undefined) server.sshPort = data.sshPort;
    if (data.username !== undefined) server.username = data.username.trim();
    if (data.password !== undefined && data.password.length > 0) {
      server.encryptedPassword = encryptCredential(data.password);
    }
    if (data.connectionType !== undefined) {
      server.connectionType = data.connectionType;
      if (data.connectionType === 'ROUTEROS_V6') {
        server.osVersion = 'v6';
      }
    }
    if (data.osVersion !== undefined) {
      server.osVersion = data.osVersion;
      if (data.osVersion === 'v6' && server.connectionType === 'AUTO') {
        server.connectionType = 'ROUTEROS_V6';
      }
    }

    if (data.isDefault) {
      db.servers.filter((s) => s.userId === userId).forEach((s) => (s.isDefault = false));
      server.isDefault = true;
    }

    server.updatedAt = new Date().toISOString();
    db.save();

    const { encryptedPassword, ...safeServer } = server;
    return safeServer;
  }

  async deleteServer(serverId: string, userId: string): Promise<boolean> {
    const index = db.servers.findIndex((s) => s.id === serverId && s.userId === userId);
    if (index === -1) return false;

    mikrotikService.removeAdapter(serverId);
    db.servers.splice(index, 1);
    db.save();
    return true;
  }

  async testConnection(serverId: string, userId: string) {
    const server = await this.getServerById(serverId, userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    return mikrotikService.testConnection(server);
  }

  async setServerStatus(serverId: string, userId: string, status: ServerStatus): Promise<Server> {
    const server = await this.getServerById(serverId, userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    server.status = status;
    if (status === 'CONNECTED') {
      server.lastConnectedAt = new Date().toISOString();
    }
    server.updatedAt = new Date().toISOString();
    db.save();
    return server;
  }

  async getServerStats(serverId: string, userId: string): Promise<ServerStats> {
    const server = await this.getServerById(serverId, userId);
    if (!server) throw new Error('السيرفر غير موجود.');

    const adapter = mikrotikService.getAdapter(server);
    return adapter.getSystemResources();
  }
}

export const serverService = new ServerService();
