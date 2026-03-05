// ========================
// Configuration & State
// ========================
const API_BASE = window.location.origin + '/api';
const DEMO_MODE = true;

const state = {
    currentDevice: 'potato-chamber-01',
    currentChartType: 'soil_moisture',
    theme: 'dark',
    sensorChart: null,
    costChart: null,
    costs: [],
    controls: {
        pump: false,
        fan: false
    }
};

// Demo sensor data
const demoSensorData = {
    soilMoisture1: 45,
    soilMoisture2: 42,
    temperature: 24,
    humidity: 65
};

// Demo cost data
const demoCosts = [
    { id: 1, category: 'hardware', name: 'ESP32 开发板', quantity: 1, unitName: '个', unitPrice: 18, totalPrice: 18, purchaseDate: '2024-01-15', supplier: '淘宝' },
    { id: 2, category: 'hardware', name: 'ESP32-CAM 摄像头', quantity: 1, unitName: '个', unitPrice: 25, totalPrice: 25, purchaseDate: '2024-01-15', supplier: '淘宝' },
    { id: 3, category: 'hardware', name: '土壤湿度传感器', quantity: 2, unitName: '个', unitPrice: 4, totalPrice: 8, purchaseDate: '2024-01-15', supplier: '淘宝' },
    { id: 4, category: 'hardware', name: 'DHT22 温湿度传感器', quantity: 1, unitName: '个', unitPrice: 5, totalPrice: 5, purchaseDate: '2024-01-15', supplier: '淘宝' },
    { id: 5, category: 'hardware', name: '5V 继电器模块', quantity: 2, unitName: '个', unitPrice: 3, totalPrice: 6, purchaseDate: '2024-01-15', supplier: '淘宝' },
    { id: 6, category: 'hardware', name: '微型潜水泵', quantity: 1, unitName: '个', unitPrice: 12, totalPrice: 12, purchaseDate: '2024-01-15', supplier: '淘宝' },
    { id: 7, category: 'supplies', name: 'PE滴灌管套装', quantity: 1, unitName: '套', unitPrice: 15, totalPrice: 15, purchaseDate: '2024-01-16', supplier: '拼多多' },
    { id: 8, category: 'supplies', name: '营养土 10L', quantity: 2, unitName: '袋', unitPrice: 8, totalPrice: 16, purchaseDate: '2024-01-20', supplier: '花卉市场' },
    { id: 9, category: 'electricity', name: '电费估算', quantity: 15, unitName: 'kWh', unitPrice: 0.5, totalPrice: 5, purchaseDate: '2024-02-01', notes: '月度估算' },
];

// Category display names
const categoryNames = {
    hardware: '🔧 硬件',
    supplies: '🌱 耗材',
    electricity: '⚡ 电费',
    water: '💧 水费',
    other: '📦 其他'
};

// ========================
// Initialization
// ========================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCharts();
    loadCosts();
    initCameras();
    refreshData();
    updateTime();
    setInterval(updateTime, 1000);
    setInterval(refreshData, 5000);

    if (DEMO_MODE) {
        startDemoMode();
    }

    // Hide loading screen
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.classList.add('hidden');
    }, 800);
});

// ========================
// Theme Management
// ========================
function initTheme() {
    const saved = localStorage.getItem('potato-theme') || 'dark';
    setTheme(saved);
}

function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    state.theme = theme;
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('potato-theme', theme);

    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';

    updateChartsTheme(theme);
}

// ========================
// Tab Navigation
// ========================
function switchTab(tab) {
    const dashboardTab = document.getElementById('dashboardTab');
    const costsTab = document.getElementById('costsTab');
    const streamingTab = document.getElementById('streamingTab');
    const tabDashboard = document.getElementById('tabDashboard');
    const tabCosts = document.getElementById('tabCosts');
    const tabStreaming = document.getElementById('tabStreaming');

    // Hide all tabs
    dashboardTab?.classList.add('hidden');
    costsTab?.classList.add('hidden');
    streamingTab?.classList.add('hidden');

    // Remove active from all buttons
    tabDashboard?.classList.remove('active');
    tabCosts?.classList.remove('active');
    tabStreaming?.classList.remove('active');

    // Show selected tab and activate button
    if (tab === 'dashboard') {
        dashboardTab?.classList.remove('hidden');
        tabDashboard?.classList.add('active');
    } else if (tab === 'costs') {
        costsTab?.classList.remove('hidden');
        tabCosts?.classList.add('active');
    } else if (tab === 'streaming') {
        streamingTab?.classList.remove('hidden');
        tabStreaming?.classList.add('active');
        // Load streaming status and recordings
        loadStreamingStatus();
        loadRecordings();
    }
}

