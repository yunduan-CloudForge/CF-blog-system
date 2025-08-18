/**
 * 饼图组件
 * 用于显示数据分布和占比
 */

import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieLabelRenderProps
} from 'recharts';

interface PieData {
  name: string;
  value: number;
  count?: number;
  [key: string]: unknown;
}

interface PieChartProps {
  data: PieData[];
  title?: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  dataKey?: string;
  nameKey?: string;
  innerRadius?: number;
  outerRadius?: number;
  formatLabel?: (props: PieLabelRenderProps) => string;
  formatTooltip?: (value: unknown, name: string) => [React.ReactNode, string];
}

const defaultColors = [
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
];

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  colors = defaultColors,
  height = 300,
  showLegend = true,
  showLabels = true,
  dataKey = 'value',
  nameKey = 'name',
  innerRadius = 0,
  outerRadius = 80,
  formatLabel,
  formatTooltip
}) => {
  const defaultFormatLabel = (props: PieLabelRenderProps) => {
    const total = data.reduce((sum, item) => sum + (Number(item[dataKey]) || 0), 0);
    const percent = total > 0 ? ((Number(props.value) / total) * 100).toFixed(0) : 0;
    const name = props.name || props[nameKey] || '';
    return `${name} ${percent}%`;
  };

  const defaultFormatTooltip = (value: unknown, name: string) => {
    return [String(value), name];
  };

  // 处理数据，确保有正确的数据结构
  const processedData = data.map(item => ({
    ...item,
    [dataKey]: item[dataKey] || item.count || item.value || 0
  }));

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabels ? (formatLabel || defaultFormatLabel) : undefined}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {processedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors[index % colors.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={formatTooltip || defaultFormatTooltip}
          />
          {showLegend && (
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="circle"
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChart;