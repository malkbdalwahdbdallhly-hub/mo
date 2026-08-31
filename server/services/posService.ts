import { db } from '../database/db';
import { POS } from '../types';

export class PosService {
  async getPosList(serverId: string, userId: string): Promise<POS[]> {
    return db.posList.filter((p) => p.serverId === serverId && p.userId === userId);
  }

  async createPos(
    serverId: string,
    userId: string,
    data: {
      name: string;
      managerName: string;
      phone?: string;
      prefix?: string;
    }
  ): Promise<POS> {
    // Generate next prefix e.g. POS001, POS002 if not provided
    let prefix = data.prefix?.toUpperCase().trim();
    if (!prefix) {
      const count = db.posList.length + 1;
      prefix = `POS${count.toString().padStart(3, '0')}`;
    }

    // Check duplicate prefix
    const existing = db.posList.find((p) => p.prefix === prefix);
    if (existing) {
      throw new Error(`البادئة [${prefix}] مستخدمة بالفعل لنقطة بيع أخرى.`);
    }

    const pos: POS = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      serverId,
      name: data.name.trim(),
      managerName: data.managerName.trim(),
      phone: data.phone?.trim(),
      prefix,
      status: 'ACTIVE',
      cardsSold: 0,
      cardsRemaining: 0,
      totalSales: 0,
      createdAt: new Date().toISOString(),
    };

    db.posList.push(pos);
    db.save();
    return pos;
  }

  async updatePos(
    posId: string,
    userId: string,
    data: Partial<{
      name: string;
      managerName: string;
      phone?: string;
      status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
    }>
  ): Promise<POS> {
    const pos = db.posList.find((p) => p.id === posId && p.userId === userId);
    if (!pos) throw new Error('نقطة البيع غير موجودة.');

    Object.assign(pos, data);
    db.save();
    return pos;
  }

  async deletePos(posId: string, userId: string): Promise<boolean> {
    const index = db.posList.findIndex((p) => p.id === posId && p.userId === userId);
    if (index === -1) return false;

    db.posList.splice(index, 1);
    db.save();
    return true;
  }
}

export const posService = new PosService();
