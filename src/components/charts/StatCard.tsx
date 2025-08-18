/**
 * 统计卡片组件
 * 用于显示关键指标和数据
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-50',
  trend,
  loading = false,
  className = '',
  onClick
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // 格式化大数字
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toLocaleString();
    }
    return val;
  };

  const getTrendColor = (isPositive?: boolean) => {
    if (isPositive === undefined) return 'text-gray-600';
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  const getTrendIcon = (isPositive?: boolean) => {
    if (isPositive === undefined) return '';
    return isPositive ? '↗' : '↘';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 border animate-pulse ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm p-6 border transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {formatValue(value)}
          </p>
          
          {/* 趋势或副标题 */}
          {trend ? (
            <p className={`text-sm mt-1 flex items-center gap-1 ${
              getTrendColor(trend.isPositive)
            }`}>
              <span>{getTrendIcon(trend.isPositive)}</span>
              <span>{trend.value > 0 ? '+' : ''}{trend.value}</span>
              <span className="text-gray-500">{trend.label}</span>
            </p>
          ) : subtitle ? (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          ) : null}
        </div>
        
        {/* 图标 */}
        {Icon && (
          <div className={`w-12 h-12 ${iconBgColor} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;