import { logger } from './logger';
import { sendAlertEmail } from './emailService';

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  duration: number; // 持续时间（秒）
  enabled: boolean;
  lastTriggered?: Date;
  cooldown: number; // 冷却时间（秒）
}

interface AlertMetric {
  name: string;
  value: number;
  timestamp: Date;
}

class AlertSystem {
  private rules: AlertRule[] = [];
  private metrics: Map<string, AlertMetric[]> = new Map();
  private activeAlerts: Set<string> = new Set();

  constructor() {
    this.initializeDefaultRules();
    this.startMetricCollection();
  }

  private initializeDefaultRules() {
    this.rules = [
      {
        id: 'error-rate-high',
        name: '错误率过高',
        metric: 'error_rate',
        threshold: 5, // 5%
        operator: 'gt',
        duration: 300, // 5分钟
        enabled: true,
        cooldown: 1800 // 30分钟冷却
      },
      {
        id: 'response-time-slow',
        name: 'API响应时间过慢',
        metric: 'avg_response_time',
        threshold: 2000, // 2秒
        operator: 'gt',
        duration: 180, // 3分钟
        enabled: true,
        cooldown: 900 // 15分钟冷却
      },
      {
        id: 'memory-usage-high',
        name: '内存使用率过高',
        metric: 'memory_usage',
        threshold: 85, // 85%
        operator: 'gt',
        duration: 600, // 10分钟
        enabled: true,
        cooldown: 1800 // 30分钟冷却
      },
      {
        id: 'cpu-usage-high',
        name: 'CPU使用率过高',
        metric: 'cpu_usage',
        threshold: 80, // 80%
        operator: 'gt',
        duration: 300, // 5分钟
        enabled: true,
        cooldown: 900 // 15分钟冷却
      }
    ];
  }

  private startMetricCollection() {
    // 每分钟收集一次指标
    setInterval(() => {
      this.collectMetrics();
      this.evaluateRules();
    }, 60000);
  }

  private async collectMetrics() {
    try {
      // 收集错误率
      const errorRate = await this.calculateErrorRate();
      this.addMetric('error_rate', errorRate);

      // 收集平均响应时间
      const avgResponseTime = await this.calculateAvgResponseTime();
      this.addMetric('avg_response_time', avgResponseTime);

      // 收集系统资源使用率
      const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100;
      this.addMetric('memory_usage', memoryUsage);

      // 模拟CPU使用率（实际项目中应使用系统监控库）
      const cpuUsage = Math.random() * 100;
      this.addMetric('cpu_usage', cpuUsage);

    } catch (error) {
      logger.error('收集指标时发生错误:', error);
    }
  }

  private addMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name)!;
    metrics.push({
      name,
      value,
      timestamp: new Date()
    });

    // 只保留最近1小时的数据
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.metrics.set(name, metrics.filter(m => m.timestamp > oneHourAgo));
  }

  private async calculateErrorRate(): Promise<number> {
    // 这里应该从日志或数据库中计算实际的错误率
    // 暂时返回模拟数据
    return Math.random() * 10;
  }

  private async calculateAvgResponseTime(): Promise<number> {
    // 这里应该从性能监控数据中计算平均响应时间
    // 暂时返回模拟数据
    return 500 + Math.random() * 2000;
  }

  private evaluateRules() {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const metrics = this.metrics.get(rule.metric);
      if (!metrics || metrics.length === 0) continue;

      // 检查是否在冷却期内
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = (Date.now() - rule.lastTriggered.getTime()) / 1000;
        if (timeSinceLastTrigger < rule.cooldown) {
          continue;
        }
      }

      // 获取指定时间范围内的指标
      const durationAgo = new Date(Date.now() - rule.duration * 1000);
      const recentMetrics = metrics.filter(m => m.timestamp > durationAgo);

      if (recentMetrics.length === 0) continue;

      // 计算平均值
      const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;

      // 检查是否触发告警
      let shouldAlert = false;
      switch (rule.operator) {
        case 'gt':
          shouldAlert = avgValue > rule.threshold;
          break;
        case 'lt':
          shouldAlert = avgValue < rule.threshold;
          break;
        case 'eq':
          shouldAlert = Math.abs(avgValue - rule.threshold) < 0.01;
          break;
      }

      if (shouldAlert && !this.activeAlerts.has(rule.id)) {
        this.triggerAlert(rule, avgValue);
      } else if (!shouldAlert && this.activeAlerts.has(rule.id)) {
        this.resolveAlert(rule);
      }
    }
  }

  private async triggerAlert(rule: AlertRule, currentValue: number) {
    this.activeAlerts.add(rule.id);
    rule.lastTriggered = new Date();

    const alertMessage = {
      id: rule.id,
      name: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue,
      timestamp: new Date(),
      severity: this.getSeverity(rule.metric, currentValue)
    };

    logger.warn('告警触发:', alertMessage);

    // 发送邮件通知（如果配置了邮件服务）
    try {
      await sendAlertEmail(alertMessage);
    } catch (error) {
      logger.error('发送告警通知失败:', error);
    }
  }

  private resolveAlert(rule: AlertRule) {
    this.activeAlerts.delete(rule.id);
    logger.info(`告警已解除: ${rule.name}`);
  }

  private getSeverity(metric: string, value: number): 'low' | 'medium' | 'high' | 'critical' {
    switch (metric) {
      case 'error_rate':
        if (value > 10) return 'critical';
        if (value > 5) return 'high';
        return 'medium';
      case 'avg_response_time':
        if (value > 5000) return 'critical';
        if (value > 3000) return 'high';
        return 'medium';
      case 'memory_usage':
      case 'cpu_usage':
        if (value > 95) return 'critical';
        if (value > 85) return 'high';
        return 'medium';
      default:
        return 'medium';
    }
  }



  // 公共方法
  public getActiveAlerts() {
    return Array.from(this.activeAlerts);
  }

  public getMetrics(metricName?: string) {
    if (metricName) {
      return this.metrics.get(metricName) || [];
    }
    return Object.fromEntries(this.metrics);
  }

  public getRules() {
    return this.rules;
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      logger.info(`告警规则已更新: ${ruleId}`);
    }
  }
}

// 单例模式
export const alertSystem = new AlertSystem();
export { AlertRule, AlertMetric };