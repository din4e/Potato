// API Configuration
const API_BASE = window.location.origin + '/api';
let currentDevice = 'potato-chamber-01';
let sensorChart = null;
let currentChartType = 'soil_moisture';

// DOM Elements
const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    statusText: document.getElementById('statusText'),
    currentTime: document.getElementById('currentTime'),
    deviceSelect: document.getElementById('deviceSelect'),
    soilMoisture1: document.getElementById('soilMoisture1'),
    soilMoisture2: document.getElementById('soilMoisture2'),
    temperature: document.getElementById('temperature'),
    humidity: document.getElementById('humidity'),
    soilMoisture1Bar: document.getElementById('soilMoisture1Bar'),
    soilMoisture2Bar: document.getElementById('soilMoisture2Bar'),
    pumpStatus: document.getElementById('pumpStatus'),
    fanStatus: document.getElementById('fanStatus'),
    cameraStream: document.getElementById('cameraStream'),
    irrigationLog: document.getElementById('irrigationLog'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    setupEventListeners();
    updateConnectionStatus();
    fetchSensorData();
    fetchDeviceStatus();
    fetchIrrigationLogs();

    // Auto-refresh every 5 seconds
    setInterval(() => {
        fetchSensorData();
        fetchDeviceStatus();
    }, 5000);

    // Update time
    updateTime();
    setInterval(updateTime, 1000);

    // Update chart every 30 seconds
    setInterval(fetchChartData, 30000);
});

// Event Listeners
function setupEventListeners() {
    // Device selection
    elements.deviceSelect.addEventListener('change', (e) => {
        currentDevice = e.target.value;
        fetchSensorData();
        fetchDeviceStatus();
        fetchIrrigationLogs();
    });

    // Pump controls
    document.getElementById('pumpOn').addEventListener('click', () => controlDevice('pump', 'on'));
    document.getElementById('pumpOff').addEventListener('click', () => controlDevice('pump', 'off'));

    // Fan controls
    document.getElementById('fanOn').addEventListener('click', () => controlDevice('fan', 'on'));
    document.getElementById('fanOff').addEventListener('click', () => controlDevice('fan', 'off'));

    // Manual irrigation
    document.getElementById('manualIrrigation').addEventListener('click', manualIrrigation);

    // Camera refresh
    document.getElementById('refreshCamera').addEventListener('click', refreshCamera);

    // Chart tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentChartType = e.target.dataset.type;
            fetchChartData();
        });
    });

    // Device refresh
    document.getElementById('refreshDevice').addEventListener('click', fetchDevices);
}

// Fetch sensor data
async function fetchSensorData() {
    try {
        const response = await fetch(`${API_BASE}/sensor/${currentDevice}/current`);
        const result = await response.json();

        if (result.success && result.data) {
            updateSensorDisplay(result.data);
        }
    } catch (error) {
        console.error('Error fetching sensor data:', error);
    }
}

// Update sensor display
function updateSensorDisplay(data) {
    elements.soilMoisture1.textContent = data.soilMoisture1?.toFixed(1) || '--';
    elements.soilMoisture2.textContent = data.soilMoisture2?.toFixed(1) || '--';
    elements.temperature.textContent = data.temperature?.toFixed(1) || '--';
    elements.humidity.textContent = data.humidity?.toFixed(1) || '--';

    // Update bars
    elements.soilMoisture1Bar.style.width = `${data.soilMoisture1 || 0}%`;
    elements.soilMoisture2Bar.style.width = `${data.soilMoisture2 || 0}%`;

    // Update temperature status
    const tempStatus = document.getElementById('tempStatus');
    if (data.temperature > 35) {
        tempStatus.innerHTML = '<span class="status-dot danger"></span><span>过高</span>';
    } else if (data.temperature < 15) {
        tempStatus.innerHTML = '<span class="status-dot warning"></span><span>过低</span>';
    } else {
        tempStatus.innerHTML = '<span class="status-dot"></span><span>正常</span>';
    }

    // Update humidity status
    const humidityStatus = document.getElementById('humidityStatus');
    if (data.humidity < 40 || data.humidity > 85) {
        humidityStatus.innerHTML = '<span class="status-dot warning"></span><span>异常</span>';
    } else {
        humidityStatus.innerHTML = '<span class="status-dot"></span><span>正常</span>';
    }
}

