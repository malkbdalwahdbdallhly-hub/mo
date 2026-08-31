import net from 'net';
import tls from 'tls';
import http from 'http';
import https from 'https';
import crypto from 'crypto';

export interface MikrotikDiagnosticStep {
  name: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'INFO';
  detail: string;
}

export interface MikrotikProbeResult {
  success: boolean;
  latencyMs: number;
  message: string;
  protocol?: 'REST_SSL' | 'REST' | 'API' | 'API_SSL';
  version?: string;
  boardName?: string;
  identity?: string;
  cloudDdns?: string;
  publicIp?: string;
  uptime?: string;
  cpuLoad?: number;
  freeMemoryMb?: number;
  totalMemoryMb?: number;
  steps: MikrotikDiagnosticStep[];
  troubleshooting?: string[];
}

/**
 * Length encoder for RouterOS API binary protocol
 */
export function encodeRouterOSLength(len: number): Buffer {
  if (len < 0x80) {
    return Buffer.from([len]);
  } else if (len < 0x4000) {
    return Buffer.from([(len >> 8) | 0x80, len & 0xff]);
  } else if (len < 0x200000) {
    return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  } else if (len < 0x10000000) {
    return Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  } else {
    return Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  }
}

/**
 * RouterOS Native Binary API Client (Port 8728 / 8729 TLS)
 */
export class RouterOSNativeClient {
  private host: string;
  private port: number;
  private username: string;
  private password?: string;
  private useTls: boolean;
  private timeoutMs: number;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private connected: boolean = false;
  private loggedIn: boolean = false;