// ========================
// Charts
// ========================
function initCharts() {
    // Sensor Chart
    const chartOptions = {
        series: [{ name: '数值', data: [] }],
        chart: {
            type: 'area',
            height: 250,
            fontFamily: 'system-ui, sans-serif',
            toolbar: { show: false },
            animations: { enabled: true }
        },
        colors: ['#10b981'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: {
            categories: [],
            labels: { style: { colors: '#94a3b8' } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        grid: {
            borderColor: 'rgba(51, 65, 85, 0.3)',
            strokeDashArray: 4
        },
        tooltip: {
            theme: 'dark',
            style: { fontSize: '12px' }
        }
    };

    state.sensorChart = new ApexCharts(document.getElementById('sensorChart'), chartOptions);
    state.sensorChart.render();

    // Cost Chart
    const costChartOptions = {
        series: [],
        chart: {
            type: 'donut',
            height: 280,
            fontFamily: 'system-ui, sans-serif'
        },
        labels: [],
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#64748b'],
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: '总计',
                            formatter: () => `¥${getTotalCost().toFixed(0)}`
                        }
                    }
                }
            }
        },
        dataLabels: { enabled: false },
        legend: {
            position: 'bottom',
            labels: { colors: '#94a3b8' }
        },
        tooltip: {
            theme: 'dark',
            y: {
                formatter: (val) => `¥${val.toFixed(2)}`
            }
        }
    };

    state.costChart = new ApexCharts(document.getElementById('costChart'), costChartOptions);
    state.costChart.render();
}

function updateChartsTheme(theme) {
    const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const gridColor = theme === 'dark' ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)';

    if (state.sensorChart) {
        state.sensorChart.updateOptions({
            xaxis: { labels: { style: { colors: textColor } } },
            yaxis: { labels: { style: { colors: textColor } } },
            grid: { borderColor: gridColor },
            tooltip: { theme: theme }
        });
    }

    if (state.costChart) {
        state.costChart.updateOptions({
            legend: { labels: { colors: textColor } },
            tooltip: { theme: theme }
        });
    }
}

function setChartType(type) {
    state.currentChartType = type;
    document.querySelectorAll('.chart-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    updateSensorChart();
}

function updateSensorChart() {
    if (!state.sensorChart) return;

    const data = generateChartData();
    const color = state.currentChartType === 'soil_moisture' ? '#10b981' :
                  state.currentChartType === 'temperature' ? '#f59e0b' : '#3b82f6';

    state.sensorChart.updateOptions({
        series: [{ name: getChartTypeName(), data: data.values }],
        xaxis: { categories: data.labels },
        colors: [color]
    });
}

function getChartTypeName() {
    const names = {
        soil_moisture: '土壤湿度 (%)',
        temperature: '温度 (°C)',
        humidity: '湿度 (%)'
    };
    return names[state.currentChartType] || '数值';
}

function generateChartData() {
    const labels = [];
    const values = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
        const time = new Date(now - i * 5 * 60 * 1000);
        labels.push(`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`);

        let baseValue;
        if (state.currentChartType === 'soil_moisture') {
            baseValue = demoSensorData.soilMoisture1 + (Math.random() - 0.5) * 10;
        } else if (state.currentChartType === 'temperature') {
            baseValue = demoSensorData.temperature + (Math.random() - 0.5) * 4;
        } else {
            baseValue = demoSensorData.humidity + (Math.random() - 0.5) * 8;
        }
        values.push(Math.round(baseValue * 10) / 10);
    }

    return { labels, values };
}

