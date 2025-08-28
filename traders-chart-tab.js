// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

// ===== CLASS DEFINITION =====

/**
 * 📖 **EXPLANATION OF FIX**
 * This version corrects a subtle bug where the "Net" (خالص) indicator lines
 * would not update when changing the chart type dropdown.
 *
 *   - **Problem**: The chart type value from the dropdown is lowercase (e.g., "volume"),
 *     while the corresponding API data key is capitalized (e.g., "buy_I_Volume"). The
 *     code was using the lowercase value, failing to find the correct data.
 *
 *   - **Solution**: In the `_addIndicatorDataSets` method, the `chartType` string is now
 *     capitalized before being used to construct the data key (e.g., "volume" becomes
 *     "Volume"). This ensures the correct data is always accessed, and the net
 *     balance lines update correctly for Volume, Value, and Count chart types.
 */
export class TradersChartTab extends BaseTab {
    constructor(stockId) {
        super('traders-chart', 'نمودار حقیقی-حقوقی و قیمت', stockId);
        this.isLoading = false;
        this.chart = null;
        this.priceChart = null;

        // Store for the complete dataset fetched from the API
        this.allTradersData = [];
        this.allPriceData = [];
    }

    // ===== UTILITY & FORMATTING =====

    _formatDate(dEven) {
        const year = Math.floor(dEven / 10000);
        const month = Math.floor((dEven % 10000) / 100);
        const day = dEven % 100;
        return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    }

