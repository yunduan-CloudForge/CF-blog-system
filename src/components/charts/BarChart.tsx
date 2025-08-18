/**
 * 柱状图组件
 * 用于显示对比数据和排名
 */

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface BarData {
  name: string;
  value: number;
  [key: string]: unknown;
}

interface BarChartProps {
  data: BarData[];
  title?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  dataKey?: string;
  nameKey?: string;
  layout?: 'horizontal' | 'vertical';
  formatTooltip?: (value: unknown, name: string) => [React.ReactNode, string];
  formatXAxisLabel?: (value: unknown) => string;
  formatYAxisLabel?: (value: unknown) => string;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  color = '#3B82F6',
  height = 300,
  showGrid = true,
  showLegend = false,
  dataKey = 'value',
  nameKey = 'name',
  layout = 'vertical',
  formatTooltip,
  formatXAxisLabel,
  formatYAxisLabel
}) => {
  const defaultFormatTooltip = (value: unknown, name: string) => {
    return [String(value), title || name];
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          
          {layout === 'vertical' ? (
            <>
              <XAxis 
                type="number" 
                fontSize={12}
                tickFormatter={formatXAxisLabel}
              />
              <YAxis 
                type="category" 
                dataKey={nameKey} 
                fontSize={12}
                width={100}
                tickFormatter={formatYAxisLabel}
              />
            </>
          ) : (
            <>
              <XAxis 
                type="category" 
                dataKey={nameKey} 
                fontSize={12}
                tickFormatter={formatXAxisLabel}
              />
              <YAxis 
                type="number" 
                fontSize={12}
                tickFormatter={formatYAxisLabel}
              />
            </>
          )}
          
          <Tooltip 
            formatter={formatTooltip || defaultFormatTooltip}
          />
          
          {showLegend && <Legend />}
          
          <Bar 
            dataKey={dataKey} 
            fill={color}
            radius={layout === 'vertical' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;