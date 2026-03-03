// API Configuration
const API_BASE = window.location.origin + '/api';
let currentDevice = 'potato-chamber-01';
let sensorChart = null;
let currentChartType = 'soil_moisture';
let updateInterval = null;

// Demo mode data generator
const demoMode = true;

// Initialize demo data for display
const demoSensorData = {
    soilMoisture1: 45,
    soilMoisture2: 42,
    temperature: 24,
    humidity: 65
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    lucide.createIcons();

    // Store original dashboard content before any modifications
    originalDashboardContent = document.getElementById('mainContent').innerHTML;

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1000);

    // Setup event listeners
    setupEventListeners();

    // Initialize chart
    initChart();

    // Fetch initial data
    fetchAllData();

    // Auto-refresh every 5 seconds
    updateInterval = setInterval(fetchAllData, 5000);

    // Update time
    updateTime();
    setInterval(updateTime, 1000);

    // Generate demo data if in demo mode
    if (demoMode) {
        startDemoMode();
    }
});

// Setup Event Listeners
function setupEventListeners() {
    // Device selection
    document.getElementById('deviceSelect').addEventListener('change', (e) => {
        currentDevice = e.target.value;
        fetchAllData();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchAllData();
        showToast('刷新成功', '数据已更新', 'success');
    });

    // Chart tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab').forEach(t => {
                t.classList.remove('active', 'bg-primary-500/20', 'text-primary-400');
                t.classList.add('hover:bg-dark-700', 'text-gray-400');
            });
            e.target.classList.add('active', 'bg-primary-500/20', 'text-primary-400');
            e.target.classList.remove('hover:bg-dark-700', 'text-gray-400');
            currentChartType = e.target.dataset.type;
            updateChartType();
        });
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;

            // Update active state
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active', 'bg-primary-500/20', 'text-primary-400');
                nav.classList.add('hover:bg-dark-700', 'text-gray-400', 'hover:text-white');
            });
            item.classList.add('active', 'bg-primary-500/20', 'text-primary-400');
            item.classList.remove('hover:bg-dark-700', 'text-gray-400', 'hover:text-white');

            // Navigate to page
            navigateToPage(page);
        });
    });
}

// Page Router
const pages = {
    dashboard: {
        title: '控制面板',
        render: renderDashboard
    },
    devices: {
        title: '设备管理',
        render: renderDevices
    },
    schedule: {
        title: '定时任务',
        render: renderSchedule
    },
    history: {
        title: '历史记录',
        render: renderHistory
    },
    settings: {
        title: '系统设置',
        render: renderSettings
    }
};

let currentPage = 'dashboard';

function navigateToPage(page) {
    currentPage = page;
    const pageConfig = pages[page];
    if (!pageConfig) return;

    // Update title
    document.getElementById('pageTitle').textContent = pageConfig.title;

    // Render content
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = pageConfig.render();

    // Re-initialize icons and components
    lucide.createIcons();

    // Page-specific initialization
    if (page === 'dashboard') {
        initChart();
        fetchAllData();
    } else if (page === 'history') {
        initHistoryChart();
        fetchHistoryData();
    } else if (page === 'schedule') {
        fetchSchedules();
    } else if (page === 'devices') {
        fetchDevices();
    }
}

// Fetch All Data
async function fetchAllData() {
    await Promise.all([
        fetchSensorData(),
        fetchDeviceStatus(),
        fetchIrrigationLogs()
    ]);
    updateLastRefresh();
}