    _calculateSMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1 || data[i] === null) {
                result.push(null);
            } else {
                const slice = data.slice(i - period + 1, i + 1);
                const validSlice = slice.filter(d => d !== null);
                if (validSlice.length < period) {
                    result.push(null);
                } else {
                    const sum = validSlice.reduce((a, b) => a + b, 0);
                    result.push(sum / period);
                }
            }
        }
        return result;
    }

    _calculateVolumeBalance(volumeData, balanceData) {
        if (volumeData.length !== balanceData.length) return [];
        return volumeData.map((volume, index) => {
            if (volume === null || balanceData[index] === null) {
                return null;
            }
            // Use a scaling factor to make the data visible on the chart alongside other metrics
            const scaleFactor = 0.0000001;
            return volume * balanceData[index] * scaleFactor;
        });
    }


    // ===== HTML TEMPLATE =====

    getTemplate() {
        return `
            <div class="section-title">نمودار قیمت و معاملات حقیقی و حقوقی</div>
            
            <div class="chart-section">
                <div class="chart-header">
                    <h3 class="chart-title">نمودار قیمت</h3>
                    <div class="chart-controls">
                        <div class="chart-type-selector">
                            <label>نوع نمودار:</label>
                            <select id="price-chart-type-selector">
                                <option value="line">خطی</option>
                                <option value="candlestick">شمعی</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="stockChartContainer" style="height: 400px; width: 100%;"></div>
            </div>
            
            <div class="chart-section">
                <div class="chart-header">
                    <h3 class="chart-title">نمودار معاملات حقیقی و حقوقی</h3>
                    <div class="chart-controls-wrapper">
                         <div class="chart-controls">
                            <label>نوع نمودار:</label>
                            <select id="chart-type-selector">
                                <option value="volume">حجم</option>
                                <option value="value">ارزش</option>
                                <option value="count">تعداد</option>
                                <option value="average">سرانه</option>
                                <option value="power">قدرت خرید</option>
                            </select>
                        </div>
                        <div class="chart-advanced-options">
                            <button id="toggle-sma-btn" class="toggle-btn">SMA</button>
                            <button id="toggle-volume-balance-btn" class="toggle-btn">حجم × خالص</button>
                        </div>
                    </div>
                </div>
                 <div class="date-range-selector">
                    <div class="date-input-group">
                        <label for="start-date">از تاریخ:</label>
                        <input type="text" id="start-date" class="persian-date-picker" placeholder="مثال: 1402/01/01">
                    </div>
                    <div class="date-input-group">
                        <label for="end-date">تا تاریخ:</label>
                        <input type="text" id="end-date" class="persian-date-picker" placeholder="مثال: 1402/01/30">
                    </div>
                    <button id="apply-date-filter" class="date-filter-btn">اعمال فیلتر</button>
                </div>
                <div class="chart-container">
                    <canvas id="traders-chart"></canvas>
                </div>
                <div id="chart-legend" class="chart-legend"></div>
            </div>
            
            <div class="chart-period-selector-container">
                <div class="chart-period-selector">
                    <button data-days="7" class="period-btn">هفته</button>
                    <button data-days="30" class="period-btn active">ماه</button>
                    <button data-days="90" class="period-btn">۳ ماه</button>
                    <button data-days="180" class="period-btn">۶ ماه</button>
                    <button data-days="365" class="period-btn">سال</button>
                    <button data-days="0" class="period-btn">کل دوره</button>
                </div>
            </div>
        `;
    }

    // ===== CHART CREATION & RENDERING =====

    _prepareDataSets(data, chartType) {
        const datasets = [];
        const dataMap = {
            volume: { title: 'حجم', keys: ['buy_I_Volume', 'sell_I_Volume', 'buy_N_Volume', 'sell_N_Volume'] },
            value: { title: 'ارزش', keys: ['buy_I_Value', 'sell_I_Value', 'buy_N_Value', 'sell_N_Value'] },
            count: { title: 'تعداد', keys: ['buy_I_Count', 'sell_I_Count', 'buy_N_Count', 'sell_N_Count'] },
        };
        const labels = ['خرید حقیقی', 'فروش حقیقی', 'خرید حقوقی', 'فروش حقوقی'];
        const colors = [
            'rgba(75, 192, 192, 0.5)', 'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)', 'rgba(255, 159, 64, 0.5)'
        ];

        if (dataMap[chartType]) {
            const { keys } = dataMap[chartType];
            keys.forEach((key, i) => {
                datasets.push({
                    label: labels[i],
                    data: data.map(item => item[key]),
                    backgroundColor: colors[i],
                    borderColor: colors[i].replace('0.5', '1'),
                    borderWidth: 1,
                    order: 2
                });
            });
            return { datasets, chartTitle: dataMap[chartType].title };
        }

        if (chartType === 'average') {
            return {
                datasets: [
                    { label: 'سرانه خرید حقیقی', data: data.map(item => item.buy_I_Count > 0 ? item.buy_I_Value / item.buy_I_Count : 0), backgroundColor: colors[0], order: 2 },
                    { label: 'سرانه فروش حقیقی', data: data.map(item => item.sell_I_Count > 0 ? item.sell_I_Value / item.sell_I_Count : 0), backgroundColor: colors[1], order: 2 },
                    { label: 'سرانه خرید حقوقی', data: data.map(item => item.buy_N_Count > 0 ? item.buy_N_Value / item.buy_N_Count : 0), backgroundColor: colors[2], order: 2 },
                    { label: 'سرانه فروش حقوقی', data: data.map(item => item.sell_N_Count > 0 ? item.sell_N_Value / item.sell_N_Count : 0), backgroundColor: colors[3], order: 2 },
                ], chartTitle: 'سرانه معاملات'
            };
        }

        if (chartType === 'power') {
            const powerCalc = (buyValue, buyCount, sellValue, sellCount) => {
                const buyAvg = buyCount > 0 ? buyValue / buyCount : 0;
                const sellAvg = sellCount > 0 ? sellValue / sellCount : 0;
                return sellAvg > 0 ? buyAvg / sellAvg : 0;
            };
            return {
                datasets: [
                    { label: 'قدرت خرید حقیقی', data: data.map(i => powerCalc(i.buy_I_Value, i.buy_I_Count, i.sell_I_Value, i.sell_I_Count)), backgroundColor: colors[0], type: 'bar', order: 2 },
                    { label: 'قدرت خرید حقوقی', data: data.map(i => powerCalc(i.buy_N_Value, i.buy_N_Count, i.sell_N_Value, i.sell_N_Count)), backgroundColor: colors[2], type: 'bar', order: 2 },
                ], chartTitle: 'قدرت خرید'
            };
        }

        return { datasets: [], chartTitle: '' };
    }

    _addIndicatorDataSets(data, chartType) {
        if (chartType === 'power') return []; // No indicators for power chart

        let individualBalance, institutionalBalance;

        // ✅ FIX: Capitalize the chartType to match API data keys (e.g., 'volume' -> 'Volume')
        const capitalizedChartType = chartType.charAt(0).toUpperCase() + chartType.slice(1);

        if (chartType === 'average') {
            // Average calculation is special and doesn't use the dynamic key
            const iBuyAvg = data.map(item => item.buy_I_Count > 0 ? item.buy_I_Value / item.buy_I_Count : 0);
            const iSellAvg = data.map(item => item.sell_I_Count > 0 ? item.sell_I_Value / item.sell_I_Count : 0);
            individualBalance = iBuyAvg.map((val, idx) => val - iSellAvg[idx]);

            const nBuyAvg = data.map(item => item.buy_N_Count > 0 ? item.buy_N_Value / item.buy_N_Count : 0);
            const nSellAvg = data.map(item => item.sell_N_Count > 0 ? item.sell_N_Value / item.sell_N_Count : 0);
            institutionalBalance = nBuyAvg.map((val, idx) => val - nSellAvg[idx]);
        } else {
            // Use the correctly capitalized key for 'volume', 'value', 'count'
            individualBalance = data.map(item => item[`buy_I_${capitalizedChartType}`] - item[`sell_I_${capitalizedChartType}`]);
            institutionalBalance = data.map(item => item[`buy_N_${capitalizedChartType}`] - item[`sell_N_${capitalizedChartType}`]);
        }
        
        const priceData = data.map(item => item.priceData ? item.priceData.pClosing : null);
        const volumeData = data.map(item => item.priceData ? item.priceData.qTotTran5J : null);

        const sma5 = this._calculateSMA(individualBalance, 5);
        const sma13 = this._calculateSMA(individualBalance, 13);
        const volumeBalance = this._calculateVolumeBalance(volumeData, individualBalance);
        
        return [
            { label: 'خالص حقیقی', data: individualBalance, type: 'line', borderColor: 'rgba(153, 102, 255, 1)', yAxisID: 'y1', order: 1 },
            { label: 'خالص حقوقی', data: institutionalBalance, type: 'line', borderColor: 'rgba(201, 203, 207, 1)', yAxisID: 'y1', order: 1 },
            { label: 'SMA(5) خالص حقیقی', data: sma5, type: 'line', borderColor: '#FFD700', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1', order: 1, hidden: true },
            { label: 'SMA(13) خالص حقیقی', data: sma13, type: 'line', borderColor: '#00FFFF', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1', order: 1, hidden: true },
            { label: 'حجم × خالص', data: volumeBalance, type: 'line', borderColor: '#FF69B4', yAxisID: 'y1', order: 1, hidden: true },
            { label: 'قیمت پایانی', data: priceData, type: 'line', borderColor: 'rgba(255, 0, 0, 1)', borderDash: [5, 5], yAxisID: 'y2', order: 0 },
            { label: 'حجم معاملات', data: volumeData, type: 'bar', backgroundColor: 'rgba(128, 128, 128, 0.3)', yAxisID: 'y3', order: 3 },
        ];
    }
    
    _getChartConfig(labels, datasets, chartTitle) {
        const hasPrice = datasets.some(ds => ds.label === 'قیمت پایانی' && ds.data.some(d => d !== null));
        return {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { stacked: false, reverse: true },
                    y: {
                        stacked: false, position: 'left', title: { display: true, text: chartTitle },
                        ticks: { callback: value => utils.formatNumberWithUnit(value) }
                    },
                    y1: {
                        position: 'right', title: { display: true, text: 'خالص' }, grid: { drawOnChartArea: false },
                        ticks: { callback: value => utils.formatNumberWithUnit(value) }
                    },
                    y2: hasPrice ? {
                        position: 'right', title: { display: true, text: 'قیمت (ریال)' }, grid: { drawOnChartArea: false },
                        ticks: { callback: value => value.toLocaleString('fa-IR') }
                    } : { display: false },
                    y3: {
                        position: 'right', title: { display: true, text: 'حجم معاملات' }, grid: { drawOnChartArea: false },
                        display: false // Hide axis labels to prevent clutter, data is in tooltip
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                let value = context.raw;
                                if (label.includes('قیمت')) return `${label}: ${value.toLocaleString('fa-IR')} ریال`;
                                if (label.includes('قدرت')) return `${label}: ${Number(value).toFixed(2)}`;
                                return `${label}: ${utils.formatNumberWithUnit(value)}`;
                            }
                        }
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                    }
                }
            }
        };
    }

    createChart(data, chartType = 'volume') {
        const ctx = document.getElementById('traders-chart').getContext('2d');
        if (this.chart) this.chart.destroy();

        const labels = data.map(item => this._formatDate(item.recDate));
        
        let { datasets, chartTitle } = this._prepareDataSets(data, chartType);
        const indicatorDatasets = this._addIndicatorDataSets(data, chartType);
        
        const allDatasets = [...datasets, ...indicatorDatasets];

        const chartConfig = this._getChartConfig(labels, allDatasets, chartTitle);
        this.chart = new Chart(ctx, chartConfig);
        
        this.createCustomLegend(allDatasets);
    }
    
    createCustomLegend(datasets) {
        const legendContainer = document.getElementById('chart-legend');
        legendContainer.innerHTML = '';
        datasets.forEach((dataset, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.style.opacity = dataset.hidden ? 0.5 : 1;
            
            const colorBox = document.createElement('span');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = dataset.backgroundColor || dataset.borderColor;
            
            const label = document.createElement('span');
            label.textContent = dataset.label;
            
            legendItem.append(colorBox, label);
            legendItem.addEventListener('click', () => {
                const isHidden = this.chart.isDatasetVisible(index);
                this.chart.setDatasetVisibility(index, !isHidden);
                legendItem.style.opacity = !isHidden ? 0.5 : 1;
                this.chart.update();
            });
            legendContainer.appendChild(legendItem);
        });
    }

    createCandlestickChart(data, days = 0) {
        if (!window.CanvasJS) return;
        
        data.sort((a, b) => a.dEven - b.dEven);
        const limitedData = days > 0 ? data.slice(-days) : data;
        if (limitedData.length === 0) return;

        const dataPoints = limitedData.map(item => ({
            x: new Date(Math.floor(item.dEven / 10000), Math.floor((item.dEven % 10000) / 100) - 1, item.dEven % 100),
            y: [item.priceFirst, item.priceMax, item.priceMin, item.pClosing]
        }));
        
        const volumeDataPoints = limitedData.map(item => ({
            x: new Date(Math.floor(item.dEven / 10000), Math.floor((item.dEven % 10000) / 100) - 1, item.dEven % 100),
            y: item.qTotTran5J,
            color: item.pClosing >= item.priceFirst ? "rgba(0, 177, 106, 0.7)" : "rgba(255, 67, 77, 0.7)"
        }));

        if (this.priceChart) this.priceChart.destroy();
        
        const chartType = document.getElementById("price-chart-type-selector").value;

        this.priceChart = new CanvasJS.StockChart("stockChartContainer", {
            theme: "light2",
            animationEnabled: true,
            exportEnabled: true,
            charts: [{
                axisY: { title: "قیمت (ریال)" },
                toolTip: { shared: true },
                data: [{
                    type: chartType,
                    name: "قیمت",
                    yValueFormatString: "#,### ریال",
                    dataPoints: chartType === 'candlestick' ? dataPoints : dataPoints.map(p => ({ x: p.x, y: p.y[3] }))
                }]
            }, {
                height: 100,
                axisY: { title: "حجم" },
                toolTip: { shared: true },
                data: [{ type: "column", name: "حجم", yValueFormatString: "#,###", dataPoints: volumeDataPoints }]
            }],
            navigator: {
                data: [{ dataPoints: dataPoints.map(p => ({ x: p.x, y: p.y[3] })) }],
                slider: { minimum: dataPoints[0].x, maximum: dataPoints[dataPoints.length - 1].x }
            },
            rangeSelector: { enabled: false }
        });
        this.priceChart.render();
    }

    // ===== DATA LOADING & PROCESSING =====

    async _loadAllData() {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            const [tradersData, priceData] = await Promise.all([
                apiService.getClientTypeHistory(this.stockId),
                apiService.getClosingPriceDailyList(this.stockId, 0) // Fetch all
            ]);
            
            // Sort data descending by date (newest first)
            this.allTradersData = tradersData?.clientType.sort((a,b) => b.recDate - a.recDate) || [];
            this.allPriceData = priceData?.closingPriceDaily.sort((a,b) => b.dEven - a.dEven) || [];

        } catch (error) {
            console.error("Error fetching chart data:", error);
            // Optionally, display an error message in the UI
        } finally {
            this.isLoading = false;
        }
    }
    
    _getProcessedChartData(days = 0) {
        // Take a slice of the pre-fetched, sorted data
        let tradersData = days > 0 ? this.allTradersData.slice(0, days) : [...this.allTradersData];
        let priceDataForPeriod = days > 0 ? this.allPriceData.slice(0, days) : [...this.allPriceData];

        // Create a lookup map for faster price matching
        const priceMap = new Map(priceDataForPeriod.map(p => [p.dEven, p]));
        
        // Combine trader data with corresponding price data
        return tradersData.map(trade => ({
            ...trade,
            priceData: priceMap.get(trade.recDate) || null
        })).reverse(); // Reverse for charting (oldest first)
    }
    
    _getFilteredPriceData(days = 0) {
        const data = days > 0 ? this.allPriceData.slice(0, days) : [...this.allPriceData];
        return data.reverse(); // Reverse for charting (oldest first)
    }

    async renderCharts(days = 30) {
        if (this.allTradersData.length === 0 || this.allPriceData.length === 0) {
           await this._loadAllData();
        }

        const tradersChartData = this._getProcessedChartData(days);
        const priceChartData = this._getFilteredPriceData(days);

        if (tradersChartData.length > 0) {
            const chartType = document.getElementById('chart-type-selector')?.value || 'volume';
            this.createChart(tradersChartData, chartType);
        }
        if (priceChartData.length > 0) {
            this.createCandlestickChart(priceChartData); // The candlestick chart manages its own days via navigator
        }
    }
    
    filterDataByDateRange(startDate, endDate) {
        const startDEven = parseInt(startDate.replace(/\//g, ''));
        const endDEven = parseInt(endDate.replace(/\//g, ''));

        const filteredTradersData = this.allTradersData.filter(item => item.recDate >= startDEven && item.recDate <= endDEven);
        const filteredPriceData = this.allPriceData.filter(item => item.dEven >= startDEven && item.dEven <= endDEven);

        const priceMap = new Map(filteredPriceData.map(p => [p.dEven, p]));
        const combinedData = filteredTradersData.map(trade => ({
            ...trade,
            priceData: priceMap.get(trade.recDate) || null
        })).reverse();

        if (combinedData.length === 0) {
            alert('داده‌ای در بازه تاریخی انتخاب شده یافت نشد.');
            return;
        }

        const chartType = document.getElementById('chart-type-selector')?.value || 'volume';
        this.createChart(combinedData, chartType);
        this.createCandlestickChart(filteredPriceData.reverse());
    }


    // ===== LIFECYCLE & EVENT LISTENERS =====

    async init() {
        this.injectStyles();
        
        await Promise.all([
            this._loadChartJsLibraries(),
            this._loadCanvasJsLibraries(),
            this._loadPersianDatepickerLibraries(),
        ]);
        
        await this.afterInit();
    }
    
    async afterInit() {
        await this.renderCharts(30); // Default to 30 days
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('chart-type-selector')?.addEventListener('change', () => this._handlePeriodOrTypeChange());
        document.getElementById('price-chart-type-selector')?.addEventListener('change', () => this._handlePeriodOrTypeChange());
        
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.period-btn.active')?.classList.remove('active');
                e.currentTarget.classList.add('active');
                this._handlePeriodOrTypeChange();
            });
        });

        document.getElementById('toggle-sma-btn')?.addEventListener('click', () => {
            this._toggleDatasetVisibility('SMA');
        });

        document.getElementById('toggle-volume-balance-btn')?.addEventListener('click', () => {
            this._toggleDatasetVisibility('حجم × خالص');
        });
        
        document.getElementById('apply-date-filter')?.addEventListener('click', () => {
             const startDate = document.getElementById('start-date').value;
             const endDate = document.getElementById('end-date').value;
             if (startDate && endDate) {
                 this.filterDataByDateRange(startDate, endDate);
             } else {
                 alert('لطفا هر دو تاریخ شروع و پایان را انتخاب کنید.');
             }
        });
    }
    
    _handlePeriodOrTypeChange() {
        const activeBtn = document.querySelector('.period-btn.active');
        const days = activeBtn ? parseInt(activeBtn.dataset.days) : 30;
        this.renderCharts(days);
    }
    
    _toggleDatasetVisibility(labelIncludes) {
        if (!this.chart) return;
        
        const datasets = this.chart.data.datasets.filter(ds => ds.label.includes(labelIncludes));
        if (datasets.length === 0) return;
        
        const isCurrentlyVisible = this.chart.isDatasetVisible(this.chart.data.datasets.indexOf(datasets[0]));
        
        datasets.forEach(ds => {
            const index = this.chart.data.datasets.indexOf(ds);
            this.chart.setDatasetVisibility(index, !isCurrentlyVisible);
        });
        this.chart.update();
        this.createCustomLegend(this.chart.data.datasets); // Refresh legend state
    }

    // ===== DYNAMIC LIBRARY LOADING =====

    async _loadChartJsLibraries() {
        await utils.loadScript('https://cdn.jsdelivr.net/npm/chart.js', 'chart-js');
        await utils.loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom', 'chart-js-zoom');
        if (window.Chart && window.ChartZoom) {
            Chart.register(ChartZoom);
        }
    }

    _loadCanvasJsLibraries() {
        return utils.loadScript('https://cdn.canvasjs.com/canvasjs.stock.min.js', 'canvas-js-stock');
    }

    async _loadPersianDatepickerLibraries() {
        await utils.loadScript('https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js', 'jquery');
        await utils.loadScript('https://cdn.jsdelivr.net/npm/persian-date@1.1.0/dist/persian-date.min.js', 'persian-date');
        await utils.loadStyle('https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/css/persian-datepicker.min.css');
        await utils.loadScript('https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/js/persian-datepicker.min.js', 'persian-datepicker');
        
        // Initialize date pickers once loaded
        if (window.jQuery?.fn?.persianDatepicker) {
             $('.persian-date-picker').persianDatepicker({
                format: 'YYYY/MM/DD',
                autoClose: true,
                observer: true,
                initialValue: false
            });
        }
    }

    injectStyles() {
        const styleId = 'traders-chart-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            /* General Section Styles */
            .chart-section { margin-bottom: 2rem; border: 1px solid #e9ecef; border-radius: 0.5rem; padding: 1rem; background-color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
            .chart-title { font-size: 1.1rem; font-weight: 600; color: #343a40; margin: 0; }
            .chart-container { height: 400px; width: 100%; position: relative; }
            .canvasjs-chart-credit { display: none !important; }

            /* Controls & Selectors */
            .chart-controls-wrapper { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
            .chart-controls, .chart-type-selector, .chart-advanced-options, .date-input-group { display: flex; align-items: center; gap: 0.5rem; }
            .chart-controls select, .persian-date-picker { padding: 0.375rem 0.75rem; border-radius: 0.25rem; border: 1px solid #ced4da; font-family: inherit; }
            
            /* Date Range Filter */
            .date-range-selector { display: flex; justify-content: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; padding: 0.5rem; background: #f8f9fa; border-radius: 0.375rem; }
            .persian-date-picker { width: 130px; text-align: center; }
            .date-filter-btn { padding: 0.375rem 1rem; background-color: var(--primary-accent); color: white; border: none; border-radius: 0.25rem; cursor: pointer; transition: background-color 0.2s; }
            .date-filter-btn:hover { background-color: var(--primary-accent-hover); }

            /* Period & Toggle Buttons */
            .chart-period-selector-container { display: flex; justify-content: center; margin: 1.5rem 0; }
            .chart-period-selector { display: flex; gap: 0.5rem; background-color: #e9ecef; padding: 0.25rem; border-radius: 0.5rem; }
            .period-btn, .toggle-btn { padding: 0.5rem 1rem; background: transparent; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500; transition: all 0.2s; }
            .period-btn.active { background: #fff; color: var(--primary-accent); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .toggle-btn { background-color: #f0f0f0; border: 1px solid #ccc; font-size: 0.8rem; }
            .toggle-btn:hover { background-color: #e0e0e0; }

            /* Custom Legend */
            .chart-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; margin-top: 1rem; }
            .legend-item { display: flex; align-items: center; gap: 0.375rem; cursor: pointer; font-size: 0.85rem; }
            .color-box { width: 14px; height: 14px; border-radius: 3px; }
        `;
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    destroy() {
        if (this.chart) this.chart.destroy();
        if (this.priceChart) this.priceChart.destroy();
        // Event listeners are on elements that get destroyed with the tab, so no manual removal needed for them.
    }
}