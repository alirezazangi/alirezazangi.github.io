// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import { loadScript } from './utils.js';

const LIGHTWEIGHT_CHARTS_URL = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';

// ===== UTILITY FUNCTIONS =====
function formatNumberWithUnit(num) {
    if (num == null || isNaN(num)) return '0';
    const units = ["", "K", "M", "B", "T"];
    const isNegative = num < 0;
    num = Math.abs(num);
    let unitIndex = 0;
    while (num >= 1000 && unitIndex < units.length - 1) {
        num /= 1000;
        unitIndex++;
    }
    const formattedNum = num.toLocaleString(undefined, {
        minimumFractionDigits: unitIndex > 0 ? 2 : 0,
        maximumFractionDigits: unitIndex > 0 ? 2 : 0
    });
    return `${isNegative ? "-" : ""}${formattedNum}${units[unitIndex]}`;
}

// ===== INDICATOR DEFINITIONS =====
const INDICATOR_DEFS = {
    'Volume': {
        name: 'Volume',
        defaultSettings: {
            visible: true,
            ma1: { visible: true, length: 20, type: 'SMA', color: '#007bff', lineWidth: 2 },
            ma2: { visible: false, length: 50, type: 'SMA', color: '#ff6347', lineWidth: 2 },
        },
        create(chart, data, settings, paneId) {
            const series = {};
            series.main = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: paneId, visible: settings.visible });
            series.main.setData(data.volumeData);
            chart.priceScale(paneId).applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
            return series;
        },
        update(chart, indicator, data, newSettings) {
            indicator.series.main.applyOptions({ visible: newSettings.visible });
            this._updateMaSeries(chart, indicator, 'ma1', data.volumeData, newSettings);
            this._updateMaSeries(chart, indicator, 'ma2', data.volumeData, newSettings);
        },
        remove(chart, indicator) {
            Object.values(indicator.series).forEach(s => s && chart.removeSeries(s));
        },
        _updateMaSeries(chart, indicator, maKey, data, settings) {
            const maSettings = settings[maKey];
            let maSeries = indicator.series[maKey];
            if (!maSettings.visible || !(maSettings.length > 0)) {
                if (maSeries) { chart.removeSeries(maSeries); indicator.series[maKey] = null; }
                return;
            }
            const calculator = CandlestickChartTab._getMaCalculator(maSettings.type);
            const maData = calculator(data, maSettings.length);

            if (maSeries) {
                maSeries.applyOptions({ color: maSettings.color, lineWidth: maSettings.lineWidth });
                maSeries.setData(maData);
            } else {
                indicator.series[maKey] = chart.addLineSeries({
                    priceScaleId: indicator.paneId, color: maSettings.color, lineWidth: maSettings.lineWidth,
                    priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false,
                });
                indicator.series[maKey].setData(maData);
            }
        },
        getLegendValues(settings, liveDataPoint, lastDataPoint) {
            const dataPoint = liveDataPoint || lastDataPoint;
            const value = dataPoint ? formatNumberWithUnit(dataPoint.value) : '...';
            return `Volume <span class="live-value">${value}</span>`;
        }
    },
    'RSI': {
        name: 'Relative Strength Index',
        disabled: true,
        defaultSettings: {},
        create: () => {}, update: () => {}, remove: () => {}, getLegendValues: () => 'RSI (بزودی)'
    }
};

// ===== CORE CLASS: CandlestickChartTab =====
export class CandlestickChartTab extends BaseTab {
    constructor(stockId) {
        super('candlestick_chart', 'نمودار تکنیکال', stockId);
        this.chart = null;
        this.series = { candlestick: null };
        this.formattedData = { candleData: [], volumeData: [] };
        this.indicators = new Map();
        this.editingIndicatorId = null;
        this.container = null;
        this.lastCandleData = null;
        this.isIndicatorPaneCollapsed = false;

        // 💡 **IMPROVEMENT**: State for auto-repeating stepper buttons
        this.stepperInterval = null;
        this.stepperTimeout = null;
        this.boundStopStepper = this._stopStepper.bind(this);
    }