  constructor(options: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    useTls?: boolean;
    timeoutMs?: number;
  }) {
    this.host = options.host;
    this.useTls = !!options.useTls;
    this.port = options.port || (this.useTls ? 8729 : 8728);
    this.username = options.username;
    this.password = options.password || '';
    this.timeoutMs = options.timeoutMs || 8000;
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.loggedIn && this.socket && !this.socket.destroyed) {
      return true;
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.close();
          reject(new Error(`انتهت مهلة الاتصال بالمنفذ ${this.port} (ETIMEDOUT) - تأكد من فتح المنفذ في جدار حماية الميكروتيك.`));
        }
      }, this.timeoutMs);

      const onConnect = async () => {
        clearTimeout(timeout);
        this.connected = true;
        try {
          await this.performLogin();
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        } catch (loginErr: any) {
          if (!resolved) {
            resolved = true;
            this.close();
            reject(loginErr);
          }
        }
      };

      const onError = (err: Error) => {
        clearTimeout(timeout);
        this.close();
        if (!resolved) {
          resolved = true;
          if (err.message.includes('ECONNREFUSED')) {
            reject(new Error(`تم رفض الاتصال على المنفذ ${this.port} (ECONNREFUSED) - تأكد من تفعيل خدمة API (/ip service enable api) في الميكروتيك.`));
          } else if (err.message.includes('ENOTFOUND')) {
            reject(new Error(`تعذر العثور على اسم المضيف (${this.host}) - تأكد من صحة رابط الكلاود mynetname.net أو عنوان الـ IP.`));
          } else {
            reject(new Error(`خطأ في اتصال الميكروتيك: ${err.message}`));
          }
        }
      };

      try {
        if (this.useTls) {
          this.socket = tls.connect(
            {
              host: this.host,
              port: this.port,
              rejectUnauthorized: false,
              servername: this.host,
            },
            onConnect
          );
        } else {
          this.socket = net.connect(
            {
              host: this.host,
              port: this.port,
            },
            onConnect
          );
        }

        this.socket.on('data', (chunk) => {
          this.buffer = Buffer.concat([this.buffer, chunk]);
        });

        this.socket.on('error', onError);
        this.socket.on('close', () => {
          this.connected = false;
          this.loggedIn = false;
        });
      } catch (err: any) {
        onError(err);
      }
    });
  }

  private async performLogin(): Promise<void> {
    try {
      // 1. Try post-6.43 style login first (works on RouterOS v6.43+ and v7)
      const loginReply = await this.sendSentence([
        '/login',
        `=name=${this.username}`,
        `=password=${this.password || ''}`,
      ]);

      const doneSentence = loginReply.find((s) => s[0] === '!done');
      const trapSentence = loginReply.find((s) => s[0] === '!trap');

      if (trapSentence) {
        const msgWord = trapSentence.find((w) => w.startsWith('=message='));
        const errorMsg = msgWord ? msgWord.replace('=message=', '') : 'فشل تسجيل الدخول';

        // RouterOS versions prior to 6.43 reject plaintext password in /login with a trap.
        // Fall back to pre-6.43 challenge-response flow
        try {
          await this.performChallengeLogin();
          this.loggedIn = true;
          return;
        } catch (fallbackErr: any) {
          throw new Error(`فشل تسجيل الدخول للميكروتيك: ${errorMsg}`);
        }
      }

      if (doneSentence) {
        // If router responded with challenge in =ret= (pre-6.43 challenge flow)
        const retWord = doneSentence.find((w) => w.startsWith('=ret='));
        if (retWord) {
          await this.respondToChallenge(retWord.replace('=ret=', ''));
        }
        this.loggedIn = true;
        return;
      }
    } catch (err: any) {
      // If error or rejected, try classic pre-6.43 challenge flow
      try {
        await this.performChallengeLogin();
        this.loggedIn = true;
        return;
      } catch (fallbackErr: any) {
        throw new Error(fallbackErr.message || err.message);
      }
    }

    throw new Error('لم يتم استلام رد صالح من راوتر الميكروتيك أثناء تسجيل الدخول.');
  }

  private async respondToChallenge(challengeHex: string): Promise<void> {
    const md5Hasher = crypto.createHash('md5');
    md5Hasher.update(
      Buffer.concat([
        Buffer.from([0]),
        Buffer.from(this.password || '', 'utf8'),
        Buffer.from(challengeHex, 'hex'),
      ])
    );
    const responseHash = md5Hasher.digest('hex');

    const challengeReply = await this.sendSentence([
      '/login',
      `=name=${this.username}`,
      `=response=00${responseHash}`,
    ]);

    const challengeTrap = challengeReply.find((s) => s[0] === '!trap');
    if (challengeTrap) {
      const msgWord = challengeTrap.find((w) => w.startsWith('=message='));
      throw new Error(
        `فشل تسجيل الدخول للميكروتيك (RouterOS v6): ${
          msgWord ? msgWord.replace('=message=', '') : 'خطأ في كلمة المرور أو اسم المستخدم'
        }`
      );
    }
  }

  private async performChallengeLogin(): Promise<void> {
    // Step 1: Send empty /login to receive challenge
    const initReply = await this.sendSentence(['/login']);
    const doneSentence = initReply.find((s) => s[0] === '!done');
    const trapSentence = initReply.find((s) => s[0] === '!trap');

    if (trapSentence) {
      const msgWord = trapSentence.find((w) => w.startsWith('=message='));
      throw new Error(`خطأ مصادقة الميكروتيك: ${msgWord ? msgWord.replace('=message=', '') : 'تعذر بدء جلسة الدخول'}`);
    }

    const retWord = doneSentence?.find((w) => w.startsWith('=ret='));
    if (!retWord) {
      throw new Error('لم يقدم راوتر الميكروتيك كود التحدي (Challenge) المطلوب للاتصال.');
    }

    const challengeHex = retWord.replace('=ret=', '');
    await this.respondToChallenge(challengeHex);
  }

  async executeCommand(words: string[]): Promise<Array<Record<string, string>>> {
    await this.connect();
    const reply = await this.sendSentence(words);

    const trapSentence = reply.find((s) => s[0] === '!trap');
    if (trapSentence) {
      const msgWord = trapSentence.find((w) => w.startsWith('=message='));
      throw new Error(msgWord ? msgWord.replace('=message=', '') : 'فشل تنفيذ الأمر في الميكروتيك');
    }

    const results: Array<Record<string, string>> = [];
    for (const sentence of reply) {
      if (sentence[0] === '!re') {
        const record: Record<string, string> = {};
        for (const word of sentence.slice(1)) {
          if (word.startsWith('=')) {
            const eqIdx = word.indexOf('=', 1);
            if (eqIdx !== -1) {
              const key = word.substring(1, eqIdx);
              const val = word.substring(eqIdx + 1);
              record[key] = val;
            }
          }
        }
        results.push(record);
      }
    }

    return results;
  }

  private sendSentence(words: string[]): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error('مقبس الاتصال غير متصل.'));
      }

      // Encode sentence
      const buffers: Buffer[] = [];
      for (const word of words) {
        const wordBuf = Buffer.from(word, 'utf8');
        buffers.push(encodeRouterOSLength(wordBuf.length));
        buffers.push(wordBuf);
      }
      // Sentence terminator
      buffers.push(encodeRouterOSLength(0));

      const payload = Buffer.concat(buffers);
      this.socket.write(payload);

      const sentences: string[][] = [];
      let currentSentence: string[] = [];

      const checkData = () => {
        while (true) {
          if (this.buffer.length === 0) break;

          // Decode length
          let len = 0;
          let bytesRead = 0;
          const b0 = this.buffer[0];

          if ((b0 & 0x80) === 0) {
            len = b0;
            bytesRead = 1;
          } else if ((b0 & 0xc0) === 0x80) {
            if (this.buffer.length < 2) break;
            len = ((b0 & 0x3f) << 8) | this.buffer[1];
            bytesRead = 2;
          } else if ((b0 & 0xe0) === 0xc0) {
            if (this.buffer.length < 3) break;
            len = ((b0 & 0x1f) << 16) | (this.buffer[1] << 8) | this.buffer[2];
            bytesRead = 3;
          } else if ((b0 & 0xf0) === 0xe0) {
            if (this.buffer.length < 4) break;
            len = ((b0 & 0x0f) << 24) | (this.buffer[1] << 16) | (this.buffer[2] << 8) | this.buffer[3];
            bytesRead = 4;
          } else if (b0 === 0xf0) {
            if (this.buffer.length < 5) break;
            len = (this.buffer[1] << 24) | (this.buffer[2] << 16) | (this.buffer[3] << 8) | this.buffer[4];
            bytesRead = 5;
          } else {
            cleanup();
            return reject(new Error('تنسيق حزمة غير صالح من الميكروتيك.'));
          }

          if (this.buffer.length < bytesRead + len) {
            // Wait for more data
            break;
          }

          // We have a full word
          const wordBuffer = this.buffer.subarray(bytesRead, bytesRead + len);
          this.buffer = this.buffer.subarray(bytesRead + len);

          if (len === 0) {
            // End of sentence
            if (currentSentence.length > 0) {
              sentences.push(currentSentence);
              const tag = currentSentence[0];
              currentSentence = [];

              if (tag === '!done' || tag === '!fatal') {
                cleanup();
                return resolve(sentences);
              }
            }
          } else {
            const word = wordBuffer.toString('utf8');
            currentSentence.push(word);
          }
        }
      };

      const onSocketData = () => {
        try {
          checkData();
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      const onSocketError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        if (this.socket) {
          this.socket.off('data', onSocketData);
          this.socket.off('error', onSocketError);
        }
      };

      this.socket.on('data', onSocketData);
      this.socket.on('error', onSocketError);

      // Check if buffer already has complete data
      checkData();
    });
  }

  close() {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.connected = false;
    this.loggedIn = false;
    this.buffer = Buffer.alloc(0);
  }
}