// ========================
// Sensor Data
// ========================
function refreshData() {
    if (DEMO_MODE) {
        updateDemoData();
    } else {
        fetchSensorData();
    }
    updateSensorChart();
}

function updateDemoData() {
    // Simulate sensor fluctuations
    demoSensorData.soilMoisture1 = clamp(demoSensorData.soilMoisture1 + (Math.random() - 0.5) * 3, 20, 80);
    demoSensorData.soilMoisture2 = clamp(demoSensorData.soilMoisture2 + (Math.random() - 0.5) * 3, 20, 80);
    demoSensorData.temperature = clamp(demoSensorData.temperature + (Math.random() - 0.5) * 1, 18, 32);
    demoSensorData.humidity = clamp(demoSensorData.humidity + (Math.random() - 0.5) * 2, 40, 85);

    updateSensorDisplay('soilMoisture1', demoSensorData.soilMoisture1, '%', 30, 70);
    updateSensorDisplay('soilMoisture2', demoSensorData.soilMoisture2, '%', 30, 70);
    updateSensorDisplay('temperature', demoSensorData.temperature, '°C', 20, 30, true);
    updateSensorDisplay('humidity', demoSensorData.humidity, '%', 40, 80);
}

function updateSensorDisplay(id, value, unit, minOk, maxOk, reverse = false) {
    const valueEl = document.getElementById(id);
    const barEl = document.getElementById(`${id}Bar`);
    const statusEl = document.getElementById(`${id}Status`);

    if (valueEl) valueEl.textContent = `${Math.round(value)}${unit}`;

    const maxPercent = reverse ? 50 : 100;
    const percent = Math.min((value / maxPercent) * 100, 100);
    if (barEl) barEl.style.width = `${percent}%`;

    if (statusEl) {
        statusEl.className = 'status-badge';
        if (value < minOk || value > maxOk) {
            statusEl.classList.add('status-danger');
            statusEl.textContent = value < minOk ? '过低' : '过高';
        } else {
            statusEl.classList.add('status-success');
            statusEl.textContent = '正常';
        }
    }
}

async function fetchSensorData() {
    try {
        const response = await fetch(`${API_BASE}/sensors/latest?device_id=${state.currentDevice}`);
        if (response.ok) {
            const data = await response.json();
            // Process and update display
        }
    } catch (error) {
        console.error('Failed to fetch sensor data:', error);
    }
}

// ========================
// Camera
// ========================
function initCameras() {
    // Initialize camera placeholders
    refreshCamera(1);
    refreshCamera(2);
}

function refreshCamera(cameraId) {
    const img = document.getElementById(`camera${cameraId}`);
    const placeholder = document.getElementById(`camera${cameraId}Placeholder`);

    // In demo mode, show placeholder
    if (DEMO_MODE || !img) {
        if (img) img.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        return;
    }

    // In production, you would load the actual camera stream
    // img.src = `http://192.168.1.${100 + cameraId}:81/stream`;
}

