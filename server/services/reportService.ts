import { db } from '../database/db';

export interface ReportFilter {
  serverId: string;
  type: 'SALES' | 'CARDS' | 'POS' | 'CONSUMPTION';
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  startDate?: string;
  endDate?: string;
}

export class ReportService {
  generateReport(userId: string, filter: ReportFilter) {
    const server = db.servers.find((s) => s.id === filter.serverId && s.userId === userId);
    const settings = db.cardSettings.find((s) => s.serverId === filter.serverId) || db.cardSettings[0];
    const cards = db.cards.filter((c) => c.serverId === filter.serverId);

    const now = Date.now();
    let minTime = 0;
    if (filter.period === 'DAILY') minTime = now - 86400000;
    else if (filter.period === 'WEEKLY') minTime = now - 86400000 * 7;
    else if (filter.period === 'MONTHLY') minTime = now - 86400000 * 30;
    else if (filter.startDate) minTime = new Date(filter.startDate).getTime();

    let maxTime = filter.endDate ? new Date(filter.endDate).getTime() : now;

    // Filter cards within date
    const scopedCards = cards.filter((c) => {
      const t = new Date(c.creationDate).getTime();
      return t >= minTime && t <= maxTime;
    });

    const totalCards = scopedCards.length;
    const soldCards = scopedCards.filter((c) => c.status !== 'AVAILABLE').length;
    const activeCards = scopedCards.filter((c) => c.status === 'ACTIVE').length;
    const usedCards = scopedCards.filter((c) => c.status === 'USED').length;
    const expiredCards = scopedCards.filter((c) => c.status === 'EXPIRED').length;
    const availableCards = scopedCards.filter((c) => c.status === 'AVAILABLE').length;

    const totalRevenue = scopedCards
      .filter((c) => c.status !== 'AVAILABLE')
      .reduce((sum, c) => sum + (c.price || 0), 0);

    const totalDownloadBytes = scopedCards.reduce((sum, c) => sum + (c.downloadBytes || 0), 0);
    const totalUploadBytes = scopedCards.reduce((sum, c) => sum + (c.uploadBytes || 0), 0);

    // Group by POS
    const posList = db.posList.filter((p) => p.serverId === filter.serverId);
    const posBreakdown = posList.map((p) => {
      const pCards = scopedCards.filter((c) => c.posId === p.id);
      const pSold = pCards.filter((c) => c.status !== 'AVAILABLE');
      return {
        posId: p.id,
        name: p.name,
        prefix: p.prefix,
        manager: p.managerName,
        cardsCount: pCards.length,
        soldCount: pSold.length,
        revenue: pSold.reduce((sum, c) => sum + (c.price || 0), 0),
      };
    });

    return {
      networkName: settings?.networkName || 'شبكة مكين',
      serverName: server?.name || 'سيرفر MikroTik',
      period: filter.period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCards,
        soldCards,
        activeCards,
        usedCards,
        expiredCards,
        availableCards,
        totalRevenue,
        totalTrafficMB: Math.round((totalDownloadBytes + totalUploadBytes) / (1024 * 1024)),
      },
      posBreakdown,
      items: scopedCards.slice(0, 100).map((c) => ({
        username: c.username,
        profile: c.profile,
        status: c.status,
        price: c.price,
        pos: c.posName || 'غير مخصص',
        created: c.creationDate,
        lastLogin: c.lastLogin || '-',
      })),
    };
  }

  exportCsv(reportData: any): string {
    const lines = [
      `Makeen Report - ${reportData.networkName}`,
      `Server: ${reportData.serverName}, Period: ${reportData.period}`,
      `Generated At: ${reportData.generatedAt}`,
      '',
      `Total Cards,Sold,Active,Expired,Available,Total Sales (SAR)`,
      `${reportData.summary.totalCards},${reportData.summary.soldCards},${reportData.summary.activeCards},${reportData.summary.expiredCards},${reportData.summary.availableCards},${reportData.summary.totalRevenue}`,
      '',
      'Username,Profile,Status,Price,POS,Created Date,Last Login',
      ...reportData.items.map(
        (i: any) =>
          `"${i.username}","${i.profile}","${i.status}",${i.price},"${i.pos}","${i.created}","${i.lastLogin}"`
      ),
    ];
    return lines.join('\n');
  }
}

export const reportService = new ReportService();