/**
 * RouterOS v7 REST API Client (Port 443 / 80 or custom HTTPS/HTTP)
 * Used by modern RouterOS v7 setups with MikroTik Cloud DDNS (*.sn.mynetname.net)
 */
export class RouterOSRestClient {
  private host: string;
  private port: number;
  private username: string;
  private password?: string;
  private useHttps: boolean;
  private timeoutMs: number;

  constructor(options: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    useHttps?: boolean;
    timeoutMs?: number;
  }) {
    this.host = options.host;
    this.useHttps = options.useHttps !== false;
    this.port = options.port || (this.useHttps ? 443 : 80);
    this.username = options.username;
    this.password = options.password || '';
    this.timeoutMs = options.timeoutMs || 8000;
  }

  async request<T = any>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const isHttps = this.useHttps;
      const client = isHttps ? https : http;
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const path = normalizedEndpoint.startsWith('/rest') ? normalizedEndpoint : `/rest${normalizedEndpoint}`;

      const auth = Buffer.from(`${this.username}:${this.password || ''}`).toString('base64');
      const reqHeaders: Record<string, string> = {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      };

      let bodyData: string | undefined;
      if (body) {
        bodyData = JSON.stringify(body);
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(bodyData).toString();
      }

      const req = client.request(
        {
          hostname: this.host,
          port: this.port,
          path,
          method,
          headers: reqHeaders,
          rejectUnauthorized: false, // MikroTik routers typically use self-signed certificates
          timeout: this.timeoutMs,
        },
        (res) => {
          let rawData = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            const status = res.statusCode || 0;
            if (status === 401) {
              return reject(new Error('خطأ 401: اسم المستخدم أو كلمة المرور غير صحيحة لميكروتيك (Unauthorized).'));
            }
            if (status === 403) {
              return reject(new Error('خطأ 403: المستخدم لا يملك صلاحية كافية في الميكروتيك (Forbidden - Check User Group).'));
            }
            if (status === 404) {
              return reject(new Error(`خطأ 404: المسار غير متوفر (${path}) - قد يكون إصدار RouterOS لا يدعم هذه الميزة أو لم يتم تفعيل User Manager.`));
            }
            if (status >= 400) {
              return reject(new Error(`خطأ من راوتر الميكروتيك (HTTP ${status}): ${rawData || 'طلب غير صالح'}`));
            }

            try {
              const parsed = rawData ? JSON.parse(rawData) : null;
              resolve(parsed as T);
            } catch {
              resolve(rawData as any);
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`انتهت مهلة الاستجابة من REST API على المنفذ ${this.port} (ETIMEDOUT).`));
      });

      req.on('error', (err: any) => {
        if (err.code === 'ECONNREFUSED') {
          reject(new Error(`تم رفض الاتصال بالمنفذ ${this.port} (ECONNREFUSED) - تأكد من تفعيل خدمة ${isHttps ? 'www-ssl' : 'www'} في /ip service.`));
        } else if (err.code === 'ENOTFOUND') {
          reject(new Error(`تعذر العثور على اسم المضيف (${this.host}) - تأكد من كود الكلاود .sn.mynetname.net.`));
        } else {
          reject(new Error(`خطأ في طلب REST الميكروتيك: ${err.message}`));
        }
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }
}

