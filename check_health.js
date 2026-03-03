import { deviceModel } from './src/models/index.js';
import { healthMonitoringService } from './src/services/healthMonitoringService.js';

const devices = await deviceModel.getAll();
console.log('Devices:', devices.length);

for (const device of devices) {
  console.log('Checking device:', device.deviceId);
  await healthMonitoringService.checkDeviceHealth(
    device.deviceId,
    device.online,
    device.lastSeen
  );
}

const status = healthMonitoringService.getHealthStatus();
console.log('Health status:', Object.fromEntries(status));
