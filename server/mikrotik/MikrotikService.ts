import { Server } from '../types';
import { IMikrotikAdapter } from './IMikrotikAdapter';
import { RealMikrotikAdapter } from './RealMikrotikAdapter';
import { probeMikrotik, MikrotikProbeResult } from './RouterOSClient';
import { decryptCredential } from '../security/crypto';
import { db } from '../database/db';

class MikrotikService {
  private adapters: Map<string, IMikrotikAdapter> = new Map();

  getAdapter(server: Server): IMikrotikAdapter {
    if (this.adapters.has(server.id)) {
      return this.adapters.get(server.id)!;
    }

    // Always connect directly to the real MikroTik server
    const adapter = new RealMikrotikAdapter(server);
    this.adapters.set(server.id, adapter);
    return adapter;
  }

  async testConnection(server: Server): Promise<MikrotikProbeResult> {
    // Direct real server connection test
    let plainPassword = '';
    try {
      plainPassword = server.encryptedPassword ? decryptCredential(server.encryptedPassword) : '';
    } catch {
      plainPassword = server.encryptedPassword || '';
    }

    const probe = await probeMikrotik({
      host: server.host,
      username: server.username,
      password: plainPassword,
      apiPort: server.apiPort,
      apiSslPort: server.apiSslPort,
      connectionType: server.connectionType,
      osVersion: server.osVersion,
    });

    // Update server status in database
    const dbServer = db.servers.find((s) => s.id === server.id);
    if (dbServer) {
      if (probe.success) {
        dbServer.status = 'CONNECTED';
        dbServer.lastConnectedAt = new Date().toISOString();
        dbServer.lastErrorMessage = undefined;
        if (probe.boardName) dbServer.boardModel = probe.boardName;
        if (probe.cloudDdns) dbServer.cloudDdns = probe.cloudDdns;
      } else {
        dbServer.status = 'ERROR';
        dbServer.lastErrorMessage = probe.message;
      }
      db.save();
    }

    return probe;
  }

  removeAdapter(serverId: string) {
    if (this.adapters.has(serverId)) {
      this.adapters.get(serverId)!.disconnect().catch(() => {});
      this.adapters.delete(serverId);
    }
  }
}

export const mikrotikService = new MikrotikService();