// Fetch device status
async function fetchDeviceStatus() {
    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/status`);
        const result = await response.json();

        if (result.success && result.data) {
            updateControlStatus(result.data);
        }
    } catch (error) {
        console.error('Error fetching device status:', error);
    }
}

// Update control status display
function updateControlStatus(status) {
    // Pump status
    const pumpIndicator = elements.pumpStatus.querySelector('.status-indicator');
    const pumpText = elements.pumpStatus.querySelector('span:last-child');
    if (status.pumpActive) {
        pumpIndicator.classList.add('active');
        pumpText.textContent = '运行中';
    } else {
        pumpIndicator.classList.remove('active');
        pumpText.textContent = '已关闭';
    }

    // Fan status
    const fanIndicator = elements.fanStatus.querySelector('.status-indicator');
    const fanText = elements.fanStatus.querySelector('span:last-child');
    if (status.fanActive) {
        fanIndicator.classList.add('active');
        fanText.textContent = '运行中';
    } else {
        fanIndicator.classList.remove('active');
        fanText.textContent = '已关闭';
    }
}

// Control device
async function controlDevice(device, action) {
    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/${device}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`${device === 'pump' ? '水泵' : '风扇'}${action === 'on' ? '开启' : '关闭'}成功`, 'success');
            // Refresh status after a short delay
            setTimeout(fetchDeviceStatus, 500);
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (error) {
        console.error('Error controlling device:', error);
        showToast('网络错误', 'error');
    }
}

// Manual irrigation
async function manualIrrigation() {
    const duration = parseInt(document.getElementById('irrigationDuration').value);

    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/pump`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'on', duration })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`开始浇水，持续 ${duration / 1000} 秒`, 'success');
            setTimeout(fetchDeviceStatus, 500);
            setTimeout(fetchIrrigationLogs, 1000);
        } else {
            showToast(result.error || '浇水失败', 'error');
        }
    } catch (error) {
        console.error('Error starting irrigation:', error);
        showToast('网络错误', 'error');
    }
}

