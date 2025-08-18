/**
 * 图表组件导出文件
 * 统一导出所有图表组件
 */

export { default as TrendChart } from './TrendChart';
export { default as PieChart } from './PieChart';
export { default as BarChart } from './BarChart';
export { default as StatCard } from './StatCard';

// 导出类型定义
export type { default as TrendChartProps } from './TrendChart';
export type { default as PieChartProps } from './PieChart';
export type { default as BarChartProps } from './BarChart';
export type { default as StatCardProps } from './StatCard';

// 图表颜色主题
export const chartTheme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#8B5CF6',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
    success: '#84CC16',
    orange: '#F97316',
    pink: '#EC4899',
    indigo: '#6366F1'
  },
  palette: [
    '#3B82F6', // blue
    '#10B981', // green
    '#8B5CF6', // purple
    '#F59E0B', // yellow
    '#EF4444', // red
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#F97316', // orange
    '#EC4899', // pink
    '#6366F1'  // indigo
  ]
};

// 图表工具函数
export const chartUtils = {
  // 格式化数字
  formatNumber: (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  },
  
  // 格式化日期
  formatDate: (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  },
  
  // 格式化百分比
  formatPercent: (value: number, total: number): string => {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
  },
  
  // 计算增长率
  calculateGrowthRate: (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
};