import { db } from '../database/db';
import { User, UserRole } from '../types';
import { hashPassword, verifyPassword, generateToken, generateRandomCode } from '../security/crypto';

export class AuthService {
  async register(email: string, name: string, password: string): Promise<{ user: Omit<User, 'passwordHash' | 'salt'>; token: string }> {
    const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('البريد الإلكتروني مسجل بالفعل في المنصة.');
    }

    const { hash, salt } = hashPassword(password);
    const isFirstUser = db.users.length === 0;
    const role: UserRole = isFirstUser ? 'OWNER' : 'ADMIN';

    const user: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: hash,
      salt: salt,
      role: role,
      isActive: true,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.users.push(user);
    db.save();

    const token = generateToken({ userId: user.id, role: user.role, email: user.email });
    const { passwordHash, salt: _, ...safeUser } = user;

    return { user: safeUser, token };
  }

  async login(email: string, password: string): Promise<{ user: Omit<User, 'passwordHash' | 'salt'>; token: string }> {
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user || !user.isActive) {
      throw new Error('بيانات الاعتماد غير صحيحة أو الحساب غير مفعّل.');
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      throw new Error('بيانات الاعتماد غير صحيحة.');
    }

    const token = generateToken({ userId: user.id, role: user.role, email: user.email });
    const { passwordHash, salt: _, ...safeUser } = user;

    return { user: safeUser, token };
  }

  async changePassword(userId: string, currentPass: string, newPass: string): Promise<boolean> {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('المستخدم غير موجود.');

    const isValid = verifyPassword(currentPass, user.passwordHash, user.salt);
    if (!isValid) throw new Error('كلمة المرور الحالية غير صحيحة.');

    const { hash, salt } = hashPassword(newPass);
    user.passwordHash = hash;
    user.salt = salt;
    user.updatedAt = new Date().toISOString();
    db.save();

    return true;
  }

  async requestPasswordRecovery(email: string): Promise<{ message: string; recoveryCode?: string }> {
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      return { message: 'إذا كان البريد مسجلاً، تم إرسال تعليمات الاستعادة بنجاح.' };
    }

    const recoveryCode = generateRandomCode(6, true);
    // In production this is sent via email, in local environment we provide confirmation
    return {
      message: 'تم إنشاء رمز استعادة الحساب المؤقت.',
      recoveryCode,
    };
  }

  getUserById(userId: string): Omit<User, 'passwordHash' | 'salt'> | null {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    const { passwordHash, salt: _, ...safeUser } = user;
    return safeUser;
  }
}

export const authService = new AuthService();
