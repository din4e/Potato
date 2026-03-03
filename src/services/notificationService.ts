import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Email notification configuration
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Feishu notification configuration
interface FeishuConfig {
  webhookUrl: string;
}

interface NotificationConfig {
  enabled: boolean;
  email?: EmailConfig;
  feishu?: FeishuConfig;
  recipients: {
    alerts: string[];  // For urgent alerts
    reports: string[]; // For daily/weekly reports
  };
}

export class NotificationService {
  private config: NotificationConfig;
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.config = {
      enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
      email: process.env.EMAIL_ENABLED === 'true' ? {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || '',
          pass: process.env.EMAIL_PASS || '',
        },
      } : undefined,
      feishu: process.env.FEISHU_WEBHOOK ? {
        webhookUrl: process.env.FEISHU_WEBHOOK,
      } : undefined,
      recipients: {
        alerts: (process.env.ALERT_RECIPIENTS || '').split(',').filter(Boolean),
        reports: (process.env.REPORT_RECIPIENTS || '').split(',').filter(Boolean),
      },
    };

    if (this.config.email) {
      this.initializeEmail();
    }
  }

  private initializeEmail(): void {
    try {
      this.emailTransporter = nodemailer.createTransport({
        host: this.config.email!.host,
        port: this.config.email!.port,
        secure: this.config.email!.secure,
        auth: this.config.email!.auth,
      });
      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  // Send email notification
  async sendEmail(subject: string, html: string, recipients?: string[]): Promise<boolean> {
    if (!this.config.enabled || !this.emailTransporter) {
      logger.debug('Email notification disabled or not configured');
      return false;
    }

    const to = recipients || this.config.recipients.reports;
    if (to.length === 0) {
      logger.warn('No email recipients configured');
      return false;
    }

    try {
      const info = await this.emailTransporter.sendMail({
        from: this.config.email!.auth.user,
        to: to.join(', '),
        subject: subject,
        html: html,
      });

      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  // Send Feishu notification
  async sendFeishu(content: string, msgType: 'text' | 'post' = 'text'): Promise<boolean> {
    if (!this.config.enabled || !this.config.feishu) {
      logger.debug('Feishu notification disabled or not configured');
      return false;
    }

    try {
      const payload =
        msgType === 'text'
          ? {
              msg_type: 'text',
              content: {
                text: content,
              },
            }
          : {
              msg_type: 'post',
              content: {
                post: {
                  zh_cn: {
                    content: [
                      {
                        tag: 'text',
                        text: content,
                      },
                    ],
                  },
                },
              },
            };

      const response = await fetch(this.config.feishu.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        logger.info('Feishu notification sent');
        return true;
      } else {
        logger.error(`Feishu notification failed: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      logger.error('Failed to send Feishu notification:', error);
      return false;
    }
  }

  // Send offline alert
  async sendOfflineAlert(deviceName: string, offlineDuration: number): Promise<void> {
    const subject = `🚨 [土豆培育系统] 设备掉线告警 - ${deviceName}`;
    const duration = this.formatDuration(offlineDuration);

    const html = this.generateEmailTemplate({
      title: '设备掉线告警',
      status: 'critical',
      deviceName,
      message: `设备 <strong>${deviceName}</strong> 已掉线 <strong>${duration}</strong>，请及时检查！`,
      details: [
        { label: '设备名称', value: deviceName },
        { label: '掉线时长', value: duration },
        { label: '告警时间', value: new Date().toLocaleString('zh-CN') },
      ],
      actions: [
        { label: '查看控制面板', url: process.env.FRONTEND_URL || 'http://localhost:3000' },
      ],
    });

    const feishuMsg = `🚨 【设备掉线告警】\n设备：${deviceName}\n掉线时长：${duration}\n请及时检查设备状态！`;

    await Promise.all([
      this.sendEmail(subject, html, this.config.recipients.alerts),
      this.sendFeishu(feishuMsg),
    ]);
  }

  // Send recovery notification
  async sendRecoveryNotice(deviceName: string, offlineDuration: number): Promise<void> {
    const subject = `✅ [土豆培育系统] 设备恢复在线 - ${deviceName}`;
    const duration = this.formatDuration(offlineDuration);

    const html = this.generateEmailTemplate({
      title: '设备恢复在线',
      status: 'success',
      deviceName,
      message: `设备 <strong>${deviceName}</strong> 已恢复连接，离线时长：${duration}`,
      details: [
        { label: '设备名称', value: deviceName },
        { label: '离线时长', value: duration },
        { label: '恢复时间', value: new Date().toLocaleString('zh-CN') },
      ],
    });

    const feishuMsg = `✅ 【设备恢复在线】\n设备：${deviceName}\n离线时长：${duration}\n设备已恢复正常工作`;

    await Promise.all([
      this.sendEmail(subject, html, this.config.recipients.alerts),
      this.sendFeishu(feishuMsg),
    ]);
  }

  // Send threshold alert
  async sendThresholdAlert(
    type: 'high' | 'low',
    sensorType: string,
    currentValue: number,
    threshold: number,
    deviceName: string
  ): Promise<void> {
    const typeText = type === 'high' ? '过高' : '过低';
    const subject = `⚠️ [土豆培育系统] ${sensorType}${typeText}告警 - ${deviceName}`;

    const html = this.generateEmailTemplate({
      title: `${sensorType}${typeText}告警`,
      status: 'warning',
      deviceName,
      message: `${sensorType}数值${typeText}，当前值：<strong>${currentValue}</strong>，阈值：<strong>${threshold}</strong>`,
      details: [
        { label: '设备名称', value: deviceName },
        { label: '传感器类型', value: sensorType },
        { label: '当前值', value: currentValue.toString() },
        { label: '阈值', value: threshold.toString() },
        { label: '告警时间', value: new Date().toLocaleString('zh-CN') },
      ],
      actions: [
        { label: '查看控制面板', url: process.env.FRONTEND_URL || 'http://localhost:3000' },
        { label: '立即浇水', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/control` },
      ],
    });

    const feishuMsg = `⚠️ 【${sensorType}${typeText}告警】\n设备：${deviceName}\n当前值：${currentValue}\n阈值：${threshold}\n请及时处理！`;

    await Promise.all([
      this.sendEmail(subject, html, this.config.recipients.alerts),
      this.sendFeishu(feishuMsg),
    ]);
  }

  // Send daily/weekly cultivation report
  async sendCultivationReport(
    reportData: CultivationReportData,
    period: 'daily' | 'weekly'
  ): Promise<void> {
    const periodText = period === 'daily' ? '日报' : '周报';
    const subject = `📊 [土豆培育系统] 培育状态${periodText} - ${new Date().toLocaleDateString('zh-CN')}`;

    const html = this.generateReportEmail(reportData, period);
    const feishuMsg = this.generateReportFeishu(reportData, period);

    await Promise.all([
      this.sendEmail(subject, html, this.config.recipients.reports),
      this.sendFeishu(feishuMsg, 'post'),
    ]);
  }

  // Generate email template
  private generateEmailTemplate(template: {
    title: string;
    status: 'success' | 'warning' | 'critical' | 'info';
    deviceName: string;
    message: string;
    details: Array<{ label: string; value: string }>;
    actions?: Array<{ label: string; url: string }>;
  }): string {
    const statusColors = {
      success: '#22c55e',
      warning: '#f59e0b',
      critical: '#ef4444',
      info: '#3b82f6',
    };

    const statusIcons = {
      success: '✅',
      warning: '⚠️',
      critical: '🚨',
      info: 'ℹ️',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { border-left: 4px solid ${statusColors[template.status]}; padding: 15px; margin: 20px 0; background: white; border-radius: 8px; }
    .alert-title { font-size: 18px; font-weight: 600; margin-bottom: 10px; color: #111827; }
    .alert-message { color: #6b7280; }
    .details { margin: 20px 0; }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-label { width: 120px; color: #6b7280; }
    .detail-value { flex: 1; font-weight: 500; color: #111827; }
    .actions { margin-top: 20px; }
    .btn { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; margin-right: 10px; }
    .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🥔 土豆培育系统</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">智能监控通知</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <div class="alert-title">${statusIcons[template.status]} ${template.title}</div>
        <div class="alert-message">${template.message}</div>
      </div>
      <div class="details">
        ${template.details.map(d => `
          <div class="detail-row">
            <div class="detail-label">${d.label}</div>
            <div class="detail-value">${d.value}</div>
          </div>
        `).join('')}
      </div>
      ${template.actions ? `
        <div class="actions">
          ${template.actions.map(a => `<a href="${a.url}" class="btn">${a.label}</a>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>此邮件由土豆培育系统自动发送，请勿回复</p>
      <p>${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // Generate report email
  private generateReportEmail(data: CultivationReportData, period: 'daily' | 'weekly'): string {
    const periodText = period === 'daily' ? '今日' : '本周';
    const trendIcon = (value: number, threshold: { min: number; max: number }) => {
      if (value < threshold.min) return '📉';
      if (value > threshold.max) return '📈';
      return '➡️';
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background: #f3f4f6; }
    .container { max-width: 700px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px; text-align: center; color: white; border-radius: 0 0 20px 20px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { padding: 30px; }
    .card { background: white; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #111827; display: flex; align-items: center; gap: 10px; }
    .sensor-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .sensor-item { padding: 15px; border-radius: 10px; text-align: center; }
    .sensor-item.good { background: #f0fdf4; }
    .sensor-item.warning { background: #fefce8; }
    .sensor-item.danger { background: #fef2f2; }
    .sensor-value { font-size: 32px; font-weight: 700; margin: 10px 0; }
    .sensor-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .stats-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
    .stats-label { color: #6b7280; }
    .stats-value { font-weight: 600; }
    .irrigation-list { list-style: none; padding: 0; margin: 0; }
    .irrigation-item { padding: 12px; border-radius: 8px; margin-bottom: 10px; background: #f9fafb; display: flex; justify-content: space-between; align-items: center; }
    .irrigation-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; }
    .irrigation-badge.manual { background: #dbeafe; color: #1d4ed8; }
    .irrigation-badge.auto { background: #dcfce7; color: #16a34a; }
    .irrigation-badge.schedule { background: #fef3c7; color: #d97706; }
    .footer { text-align: center; padding: 30px; color: #6b7280; font-size: 12px; }
    .btn { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🥔 培育状态${period === 'daily' ? '日报' : '周报'}</h1>
      <p>${data.reportPeriod} | 设备: ${data.deviceName}</p>
    </div>
    <div class="content">
      <!-- 当前状态 -->
      <div class="card">
        <div class="card-title">📊 当前环境状态</div>
        <div class="sensor-grid">
          <div class="sensor-item ${this.getStatusClass(data.current.soilMoisture, 30, 80)}">
            <div class="sensor-label">💧 土壤湿度</div>
            <div class="sensor-value">${data.current.soilMoisture.toFixed(1)}%</div>
            <div>${trendIcon(data.current.soilMoisture, { min: 30, max: 80 })} ${data.current.soilMoisture < 30 ? '偏干' : data.current.soilMoisture > 80 ? '偏湿' : '适宜'}</div>
          </div>
          <div class="sensor-item ${this.getStatusClass(data.current.temperature, 15, 35)}">
            <div class="sensor-label">🌡️ 温度</div>
            <div class="sensor-value">${data.current.temperature.toFixed(1)}°C</div>
            <div>${trendIcon(data.current.temperature, { min: 15, max: 35 })} ${data.current.temperature < 15 ? '偏低' : data.current.temperature > 35 ? '偏高' : '适宜'}</div>
          </div>
          <div class="sensor-item ${this.getStatusClass(data.current.humidity, 40, 85)}">
            <div class="sensor-label">💨 空气湿度</div>
            <div class="sensor-value">${data.current.humidity.toFixed(1)}%</div>
            <div>${trendIcon(data.current.humidity, { min: 40, max: 85 })} ${data.current.humidity < 40 ? '偏干' : data.current.humidity > 85 ? '偏湿' : '适宜'}</div>
          </div>
          <div class="sensor-item good">
            <div class="sensor-label">🟢 设备状态</div>
            <div class="sensor-value" style="font-size: 20px;">在线</div>
            <div>最后更新: ${new Date(data.current.timestamp).toLocaleTimeString('zh-CN')}</div>
          </div>
        </div>
      </div>

      <!-- 统计数据 -->
      <div class="card">
        <div class="card-title">📈 ${periodText}统计数据</div>
        <div class="stats-row">
          <span class="stats-label">平均土壤湿度</span>
          <span class="stats-value">${data.stats.avgSoilMoisture.toFixed(1)}%</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">平均温度</span>
          <span class="stats-value">${data.stats.avgTemperature.toFixed(1)}°C</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">平均湿度</span>
          <span class="stats-value">${data.stats.avgHumidity.toFixed(1)}%</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">温度范围</span>
          <span class="stats-value">${data.stats.minTemperature.toFixed(1)}°C ~ ${data.stats.maxTemperature.toFixed(1)}°C</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">湿度范围</span>
          <span class="stats-value">${data.stats.minHumidity.toFixed(1)}% ~ ${data.stats.maxHumidity.toFixed(1)}%</span>
        </div>
      </div>

      <!-- 浇水记录 -->
      <div class="card">
        <div class="card-title">💧 ${periodText}浇水记录</div>
        <ul class="irrigation-list">
          ${data.irrigations.length > 0 ? data.irrigations.map(irr => `
            <li class="irrigation-item">
              <div>
                <strong>${irr.reason === 'manual' ? '手动' : irr.reason === 'auto' ? '自动' : '定时'}浇水</strong>
                <div style="font-size: 12px; color: #6b7280;">${new Date(irr.timestamp).toLocaleString('zh-CN')}</div>
              </div>
              <div style="text-align: right;">
                <span class="irrigation-badge ${irr.reason}">${irr.duration / 1000}秒</span>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">湿度: ${irr.soilMoistureBefore.toFixed(1)}% → ${irr.soilMoistureAfter?.toFixed(1) || '?'}%</div>
              </div>
            </li>
          `).join('') : '<li style="text-align: center; color: #6b7280;">暂无浇水记录</li>'}
        </ul>
      </div>

      <!-- 建议 -->
      ${data.suggestions?.length ? `
      <div class="card">
        <div class="card-title">💡 培育建议</div>
        <ul style="margin: 0; padding-left: 20px;">
          ${data.suggestions.map(s => `<li style="margin-bottom: 10px;">${s}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 20px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">查看控制面板</a>
      </div>
    </div>
    <div class="footer">
      <p>此邮件由土豆培育系统自动发送 | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getStatusClass(value: number, min: number, max: number): string {
    if (value < min || value > max) return 'danger';
    if (value < min * 1.2 || value > max * 0.8) return 'warning';
    return 'good';
  }

  private generateReportFeishu(data: CultivationReportData, period: 'daily' | 'weekly'): string {
    const periodText = period === 'daily' ? '今日' : '本周';

    return `📊 【土豆培育${period === 'daily' ? '日报' : '周报'}】

📅 ${data.reportPeriod}
📍 设备: ${data.deviceName}

━━━━━━━━━━━━━━━━
📊 当前状态
━━━━━━━━━━━━━━━━
💧 土壤湿度: ${data.current.soilMoisture.toFixed(1)}%
🌡️ 温度: ${data.current.temperature.toFixed(1)}°C
💨 空气湿度: ${data.current.humidity.toFixed(1)}%

━━━━━━━━━━━━━━━━
📈 ${periodText}统计
━━━━━━━━━━━━━━━━
平均土壤湿度: ${data.stats.avgSoilMoisture.toFixed(1)}%
平均温度: ${data.stats.avgTemperature.toFixed(1)}°C
平均湿度: ${data.stats.avgHumidity.toFixed(1)}%
温度范围: ${data.stats.minTemperature.toFixed(1)}~${data.stats.maxTemperature.toFixed(1)}°C

━━━━━━━━━━━━━━━━
💧 浇水记录 (${data.irrigations.length}次)
━━━━━━━━━━━━━━━━
${data.irrigations.map(irr => `• ${irr.reason === 'manual' ? '手动' : irr.reason === 'auto' ? '自动' : '定时'} ${irr.duration / 1000}秒 (${new Date(irr.timestamp).toLocaleTimeString('zh-CN')})`).join('\n')}

${data.suggestions?.length ? `
━━━━━━━━━━━━━━━━
💡 培育建议
━━━━━━━━━━━━━━━━
${data.suggestions.map(s => `• ${s}`).join('\n')}
` : ''}

查看详情: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟`;
    return `${seconds}秒`;
  }

  // Test notification
  async testNotification(): Promise<boolean> {
    const subject = '🧪 [土豆培育系统] 测试通知';
    const html = this.generateEmailTemplate({
      title: '测试通知',
      status: 'info',
      deviceName: '测试设备',
      message: '这是一条测试通知，用于验证邮件和飞书通知是否正常工作。',
      details: [
        { label: '测试时间', value: new Date().toLocaleString('zh-CN') },
        { label: '通知类型', value: '测试' },
      ],
    });

    const feishuMsg = '🧪 【测试通知】这是一条测试消息';

    const results = await Promise.all([
      this.sendEmail(subject, html, this.config.recipients.alerts.length ? this.config.recipients.alerts : undefined),
      this.sendFeishu(feishuMsg),
    ]);

    return results.some(r => r);
  }
}

export interface CultivationReportData {
  reportPeriod: string;
  deviceName: string;
  current: {
    soilMoisture: number;
    temperature: number;
    humidity: number;
    timestamp: number;
  };
  stats: {
    avgSoilMoisture: number;
    avgTemperature: number;
    avgHumidity: number;
    minTemperature: number;
    maxTemperature: number;
    minHumidity: number;
    maxHumidity: number;
  };
  irrigations: Array<{
    timestamp: number;
    duration: number;
    reason: 'manual' | 'auto' | 'schedule';
    soilMoistureBefore: number;
    soilMoistureAfter?: number;
  }>;
  suggestions?: string[];
}

export const notificationService = new NotificationService();
