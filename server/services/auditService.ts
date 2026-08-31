import { db } from '../database/db';
import { AuditLog, AuditOperation } from '../types';

export class AuditService {
  log(
    operation: AuditOperation,
    status: 'SUCCESS' | 'FAILURE' | 'WARNING',
    userId?: string,
    telegramId?: number,
    serverId?: string,
    ip?: string,
    metadata?: Record<string, any>,
    error?: string
  ): AuditLog {
    // Sanitize metadata (never store passwords or tokens)
    const sanitizedMetadata = metadata ? { ...metadata } : undefined;
    if (sanitizedMetadata) {
      delete sanitizedMetadata.password;
      delete sanitizedMetadata.token;
      delete sanitizedMetadata.encryptedPassword;
      delete sanitizedMetadata.secret;
    }

    const logItem: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      telegramId,
      serverId,
      operation,
      timestamp: new Date().toISOString(),
      status,
      ip,
      error,
      metadata: sanitizedMetadata,
    };

    db.auditLogs.unshift(logItem);
    // Keep last 500 logs to prevent infinite growth
    if (db.auditLogs.length > 500) {
      db.auditLogs.length = 500;
    }
    db.save();
    return logItem;
  }

  getLogs(serverId?: string, limit: number = 100): AuditLog[] {
    if (serverId) {
      return db.auditLogs.filter((l) => l.serverId === serverId).slice(0, limit);
    }
    return db.auditLogs.slice(0, limit);
  }
}

export const auditService = new AuditService();
