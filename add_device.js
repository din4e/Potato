import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'potato_system'
});

await conn.execute(`
  INSERT INTO devices (device_id, name, location, pump_active, fan_active, online, last_seen)
  VALUES ('potato-chamber-01', '土豆培育箱01', '客厅', 0, 0, 1, NOW())
  ON DUPLICATE KEY UPDATE name='土豆培育箱01', online=1, last_seen=NOW()
`);

console.log('Device added successfully');
await conn.end();