// Fetch irrigation logs
async function fetchIrrigationLogs() {
    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/logs?limit=10`);
        const result = await response.json();

        if (result.success && result.data) {
            updateIrrigationLog(result.data);
        }
    } catch (error) {
        console.error('Error fetching irrigation logs:', error);
    }
}

// Update irrigation log display
function updateIrrigationLog(logs) {
    if (!logs || logs.length === 0) {
        elements.irrigationLog.innerHTML = '<div class="log-item"><span class="log-time">--:--</span><span class="log-action">暂无记录</span></div>';
        return;
    }

    elements.irrigationLog.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const reasonText = {
            'manual': '手动',
            'auto': '自动',
            'schedule': '定时'
        }[log.triggerReason] || log.triggerReason;

        return `
            <div class="log-item">
                <span class="log-time">${time}</span>
                <span class="log-action">${(log.duration / 1000).toFixed(0)}秒</span>
                <span class="log-reason ${log.triggerReason}">${reasonText}</span>
            </div>
        `;
    }).join('');
}

// Fetch chart data
async function fetchChartData() {
    try {
        const response = await fetch(`${API_BASE}/sensor/${currentDevice}/history?hours=24`);
        const result = await response.json();

        if (result.success && result.data) {
            updateChart(result.data);
        }
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

// Initialize Chart
function initChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');

    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '土壤湿度 1',
                data: [],
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: '土壤湿度 2',
                data: [],
                borderColor: '#8BC34A',
                backgroundColor: 'rgba(139, 195, 74, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#e0e0e0' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9e9e9e' },
                    grid: { color: '#2d3748' }
                },
                y: {
                    ticks: { color: '#9e9e9e' },
                    grid: { color: '#2d3748' }
                }
            }
        }
    });

    fetchChartData();
}

// Update chart
function updateChart(data) {
    // Group data by sensor type
    const sensor1Data = [];
    const sensor2Data = [];
    const tempData = [];
    const humidityData = [];
    const labels = [];

    // Get unique timestamps
    const timestamps = [...new Set(data.map(d => {
        const date = new Date(d.timestamp);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }))];

    // Filter and sort data
    const sortedData = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Extract values for each sensor type
    for (const item of sortedData) {
        const date = new Date(item.timestamp);
        const timeLabel = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        if (item.sensorType === 'soil_moisture_1') {
            sensor1Data.push({ time: timeLabel, value: item.value });
        } else if (item.sensorType === 'soil_moisture_2') {
            sensor2Data.push({ time: timeLabel, value: item.value });
        } else if (item.sensorType === 'temperature') {
            tempData.push({ time: timeLabel, value: item.value });
        } else if (item.sensorType === 'humidity') {
            humidityData.push({ time: timeLabel, value: item.value });
        }
    }

    // Update chart based on current type
    if (currentChartType === 'soil_moisture') {
        sensorChart.data.labels = sensor1Data.map(d => d.time);
        sensorChart.data.datasets[0].data = sensor1Data.map(d => d.value);
        sensorChart.data.datasets[1].data = sensor2Data.map(d => d.value);
        sensorChart.data.datasets[0].label = '土壤湿度 1';
        sensorChart.data.datasets[1].label = '土壤湿度 2';
    } else if (currentChartType === 'temperature') {
        sensorChart.data.labels = tempData.map(d => d.time);
        sensorChart.data.datasets[0].data = tempData.map(d => d.value);
        sensorChart.data.datasets[1].data = [];
        sensorChart.data.datasets[0].label = '温度 (°C)';
        sensorChart.data.datasets[0].borderColor = '#FF5722';
        sensorChart.data.datasets[0].backgroundColor = 'rgba(255, 87, 34, 0.1)';
    } else if (currentChartType === 'humidity') {
        sensorChart.data.labels = humidityData.map(d => d.time);
        sensorChart.data.datasets[0].data = humidityData.map(d => d.value);
        sensorChart.data.datasets[1].data = [];
        sensorChart.data.datasets[0].label = '空气湿度 (%)';
        sensorChart.data.datasets[0].borderColor = '#00BCD4';
        sensorChart.data.datasets[0].backgroundColor = 'rgba(0, 188, 212, 0.1)';
    }

    sensorChart.update();
}

// Fetch all devices
async function fetchDevices() {
    try {
        const response = await fetch(`${API_BASE}/control/devices`);
        const result = await response.json();

        if (result.success && result.data) {
            elements.deviceSelect.innerHTML = result.data.map(device =>
                `<option value="${device.deviceId}">${device.name || device.deviceId}</option>`
            ).join('');
            currentDevice = result.data[0]?.deviceId || currentDevice;
        }
    } catch (error) {
        console.error('Error fetching devices:', error);
    }
}

// Refresh camera
function refreshCamera() {
    const cameraUrl = document.getElementById('cameraStream').src;
    if (cameraUrl) {
        document.getElementById('cameraStream').src = cameraUrl + '?t=' + Date.now();
    }
}

// Update connection status
async function updateConnectionStatus() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const result = await response.json();

        if (result.success) {
            elements.connectionStatus.classList.remove('disconnected');
            elements.connectionStatus.classList.add('connected');
            elements.statusText.textContent = '已连接';
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        elements.connectionStatus.classList.add('disconnected');
        elements.connectionStatus.classList.remove('connected');
        elements.statusText.textContent = '断开连接';
    }
}

// Update time
function updateTime() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString('zh-CN');
}

// Show toast notification
function showToast(message, type = 'info') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast ${type} active`;

    setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3000);
}