// ========================
// Controls
// ========================
async function controlPump(action) {
    const isActive = action === 'on';
    state.controls.pump = isActive;
    updateControlDisplay('pump', isActive, '水泵');

    if (!DEMO_MODE) {
        try {
            await fetch(`${API_BASE}/control/${state.currentDevice}/pump`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
        } catch (error) {
            console.error('Failed to control pump:', error);
        }
    }

    showToast(action === 'on' ? '💧 水泵已开启' : '💧 水泵已关闭');
}

async function controlFan(action) {
    const isActive = action === 'on';
    state.controls.fan = isActive;
    updateControlDisplay('fan', isActive, '风扇');

    if (!DEMO_MODE) {
        try {
            await fetch(`${API_BASE}/control/${state.currentDevice}/fan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
        } catch (error) {
            console.error('Failed to control fan:', error);
        }
    }

    showToast(action === 'on' ? '💨 风扇已开启' : '💨 风扇已关闭');
}

async function manualIrrigation() {
    const duration = parseInt(document.getElementById('irrigationDuration').value);
    showToast(`⏰ 开始浇水 ${duration / 1000} 秒...`);

    if (!DEMO_MODE) {
        try {
            await fetch(`${API_BASE}/control/${state.currentDevice}/pump`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'on', duration })
            });
        } catch (error) {
            console.error('Failed to start irrigation:', error);
        }
    }

    // Simulate irrigation
    state.controls.pump = true;
    updateControlDisplay('pump', true, '水泵');
    setTimeout(() => {
        state.controls.pump = false;
        updateControlDisplay('pump', false, '水泵');
        showToast('✅ 浇水完成');
    }, duration);
}

function updateControlDisplay(control, isActive, name) {
    const statusEl = document.getElementById(`${control}Status`);
    const indicatorEl = document.getElementById(`${control}Indicator`);

    if (statusEl) {
        statusEl.textContent = isActive ? '运行中' : '已关闭';
        statusEl.className = isActive ? 'text-sm text-emerald-500' : 'text-sm text-muted';
    }

    if (indicatorEl) {
        indicatorEl.className = `w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`;
    }
}

// ========================
// Cost Management
// ========================
async function loadCosts() {
    if (DEMO_MODE) {
        state.costs = [...demoCosts];
    } else {
        try {
            const response = await fetch(`${API_BASE}/costs`);
            if (response.ok) {
                state.costs = await response.json();
            }
        } catch (error) {
            console.error('Failed to load costs:', error);
            state.costs = [];
        }
    }
    renderCosts();
}

function renderCosts() {
    const listEl = document.getElementById('costList');
    if (!listEl) return;

    if (state.costs.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center py-8">暂无成本记录</p>';
        updateCostSummary();
        return;
    }

    listEl.innerHTML = state.costs.map(item => `
        <div class="card-alt flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="status-badge cat-${item.category}">${categoryNames[item.category] || item.category}</span>
                <div>
                    <p class="font-medium text-sm">${item.name}</p>
                    <p class="text-xs text-muted">${item.quantity} ${item.unitName || ''} × ¥${item.unitPrice}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="font-semibold">¥${item.totalPrice.toFixed(2)}</span>
                <button onclick="editCost(${item.id})" class="text-muted hover:text-current p-1">✏️</button>
                <button onclick="deleteCost(${item.id})" class="text-muted hover:text-red-500 p-1">🗑️</button>
            </div>
        </div>
    `).join('');

    updateCostSummary();
    updateCostChart();
}

function updateCostSummary() {
    const totals = {
        total: 0,
        hardware: 0,
        supplies: 0,
        monthly: 0
    };

    state.costs.forEach(item => {
        totals.total += item.totalPrice;
        if (item.category === 'hardware') totals.hardware += item.totalPrice;
        if (item.category === 'supplies') totals.supplies += item.totalPrice;
        if (item.category === 'electricity' || item.category === 'water') totals.monthly += item.totalPrice;
    });

    document.getElementById('totalCost').textContent = `¥${totals.total.toFixed(0)}`;
    document.getElementById('hardwareCost').textContent = `¥${totals.hardware.toFixed(0)}`;
    document.getElementById('suppliesCost').textContent = `¥${totals.supplies.toFixed(0)}`;
    document.getElementById('monthlyCost').textContent = `¥${totals.monthly.toFixed(0)}`;
    document.getElementById('monthlyOperating').textContent = `¥${totals.monthly.toFixed(0)}`;
    document.getElementById('annualOperating').textContent = `¥${(totals.monthly * 12).toFixed(0)}`;
    document.getElementById('firstYearTotal').textContent = `¥${(totals.total + totals.monthly * 12).toFixed(0)}`;
}

function updateCostChart() {
    if (!state.costChart) return;

    const categoryTotals = {};
    Object.keys(categoryNames).forEach(cat => categoryTotals[cat] = 0);

    state.costs.forEach(item => {
        categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.totalPrice;
    });

    const labels = [];
    const values = [];

    Object.entries(categoryTotals).forEach(([cat, total]) => {
        if (total > 0) {
            labels.push(categoryNames[cat]);
            values.push(total);
        }
    });

    state.costChart.updateOptions({
        labels: labels,
        series: values
    });
}

function getTotalCost() {
    return state.costs.reduce((sum, item) => sum + item.totalPrice, 0);
}

function openCostModal(id = null) {
    const modal = document.getElementById('costModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('costForm');

    form.reset();
    document.getElementById('costId').value = '';
    document.getElementById('costQuantity').value = '1';

    if (id) {
        const item = state.costs.find(c => c.id === id);
        if (item) {
            title.textContent = '编辑成本';
            document.getElementById('costId').value = item.id;
            document.getElementById('costCategory').value = item.category;
            document.getElementById('costName').value = item.name;
            document.getElementById('costQuantity').value = item.quantity;
            document.getElementById('costUnitName').value = item.unitName || '';
            document.getElementById('costUnitPrice').value = item.unitPrice;
            document.getElementById('costPurchaseDate').value = item.purchaseDate;
            document.getElementById('costSupplier').value = item.supplier || '';
            document.getElementById('costNotes').value = item.notes || '';
        }
    } else {
        title.textContent = '添加成本';
        document.getElementById('costPurchaseDate').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');
}

function closeCostModal() {
    document.getElementById('costModal').classList.add('hidden');
}

function editCost(id) {
    openCostModal(id);
}

async function deleteCost(id) {
    if (!confirm('确定要删除这条成本记录吗？')) return;

    if (!DEMO_MODE) {
        try {
            await fetch(`${API_BASE}/costs/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete cost:', error);
        }
    }

    state.costs = state.costs.filter(c => c.id !== id);
    renderCosts();
    showToast('🗑️ 已删除');
}

async function saveCost(event) {
    event.preventDefault();

    const id = document.getElementById('costId').value;
    const data = {
        category: document.getElementById('costCategory').value,
        name: document.getElementById('costName').value,
        quantity: parseInt(document.getElementById('costQuantity').value) || 1,
        unitName: document.getElementById('costUnitName').value,
        unitPrice: parseFloat(document.getElementById('costUnitPrice').value) || 0,
        purchaseDate: document.getElementById('costPurchaseDate').value,
        supplier: document.getElementById('costSupplier').value,
        notes: document.getElementById('costNotes').value
    };

    data.totalPrice = data.quantity * data.unitPrice;

    if (!DEMO_MODE) {
        try {
            const url = id ? `${API_BASE}/costs/${id}` : `${API_BASE}/costs`;
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                const saved = await response.json();
                if (id) {
                    const index = state.costs.findIndex(c => c.id == id);
                    if (index !== -1) state.costs[index] = { ...data, id: parseInt(id) };
                } else {
                    state.costs.push({ ...data, id: Date.now() });
                }
            }
        } catch (error) {
            console.error('Failed to save cost:', error);
        }
    } else {
        if (id) {
            const index = state.costs.findIndex(c => c.id == id);
            if (index !== -1) state.costs[index] = { ...data, id: parseInt(id) };
        } else {
            state.costs.push({ ...data, id: Date.now() });
        }
    }

    closeCostModal();
    renderCosts();
    showToast(id ? '✏️ 已更新' : '✅ 已添加');
}

// ========================
// Utilities
// ========================
function updateTime() {
    const now = new Date();
    const timeEl = document.getElementById('currentTime');
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');

    if (icon) icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    if (msg) msg.textContent = message;

    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showAlert(title, message) {
    const banner = document.getElementById('alertBanner');
    const titleEl = document.getElementById('alertTitle');
    const msgEl = document.getElementById('alertMessage');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    banner.classList.remove('hidden');
}

function hideAlert() {
    document.getElementById('alertBanner').classList.add('hidden');
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function startDemoMode() {
    console.log('Running in demo mode');
    showAlert('演示模式', '当前运行在演示模式，数据为模拟数据');
}

// ========================
// Streaming / Live
// ========================
let streamStartTime = null;
let streamInterval = null;
let hls = null;

// Platform RTMP URLs
const platformUrls = {
    bilibili: 'rtmp://live-push.bilivideo.com/live-bvc/',
    douyin: 'rtmp://push.douyin.com/live/',
    youtube: 'rtmp://a.rtmp.youtube.com/live2/',
    kuaishou: 'rtmp://push.kuaishou.com/live/'
};

const platformHelp = {
    bilibili: 'B站：前往 <a href="https://link.bilibili.com/p/help/index#/live-tool" target="_blank">直播中心</a> 获取推流码',
    douyin: '抖音：使用抖音伴侣获取推流地址和密钥',
    youtube: 'YouTube：前往 <a href="https://www.youtube.com/live_dashboard" target="_blank">直播控制台</a> 获取流密钥',
    kuaishou: '快手：使用快手直播伴侣获取推流信息'
};

// Platform change handler
document.addEventListener('DOMContentLoaded', () => {
    const platformSelect = document.getElementById('streamPlatform');
    if (platformSelect) {
        platformSelect.addEventListener('change', (e) => {
            const platform = e.target.value;
            const rtmpUrl = document.getElementById('rtmpUrl');
            const helpText = document.getElementById('platformHelpText');

            if (platform && platformUrls[platform]) {
                rtmpUrl.value = platformUrls[platform];
                helpText.innerHTML = platformHelp[platform] || '请输入推流密钥';
            } else {
                rtmpUrl.value = '';
                helpText.textContent = '请选择直播平台或输入自定义 RTMP 地址';
            }
        });
    }
});

// ========================
// Streaming / Live - Multi-Platform
// ========================
let streamStartTime = null;
let streamInterval = null;
let hls = null;
let platformInfo = {};

// Platform RTMP URLs
const platformUrls = {
    bilibili: 'rtmp://live-push.bilivideo.com/live-bvc/',
    douyin: 'rtmp://push.douyin.com/live/',
    youtube: 'rtmp://a.rtmp.youtube.com/live2/',
    kuaishou: 'rtmp://push.kuaishou.com/live/'
};

// Platform toggle handlers
document.addEventListener('DOMContentLoaded', () => {
    // Initialize platform toggles
    document.querySelectorAll('.platform-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const platform = e.target.dataset.platform;
            const card = document.querySelector(`[data-platform="${platform}"].platform-card`);
            const config = card.querySelector('.platform-config');

            if (e.target.checked) {
                card.classList.add('enabled');
                config.classList.remove('hidden');
            } else {
                card.classList.remove('enabled');
                config.classList.add('hidden');
            }
        });
    });
});