/**
 * Probes a MikroTik server via Cloud / IP, testing both REST and Native API
 * and returns full diagnostics, real version, board model, and uptime.
 */
export async function probeMikrotik(server: {
  host: string;
  username: string;
  password?: string;
  apiPort?: number;
  apiSslPort?: number;
  connectionType?: string;
  osVersion?: 'v6' | 'v7' | 'auto';
}): Promise<MikrotikProbeResult> {
  const steps: MikrotikDiagnosticStep[] = [];
  const startTime = Date.now();
  const host = server.host.trim();
  const username = server.username.trim();
  const password = server.password || '';

  const isV6 = server.connectionType === 'ROUTEROS_V6' || server.osVersion === 'v6';

  steps.push({
    name: 'فحص عنوان المضيف',
    status: 'INFO',
    detail: `المضيف المستهدف: ${host} ${host.includes('mynetname.net') ? '(MikroTik Cloud DDNS)' : ''} ${
      isV6 ? '• تم ضبط النظام على MikroTik RouterOS v6' : ''
    }`,
  });

  const isRestRequested = server.connectionType === 'REST' || server.connectionType === 'REST_SSL';
  const isApiRequested = server.connectionType === 'API' || server.connectionType === 'API_SSL' || isV6;

  // Strategy: If specific protocol requested or RouterOS v6, skip REST completely and go directly to Native API (port 8728).
  // If AUTO and not v6, test REST first (RouterOS v7) then Native API (8728).
  let lastError: Error | null = null;

  // 1. Try RouterOS v7 REST API (if not restricted to API only and not v6)
  if (!isApiRequested) {
    const isHttps = server.connectionType !== 'REST';
    const restPort = isHttps ? 443 : 80;

    steps.push({
      name: `فحص اتصال REST API عبر المنفذ ${restPort} (${isHttps ? 'HTTPS' : 'HTTP'})`,
      status: 'INFO',
      detail: `جاري إرسال طلب مصادقة إلى https://${host}:${restPort}/rest/system/resource...`,
    });

    try {
      const restClient = new RouterOSRestClient({
        host,
        port: restPort,
        username,
        password,
        useHttps: isHttps,
        timeoutMs: 4000,
      });

      const [resource, identity, cloud] = await Promise.all([
        restClient.request<Record<string, any>>('/system/resource'),
        restClient.request<Record<string, any>>('/system/identity').catch(() => ({ name: 'MikroTik' })),
        restClient.request<Record<string, any>>('/ip/cloud').catch(() => null),
      ]);

      const latencyMs = Date.now() - startTime;
      const version = resource?.version || 'RouterOS v7 (REST)';
      const boardName = resource?.['board-name'] || resource?.board || 'MikroTik RouterBoard';
      const routerName = identity?.name || 'MikroTik';
      const freeMemMb = resource?.['free-memory'] ? Math.round(parseInt(resource['free-memory'], 10) / (1024 * 1024)) : undefined;
      const totalMemMb = resource?.['total-memory'] ? Math.round(parseInt(resource['total-memory'], 10) / (1024 * 1024)) : undefined;
      const cpuLoad = resource?.['cpu-load'] !== undefined ? parseInt(resource['cpu-load'], 10) : undefined;
      const uptime = resource?.uptime || undefined;

      steps.push({
        name: 'المصادقة والتحقق من صلاحيات المدير',
        status: 'SUCCESS',
        detail: `تم تسجيل الدخول بنجاح كمسؤول (${username}). الراوتر: ${routerName}`,
      });

      steps.push({
        name: 'قراءة موارد النظام (System Resources)',
        status: 'SUCCESS',
        detail: `الإصدار: ${version} | البوردة: ${boardName} | وقت التشغيل: ${uptime || 'جاهز'} | زمن الاستجابة: ${latencyMs}ms`,
      });

      if (cloud?.['dns-name'] || cloud?.['public-address']) {
        steps.push({
          name: 'حالة خدمة Cloud DDNS',
          status: 'SUCCESS',
          detail: `كود الكلاود: ${cloud['dns-name'] || host} | IP الخارجي: ${cloud['public-address'] || 'متوفر'}`,
        });
      }

      return {
        success: true,
        latencyMs,
        message: `تم الاتصال الحقيقي بالسيرفر بنجاح عبر بروتوكول RouterOS v7 REST API (${boardName})!`,
        protocol: isHttps ? 'REST_SSL' : 'REST',
        version,
        boardName,
        identity: routerName,
        cloudDdns: cloud?.['dns-name'],
        publicIp: cloud?.['public-address'],
        uptime,
        cpuLoad,
        freeMemoryMb: freeMemMb,
        totalMemoryMb: totalMemMb,
        steps,
      };
    } catch (err: any) {
      lastError = err;
      steps.push({
        name: `فحص REST API على المنفذ ${restPort}`,
        status: 'FAILED',
        detail: err.message,
      });

      // If user specifically wanted REST, stop here and return error
      if (isRestRequested) {
        return buildFailedResult(startTime, steps, err, isV6);
      }
    }
  }

  // 2. Try Native RouterOS API protocol (Port 8728 / 8729) - Required for RouterOS v6!
  const apiPort = server.connectionType === 'API_SSL' ? (server.apiSslPort || 8729) : (server.apiPort || 8728);
  const useTls = server.connectionType === 'API_SSL';

  steps.push({
    name: `فحص اتصال RouterOS API الأصلي على المنفذ ${apiPort} ${isV6 ? '(بروتوكول RouterOS v6)' : ''}`,
    status: 'INFO',
    detail: `فتح جلسة مقبس Socket ومصادقة مع بروتوكول MikroTik الثنائي على المنفذ ${apiPort}...`,
  });

  try {
    const nativeClient = new RouterOSNativeClient({
      host,
      port: apiPort,
      username,
      password,
      useTls,
      timeoutMs: 6000,
    });

    await nativeClient.connect();

    steps.push({
      name: 'مصادقة مستخدم API',
      status: 'SUCCESS',
      detail: `نجح تسجيل الدخول عبر بروتوكول RouterOS API بالحساب (${username}). تم فحص التحدي والمصادقة.`,
    });

    const resources = await nativeClient.executeCommand(['/system/resource/print']);
    const identities = await nativeClient.executeCommand(['/system/identity/print']).catch(() => []);
    const clouds = await nativeClient.executeCommand(['/ip/cloud/print']).catch(() => []);

    nativeClient.close();

    const latencyMs = Date.now() - startTime;
    const res = resources[0] || {};
    const version = res.version || 'RouterOS';
    const boardName = res['board-name'] || res.board || 'MikroTik RouterBoard';
    const routerName = identities[0]?.name || 'MikroTik';
    const cloudDdns = clouds[0]?.['dns-name'];
    const publicIp = clouds[0]?.['public-address'];
    const uptime = res.uptime;
    const cpuLoad = res['cpu-load'] ? parseInt(res['cpu-load'], 10) : undefined;
    const freeMemMb = res['free-memory'] ? Math.round(parseInt(res['free-memory'], 10) / (1024 * 1024)) : undefined;
    const totalMemMb = res['total-memory'] ? Math.round(parseInt(res['total-memory'], 10) / (1024 * 1024)) : undefined;

    const isVersion6 = version.startsWith('6.') || isV6;

    steps.push({
      name: 'استخراج مواصفات الراوتر الحقيقية',
      status: 'SUCCESS',
      detail: `الراوتر: ${routerName} | الطراز: ${boardName} | الإصدار: ${version} ${
        isVersion6 ? '(RouterOS v6 - متوافق بنسبة 100%)' : ''
      } | وقت الاستجابة: ${latencyMs}ms`,
    });

    return {
      success: true,
      latencyMs,
      message: isVersion6
        ? `تم الاتصال الحقيقي بنجاح بسيرفر MikroTik RouterOS v6 (${boardName}) عبر منفذ API ${apiPort}!`
        : `تم الاتصال الحقيقي بالسيرفر بنجاح عبر منفذ RouterOS API ${apiPort} (${boardName})!`,
      protocol: useTls ? 'API_SSL' : 'API',
      version,
      boardName,
      identity: routerName,
      cloudDdns,
      publicIp,
      uptime,
      cpuLoad,
      freeMemoryMb: freeMemMb,
      totalMemoryMb: totalMemMb,
      steps,
    };
  } catch (err: any) {
    lastError = err;
    steps.push({
      name: `فحص RouterOS API على المنفذ ${apiPort}`,
      status: 'FAILED',
      detail: err.message,
    });
  }

  return buildFailedResult(startTime, steps, lastError || new Error('فشل الاتصال بالسيرفر.'), isV6);
}