    static _getMaCalculator(type = 'SMA') {
        const calculators = {
            'SMA': CandlestickChartTab._calculateSMA,
        };
        return calculators[type] || CandlestickChartTab._calculateSMA;
    }

    static _calculateSMA(data, period) {
        if (period <= 0 || !data || data.length < period) return [];
        const smaData = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) { sum += data[i - j].value; }
            smaData.push({ time: data[i].time, value: sum / period });
        }
        return smaData;
    }

    getTemplate() {
        const indicatorListItems = Object.entries(INDICATOR_DEFS).map(([key, def]) =>
            `<li data-indicator-type="${key}" class="${def.disabled ? 'disabled' : ''}">${def.name} ${def.disabled ? '(بزودی)' : ''}</li>`
        ).join('');

        return `
            <style>
                /* ... (most existing styles are the same) ... */
                .chart-wrapper { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 600px; background: #fff; }
                .chart-toolbar { padding: 4px 10px; background-color: #f9f9f9; border-bottom: 1px solid #eee; display: flex; gap: 10px; align-items: center; }
                .toolbar-button { font-family: 'Vazirmatn', sans-serif; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 13px; }
                #chart-container { display: flex; flex-direction: column; flex-grow: 1; position: relative; }
                #candlestick-chart-element { width: 100%; flex-grow: 1; position: relative; }
                #indicator-pane { width: 100%; height: 25%; position: relative; transition: height 0.3s ease; border-top: 1px solid #eee; }
                .chart-wrapper.indicators-collapsed #indicator-pane { height: 0; border-top: none; overflow: hidden; }
                #indicator-pane-toggle { position: absolute; top: -22px; left: 20px; z-index: 20; background: #f0f3f5; border: 1px solid #e0e3e5; border-bottom: none; border-radius: 4px 4px 0 0; padding: 0 6px; cursor: pointer; display: flex; align-items: center; }
                #indicator-pane-toggle svg { width: 18px; height: 18px; transition: transform 0.3s ease; }
                .chart-wrapper.indicators-collapsed #indicator-pane-toggle { transform: translateY(22px); border-bottom: 1px solid #e0e3e5; border-top: none; }
                .chart-wrapper.indicators-collapsed #indicator-pane-toggle svg { transform: rotate(180deg); }
                #data-header { position: absolute; top: 10px; left: 60px; z-index: 10; font-family: monospace; font-size: 13px; color: #333; pointer-events: none; }
                .ohlc-value { margin: 0 8px 0 2px; } .positive { color: #27ae60; } .negative { color: #e74c3c; }
                #indicator-legends-container { position: absolute; top: 0; left: 0; z-index: 10; padding: 5px; display: flex; flex-direction: column; gap: 2px; }
                .indicator-legend { display: flex; align-items: center; gap: 6px; padding: 2px 5px; border-radius: 4px; font-size: 12px; }
                .indicator-legend.hidden { opacity: 0.5; }
                .indicator-name { color: #444; } .live-value { font-weight: bold; color: #007bff; margin: 0 4px; }
                .indicator-actions { display: inline-flex; gap: 4px; }
                .indicator-legend button { background: none; border: none; cursor: pointer; padding: 2px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.6; pointer-events: all; }
                .indicator-legend button:hover { opacity: 1; }
                .indicator-legend svg { width: 16px; height: 16px; }
                .modal { display: none; position: fixed; z-index: 10001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; }
                .modal.visible { display: flex; }
                .modal-content { background-color: #fff; margin: auto; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); width: 90%; max-width: 520px; font-family: 'Vazirmatn', sans-serif; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
                .modal-header h4 { margin: 0; font-size: 18px; }
                .modal-close { font-size: 24px; font-weight: bold; cursor: pointer; color: #888; }
                #indicator-select-modal .modal-body ul { list-style: none; padding: 0; margin: 0; }
                #indicator-select-modal .modal-body li { padding: 12px 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s; }
                #indicator-select-modal .modal-body li:hover { background-color: #f7f7f7; }
                #indicator-select-modal .modal-body li.disabled { color: #aaa; cursor: not-allowed; }
                #indicator-settings-modal .form-section { border: 1px solid #f0f0f0; border-radius: 4px; padding: 15px; margin-bottom: 15px; }
                #indicator-settings-modal .form-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
                #indicator-settings-modal .form-group { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
                #indicator-settings-modal label, #indicator-settings-modal input, #indicator-settings-modal select { font-size: 13px; }
                #indicator-settings-modal input[type="color"] { width: 32px; padding: 2px; height: 28px; border: 1px solid #ccc; border-radius: 4px; background: none; }
                #indicator-settings-modal select { padding: 5px; border-radius: 4px; border: 1px solid #ccc; background-color: #fff; }
                .number-input-stepper { display: flex; align-items: center; }
                .number-input-stepper input[type="number"] { width: 60px; height: 28px; text-align: center; border: 1px solid #ccc; border-left: none; border-right: none; padding: 0; border-radius: 0; -moz-appearance: textfield; }
                .number-input-stepper input::-webkit-outer-spin-button, .number-input-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .stepper-btn { width: 28px; height: 28px; background-color: #f0f3f5; border: 1px solid #ccc; cursor: pointer; font-size: 18px; font-weight: bold; line-height: 26px; padding: 0; user-select: none; }
                .stepper-btn.plus { border-radius: 0 4px 4px 0; }
                .stepper-btn.minus { border-radius: 4px 0 0 4px; }
                .modal-footer { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; }
                .modal-button { padding: 8px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
                .modal-button.ok { background-color: #007bff; color: white; }
                .modal-button.cancel { background-color: #6c757d; color: white; }
            </style>
            <div class="chart-wrapper">
                <div class="chart-toolbar"><button id="add-indicator-btn" class="toolbar-button">افزودن اندیکاتور</button></div>
                <div id="chart-container">
                    <div id="candlestick-chart-element"><div id="data-header"></div></div>
                    <div id="indicator-pane"><div id="indicator-legends-container"></div></div>
                    <div id="indicator-pane-toggle-container">
                        <button id="indicator-pane-toggle" title="Toggle Indicator Pane"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" /></svg></button>
                    </div>
                </div>
            </div>
            <div id="indicator-select-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header"><h4 id="modal-title">انتخاب اندیکاتور</h4><span class="modal-close">&times;</span></div>
                    <div class="modal-body"><ul>${indicatorListItems}</ul></div>
                </div>
            </div>
            <div id="indicator-settings-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header"><h4 id="modal-title">تنظیمات</h4><span class="modal-close">&times;</span></div>
                    <div class="modal-body"><div id="volume-settings-template">
                        <div class="form-section">
                            <div class="form-section-header"><input type="checkbox" id="vol-ma1-visible"><label for="vol-ma1-visible">Moving Average 1</label></div>
                            <div class="form-group"><label for="vol-ma1-type">Type:</label><select id="vol-ma1-type"><option value="SMA">Simple (SMA)</option><option value="EMA" disabled>Exponential (EMA) - بزودی</option></select></div>
                            <div class="form-group"><label>Length:</label><div class="number-input-stepper"><button type="button" class="stepper-btn plus" data-target="vol-ma1-length">+</button><input type="number" id="vol-ma1-length" min="1"><button type="button" class="stepper-btn minus" data-target="vol-ma1-length">-</button></div><label>Width:</label><input type="number" id="vol-ma1-lineWidth" min="1" max="10" value="2" style="width:50px;"><label>Color:</label><input type="color" id="vol-ma1-color"></div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-header"><input type="checkbox" id="vol-ma2-visible"><label for="vol-ma2-visible">Moving Average 2</label></div>
                             <div class="form-group"><label for="vol-ma2-type">Type:</label><select id="vol-ma2-type"><option value="SMA">Simple (SMA)</option><option value="EMA" disabled>Exponential (EMA) - بزودی</option></select></div>
                            <div class="form-group"><label>Length:</label><div class="number-input-stepper"><button type="button" class="stepper-btn plus" data-target="vol-ma2-length">+</button><input type="number" id="vol-ma2-length" min="1"><button type="button" class="stepper-btn minus" data-target="vol-ma2-length">-</button></div><label>Width:</label><input type="number" id="vol-ma2-lineWidth" min="1" max="10" value="2" style="width:50px;"><label>Color:</label><input type="color" id="vol-ma2-color"></div>
                        </div>
                    </div></div>
                    <div class="modal-footer"><button id="modal-ok" class="modal-button ok">Ok</button><button id="modal-cancel" class="modal-button cancel">Cancel</button></div>
                </div>
            </div>
        `;
    }

    async _fetchAndFormatData() {
        const rawData = await apiService.getClosingPriceDailyList(this.stockId, 300);
        if (!rawData || !rawData.closingPriceDaily) return false;
        
        const sortedData = rawData.closingPriceDaily.sort((a, b) => a.dEven - b.dEven);
        const candleData = [], volumeData = [];
        
        sortedData.forEach(day => {
            /**
             * 📖 **EXPLANATION OF CHANGE**:
             * This `if` condition is the core of the fix. It acts as a data sanitization filter.
             * Before adding a day's data to the chart, it checks for three critical conditions:
             * 1. `day.pClosing > 0`: The closing price must be positive.
             * 2. `day.priceMax > 0`: The high price must be positive.
             * 3. `day.qTotTran5J > 0`: The total volume must be greater than zero. This is the most important check,
             *    as zero volume means no trades occurred, making the price data unreliable.
             * Only if all these conditions are met is the candle considered valid and "kept". Otherwise, it is "deleted"
             * by simply skipping it.
             */
            if (day.pClosing > 0 && day.priceMax > 0 && day.qTotTran5J > 0) {
                const time = `${day.dEven.toString().substring(0, 4)}-${day.dEven.toString().substring(4, 6)}-${day.dEven.toString().substring(6, 8)}`;
                candleData.push({ time, open: day.priceFirst, high: day.priceMax, low: day.priceMin, close: day.pClosing, pDrCotVal: day.pDrCotVal });
                volumeData.push({ time, value: day.qTotTran5J, color: day.pClosing >= day.priceFirst ? 'rgba(39, 174, 96, 0.5)' : 'rgba(231, 76, 60, 0.5)' });
            }
        });

        // After filtering, check if any valid data is left.
        if (candleData.length === 0) {
            console.warn(`No valid candle data found for stock ${this.stockId} after filtering out zero-value days.`);
            return false; // Prevents trying to draw an empty chart.
        }
        
        this.formattedData = { candleData, volumeData };
        this.lastCandleData = candleData.length > 0 ? candleData[candleData.length - 1] : null;
        return true;
    }

    _setupEventListeners() {
        this.container.querySelector('#add-indicator-btn').addEventListener('click', () => {
            this.container.querySelector('#indicator-select-modal').classList.add('visible');
        });
        this.container.querySelector('#indicator-pane-toggle').addEventListener('click', () => this._toggleIndicatorPane());

        const selectModal = this.container.querySelector('#indicator-select-modal');
        selectModal.querySelector('.modal-close').addEventListener('click', () => selectModal.classList.remove('visible'));
        selectModal.addEventListener('click', (e) => {
            const target = e.target.closest('li');
            if (target && !target.classList.contains('disabled')) {
                const type = target.dataset.indicatorType;
                selectModal.classList.remove('visible');
                this._openSettingsModalForAdd(type);
            }
        });
        
        const settingsModal = this.container.querySelector('#indicator-settings-modal');
        settingsModal.querySelector('.modal-close').addEventListener('click', () => settingsModal.classList.remove('visible'));
        settingsModal.querySelector('#modal-cancel').addEventListener('click', () => settingsModal.classList.remove('visible'));
        settingsModal.querySelector('#modal-ok').addEventListener('click', () => this._saveSettings());
        
        this._setupStepperEvents(settingsModal);
        
        this.container.querySelector('#indicator-legends-container').addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) return;
            const legendEl = actionEl.closest('[data-indicator-id]');
            const id = legendEl.dataset.indicatorId;
            const action = actionEl.dataset.action;
            if (action === 'toggle-visibility') this._toggleIndicatorVisibility(id);
            else if (action === 'open-settings') this._openSettingsModalForEdit(id);
            else if (action === 'remove') this._removeIndicator(id);
        });
    }

    _stopStepper() {
        if (this.stepperTimeout) clearTimeout(this.stepperTimeout);
        if (this.stepperInterval) clearInterval(this.stepperInterval);
        this.stepperTimeout = null;
        this.stepperInterval = null;
    }

    _startStepper(e, input, isIncrement) {
        e.preventDefault();
        this._stopStepper();

        const step = () => {
            let value = parseInt(input.value, 10) || 1;
            value += isIncrement ? 1 : -1;
            input.value = Math.max(1, value);
        };

        step();

        this.stepperTimeout = setTimeout(() => {
            this.stepperInterval = setInterval(step, 80);
        }, 400);
    }

    _setupStepperEvents(settingsModal) {
        settingsModal.querySelectorAll('.stepper-btn').forEach(button => {
            const targetId = button.dataset.target;
            const input = settingsModal.querySelector(`#${targetId}`);
            if (!input) return;

            const isIncrement = button.classList.contains('plus');
            const handler = (e) => this._startStepper(e, input, isIncrement);

            button.addEventListener('mousedown', handler);
            button.addEventListener('touchstart', handler, { passive: false });
        });
        
        document.addEventListener('mouseup', this.boundStopStepper);
        document.addEventListener('touchend', this.boundStopStepper);
    }
    
    _setupCrosshairListener() {
        this.chart.subscribeCrosshairMove(param => {
            const candleData = param.point ? param.seriesData.get(this.series.candlestick) : this.lastCandleData;
            this._updateDataHeader(candleData);
            this._renderIndicatorLegends(param.seriesData);
        });
    }

    _updateDataHeader(data) {
        const header = this.container.querySelector('#data-header');
        if (!data || !header) return;
        const change = data.close - data.pDrCotVal;
        const percentChange = data.pDrCotVal !== 0 ? (change / data.pDrCotVal) * 100 : 0;
        const colorClass = change >= 0 ? 'positive' : 'negative';
        header.innerHTML = `
            <span class="ohlc-label">O:</span><span class="ohlc-value ${data.close >= data.open ? 'positive' : 'negative'}">${data.open}</span>
            <span class="ohlc-label">H:</span><span class="ohlc-value positive">${data.high}</span>
            <span class="ohlc-label">L:</span><span class="ohlc-value negative">${data.low}</span>
            <span class="ohlc-label">C:</span><span class="ohlc-value ${data.close >= data.open ? 'positive' : 'negative'}">${data.close}</span>
            <span class="${colorClass}">${change.toFixed(0)} (${percentChange.toFixed(2)}%)</span>
        `;
    }
    
    _toggleIndicatorPane() {
        this.isIndicatorPaneCollapsed = !this.isIndicatorPaneCollapsed;
        const wrapper = this.container.querySelector('.chart-wrapper');
        const chartElement = this.container.querySelector('#candlestick-chart-element');
        wrapper.classList.toggle('indicators-collapsed', this.isIndicatorPaneCollapsed);
        
        setTimeout(() => { if (this.chart) this.chart.resize(chartElement.clientWidth, chartElement.clientHeight); }, 300);
    }

    _addIndicator(type, settings) {
        if (!type || !INDICATOR_DEFS[type]) return;
        const id = `${type}_${Date.now()}`;
        const def = INDICATOR_DEFS[type];
        const finalSettings = settings || JSON.parse(JSON.stringify(def.defaultSettings));
        const paneId = 'volume-pane';
        const series = def.create(this.chart, this.formattedData, finalSettings, paneId);
        
        const indicatorData = { id, type, settings: finalSettings, series, paneId };
        this.indicators.set(id, indicatorData);
        
        def.update(this.chart, indicatorData, this.formattedData, finalSettings);
        
        this._renderIndicatorLegends();
    }

    _removeIndicator(id) {
        if (!this.indicators.has(id)) return;
        const indicator = this.indicators.get(id);
        INDICATOR_DEFS[indicator.type].remove(this.chart, indicator);
        this.indicators.delete(id);
        this._renderIndicatorLegends();
    }
    
    _updateIndicator(id, newSettings) {
        if (!this.indicators.has(id)) return;
        const indicator = this.indicators.get(id);
        indicator.settings = newSettings;
        INDICATOR_DEFS[indicator.type].update(this.chart, indicator, this.formattedData, newSettings);
        this._renderIndicatorLegends();
    }
    
    _toggleIndicatorVisibility(id) {
        if (!this.indicators.has(id)) return;
        const indicator = this.indicators.get(id);
        indicator.settings.visible = !indicator.settings.visible;
        this._updateIndicator(id, indicator.settings);
    }
    
    _renderIndicatorLegends(liveSeriesData) {
        const container = this.container.querySelector('#indicator-legends-container');
        if (!container) return;
        container.innerHTML = '';

        this.indicators.forEach(indicator => {
            const legendEl = document.createElement('div');
            legendEl.className = `indicator-legend ${indicator.settings.visible ? '' : 'hidden'}`;
            legendEl.dataset.indicatorId = indicator.id;
            const def = INDICATOR_DEFS[indicator.type];
            
            const liveDataPoint = liveSeriesData ? liveSeriesData.get(indicator.series.main) : undefined;
            const lastDataPoint = this.formattedData.volumeData.length > 0 ? this.formattedData.volumeData[this.formattedData.volumeData.length - 1] : null;

            legendEl.innerHTML = `
                <span class="indicator-name">${def.getLegendValues(indicator.settings, liveDataPoint, lastDataPoint)}</span>
                <span class="indicator-actions">
                    <button data-action="toggle-visibility" title="Toggle Visibility"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" /></svg></button>
                    <button data-action="open-settings" title="Settings"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.14,12.94C19.07,12.44 19,11.94 19,11.44C19,10.94 19.07,10.44 19.14,9.94L21.14,8.34L19.14,4.74L16.89,5.84C16.32,5.43 15.69,5.12 15,4.94L14.5,2.5H9.5L9,4.94C8.31,5.12 7.68,5.43 7.11,5.84L4.86,4.74L2.86,8.34L4.86,9.94C4.93,10.44 5,10.94 5,11.44C5,11.94 4.93,12.44 4.86,12.94L2.86,14.54L4.86,18.14L7.11,17.04C7.68,17.45 8.31,17.76 9,17.94L9.5,20.36H14.5L15,17.94C15.69,17.76 16.32,17.45 16.89,17.04L19.14,18.14L21.14,14.54L19.14,12.94M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5Z" /></svg></button>
                    <button data-action="remove" title="Remove"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg></button>
                </span>`;
            container.appendChild(legendEl);
        });
    }

    _openSettingsModalForAdd(type) {
        this.editingIndicatorId = null; 
        this.addingIndicatorType = type;
        const def = INDICATOR_DEFS[type];
        const modal = this.container.querySelector('#indicator-settings-modal');
        modal.querySelector('#modal-title').textContent = `افزودن ${def.name}`;
        this._populateModal(def.defaultSettings);
        modal.classList.add('visible');
    }

    _openSettingsModalForEdit(id) {
        this.editingIndicatorId = id;
        this.addingIndicatorType = null;
        const indicator = this.indicators.get(id);
        const modal = this.container.querySelector('#indicator-settings-modal');
        modal.querySelector('#modal-title').textContent = `تنظیمات ${INDICATOR_DEFS[indicator.type].name}`;
        this._populateModal(indicator.settings);
        modal.classList.add('visible');
    }
    
    _populateModal(settings) {
        const modal = this.container.querySelector('#indicator-settings-modal');
        modal.querySelector('#vol-ma1-visible').checked = settings.ma1.visible;
        modal.querySelector('#vol-ma1-type').value = settings.ma1.type;
        modal.querySelector('#vol-ma1-length').value = settings.ma1.length;
        modal.querySelector('#vol-ma1-lineWidth').value = settings.ma1.lineWidth;
        modal.querySelector('#vol-ma1-color').value = settings.ma1.color;
        modal.querySelector('#vol-ma2-visible').checked = settings.ma2.visible;
        modal.querySelector('#vol-ma2-type').value = settings.ma2.type;
        modal.querySelector('#vol-ma2-length').value = settings.ma2.length;
        modal.querySelector('#vol-ma2-lineWidth').value = settings.ma2.lineWidth;
        modal.querySelector('#vol-ma2-color').value = settings.ma2.color;
    }
    
    _saveSettings() {
        const modal = this.container.querySelector('#indicator-settings-modal');
        const newSettings = {
            visible: true,
            ma1: {
                visible: modal.querySelector('#vol-ma1-visible').checked,
                type: modal.querySelector('#vol-ma1-type').value,
                length: parseInt(modal.querySelector('#vol-ma1-length').value, 10) || 1,
                lineWidth: parseInt(modal.querySelector('#vol-ma1-lineWidth').value, 10) || 1,
                color: modal.querySelector('#vol-ma1-color').value,
            },
            ma2: {
                visible: modal.querySelector('#vol-ma2-visible').checked,
                type: modal.querySelector('#vol-ma2-type').value,
                length: parseInt(modal.querySelector('#vol-ma2-length').value, 10) || 1,
                lineWidth: parseInt(modal.querySelector('#vol-ma2-lineWidth').value, 10) || 1,
                color: modal.querySelector('#vol-ma2-color').value,
            }
        };
        if (this.editingIndicatorId) {
            this._updateIndicator(this.editingIndicatorId, newSettings);
        } else if (this.addingIndicatorType) {
            this._addIndicator(this.addingIndicatorType, newSettings);
        }
        modal.classList.remove('visible');
        this.editingIndicatorId = null;
        this.addingIndicatorType = null;
    }

    _createChart() {
        const chartElement = this.container.querySelector('#candlestick-chart-element');
        const chartOptions = {
            width: chartElement.clientWidth, height: chartElement.clientHeight,
            rightPriceScale: { visible: true },
            timeScale: { rightOffset: 12, timeVisible: true },
            crosshair: { mode: window.LightweightCharts.CrosshairMode.Normal },
            grid: { vertLines: { color: '#f2f2f2' }, horzLines: { color: '#f2f2f2' } },
            layout: { background: { color: '#ffffff' }, textColor: '#333333' },
        };
        this.chart = window.LightweightCharts.createChart(chartElement, chartOptions);
        this.series.candlestick = this.chart.addCandlestickSeries({ upColor: '#27ae60', downColor: '#e74c3c', borderVisible: false, wickUpColor: '#27ae60', wickDownColor: '#e74c3c' });
        this.series.candlestick.setData(this.formattedData.candleData);
    }

    async init() {
        this.container = document.getElementById(this.name + '-container');
        if (!this.container) { console.error(`Chart tab container not found: #${this.name}-container`); return; }
        
        this.container.innerHTML = this.getTemplate();
        
        try {
            await loadScript(LIGHTWEIGHT_CHARTS_URL, 'lightweight-charts-script');
            const dataLoaded = await this._fetchAndFormatData();
            
            if (dataLoaded) {
                this._createChart();
                this._setupEventListeners();
                this._setupCrosshairListener();
                this._updateDataHeader(this.lastCandleData);
                this._renderIndicatorLegends();
            } else {
                this.container.querySelector('#chart-container').innerHTML = '<p>داده‌ای برای نمایش نمودار یافت نشد.</p>';
            }
        } catch (error) {
            console.error('Error initializing technical chart:', error);
            this.container.querySelector('#chart-container').innerHTML = '<p>خطا در بارگذاری نمودار.</p>';
        }
    }
    
    destroy() {
        this._stopStepper();
        document.removeEventListener('mouseup', this.boundStopStepper);
        document.removeEventListener('touchend', this.boundStopStepper);

        if (this.chart) { this.chart.remove(); this.chart = null; }
        if (this.container) { this.container.innerHTML = ''; }
        this.indicators.clear();
        super.destroy();
    }
}