async function startStreaming() {
    // Collect enabled platforms
    const platforms = [];
    const enabledToggles = document.querySelectorAll('.platform-toggle:checked');

    if (enabledToggles.length === 0) {
        showToast('请至少选择一个直播平台', 'error');
        return;
    }

    for (const toggle of enabledToggles) {
        const platformId = toggle.dataset.platform;
        const keyInput = document.querySelector(`.platform-key[data-platform="${platformId}"]`);
        const key = keyInput?.value?.trim();

        if (!key) {
            showToast(`请输入 ${platformId} 的推流密钥`, 'error');
            return;
        }

        platforms.push({
            id: platformId,
            name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
            enabled: true,
            rtmpUrl: platformUrls[platformId] || '',
            rtmpKey: key
        });
    }

    const camera = document.getElementById('cameraSource')?.value;
    const resolution = document.getElementById('streamResolution')?.value;
    const bitrate = document.getElementById('streamBitrate')?.value;
    const enableCache = document.getElementById('enableCache')?.checked;

    try {
        const response = await fetch(`${API_BASE}/streaming/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platforms,
                camera,
                resolution,
                bitrate,
                enableCache
            })
        });

        const result = await response.json();

        if (result.success) {
            streamStartTime = new Date();
            updateStreamStatus();
            streamInterval = setInterval(updateStreamStatus, 1000);

            // Update UI
            document.getElementById('btnStartStream').disabled = true;
            document.getElementById('btnStopStream').disabled = false;
            document.getElementById('streamStatus').innerHTML = '<span class="text-red-500">直播中</span>';
            document.getElementById('streamIndicator').className = 'w-3 h-3 rounded-full bg-red-500 animate-pulse';
            document.getElementById('streamPlatformCount').textContent = `${platforms.length} 个平台`;
            document.getElementById('streamRecording').textContent = enableCache ? '录制中' : '未录制';

            // Mark platform cards as streaming
            for (const platform of platforms) {
                const card = document.querySelector(`[data-platform="${platform.id}"].platform-card`);
                if (card) {
                    card.classList.add('streaming');
                    const status = card.querySelector('.platform-status');
                    if (status) status.textContent = '推流中...';
                    status.classList.add('text-red-500');
                }
            }

            // Disable inputs while streaming
            disablePlatformInputs(true);

            // Start HLS player
            startHlsPlayer();

            showToast(`🔴 已开始推流到 ${platforms.length} 个平台`);
        } else {
            showToast(result.error || '直播启动失败', 'error');
        }
    } catch (error) {
        console.error('Failed to start streaming:', error);
        showToast('直播启动失败：' + error.message, 'error');
    }
}

async function stopStreaming() {
    try {
        const response = await fetch(`${API_BASE}/streaming/stop`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            if (streamInterval) {
                clearInterval(streamInterval);
                streamInterval = null;
            }
            streamStartTime = null;

            // Update UI
            document.getElementById('btnStartStream').disabled = false;
            document.getElementById('btnStopStream').disabled = true;
            document.getElementById('streamPlatformCount').textContent = '0 个平台';
            document.getElementById('streamDuration').textContent = '00:00:00';
            document.getElementById('streamStatus').innerHTML = '<span class="text-slate-400">未开始</span>';
            document.getElementById('streamIndicator').className = 'w-3 h-3 rounded-full bg-slate-500';
            document.getElementById('streamRecording').textContent = '未录制';

            // Reset platform cards
            document.querySelectorAll('.platform-card').forEach(card => {
                card.classList.remove('streaming');
                const status = card.querySelector('.platform-status');
                if (status) {
                    status.textContent = '待推流';
                    status.classList.remove('text-red-500');
                }
            });

            // Enable inputs
            disablePlatformInputs(false);

            // Stop HLS player
            stopHlsPlayer();

            // Refresh recordings
            loadRecordings();

            showToast('⬛ 直播已停止');
        }
    } catch (error) {
        console.error('Failed to stop streaming:', error);
        showToast('直播停止失败', 'error');
    }
}

function disablePlatformInputs(disabled) {
    document.querySelectorAll('.platform-toggle').forEach(toggle => {
        toggle.disabled = disabled;
    });
    document.querySelectorAll('.platform-key').forEach(input => {
        input.disabled = disabled;
    });
    document.getElementById('cameraSource').disabled = disabled;
    document.getElementById('streamResolution').disabled = disabled;
    document.getElementById('streamBitrate').disabled = disabled;
}

function updateStreamStatus() {
    if (!streamStartTime) return;

    const now = new Date();
    const diff = Math.floor((now - streamStartTime) / 1000);

    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');

    const durationEl = document.getElementById('streamDuration');
    if (durationEl) {
        durationEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

function startHlsPlayer() {
    const video = document.getElementById('hlsPlayer');
    const placeholder = document.getElementById('hlsPlaceholder');
    const hlsUrl = document.getElementById('hlsUrl');

    if (video) {
        video.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        if (hlsUrl) hlsUrl.textContent = `${window.location.origin}/hls/stream.m3u8`;

        // Check for HLS support
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = `${window.location.origin}/hls/stream.m3u8`;
        } else if (Hls.isSupported()) {
            // HLS.js for other browsers
            hls = new Hls();
            hls.loadSource(`${window.location.origin}/hls/stream.m3u8`);
            hls.attachMedia(video);
        } else {
            showToast('您的浏览器不支持 HLS 播放', 'error');
        }
    }
}

function stopHlsPlayer() {
    const video = document.getElementById('hlsPlayer');
    const placeholder = document.getElementById('hlsPlaceholder');
    const hlsUrl = document.getElementById('hlsUrl');

    if (hls) {
        hls.destroy();
        hls = null;
    }

    if (video) {
        video.classList.add('hidden');
        video.src = '';
        if (placeholder) placeholder.classList.remove('hidden');
        if (hlsUrl) hlsUrl.textContent = '-';
    }
}

async function loadRecordings() {
    try {
        const response = await fetch(`${API_BASE}/streaming/recordings`);
        const result = await response.json();

        if (result.success) {
            renderRecordings(result.data);
        }
    } catch (error) {
        console.error('Failed to load recordings:', error);
    }
}

function renderRecordings(recordings) {
    const listEl = document.getElementById('recordingsList');
    if (!listEl) return;

    if (recordings.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center py-8">暂无录像</p>';
        return;
    }

    listEl.innerHTML = recordings.map(rec => `
        <div class="card-alt flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="text-2xl">📼</span>
                <div>
                    <p class="font-medium text-sm">${rec.name}</p>
                    <p class="text-xs text-muted">${rec.size} • ${new Date(rec.date).toLocaleString('zh-CN')}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="downloadRecording('${rec.name}')" class="text-sm text-emerald-500 hover:text-emerald-400 p-1">⬇️</button>
                <button onclick="deleteRecording('${rec.name}')" class="text-sm text-muted hover:text-red-500 p-1">🗑️</button>
            </div>
        </div>
    `).join('');
}

function downloadRecording(filename) {
    window.location.href = `${API_BASE}/streaming/download/${filename}`;
}

async function deleteRecording(filename) {
    if (!confirm(`确定要删除录像 "${filename}" 吗？`)) return;

    try {
        const response = await fetch(`${API_BASE}/streaming/recordings/${filename}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            loadRecordings();
            showToast('🗑️ 已删除');
        }
    } catch (error) {
        console.error('Failed to delete recording:', error);
        showToast('删除失败', 'error');
    }
}

