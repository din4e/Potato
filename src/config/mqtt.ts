import mqtt, { MqttClient } from 'mqtt';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { CurrentSensorData } from '../types/index.js';

export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private brokerUrl: string;
  private options: mqtt.IClientOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private demoMode = false;

  constructor() {
    super();
    this.brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    this.options = {
      clientId: `potato-server-${Date.now()}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 5000,
      ...(process.env.MQTT_USER && {
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASSWORD,
      }),
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if running in demo mode (MQTT_BROKER not set)
      if (!process.env.MQTT_BROKER || process.env.MQTT_BROKER === 'mqtt://localhost:1883') {
        logger.warn('MQTT broker not configured, running in DEMO mode');
        logger.info('To connect ESP32, set MQTT_BROKER in .env to your broker address');
        this.demoMode = true;
        resolve();
        return;
      }

      this.client = mqtt.connect(this.brokerUrl, this.options);

      this.client.on('connect', () => {
        logger.info('MQTT connected to broker:', this.brokerUrl);
        this.reconnectAttempts = 0;
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('error', (err) => {
        logger.error('MQTT connection error:', err.message);
        this.demoMode = true;
        logger.warn('MQTT unavailable, running in DEMO mode');
        resolve(); // Resolve anyway to allow server to start
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        logger.info(`MQTT reconnecting... Attempt ${this.reconnectAttempts}`);
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          this.client?.end();
          reject(new Error('Max reconnect attempts reached'));
        }
      });

      this.client.on('offline', () => {
        logger.warn('MQTT client offline');
      });

      // Timeout after 5 seconds - allow server to start in demo mode
      setTimeout(() => {
        if (!this.client?.connected) {
          logger.warn('MQTT connection timeout, running in DEMO mode');
          this.demoMode = true;
          resolve();
        }
      }, 5000);
    });
  }

  private subscribeToTopics(): void {
    if (this.demoMode || !this.client) return;

    const topics = [
      'potato/sensor',
      'potato/status',
      'potato/response',
      'potato/+/status',
    ];

    topics.forEach((topic) => {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err.message);
        } else {
          logger.debug(`Subscribed to ${topic}`);
        }
      });
    });
  }

  private handleMessage(topic: string, message: Buffer): void {
    try {
      const payload = message.toString();
      logger.debug(`Received MQTT message [${topic}]:`, payload);

      const data = JSON.parse(payload);

      switch (topic) {
        case 'potato/sensor':
          this.emit('sensorData', data as CurrentSensorData);
          break;
        case 'potato/status':
          this.emit('deviceStatus', data);
          break;
        case 'potato/response':
          this.emit('deviceResponse', data);
          break;
        default:
          if (topic.match(/potato\/.+\/status/)) {
            this.emit('deviceStatus', data);
          }
      }
    } catch (err) {
      logger.error('Error parsing MQTT message:', err);
    }
  }

  publishControl(deviceId: string, device: string, action: string, duration?: number): void {
    if (this.demoMode) {
      logger.info(`[DEMO] Control command: ${device} -> ${action} (duration: ${duration}ms)`);
      logger.info('Connect an MQTT broker to send actual commands to ESP32');
      return;
    }

    const topic = 'potato/control';
    const payload = JSON.stringify({
      device,
      action,
      duration,
      timestamp: Date.now(),
    });

    this.client?.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`Failed to publish control command:`, err.message);
      } else {
        logger.info(`Control command sent: ${device} -> ${action}`);
      }
    });
  }

  publishConfig(deviceId: string, config: Record<string, any>): void {
    if (this.demoMode) {
      logger.info(`[DEMO] Config for ${deviceId}:`, config);
      return;
    }

    const topic = `potato/${deviceId}/config`;
    const payload = JSON.stringify(config);

    this.client?.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`Failed to publish config:`, err.message);
      }
    });
  }

  disconnect(): void {
    this.client?.end();
    this.client = null;
    logger.info('MQTT disconnected');
  }

  isConnected(): boolean {
    return this.demoMode || (this.client?.connected || false);
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }
}

export const mqttService = new MQTTService();
