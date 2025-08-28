// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

// ===== CONFIGURATION & CONSTANTS =====
const CHART_COLORS = {
    positive: '#27ae60',
    negative: '#e74c3c',
    primary: '#007bff',
    warning: '#f39c12',
    secondary: '#6c757d',
    dark: '#212529',
    positive_bg_start: 'rgba(39, 174, 96, 0.4)',
    positive_bg_end: 'rgba(39, 174, 96, 0)',
    negative_bg_start: 'rgba(231, 76, 60, 0.4)',
    negative_bg_end: 'rgba(231, 76, 60, 0)',
    primary_bg_start: 'rgba(0, 123, 255, 0.4)',
    primary_bg_end: 'rgba(0, 123, 255, 0)',
    warning_bg_start: 'rgba(243, 156, 18, 0.4)',
    warning_bg_end: 'rgba(243, 156, 18, 0)',
    secondary_bg: 'rgba(108, 117, 125, 0.6)',
    dark_bg: 'rgba(40, 40, 40, 0.4)',
};


/**
 * 🚀 SaraneTab: Advanced Real-time Stock Analysis
 *
 * This tab provides a comprehensive, multi-chart dashboard for real-time analysis of a stock's trading behavior.
 * It synthesizes data from two distinct sources:
 * 1. Tablokhani API: For real-time per-capita (Sarane) and trader-type data.
 * 2. TSETMC API: For official trade history, providing price and volume data.
 */
export class SaraneTab extends BaseTab {
    constructor(stockId) {
        super('sarane', 'تحلیل لحظه‌ای سرانه', stockId);
        this.charts = new Map();
        this.crosshairPlugin = this.createCrosshairPlugin();
        this.isMouseOverChart = false;
    }

    // ===== LIFECYCLE METHODS =====

    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if (!container) return;
        container.innerHTML = this.getTemplate();