// Fetch Sensor Data
async function fetchSensorData() {
    if (demoMode) {
        updateSensorDisplay(demoSensorData);
        return;
    }

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

// Update Sensor Display
function updateSensorDisplay(data) {
    // Update values with animation
    animateValue('soilMoisture1', data.soilMoisture1 || 0);
    animateValue('soilMoisture2', data.soilMoisture2 || 0);
    animateValue('temperature', data.temperature || 0);
    animateValue('humidity', data.humidity || 0);

    // Update progress rings
    updateProgressRing('soilMoisture1Ring', data.soilMoisture1 || 0);
    updateProgressRing('soilMoisture2Ring', data.soilMoisture2 || 0);
    updateProgressRing('temperatureRing', (data.temperature || 0) / 50 * 100);
    updateProgressRing('humidityRing', data.humidity || 0);

    // Update progress bars
    document.getElementById('soilMoisture1Bar').style.width = `${data.soilMoisture1 || 0}%`;
    document.getElementById('soilMoisture2Bar').style.width = `${data.soilMoisture2 || 0}%`;
    document.getElementById('temperatureBar').style.width = `${(data.temperature || 0) / 50 * 100}%`;
    document.getElementById('humidityBar').style.width = `${data.humidity || 0}%`;

    // Update status badges
    updateStatusBadge('tempStatus', data.temperature, 15, 35);
    updateStatusBadge('humidityStatus', data.humidity, 40, 85);

    // Check alerts
    checkAlerts(data);
}

// Animate Value Change
function animateValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseFloat(element.textContent) || 0;
    const diff = newValue - currentValue;
    const duration = 500;
    const steps = 20;
    const stepValue = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        element.textContent = (currentValue + stepValue * step).toFixed(1);
        if (step >= steps) {
            clearInterval(timer);
            element.textContent = newValue.toFixed(1);
        }
    }, duration / steps);
}

// Update Progress Ring
function updateProgressRing(elementId, percentage) {
    const circle = document.getElementById(elementId);
    const circumference = 2 * Math.PI * 15.9155;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
}

// Update Status Badge
function updateStatusBadge(elementId, value, min, max) {
    const element = document.getElementById(elementId);
    element.className = 'text-xs px-2 py-1 rounded-full';

    if (value < min) {
        element.classList.add('bg-blue-500/20', 'text-blue-400');
        element.textContent = '偏低';
    } else if (value > max) {
        element.classList.add('bg-red-500/20', 'text-red-400');
        element.textContent = '偏高';
    } else {
        element.classList.add('bg-green-500/20', 'text-green-400');
        element.textContent = '正常';
    }
}

// Check Alerts
function checkAlerts(data) {
    const alertBanner = document.getElementById('alertBanner');
    const avgSoilMoisture = ((data.soilMoisture1 || 0) + (data.soilMoisture2 || 0)) / 2;

    if (avgSoilMoisture < 30) {
        showAlert('warning', '土壤湿度过低', `当前湿度: ${avgSoilMoisture.toFixed(1)}%，建议浇水`);
    } else if (data.temperature > 35) {
        showAlert('danger', '温度过高', `当前温度: ${data.temperature.toFixed(1)}°C，风扇已开启`);
    } else if (data.humidity < 40) {
        showAlert('info', '空气湿度偏低', `当前湿度: ${data.humidity.toFixed(1)}%`);
    } else {
        hideAlert();
    }
}

// Show Alert
function showAlert(type, title, message) {
    const alertBanner = document.getElementById('alertBanner');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');

    const colors = {
        warning: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
        danger: 'from-red-500/20 to-pink-500/20 border-red-500/30',
        info: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30'
    };

    alertBanner.className = `bg-gradient-to-r ${colors[type]} border rounded-xl p-4 flex items-center gap-4 animate-slide-up`;
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertBanner.classList.remove('hidden');
}

function hideAlert() {
    document.getElementById('alertBanner').classList.add('hidden');
}