// Add HLS.js library
const hlsScript = document.createElement('script');
hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
document.head.appendChild(hlsScript);

async function loadStreamingStatus() {
    try {
        const response = await fetch(`${API_BASE}/streaming/status`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // Load platform info
            if (data.platforms) {
                platformInfo = data.platforms;
            }

            // If stream is active, update UI
            if (data.active && data.startTime) {
                streamStartTime = new Date(data.startTime);
                updateStreamStatus();
                streamInterval = setInterval(updateStreamStatus, 1000);

                document.getElementById('btnStartStream').disabled = true;
                document.getElementById('btnStopStream').disabled = false;
                document.getElementById('streamStatus').innerHTML = '<span class="text-red-500">直播中</span>';
                document.getElementById('streamIndicator').className = 'w-3 h-3 rounded-full bg-red-500 animate-pulse';

                // Update platform count
                if (data.platforms && Array.isArray(data.platforms)) {
                    const activeCount = data.platforms.filter(p => p.status === 'streaming').length;
                    document.getElementById('streamPlatformCount').textContent = `${activeCount} 个平台`;
                }

                // Update recording status
                if (data.recording) {
                    document.getElementById('streamRecording').textContent = '录制中';
                }

                // Disable inputs while streaming
                disablePlatformInputs(true);

                // Mark active platform cards
                if (data.platforms && Array.isArray(data.platforms)) {
                    for (const platform of data.platforms) {
                        if (platform.enabled) {
                            const card = document.querySelector(`[data-platform="${platform.id}"].platform-card`);
                            if (card) {
                                card.classList.add('streaming');
                                // Check the toggle
                                const toggle = card.querySelector('.platform-toggle');
                                if (toggle) {
                                    toggle.checked = true;
                                    toggle.disabled = true;
                                }
                                // Show config
                                const config = card.querySelector('.platform-config');
                                if (config) config.classList.remove('hidden');

                                const status = card.querySelector('.platform-status');
                                if (status) {
                                    status.textContent = platform.status === 'streaming' ? '推流中...' : '待推流';
                                }
                            }
                        }
                    }
                }

                startHlsPlayer();
            }
        }
    } catch (error) {
        console.error('Failed to load streaming status:', error);
    }
}
