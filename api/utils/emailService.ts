import nodemailer from 'nodemailer';
import { logger, LogLevel, LogType } from './logger.js';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    // 从环境变量读取邮件配置
    const emailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
      }
    };

    // 只有在配置了邮件服务时才初始化
    if (emailConfig.auth.user && emailConfig.auth.pass) {
      this.config = emailConfig;
      this.createTransporter();
    } else {
      logger.log(LogLevel.WARN, LogType.OPERATION, '邮件服务未配置，告警通知将只记录到日志');
    }
  }

  private createTransporter() {
    if (!this.config) return;

    try {
      this.transporter = nodemailer.createTransporter({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        tls: {
          rejectUnauthorized: false
        }
      });

      logger.info('邮件服务已初始化');
    } catch (error) {
      logger.error('邮件服务初始化失败:', error);
    }
  }

  public async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('邮件服务未配置，无法发送邮件');
      return false;
    }

    try {
      const mailOptions = {
        from: this.config?.auth.user,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('邮件发送成功:', { messageId: result.messageId, to: options.to });
      return true;
    } catch (error) {
      logger.error('邮件发送失败:', error);
      return false;
    }
  }

  public async sendAlertEmail(alert: any): Promise<boolean> {
    const recipients = process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || ['admin@example.com'];
    
    const subject = `[${alert.severity.toUpperCase()}] ${alert.name}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">系统告警</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">${alert.name}</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background-color: #f5f5f5; font-weight: bold;">指标名称</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${alert.metric}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background-color: #f5f5f5; font-weight: bold;">阈值</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${alert.threshold}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background-color: #f5f5f5; font-weight: bold;">当前值</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: ${this.getSeverityColor(alert.severity)};">
                <strong>${alert.currentValue.toFixed(2)}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background-color: #f5f5f5; font-weight: bold;">严重程度</td>
              <td style="padding: 10px; border: 1px solid #ddd;">
                <span style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 4px 8px; border-radius: 4px;">
                  ${alert.severity.toUpperCase()}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background-color: #f5f5f5; font-weight: bold;">触发时间</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${alert.timestamp.toLocaleString()}</td>
            </tr>
          </table>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
            <strong>建议操作：</strong>
            <ul style="margin: 10px 0;">
              ${this.getRecommendations(alert.metric).map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <div style="padding: 15px; background-color: #e9ecef; text-align: center; font-size: 12px; color: #6c757d;">
          此邮件由博客系统监控服务自动发送，请勿回复。
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipients,
      subject,
      html
    });
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  private getRecommendations(metric: string): string[] {
    switch (metric) {
      case 'error_rate':
        return [
          '检查应用程序日志以识别错误模式',
          '验证数据库连接和第三方服务状态',
          '检查最近的代码部署是否引入了问题'
        ];
      case 'avg_response_time':
        return [
          '检查数据库查询性能',
          '分析慢查询日志',
          '考虑增加缓存或优化算法',
          '检查服务器资源使用情况'
        ];
      case 'memory_usage':
        return [
          '检查是否存在内存泄漏',
          '分析应用程序内存使用模式',
          '考虑重启应用程序释放内存',
          '检查是否需要增加服务器内存'
        ];
      case 'cpu_usage':
        return [
          '检查是否有高CPU消耗的进程',
          '分析应用程序性能瓶颈',
          '考虑优化算法或增加服务器资源',
          '检查是否有异常的循环或递归'
        ];
      default:
        return ['请检查系统状态并采取适当的措施'];
    }
  }

  public async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('邮件服务连接测试成功');
      return true;
    } catch (error) {
      logger.error('邮件服务连接测试失败:', error);
      return false;
    }
  }
}

// 导出单例
export const emailService = new EmailService();
export { EmailOptions };

// 便捷函数
export const sendEmail = (options: EmailOptions) => emailService.sendEmail(options);
export const sendAlertEmail = (alert: any) => emailService.sendAlertEmail(alert);