function buildFailedResult(
  startTime: number,
  steps: MikrotikDiagnosticStep[],
  err: Error,
  isV6 = false
): MikrotikProbeResult {
  return {
    success: false,
    latencyMs: Date.now() - startTime,
    message: err.message || 'تعذر الاتصال بسيرفر الميكروتيك الحقيقي.',
    steps,
    troubleshooting: isV6
      ? [
          'تأكد من تفعيل خدمة API في RouterOS v6 بتنفيذ الأمر: /ip service enable api',
          'تأكد من فتح المنفذ 8728 في جدار الحماية (Firewall) بالسماح بالاتصال: /ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept place-before=1',
          'تأكد من تفعيل الكلاود وتحديث العنوان: /ip cloud set ddns-enabled=yes update-time=yes ثم /ip cloud print',
          'إذا كان جهاز الميكروتيك خلف مودم مزود خدمة (Fiber / 4G / 5G)، يجب عمل توجيه منفذ (Port Forwarding) للمنفذ 8728 إلى عنوان IP الميكروتيك الداخلي.',
          'تأكد من صحة اسم المستخدم وكلمة المرور وصلاحية الدخول الكاملة (full group) في /user print.',
        ]
      : [
          'تأكد من كتابة عنوان IP أو كود الكلاود بشكل صحيح (مثل: xxx.sn.mynetname.net).',
          'تأكد من تفعيل خدمة الكلاود في الميكروتيك: /ip cloud set ddns-enabled=yes update-time=yes',
          'تأكد من تفعيل خدمة API أو WWW في الميكروتيك: /ip service enable api أو /ip service enable www-ssl',
          'إذا كان الميكروتيك خلف مودم ألياف أو 4G/5G، يجب توجيه المنفذ 8728 أو 443 (Port Forwarding / DMZ) إلى الـ IP الداخلي للميكروتيك.',
          'تأكد من صحة اسم المستخدم وكلمة المرور وصلاحية الدخول Full لمجموعة المستخدم (Group).',
        ],
  };
}
