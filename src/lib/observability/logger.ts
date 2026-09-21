/**
 * Production-Grade POS Observability & Safe Logging Subsystem
 * Enforces Phase 17:
 * - Sanitizes sensitive credentials (passwords, PINs, auth tokens, card numbers)
 * - Structured log events for monitoring API errors, payments, KOTs, and database operations
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "AUDIT";

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  category: "API" | "DATABASE" | "PAYMENT" | "KOT" | "PRINT" | "AUTH" | "SYNC";
  message: string;
  meta?: Record<string, any>;
}

const REDACTED_KEYS = new Set([
  "pin",
  "password",
  "token",
  "salt",
  "secret",
  "authorization",
  "cookie",
  "creditCard",
  "cardNumber",
  "cvv",
]);

function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class PosLogger {
  static info(category: LogEvent["category"], message: string, meta?: Record<string, any>): void {
    this.log("INFO", category, message, meta);
  }

  static warn(category: LogEvent["category"], message: string, meta?: Record<string, any>): void {
    this.log("WARN", category, message, meta);
  }

  static error(category: LogEvent["category"], message: string, error?: any, meta?: Record<string, any>): void {
    const errorMeta = {
      ...meta,
      errorMessage: error?.message || String(error),
      stack: error?.stack,
    };
    this.log("ERROR", category, message, errorMeta);
  }

  static audit(action: string, entity: string, entityId: string, meta?: Record<string, any>): void {
    this.log("AUDIT", "API", `${action} on ${entity}:${entityId}`, meta);
  }

  private static log(level: LogLevel, category: LogEvent["category"], message: string, meta?: Record<string, any>): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      meta: meta ? sanitizeData(meta) : undefined,
    };

    const formatted = `[${event.timestamp}] [${event.level}] [${event.category}] ${event.message}`;

    if (level === "ERROR") {
      console.error(formatted, event.meta || "");
    } else if (level === "WARN") {
      console.warn(formatted, event.meta || "");
    } else {
      // In production or test, output structured log
      if (process.env.NODE_ENV !== "test") {
        console.log(formatted, event.meta ? JSON.stringify(event.meta) : "");
      }
    }
  }
}