        const data = await this.fetchData();
        if (data && data.timeLabels.length > 0) {
            this.createCharts(data);
            this.setupSyncListeners();
            this.startUpdateInterval(5 * 60 * 1000); // Update every 5 minutes
        } else {
            container.innerHTML = `<div class="error-message-container"><p class="error-message">اطلاعاتی برای نمایش وجود ندارد یا در دریافت آن مشکلی رخ داده است.</p></div>`;
        }
    }

    async update() {
        const data = await this.fetchData();
        if (data && data.timeLabels.length > 0) {
            this.charts.forEach(chart => chart.destroy());
            this.charts.clear();
            this.createCharts(data);
            this.setupSyncListeners();
        }
    }

    destroy() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
        super.destroy();
    }

    // ===== DATA HANDLING =====

    async fetchData() {
        try {
            const [saraneText, tradeHistoryData] = await Promise.all([
                apiService.fetchSaraneData(this.stockId),
                apiService.getTradeHistory(this.stockId)
            ]);
            if (!saraneText || !tradeHistoryData) return null;
            return this.processData(saraneText, tradeHistoryData.trade || []);
        } catch (error) {
            console.error('Error fetching SaraneTab data:', error);
            return null;
        }
    }

    processData(saraneData, tradeHistoryData) {
        const priceByMinute = new Map();
        const tradeGroups = new Map();
        tradeHistoryData.forEach(trade => {
            if (trade.canceled) return;
            const hourMin = trade.hEven.toString().padStart(6, '0').substring(0, 4);
            if (!tradeGroups.has(hourMin)) {
                tradeGroups.set(hourMin, { totalVolume: 0, totalValue: 0 });
            }
            const group = tradeGroups.get(hourMin);
            group.totalVolume += trade.qTitTran;
            group.totalValue += trade.qTitTran * trade.pTran;
        });
        tradeGroups.forEach((group, hourMin) => {
            if (group.totalVolume > 0) {
                priceByMinute.set(hourMin, group.totalValue / group.totalVolume);
            }
        });

        const rows = saraneData.split(';').filter(r => r);
        const data = {
            timeLabels: [], buyPerCapita: [], sellPerCapita: [], buyPower: [], sellPower: [],
            lastPrice: [], demandedPrice: [], offeredPrice: [], buyVolumeReal: [], sellVolumeReal: [],
            buyValueLegal: [], sellValueLegal: [], buyValueReal: [], sellValueReal: [],
            tradePrice: []
        };
        let prev = {};
        let lastKnownPrice = tradeHistoryData.length > 0 ? tradeHistoryData[0].pTran : (rows.length > 0 ? parseFloat(rows[0].split(',')[15]) : 0);

        rows.forEach(row => {
            const cols = row.split(',');
            if (cols.length < 16) return;

            const timeStr = cols[0].padStart(6, '0');
            const hourMin = timeStr.substring(0, 4);
            const formattedTime = utils.formatTime(timeStr);
            const [hours] = formattedTime.split(':');

            if (parseInt(hours) >= 9) {
                const currentDate = new Date();
                currentDate.setHours(parseInt(timeStr.substring(0, 2)), parseInt(timeStr.substring(2, 4)), 0, 0);

                const priceForThisMinute = priceByMinute.get(hourMin);
                if (priceForThisMinute !== undefined) {
                    lastKnownPrice = priceForThisMinute;
                }
                data.tradePrice.push({ x: currentDate, y: lastKnownPrice });

                const current = { lastPrice: parseFloat(cols[1]), buyCountReal: parseInt(cols[3], 10), buyVolumeReal: parseFloat(cols[5]), sellCountReal: parseInt(cols[7], 10), sellVolumeReal: parseFloat(cols[9]), buyVolumeLegal: parseFloat(cols[6]), sellVolumeLegal: parseFloat(cols[10]) };
                const delta = { buyCountReal: (current.buyCountReal || 0) - (prev.buyCountReal || 0), sellCountReal: (current.sellCountReal || 0) - (prev.sellCountReal || 0), buyVolumeReal: (current.buyVolumeReal || 0) - (prev.buyVolumeReal || 0), sellVolumeReal: (current.sellVolumeReal || 0) - (prev.sellVolumeReal || 0), buyVolumeLegal: (current.buyVolumeLegal || 0) - (prev.buyVolumeLegal || 0), sellVolumeLegal: (current.sellVolumeLegal || 0) - (prev.sellVolumeLegal || 0) };
                prev = current;
                const buyValueRealDelta = (delta.buyVolumeReal * current.lastPrice) / 1e7;
                const sellValueRealDelta = (delta.sellVolumeReal * current.lastPrice) / 1e7;
                const buyPerCapita = delta.buyCountReal > 0 ? buyValueRealDelta / delta.buyCountReal : 0;
                const sellPerCapita = delta.sellCountReal > 0 ? sellValueRealDelta / delta.sellCountReal : 0;

                data.timeLabels.push(currentDate);
                data.lastPrice.push({ x: currentDate, y: current.lastPrice });
                data.demandedPrice.push({ x: currentDate, y: parseFloat(cols[12]) });
                data.offeredPrice.push({ x: currentDate, y: parseFloat(cols[14]) });
                data.buyPerCapita.push({ x: currentDate, y: buyPerCapita });
                data.sellPerCapita.push({ x: currentDate, y: sellPerCapita });
                data.buyPower.push({ x: currentDate, y: sellPerCapita > 0 ? buyPerCapita / sellPerCapita : 0 });
                data.sellPower.push({ x: currentDate, y: buyPerCapita > 0 ? sellPerCapita / buyPerCapita : 0 });
                data.buyVolumeReal.push({ x: currentDate, y: delta.buyVolumeReal });
                data.sellVolumeReal.push({ x: currentDate, y: delta.sellVolumeReal });
                data.buyValueReal.push({ x: currentDate, y: buyValueRealDelta });
                data.sellValueReal.push({ x: currentDate, y: sellValueRealDelta });
                data.buyValueLegal.push({ x: currentDate, y: (delta.buyVolumeLegal * current.lastPrice) / 1e7 });
                data.sellValueLegal.push({ x: currentDate, y: (delta.sellVolumeLegal * current.lastPrice) / 1e7 });
            }
        });

        return data;
    }

    // ===== UI & CHARTING =====

    getTemplate() {
        return `
            <div class="chart-grid">
                <div class="chart-container"><h3 class="chart-title">سرانه خرید و فروش حقیقی (میلیون تومان)</h3><canvas id="tradingCapitaChart"></canvas></div>
                <div class="chart-container"><h3 class="chart-title">قدرت خریدار به فروشنده</h3><canvas id="tradingPowerChart"></canvas></div>
                <div class="chart-container"><h3 class="chart-title">محدوده قیمت (عرضه و تقاضا)</h3><canvas id="priceRangeChart"></canvas></div>
                <div class="chart-container"><h3 class="chart-title">حجم خرید و فروش حقیقی</h3><canvas id="realPersonVolumeChart"></canvas></div>
                <div class="chart-container"><h3 class="chart-title">ارزش معاملات (میلیون تومان)</h3><canvas id="tradingDetailsChart"></canvas></div>
            </div>
            <style>
                .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 1.5rem; }
                .chart-container { background: var(--bg-widget); padding: 1rem; border-radius: var(--border-radius); box-shadow: var(--shadow); border: 1px solid var(--border-color); height: 400px; position: relative; }
                .chart-title { text-align: center; font-size: 1em; font-weight: 600; margin-bottom: 1rem; color: var(--text-secondary); }
                .error-message-container { display: flex; justify-content: center; align-items: center; height: 300px; background: var(--bg-main); border-radius: var(--border-radius); }
                .error-message { font-size: 1.2em; color: var(--text-secondary); }
            </style>
        `;
    }

    createGradient(ctx, startColor, endColor) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        return gradient;
    }

    createCrosshairPlugin() {
        return {
            id: 'crosshair',
            afterDraw: (chart) => {
                if (chart.tooltip?.getActiveElements?.().length && this.isMouseOverChart) {
                    const activeElement = chart.tooltip.getActiveElements()[0];
                    const ctx = chart.ctx;
                    const x = activeElement.element.x;
                    const topY = chart.scales.y.top;
                    const bottomY = chart.scales.y.bottom;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, topY);
                    ctx.lineTo(x, bottomY);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.stroke();
                    ctx.restore();
                }
            },
        };
    }

    /*
        QUOTE ORIGINAL:
        The original sync logic used `getElementsAtEventForMode`, which relied on mouse pixel coordinates.
        This caused issues when data was sparse, leading to tooltips showing "0" for non-existent data points.

        EXPLANATION OF FIX:
        This function has been completely re-architected to be data-driven.
        1.  **Get Master Timestamp:** When hovering over the source chart, we get the precise timestamp of the active data point.
        2.  **Timestamp-Based Search:** We then iterate through all other charts and programmatically *search* for a data point with the exact same timestamp. A fast `findIndex` is used for this.
        3.  **Precise Activation/Deactivation:**
            - If a matching timestamp is found, we activate the tooltip for that specific data point.
            - If no match is found (a data gap), we explicitly deactivate the tooltip for that chart by calling `setActiveElements([])`.
        This new timestamp-based logic is far more robust and completely eliminates the "phantom 0" tooltip bug.
    */
    setupSyncListeners() {
        const charts = Array.from(this.charts.values());
        for (const sourceChart of charts) {
            sourceChart.canvas.addEventListener('mousemove', (e) => {
                this.isMouseOverChart = true;
                const activeElements = sourceChart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);

                if (activeElements.length > 0) {
                    const masterIndex = activeElements[0].index;
                    const masterTimestamp = sourceChart.data.datasets[0].data[masterIndex].x;

                    for (const targetChart of charts) {
                        const matchingIndex = targetChart.data.datasets[0]?.data.findIndex(p => p.x.getTime() === masterTimestamp.getTime());

                        if (matchingIndex > -1) {
                            const newActiveElements = [];
                            targetChart.data.datasets.forEach((dataset, datasetIndex) => {
                                if (targetChart.isDatasetVisible(datasetIndex)) {
                                    newActiveElements.push({ datasetIndex, index: matchingIndex });
                                }
                            });
                            targetChart.tooltip.setActiveElements(newActiveElements, e);
                        } else {
                            targetChart.tooltip.setActiveElements([], e);
                        }
                        targetChart.draw();
                    }
                }
            });

            sourceChart.canvas.addEventListener('mouseleave', () => {
                this.isMouseOverChart = false;
                for (const chart of charts) {
                    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
                    chart.draw();
                }
            });
        }
    }

    createCharts(data) {
        const tooltipCallbacks = {
            label: function (context) {
                let label = context.dataset.label || '';
                if (label) { label += ': '; }
                const value = context.raw.y;
                if (value !== null && !isNaN(value)) {
                    label += value.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
                }
                return label;
            }
        };

        const commonOptions = {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { type: 'time', time: { unit: 'minute', displayFormats: { minute: 'HH:mm' }, tooltipFormat: 'HH:mm' }, ticks: { autoSkip: true, maxTicksLimit: 10 } } },
            plugins: { legend: { position: 'bottom', labels: { padding: 20, font: { size: 11 } } }, tooltip: { callbacks: tooltipCallbacks, bodySpacing: 4, padding: 8 } },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 400, easing: 'easeOutQuart' },
            pointRadius: 0, pointHoverRadius: 5, pointBorderWidth: 1, pointHoverBorderWidth: 2,
        };

        const chartConfigs = [
            {
                id: 'tradingCapitaChart', type: 'line', options: { ...commonOptions, scales: { ...commonOptions.scales, y: { title: { display: true, text: 'میلیون تومان' } }, y1: { type: 'linear', position: 'right', display: false } } },
                datasets: [
                    { label: 'سرانه خرید', data: data.buyPerCapita, borderColor: CHART_COLORS.positive, backgroundColor: (context) => this.createGradient(context.chart.ctx, CHART_COLORS.positive_bg_start, CHART_COLORS.positive_bg_end), fill: 'start' },
                    { label: 'سرانه فروش', data: data.sellPerCapita, borderColor: CHART_COLORS.negative, backgroundColor: (context) => this.createGradient(context.chart.ctx, CHART_COLORS.negative_bg_start, CHART_COLORS.negative_bg_end), fill: 'start' },
                    { label: 'قیمت', data: data.tradePrice, borderColor: CHART_COLORS.dark_bg, yAxisID: 'y1', borderWidth: 2, borderDash: [5, 5] },
                ]
            },
            {
                id: 'tradingPowerChart', type: 'line', options: { ...commonOptions, scales: { ...commonOptions.scales, y: { title: { display: true, text: 'نسبت' } }, y1: { type: 'linear', position: 'right', display: false } } },
                datasets: [
                    { label: 'قدرت خرید', data: data.buyPower, borderColor: CHART_COLORS.primary, backgroundColor: (context) => this.createGradient(context.chart.ctx, CHART_COLORS.primary_bg_start, CHART_COLORS.primary_bg_end), fill: 'start' },
                    { label: 'قدرت فروش', data: data.sellPower, borderColor: CHART_COLORS.warning, backgroundColor: (context) => this.createGradient(context.chart.ctx, CHART_COLORS.warning_bg_start, CHART_COLORS.warning_bg_end), fill: 'start' },
                    { label: 'قیمت', data: data.tradePrice, borderColor: CHART_COLORS.dark_bg, yAxisID: 'y1', borderWidth: 2, borderDash: [5, 5] },
                ]
            },
            {
                id: 'priceRangeChart', type: 'line', options: { ...commonOptions },
                datasets: [{ label: 'آخرین قیمت', data: data.lastPrice, borderColor: CHART_COLORS.dark, borderWidth: 2 }, { label: 'قیمت تقاضا', data: data.demandedPrice, borderColor: CHART_COLORS.positive }, { label: 'قیمت عرضه', data: data.offeredPrice, borderColor: CHART_COLORS.negative },]
            },
            {
                id: 'realPersonVolumeChart', type: 'line', options: { ...commonOptions, scales: { ...commonOptions.scales, y: { title: { display: true, text: 'حجم' } } } },
                datasets: [{ label: 'حجم خرید حقیقی', data: data.buyVolumeReal, borderColor: CHART_COLORS.positive }, { label: 'حجم فروش حقیقی', data: data.sellVolumeReal, borderColor: CHART_COLORS.negative },]
            },
            {
                id: 'tradingDetailsChart', type: 'line', options: { ...commonOptions, scales: { ...commonOptions.scales, y: { stacked: true, title: { display: true, text: 'میلیون تومان' } } } },
                datasets: [{ label: 'ارزش خرید حقیقی', data: data.buyValueReal, backgroundColor: 'rgba(39, 174, 96, 0.6)', borderColor: CHART_COLORS.positive, fill: true }, { label: 'ارزش فروش حقیقی', data: data.sellValueReal, backgroundColor: 'rgba(231, 76, 60, 0.6)', borderColor: CHART_COLORS.negative, fill: true }, { label: 'ارزش خرید حقوقی', data: data.buyValueLegal, backgroundColor: 'rgba(0, 123, 255, 0.5)', borderColor: CHART_COLORS.primary, fill: true }, { label: 'ارزش فروش حقوقی', data: data.sellValueLegal, backgroundColor: 'rgba(243, 156, 18, 0.5)', borderColor: CHART_COLORS.warning, fill: true },]
            }
        ];

        chartConfigs.forEach(config => {
            const ctx = document.getElementById(config.id)?.getContext('2d');
            if (ctx) {
                const chart = new Chart(ctx, {
                    type: config.type,
                    data: { datasets: config.datasets.map(ds => ({ ...ds, borderWidth: ds.borderWidth || 1.5, tension: 0.3, })) },
                    options: config.options,
                    plugins: [this.crosshairPlugin]
                });
                this.charts.set(config.id, chart);
            }
        });
    }
}