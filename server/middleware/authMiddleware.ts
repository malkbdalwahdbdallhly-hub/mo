import { Request, Response, NextFunction } from 'express';
import { verifyToken, rateLimiter } from '../security/crypto';
import { UserRole } from '../types';
import { hasPermission } from '../security/rbac';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً للمتابعة (Unauthorized).' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken<{ userId: string; email: string; role: UserRole }>(token);

  if (!payload) {
    return res.status(401).json({ error: 'جلسة الدخول منتهية أو غير صالحة.' });
  }

  req.user = payload;
  next();
}

export function requireRole(minRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح.' });
    }

    if (!hasPermission(req.user.role, minRole)) {
      return res.status(403).json({ error: 'ليس لديك الصلاحية الكافية لتنفيذ هذه العملية.' });
    }

    next();
  };
}

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.path}_${ip}`;
    const result = rateLimiter.check(key, maxRequests, windowMs);

    if (!result.allowed) {
      return res.status(429).json({ error: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.' });
    }

    next();
  };
}
