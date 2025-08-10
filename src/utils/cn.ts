import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并CSS类名的工具函数
 * 使用clsx处理条件类名，使用tailwind-merge处理Tailwind CSS类名冲突
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}