/**
 * 趋势图表组件
 * 用于显示时间序列数据的趋势变化
 */

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface TrendData {
  date: string;
  count: number;
  [key: string]: unknown;
}

interface TrendChartProps {
  data: TrendData[];
  dataKey?: string;
  title?: string;
  color?: string;
  type?: 'line' | 'area';
  height?: number;
  showGrid?: boolean;
  formatDate?: (date: string) => string;
  formatTooltip?: (value: unknown, name: string) => [React.ReactNode, string];
}

const TrendChart: React.FC<TrendChartProps> = ({
  data,
  dataKey = 'count',
  title,
  color = '#3B82F6',
  type = 'line',
  height = 300,
  showGrid = true,
  formatDate,
  formatTooltip
}) => {
  const defaultFormatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const defaultFormatTooltip = (value: unknown, name: string) => {
    return [String(value), title || name];
  };

  const Chart = type === 'area' ? AreaChart : LineChart;

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate || defaultFormatDate}
            fontSize={12}
          />
          <YAxis fontSize={12} />
          <Tooltip 
            labelFormatter={(value) => `日期: ${(formatDate || defaultFormatDate)(value)}`}
            formatter={formatTooltip || defaultFormatTooltip}
          />
          {type === 'area' ? (
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              fill={color}
              fillOpacity={0.3}
            />
          ) : (
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;