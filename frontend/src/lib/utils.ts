/**
 * 工具函数
 * @author Bamzc
 */
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const TZ = "Asia/Shanghai";

/**
 * 将后端返回的无时区 ISO 字符串视为 UTC，确保正确转换为 Asia/Shanghai 显示。
 */
function parseAsUtc(date: string | Date): Date {
  if (date instanceof Date) return date;
  const s = String(date).trim();
  if (!s) return new Date(NaN);
  // 无时区后缀的 ISO 视为 UTC（后端存储为 UTC）
  if (
    /^\d{4}-\d{2}-\d{2}/.test(s) &&
    !s.endsWith("Z") &&
    !/[-+]\d{2}:?\d{2}$/.test(s)
  ) {
    return new Date(s.replace(" ", "T").replace(/Z?$/, "Z"));
  }
  return new Date(s);
}

/**
 * 格式化日期（统一使用 Asia/Shanghai 时区）
 */
export function formatDate(date: string | Date): string {
  const d = parseAsUtc(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  });
}

/**
 * 格式化日期+时间（统一使用 Asia/Shanghai 时区）
 */
export function formatDateTime(date: string | Date): string {
  const d = parseAsUtc(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/**
 * 格式化相对时间
 */
export function timeAgo(date: string | Date): string {
  const d = parseAsUtc(date);
  if (isNaN(d.getTime())) return String(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return formatDate(date);
}

/**
 * 格式化耗时（毫秒）
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/**
 * 格式化美元金额
 */
export function formatUSD(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * 截断文本
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

/**
 * 生成唯一ID
 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