// Fetch Device Status
async function fetchDeviceStatus() {
    if (demoMode) {
        updateControlStatus({ pumpActive: false, fanActive: false });
        return;
    }

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

// Update Control Status
function updateControlStatus(status) {
    const pumpToggle = document.getElementById('pumpToggle');
    const fanToggle = document.getElementById('fanToggle');
    const pumpStatusText = document.getElementById('pumpStatusText');
    const fanStatusText = document.getElementById('fanStatusText');

    if (status.pumpActive) {
        pumpToggle.classList.add('active');
        pumpStatusText.textContent = '运行中';
    } else {
        pumpToggle.classList.remove('active');
        pumpStatusText.textContent = '已关闭';
    }

    if (status.fanActive) {
        fanToggle.classList.add('active');
        fanStatusText.textContent = '运行中';
    } else {
        fanToggle.classList.remove('active');
        fanStatusText.textContent = '已关闭';
    }
}

// Control Functions
async function controlPump(action) {
    if (demoMode) {
        showToast('水泵控制', `水泵已${action === 'on' ? '开启' : '关闭'}`, 'success');
        updateControlStatus({ pumpActive: action === 'on', fanActive: document.getElementById('fanToggle').classList.contains('active') });
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/pump`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        const result = await response.json();

        if (result.success) {
            showToast('水泵控制', `水泵已${action === 'on' ? '开启' : '关闭'}`, 'success');
            setTimeout(fetchDeviceStatus, 500);
        } else {
            showToast('操作失败', result.error || '无法控制水泵', 'error');
        }
    } catch (error) {
        showToast('网络错误', '请检查服务器连接', 'error');
    }
}

async function controlFan(action) {
    if (demoMode) {
        showToast('风扇控制', `风扇已${action === 'on' ? '开启' : '关闭'}`, 'success');
        updateControlStatus({
            pumpActive: document.getElementById('pumpToggle').classList.contains('active'),
            fanActive: action === 'on'
        });
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/fan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        const result = await response.json();

        if (result.success) {
            showToast('风扇控制', `风扇已${action === 'on' ? '开启' : '关闭'}`, 'success');
            setTimeout(fetchDeviceStatus, 500);
        } else {
            showToast('操作失败', result.error || '无法控制风扇', 'error');
        }
    } catch (error) {
        showToast('网络错误', '请检查服务器连接', 'error');
    }
}

function togglePump() {
    const isActive = document.getElementById('pumpToggle').classList.contains('active');
    controlPump(isActive ? 'off' : 'on');
}

function toggleFan() {
    const isActive = document.getElementById('fanToggle').classList.contains('active');
    controlFan(isActive ? 'off' : 'on');
}

async function manualIrrigation() {
    const duration = parseInt(document.getElementById('irrigationDuration').value);

    if (demoMode) {
        showToast('手动浇水', `开始浇水，持续 ${duration / 1000} 秒`, 'success');
        addActivity('irrigation', '手动浇水', `${duration / 1000}秒`);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/pump`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'on', duration })
        });

        const result = await response.json();

        if (result.success) {
            showToast('手动浇水', `开始浇水，持续 ${duration / 1000} 秒`, 'success');
            setTimeout(fetchDeviceStatus, 500);
            setTimeout(fetchIrrigationLogs, 1000);
        } else {
            showToast('操作失败', result.error || '无法启动浇水', 'error');
        }
    } catch (error) {
        showToast('网络错误', '请检查服务器连接', 'error');
    }
}

// Fetch Irrigation Logs
async function fetchIrrigationLogs() {
    if (demoMode) return;

    try {
        const response = await fetch(`${API_BASE}/control/${currentDevice}/logs?limit=10`);
        const result = await response.json();

        if (result.success && result.data) {
            updateActivityList(result.data);
        }
    } catch (error) {
        console.error('Error fetching irrigation logs:', error);
    }
}

