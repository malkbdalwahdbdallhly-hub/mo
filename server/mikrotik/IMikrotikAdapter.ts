import { Server, ServerStats, Card, ActiveUser, DiagnosticData } from '../types';

export interface BatchCreateResult {
  requested: number;
  created: number;
  failed: number;
  errors: string[];
  cards: Card[];
}

export interface CleanupPreview {
  expiredUsers: number;
  disabledUsers: number;
  invalidRecords: number;
  totalRemovable: number;
}

export interface IMikrotikAdapter {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getSystemResources(): Promise<ServerStats>;
  getSystemIdentity(): Promise<string>;
  getUsers(): Promise<Card[]>;
  getActiveUsers(): Promise<ActiveUser[]>;
  createUser(card: Partial<Card>): Promise<Card>;
  createUsersBatch(cards: Partial<Card>[], onProgress?: (percent: number) => void): Promise<BatchCreateResult>;
  getUser(username: string): Promise<Card | null>;
  disableUser(username: string): Promise<boolean>;
  deleteUser(username: string): Promise<boolean>;
  backup(filenamePrefix?: string): Promise<{ filename: string; sizeBytes: number; checksum: string }>;
  restore(filename: string): Promise<{ success: boolean; message: string }>;
  previewCleanup(): Promise<CleanupPreview>;
  cleanup(preview?: CleanupPreview): Promise<{ removedCount: number }>;
  rebuild(): Promise<{ success: boolean; durationMs: number; errors?: string[] }>;
  reboot(): Promise<{ success: boolean; message: string }>;
  diagnostics(): Promise<DiagnosticData>;
  disconnectActiveUser(username: string): Promise<boolean>;
}