// Update Activity List
function updateActivityList(logs) {
    const activityList = document.getElementById('activityList');

    if (!logs || logs.length === 0) {
        activityList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p class="text-sm">暂无活动记录</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    activityList.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const reasonConfig = {
            'manual': { icon: 'hand', color: 'text-blue-400', bg: 'bg-blue-500/20', label: '手动' },
            'auto': { icon: 'zap', color: 'text-green-400', bg: 'bg-green-500/20', label: '自动' },
            'schedule': { icon: 'clock', color: 'text-orange-400', bg: 'bg-orange-500/20', label: '定时' }
        }[log.triggerReason] || { icon: 'activity', color: 'text-gray-400', bg: 'bg-gray-500/20', label: '未知' };

        return `
            <div class="flex items-center gap-3 p-3 bg-dark-800 rounded-xl">
                <div class="w-10 h-10 ${reasonConfig.bg} rounded-lg flex items-center justify-center">
                    <i data-lucide="${reasonConfig.icon}" class="w-5 h-5 ${reasonConfig.color}"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-medium">${reasonConfig.label}浇水</p>
                    <p class="text-xs text-gray-500">${time}</p>
                </div>
                <span class="text-sm text-gray-400">${log.duration / 1000}s</span>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

// Add Activity (for demo mode)
function addActivity(type, title, detail) {
    const activityList = document.getElementById('activityList');
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    const typeConfig = {
        'irrigation': { icon: 'droplet', color: 'text-blue-400', bg: 'bg-blue-500/20' }
    }[type] || { icon: 'activity', color: 'text-gray-400', bg: 'bg-gray-500/20' };

    const newActivity = `
        <div class="flex items-center gap-3 p-3 bg-dark-800 rounded-xl animate-slide-up">
            <div class="w-10 h-10 ${typeConfig.bg} rounded-lg flex items-center justify-center">
                <i data-lucide="${typeConfig.icon}" class="w-5 h-5 ${typeConfig.color}"></i>
            </div>
            <div class="flex-1">
                <p class="text-sm font-medium">${title}</p>
                <p class="text-xs text-gray-500">${time}</p>
            </div>
            <span class="text-sm text-gray-400">${detail}</span>
        </div>
    `;

    // Remove empty state if exists
    const emptyState = activityList.querySelector('.text-center');
    if (emptyState) {
        emptyState.remove();
    }

    activityList.insertAdjacentHTML('afterbegin', newActivity);
    lucide.createIcons();
}

// Initialize Chart
function initChart() {
    const options = {
        series: [{
            name: '土壤湿度 1',
            data: generateDemoData()
        }, {
            name: '土壤湿度 2',
            data: generateDemoData()
        }],
        chart: {
            type: 'area',
            height: 250,
            toolbar: { show: false },
            background: 'transparent',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            }
        },
        colors: ['#3b82f6', '#06b6d4'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1,
                stops: [0, 100]
            }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: {
            categories: generateTimeLabels(),
            labels: { style: { colors: '#64748b' } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: { style: { colors: '#64748b' } }
        },
        grid: {
            borderColor: '#334155',
            strokeDashArray: 4,
        },
        theme: { mode: 'dark' },
        tooltip: {
            theme: 'dark',
            style: { fontSize: '12px' }
        },
        legend: {
            show: true,
            position: 'top',
            labels: { colors: '#94a3b8' }
        }
    };

    sensorChart = new ApexCharts(document.querySelector('#sensorChart'), options);
    sensorChart.render();
}

function updateChartType() {
    const configs = {
        soil_moisture: {
            series: [
                { name: '土壤湿度 1', data: generateDemoData() },
                { name: '土壤湿度 2', data: generateDemoData() }
            ],
            colors: ['#3b82f6', '#06b6d4']
        },
        temperature: {
            series: [{ name: '温度', data: generateDemoData(20, 30) }],
            colors: ['#f97316']
        },
        humidity: {
            series: [{ name: '空气湿度', data: generateDemoData(50, 80) }],
            colors: ['#a855f7']
        }
    };

    const config = configs[currentChartType];
    sensorChart.updateOptions({
        series: config.series,
        colors: config.colors
    });
}

function generateDemoData(min = 30, max = 60) {
    return Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

function generateTimeLabels() {
    const labels = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        labels.push(hour.getHours().toString().padStart(2, '0') + ':00');
    }
    return labels;
}

// Demo Mode
function startDemoMode() {
    // Simulate sensor data changes
    setInterval(() => {
        demoSensorData.soilMoisture1 = Math.max(20, Math.min(80, demoSensorData.soilMoisture1 + (Math.random() - 0.5) * 5));
        demoSensorData.soilMoisture2 = Math.max(20, Math.min(80, demoSensorData.soilMoisture2 + (Math.random() - 0.5) * 5));
        demoSensorData.temperature = Math.max(18, Math.min(32, demoSensorData.temperature + (Math.random() - 0.5) * 2));
        demoSensorData.humidity = Math.max(40, Math.min(90, demoSensorData.humidity + (Math.random() - 0.5) * 3));

        updateSensorDisplay(demoSensorData);
    }, 3000);

    // Update chart periodically
    setInterval(() => {
        updateChartType();
    }, 10000);
}

// Utility Functions
function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('zh-CN');
    document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-');
}

function updateLastRefresh() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = `最后更新: ${now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}`;
}

function showToast(title, message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');

    const icons = {
        success: { icon: 'check-circle', color: 'text-green-400', bg: 'bg-green-500/20' },
        error: { icon: 'x-circle', color: 'text-red-400', bg: 'bg-red-500/20' },
        info: { icon: 'info', color: 'text-blue-400', bg: 'bg-blue-500/20' },
        warning: { icon: 'alert-triangle', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    }[type];

    toastIcon.className = `w-10 h-10 rounded-full ${icons.bg} flex items-center justify-center`;
    toastIcon.innerHTML = `<i data-lucide="${icons.icon}" class="w-5 h-5 ${icons.color}"></i>`;
    toastTitle.textContent = title;
    toastMessage.textContent = message;

    toast.classList.remove('translate-y-full', 'opacity-0');
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
    }, 3000);
}

function closeModal() {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');

    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = title;
    modalBody.innerHTML = content;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

// ==================== Page Render Functions ====================

// Store original dashboard content
let originalDashboardContent = '';

function renderDashboard() {
    if (!originalDashboardContent) {
        // Capture the original dashboard HTML from index.html
        originalDashboardContent = document.getElementById('mainContent').innerHTML;
    }
    return originalDashboardContent;
}

function renderDevices() {
    return `
        <div class="space-y-6">
            <!-- Add Device Button -->
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-semibold">已连接设备</h3>
                    <p class="text-sm text-gray-400">管理您的 ESP32 培育箱设备</p>
                </div>
                <button onclick="showAddDeviceModal()" class="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    添加设备
                </button>
            </div>

            <!-- Devices Grid -->
            <div id="devicesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="glass rounded-2xl p-5 card-hover">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
                                <i data-lucide="sprout" class="w-6 h-6 text-white"></i>
                            </div>
                            <div>
                                <h4 class="font-semibold">培育箱 01</h4>
                                <p class="text-xs text-gray-400">potato-chamber-01</p>
                            </div>
                        </div>
                        <span class="flex items-center gap-1 text-xs text-green-400">
                            <span class="w-2 h-2 rounded-full bg-green-500 status-pulse"></span>
                            在线
                        </span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">土壤湿度</span>
                            <span>45%</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">温度</span>
                            <span>24°C</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">最后更新</span>
                            <span>刚刚</span>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-dark-600 flex gap-2">
                        <button class="flex-1 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition">
                            <i data-lucide="settings" class="w-4 h-4 inline mr-1"></i> 设置
                        </button>
                        <button class="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition">
                            <i data-lucide="trash-2" class="w-4 h-4 inline mr-1"></i> 删除
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSchedule() {
    return `
        <div class="space-y-6">
            <!-- Add Schedule Button -->
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-semibold">定时任务</h3>
                    <p class="text-sm text-gray-400">设置自动浇水计划</p>
                </div>
                <button onclick="showAddScheduleModal()" class="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    新建计划
                </button>
            </div>

            <!-- Schedules List -->
            <div id="schedulesList" class="space-y-4">
                <div class="glass rounded-2xl p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                <i data-lucide="droplet" class="w-5 h-5 text-cyan-400"></i>
                            </div>
                            <div>
                                <h4 class="font-medium">早间浇水</h4>
                                <p class="text-xs text-gray-400">每天 08:00</p>
                            </div>
                        </div>
                        <div class="toggle-switch active" onclick="this.classList.toggle('active')"></div>
                    </div>
                    <div class="text-sm text-gray-400">
                        <p>持续时间: 15 秒</p>
                        <p>设备: 培育箱 01</p>
                    </div>
                </div>

                <div class="glass rounded-2xl p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                <i data-lucide="droplet" class="w-5 h-5 text-orange-400"></i>
                            </div>
                            <div>
                                <h4 class="font-medium">晚间浇水</h4>
                                <p class="text-xs text-gray-400">每天 20:00</p>
                            </div>
                        </div>
                        <div class="toggle-switch active" onclick="this.classList.toggle('active')"></div>
                    </div>
                    <div class="text-sm text-gray-400">
                        <p>持续时间: 20 秒</p>
                        <p>设备: 培育箱 01</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderHistory() {
    return `
        <div class="space-y-6">
            <!-- Filters -->
            <div class="glass rounded-2xl p-4 flex flex-wrap gap-4 items-center">
                <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-400">日期范围:</label>
                    <select class="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm">
                        <option>最近 7 天</option>
                        <option>最近 30 天</option>
                        <option>最近 90 天</option>
                        <option>全部</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-400">类型:</label>
                    <select class="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm">
                        <option>全部</option>
                        <option>浇水记录</option>
                        <option>传感器数据</option>
                        <option>系统事件</option>
                    </select>
                </div>
                <button class="ml-auto px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition flex items-center gap-2">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    导出数据
                </button>
            </div>

            <!-- History Chart -->
            <div class="glass rounded-2xl p-5">
                <h3 class="font-medium mb-4 flex items-center gap-2">
                    <i data-lucide="line-chart" class="w-5 h-5 text-primary-400"></i>
                    传感器历史趋势
                </h3>
                <div id="historyChart" class="h-64"></div>
            </div>

            <!-- History Table -->
            <div class="glass rounded-2xl overflow-hidden">
                <div class="p-4 border-b border-dark-600">
                    <h3 class="font-medium">详细记录</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-dark-800">
                            <tr>
                                <th class="px-4 py-3 text-left text-gray-400">时间</th>
                                <th class="px-4 py-3 text-left text-gray-400">事件类型</th>
                                <th class="px-4 py-3 text-left text-gray-400">设备</th>
                                <th class="px-4 py-3 text-left text-gray-400">详情</th>
                            </tr>
                        </thead>
                        <tbody id="historyTableBody">
                            <tr class="border-t border-dark-600">
                                <td class="px-4 py-3">2024-03-03 08:00</td>
                                <td class="px-4 py-3"><span class="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">浇水</span></td>
                                <td class="px-4 py-3">培育箱 01</td>
                                <td class="px-4 py-3 text-gray-400">定时浇水，持续 15 秒</td>
                            </tr>
                            <tr class="border-t border-dark-600">
                                <td class="px-4 py-3">2024-03-03 07:55</td>
                                <td class="px-4 py-3"><span class="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">警告</span></td>
                                <td class="px-4 py-3">培育箱 01</td>
                                <td class="px-4 py-3 text-gray-400">土壤湿度低于阈值 (28%)</td>
                            </tr>
                            <tr class="border-t border-dark-600">
                                <td class="px-4 py-3">2024-03-02 20:00</td>
                                <td class="px-4 py-3"><span class="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">浇水</span></td>
                                <td class="px-4 py-3">培育箱 01</td>
                                <td class="px-4 py-3 text-gray-400">定时浇水，持续 20 秒</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSettings() {
    return `
        <div class="space-y-6 max-w-3xl">
            <!-- System Settings -->
            <div class="glass rounded-2xl p-6">
                <h3 class="font-medium mb-4 flex items-center gap-2">
                    <i data-lucide="server" class="w-5 h-5 text-primary-400"></i>
                    系统设置
                </h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">系统名称</label>
                        <input type="text" value="土豆培育系统" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">数据刷新间隔 (秒)</label>
                        <input type="number" value="5" min="1" max="60" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                </div>
            </div>

            <!-- Alert Thresholds -->
            <div class="glass rounded-2xl p-6">
                <h3 class="font-medium mb-4 flex items-center gap-2">
                    <i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-400"></i>
                    告警阈值
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">土壤湿度下限 (%)</label>
                        <input type="number" value="30" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">土壤湿度上限 (%)</label>
                        <input type="number" value="80" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">温度下限 (°C)</label>
                        <input type="number" value="15" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">温度上限 (°C)</label>
                        <input type="number" value="35" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">空气湿度下限 (%)</label>
                        <input type="number" value="40" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">空气湿度上限 (%)</label>
                        <input type="number" value="85" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                </div>
            </div>

            <!-- Irrigation Settings -->
            <div class="glass rounded-2xl p-6">
                <h3 class="font-medium mb-4 flex items-center gap-2">
                    <i data-lucide="droplet" class="w-5 h-5 text-blue-400"></i>
                    浇水设置
                </h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">最大浇水持续时间 (秒)</label>
                        <input type="number" value="300" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">最小浇水间隔 (分钟)</label>
                        <input type="number" value="60" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    </div>
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium">自动浇水</p>
                            <p class="text-sm text-gray-400">土壤湿度低于阈值时自动浇水</p>
                        </div>
                        <div class="toggle-switch active" onclick="this.classList.toggle('active')"></div>
                    </div>
                </div>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end gap-4">
                <button class="px-6 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition">重置</button>
                <button class="px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition" onclick="showToast('设置已保存', '系统配置已更新', 'success')">保存设置</button>
            </div>
        </div>
    `;
}

// ==================== Page Initialization Functions ====================

function initHistoryChart() {
    const options = {
        series: [{
            name: '土壤湿度',
            data: [45, 42, 48, 50, 46, 44, 43]
        }],
        chart: {
            type: 'line',
            height: 250,
            toolbar: { show: false },
            background: 'transparent'
        },
        colors: ['#3b82f6'],
        stroke: { curve: 'smooth', width: 2 },
        xaxis: {
            categories: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
            labels: { style: { colors: '#64748b' } }
        },
        yaxis: {
            labels: { style: { colors: '#64748b' } }
        },
        grid: { borderColor: '#334155', strokeDashArray: 4 },
        theme: { mode: 'dark' }
    };
    new ApexCharts(document.querySelector('#historyChart'), options).render();
}

async function fetchDevices() {
    // TODO: Implement API call
}

async function fetchSchedules() {
    // TODO: Implement API call
}

async function fetchHistoryData() {
    // TODO: Implement API call
}

function showAddDeviceModal() {
    const content = `
        <div class="space-y-4">
            <div>
                <label class="block text-sm text-gray-400 mb-2">设备名称</label>
                <input type="text" placeholder="例如: 培育箱 02" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-2">设备 ID</label>
                <input type="text" placeholder="potato-chamber-02" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-2">位置 (可选)</label>
                <input type="text" placeholder="例如: 阳台" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            </div>
            <button class="w-full py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition" onclick="showToast('设备已添加', '新设备已成功连接', 'success'); closeModal();">
                添加设备
            </button>
        </div>
    `;
    showModal('添加设备', content);
}

function showAddScheduleModal() {
    const content = `
        <div class="space-y-4">
            <div>
                <label class="block text-sm text-gray-400 mb-2">计划名称</label>
                <input type="text" placeholder="例如: 早间浇水" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-2">执行时间</label>
                <input type="time" value="08:00" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-2">重复</label>
                <select class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option>每天</option>
                    <option>工作日</option>
                    <option>周末</option>
                    <option>自定义</option>
                </select>
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-2">持续时间 (秒)</label>
                <input type="number" value="15" min="5" max="300" class="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            </div>
            <button class="w-full py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition" onclick="showToast('计划已创建', '定时任务已添加', 'success'); closeModal();">
                创建计划
            </button>
        </div>
    `;
    showModal('新建定时任务', content);
}
