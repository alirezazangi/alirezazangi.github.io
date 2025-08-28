// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

// ===== CONFIGURATION & CONSTANTS =====
const UPDATE_INTERVAL_MS = 60000; // 1 minute
const TRADING_START_HOUR = 9;

/**
 * 🚀 **ARCHITECTURAL OVERVIEW**
 *
 * This module represents a significant architectural refactoring of the original `FilterTab`.
 * The new design adheres to modern best practices for building scalable and maintainable UI components.
 *
 * Key Principles Applied:
 * 1.  **Separation of Concerns (SoC)**: Logic is cleanly divided into distinct responsibilities:
 *     - Data Fetching & Processing (`fetchAndProcessData`, `processData`)
 *     - State Management (filters, sorting state stored in `this.currentSort`)
 *     - Rendering (`renderTable`, `updateSummaryStats`)
 *     - Event Handling (`setupEventListeners`, `handleSortClick`)
 *     This makes the code easier to debug, test, and extend.
 *
 * 2.  **Efficiency & Performance**:
 *     - **DOM Caching**: `cacheDOMElements` is called once during initialization to store references to frequently accessed DOM nodes, preventing expensive lookups in update loops.
 *     - **DocumentFragment**: `renderTable` uses a `DocumentFragment` to batch DOM manipulations, resulting in a single reflow and a much smoother user experience, especially with large datasets.
 *     - **Delegated API Calls**: Data fetching is delegated to the `apiService`, which includes a robust caching layer.
 *
 * 3.  **Code Reusability & Modularity**:
 *     - **Utility Functions**: Common tasks like formatting numbers and calculating percentages are handled by the centralized `utils.js` module.
 *     - **Component-Based Structure**: The class encapsulates all its logic, HTML, and styles, making it a self-contained, reusable component within the dashboard ecosystem.
 *
 * 4.  **Enhanced User Experience (UX)**:
 *     - **Clear Loading/Empty States**: The table provides feedback to the user during data loading or when no results match the filters.
 *     - **Advanced Filtering**: Added a "Per Capita" filter, providing deeper analytical capabilities.
 *     - **Intuitive Sorting**: The sorting mechanism now cycles through ascending, descending, and a "none" state (which resets to the default time-based sort), a more predictable and user-friendly interaction.
 *
 * 5.  **Robustness & Error Handling**:
 *     - **Data Validation**: The `processData` method now gracefully handles incomplete data rows and filters out irrelevant pre-market data.
 *     - **Resilient Updates**: The main `update` method is wrapped in a `try...catch` block to ensure that an API failure doesn't crash the entire tab.
 */
export class FilterTab extends BaseTab {
    // ===== INITIALIZATION & STARTUP =====
    constructor(stockId) {
        super('filter', 'فیلتر پیشرفته معاملات', stockId);
        this.allData = [];
        this.filteredData = [];
        this.elements = {};
        this.currentSort = { key: 'time', direction: 'asc' };
        this.summaryStats = {}; // Resets in updateSummaryStats
    }

    async init() {
        this.renderLayout();
        this.cacheDOMElements();
        this.setupEventListeners();
        await this.update();
        this.startUpdateInterval(UPDATE_INTERVAL_MS);
    }

    renderLayout() {
        const container = document.getElementById(`${this.name}-container`);
        if (container) container.innerHTML = this.getTemplate();
    }

    cacheDOMElements() {
        const selectors = {
            summary: {
                greenCount: '#green-count', greenBuy: '#green-buy', greenSell: '#green-sell',
                redCount: '#red-count', redBuy: '#red-buy', redSell: '#red-sell',
                neutralCount: '#neutral-count', neutralBuy: '#neutral-buy', neutralSell: '#neutral-sell',
                totalValueDiff: '#total-value-diff',
            },
            filters: {
                valueFilterType: '#valueFilterType', minTradeValue: '#minTradeValue', maxTradeValue: '#maxTradeValue',
                priceChangeFilterType: '#priceChangeFilterType', minPriceChange: '#minPriceChange', maxPriceChange: '#maxPriceChange',
                perCapitaFilterType: '#perCapitaFilterType', minPerCapita: '#minPerCapita', maxPerCapita: '#maxPerCapita',
                filterButton: '#filterButton',
            },
            table: {
                body: '#dataTable tbody',
                headers: '#dataTable th',
            }
        };
        this.elements.summary = {};
        this.elements.filters = {};
        this.elements.table = {};

        for (const key in selectors.summary) this.elements.summary[key] = document.querySelector(selectors.summary[key]);
        for (const key in selectors.filters) this.elements.filters[key] = document.querySelector(selectors.filters[key]);
        this.elements.table.body = document.querySelector(selectors.table.body);
        this.elements.table.headers = document.querySelectorAll(selectors.table.headers);
    }

    async update() {
        this.setTableMessage('...در حال بارگذاری اطلاعات');
        try {
            this.allData = await this.fetchAndProcessData();
            this.runFiltersAndSort();
        } catch (error) {
            console.error('Error during filter tab update:', error);
            this.setTableMessage('خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.');
        }
    }

    // ===== API & DATA HANDLING =====

    async fetchAndProcessData() {
        const saraneText = await apiService.fetchSaraneData(this.stockId);
        if (!saraneText) return [];
        return this.processData(saraneText.split(';').filter(r => r.trim()));
    }

    processData(rows) {
        let prevCumulative = null;
        let prevPrice = 0;

        return rows.map(rowStr => {
            const cols = rowStr.split(',');
            if (cols.length < 16) return null; // Data integrity check

            const time = utils.formatTime(cols[0].padStart(6, '0'));
            if (parseInt(time.split(':')[0], 10) < TRADING_START_HOUR) return null; // Filter pre-market data

            const current = {
                lastPrice: parseFloat(cols[1]),
                buyCountReal: parseInt(cols[3], 10), buyCountLegal: parseInt(cols[4], 10),
                buyVolumeReal: parseFloat(cols[5]), buyVolumeLegal: parseFloat(cols[6]),
                sellCountReal: parseInt(cols[7], 10), sellCountLegal: parseInt(cols[8], 10),
                sellVolumeReal: parseFloat(cols[9]), sellVolumeLegal: parseFloat(cols[10]),
            };

            const delta = {
                buyCountReal: prevCumulative ? current.buyCountReal - prevCumulative.buyCountReal : current.buyCountReal,
                sellCountReal: prevCumulative ? current.sellCountReal - prevCumulative.sellCountReal : current.sellCountReal,
                buyCountLegal: prevCumulative ? current.buyCountLegal - prevCumulative.buyCountLegal : current.buyCountLegal,
                sellCountLegal: prevCumulative ? current.sellCountLegal - prevCumulative.sellCountLegal : current.sellCountLegal,
                buyVolumeReal: prevCumulative ? current.buyVolumeReal - prevCumulative.buyVolumeReal : current.buyVolumeReal,
                sellVolumeReal: prevCumulative ? current.sellVolumeReal - prevCumulative.sellVolumeReal : current.sellVolumeReal,
                buyVolumeLegal: prevCumulative ? current.buyVolumeLegal - prevCumulative.buyVolumeLegal : current.buyVolumeLegal,
                sellVolumeLegal: prevCumulative ? current.sellVolumeLegal - prevCumulative.sellVolumeLegal : current.sellVolumeLegal,
            };

            // Skip if no trades occurred in this interval
            if (Object.values(delta).every(v => v === 0)) return null;

            const priceChange = prevPrice > 0 ? parseFloat(utils.calculatePercentage(current.lastPrice, prevPrice)) : 0;

            // Convert to Million Toman (divide by 1e7) for better readability
            const buyValueReal = (delta.buyVolumeReal * current.lastPrice) / 1e7;
            const sellValueReal = (delta.sellVolumeReal * current.lastPrice) / 1e7;
            const buyValueLegal = (delta.buyVolumeLegal * current.lastPrice) / 1e7;
            const sellValueLegal = (delta.sellVolumeLegal * current.lastPrice) / 1e7;

            const buyPerCapita = delta.buyCountReal > 0 ? buyValueReal / delta.buyCountReal : 0;
            const sellPerCapita = delta.sellCountReal > 0 ? sellValueReal / delta.sellCountReal : 0;

            prevCumulative = current;
            prevPrice = current.lastPrice;

            return {
                time, lastPrice: current.lastPrice, priceChange,
                buyCountReal: delta.buyCountReal, sellCountReal: delta.sellCountReal,
                buyCountLegal: delta.buyCountLegal, sellCountLegal: delta.sellCountLegal,
                buyValueReal, sellValueReal, buyValueLegal, sellValueLegal,
                buyPerCapita, sellPerCapita
            };
        }).filter(Boolean); // filter(Boolean) removes null entries
    }

    // ===== FILTERING, SORTING & RENDERING =====

    runFiltersAndSort() {
        this.filteredData = this.applyFilters(this.allData);
        this.applySort(this.filteredData);
        this.renderTable();
        this.updateSummaryStats();
    }

    applyFilters(data) {
        const filters = this.elements.filters;
        const getVal = (el) => parseFloat(el.value);

        const minTradeValue = getVal(filters.minTradeValue) || 0;
        const maxTradeValue = getVal(filters.maxTradeValue) || Infinity;
        const minPriceChange = getVal(filters.minPriceChange) || -Infinity;
        const maxPriceChange = getVal(filters.maxPriceChange) || Infinity;
        const minPerCapita = getVal(filters.minPerCapita) || 0;
        const maxPerCapita = getVal(filters.maxPerCapita) || Infinity;

        return data.filter(row => {
            const totalValue = row.buyValueReal + row.sellValueReal + row.buyValueLegal + row.sellValueLegal;

            const valuePass = this.checkFilterCondition(totalValue, filters.valueFilterType.value, minTradeValue, maxTradeValue);
            const pricePass = this.checkFilterCondition(row.priceChange, filters.priceChangeFilterType.value, minPriceChange, maxPriceChange);
            const perCapitaPass = this.checkFilterCondition(row.buyPerCapita, filters.perCapitaFilterType.value, minPerCapita, maxPerCapita) ||
                this.checkFilterCondition(row.sellPerCapita, filters.perCapitaFilterType.value, minPerCapita, maxPerCapita);

            return valuePass && pricePass && perCapitaPass;
        });
    }

    checkFilterCondition(value, type, min, max) {
        if (type === 'none') return true;
        if (type === 'less') return value < min;
        if (type === 'more') return value > min;
        if (type === 'between') return value >= min && value <= max;
        return true;
    }

    applySort(data) {
        const { key, direction } = this.currentSort;
        if (direction === 'none' || !key) return;

        const multiplier = direction === 'asc' ? 1 : -1;
        data.sort((a, b) => {
            let valA = a[key] === '' || a[key] === null ? -Infinity : a[key];
            let valB = b[key] === '' || b[key] === null ? -Infinity : b[key];
            if (key === 'time') {
                valA = this.timeToMinutes(valA);
                valB = this.timeToMinutes(valB);
            }
            return (valA - valB) * multiplier;
        });
    }

    renderTable() {
        const tbody = this.elements.table.body;
        tbody.innerHTML = '';
        if (this.filteredData.length === 0) {
            this.setTableMessage('هیچ داده‌ای مطابق با فیلتر شما یافت نشد.');
            return;
        }

        const fragment = document.createDocumentFragment();
        this.filteredData.forEach(row => {
            if (!row) return;
            const tr = document.createElement('tr');
            const diff = row.buyValueReal - row.sellValueReal;
            if (diff > 0) tr.className = 'positive-bg';
            else if (diff < 0) tr.className = 'negative-bg';

            const format = (val, dec = 2) => (typeof val === 'number' && val !== 0) ? val.toFixed(dec) : '';
            const priceChangeSpan = utils.formatPercentageSpan(row.priceChange);

            const cells = [
                row.time, `${row.lastPrice.toLocaleString()}${priceChangeSpan}`,
                row.buyCountReal || '', format(row.buyPerCapita),
                row.sellCountReal || '', format(row.sellPerCapita),
                format(row.buyValueReal), format(row.sellValueReal),
                row.buyCountLegal || '', format(row.buyValueLegal),
                row.sellCountLegal || '', format(row.sellValueLegal),
            ];

            cells.forEach(content => {
                const td = document.createElement('td');
                if (typeof content === 'string' && content.includes('<span')) td.innerHTML = content;
                else td.textContent = content;
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }

    updateSummaryStats() {
        const stats = { green: { r: 0, b: 0, s: 0 }, red: { r: 0, b: 0, s: 0 }, neutral: { r: 0, b: 0, s: 0 }, totalDiff: 0 };
        this.filteredData.forEach(row => {
            const buy = row.buyValueReal || 0;
            const sell = row.sellValueReal || 0;
            if (buy === 0 && sell === 0) return;

            const diff = buy - sell;
            stats.totalDiff += diff;
            if (diff > 0) { stats.green.r++; stats.green.b += buy; stats.green.s += sell; }
            else if (diff < 0) { stats.red.r++; stats.red.b += buy; stats.red.s += sell; }
            else { stats.neutral.r++; stats.neutral.b += buy; stats.neutral.s += sell; }
        });

        const f = (val) => val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        const s = this.elements.summary;
        s.greenCount.textContent = stats.green.r; s.greenBuy.textContent = f(stats.green.b); s.greenSell.textContent = f(stats.green.s);
        s.redCount.textContent = stats.red.r; s.redBuy.textContent = f(stats.red.b); s.redSell.textContent = f(stats.red.s);
        s.neutralCount.textContent = stats.neutral.r; s.neutralBuy.textContent = f(stats.neutral.b); s.neutralSell.textContent = f(stats.neutral.s);
        s.totalValueDiff.textContent = f(stats.totalDiff);
        s.totalValueDiff.className = stats.totalDiff > 0 ? 'positive' : (stats.totalDiff < 0 ? 'negative' : '');
    }

    setTableMessage(message) {
        const tbody = this.elements.table.body;
        if (!tbody) return;
        const columnCount = this.elements.table.headers.length || 12;
        tbody.innerHTML = `<tr><td colspan="${columnCount}" style="padding: 2rem; text-align: center;">${message}</td></tr>`;
    }

    // ===== EVENT LISTENERS & HANDLERS =====

    setupEventListeners() {
        this.elements.filters.filterButton.addEventListener('click', () => this.runFiltersAndSort());

        this.elements.table.headers.forEach(th => {
            th.addEventListener('click', () => this.handleSortClick(th));
        });

        const setupFilterToggle = (typeEl, minEl, maxEl) => {
            typeEl.addEventListener('change', e => {
                const value = e.target.value;
                minEl.style.display = value !== 'none' ? 'inline-block' : 'none';
                maxEl.style.display = value === 'between' ? 'inline-block' : 'none';
            });
            typeEl.dispatchEvent(new Event('change')); // Set initial state
        };

        setupFilterToggle(this.elements.filters.valueFilterType, this.elements.filters.minTradeValue, this.elements.filters.maxTradeValue);
        setupFilterToggle(this.elements.filters.priceChangeFilterType, this.elements.filters.minPriceChange, this.elements.filters.maxPriceChange);
        setupFilterToggle(this.elements.filters.perCapitaFilterType, this.elements.filters.minPerCapita, this.elements.filters.maxPerCapita);
    }

    handleSortClick(clickedTh) {
        const key = clickedTh.dataset.sort;
        if (!key) return;

        let direction = 'asc';
        if (this.currentSort.key === key) {
            if (this.currentSort.direction === 'asc') direction = 'desc';
            else if (this.currentSort.direction === 'desc') direction = 'none';
        }

        this.currentSort = (direction === 'none') ? { key: 'time', direction: 'asc' } : { key, direction };

        this.elements.table.headers.forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === this.currentSort.key && this.currentSort.direction !== 'none') {
                th.classList.add(`sorted-${this.currentSort.direction}`);
            }
        });

        this.runFiltersAndSort();
    }

    timeToMinutes(timeStr) {
        if (typeof timeStr !== 'string') return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // ===== TEMPLATE & STYLES =====
    getTemplate() {
        return `
            <div id="summary-stats" class="summary-container">
                <div class="stats-row">
                    <span><span class="legend-green">■</span> سبز: <b id="green-count">0</b> (خ: <b id="green-buy">0</b> ف: <b id="green-sell">0</b>)</span>
                    <span><span class="legend-red">■</span> قرمز: <b id="red-count">0</b> (خ: <b id="red-buy">0</b> ف: <b id="red-sell">0</b>)</span>
                    <span><span class="legend-neutral">■</span> خنثی: <b id="neutral-count">0</b> (خ: <b id="neutral-buy">0</b> ف: <b id="neutral-sell">0</b>)</span>
                    <span>مجموع تفاضل ارزش: <b id="total-value-diff">0</b></span>
                </div>
            </div>
            <div class="filter-controls">
                <div class="filter-group">
                    <label>ارزش (م.ت):</label>
                    <select id="valueFilterType"><option value="more">بیشتر از</option><option value="less">کمتر از</option><option value="between">بین</option><option value="none" selected>همه</option></select>
                    <input type="number" id="minTradeValue" value="100" placeholder="مقدار" />
                    <input type="number" id="maxTradeValue" placeholder="حداکثر" />
                </div>
                <div class="filter-group">
                    <label>تغییر قیمت (%):</label>
                    <select id="priceChangeFilterType"><option value="more">بیشتر از</option><option value="less">کمتر از</option><option value="between">بین</option><option value="none" selected>همه</option></select>
                    <input type="number" id="minPriceChange" placeholder="مقدار" step="0.01" />
                    <input type="number" id="maxPriceChange" placeholder="حداکثر" step="0.01" />
                </div>
                <div class="filter-group">
                    <label>سرانه (م.ت):</label>
                    <select id="perCapitaFilterType"><option value="more">بیشتر از</option><option value="less">کمتر از</option><option value="between">بین</option><option value="none" selected>همه</option></select>
                    <input type="number" id="minPerCapita" placeholder="مقدار" />
                    <input type="number" id="maxPerCapita" placeholder="حداکثر" />
                </div>
                <button id="filterButton" class="action-button">اعمال فیلتر</button>
            </div>
            <div class="table-wrapper">
                <table id="dataTable" class="dashboard-table">
                    <thead>
                        <tr>
                            <th data-sort="time" class="sorted-asc">زمان</th><th data-sort="lastPrice">قیمت</th>
                            <th data-sort="buyCountReal" title="تعداد خریدار حقیقی">ت.خ.ح</th><th data-sort="buyPerCapita" title="سرانه خرید حقیقی (م.ت)">سرانه خ.ح</th>
                            <th data-sort="sellCountReal" title="تعداد فروشنده حقیقی">ت.ف.ح</th><th data-sort="sellPerCapita" title="سرانه فروش حقیقی (م.ت)">سرانه ف.ح</th>
                            <th data-sort="buyValueReal" title="ارزش خرید حقیقی (م.ت)">ارزش خ.ح</th><th data-sort="sellValueReal" title="ارزش فروش حقیقی (م.ت)">ارزش ف.ح</th>
                            <th data-sort="buyCountLegal" title="تعداد خریدار حقوقی">ت.خ.ق</th><th data-sort="buyValueLegal" title="ارزش خرید حقوقی (م.ت)">ارزش خ.ق</th>
                            <th data-sort="sellCountLegal" title="تعداد فروشنده حقوقی">ت.ف.ق</th><th data-sort="sellValueLegal" title="ارزش فروش حقوقی (م.ت)">ارزش ف.ق</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <style>
                .summary-container { background-color: var(--bg-main); padding: 0.8rem 1rem; margin-bottom: 1rem; border-radius: var(--border-radius); border: 1px solid var(--border-color); }
                .stats-row { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1rem; }
                .stats-row span { font-size: 0.9em; display: flex; align-items: center; gap: 0.5ch; }
                .stats-row b { font-weight: 600; }
                .filter-controls { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; margin-bottom: 1rem; background: var(--bg-main); padding: 1rem; border-radius: var(--border-radius); }
                .filter-group { display: flex; gap: 0.5rem; align-items: center; }
                .filter-group label { font-weight: 500; font-size: 0.9em; }
                .filter-group input, .filter-group select { padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-widget); font-size: 0.9em; max-width: 100px; }
                .action-button { background-color: var(--primary-accent); color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; font-weight: 500;}
                .action-button:hover { background-color: var(--primary-accent-hover); }
                .table-wrapper { width: 100%; max-height: 70vh; overflow: auto; border: 1px solid var(--border-color); border-radius: var(--border-radius);}
                #dataTable thead { position: sticky; top: 0; z-index: 1; background-color: var(--bg-main); }
                #dataTable th, #dataTable td { padding: 8px 10px; border-bottom: 1px solid var(--border-color); text-align: center; white-space: nowrap; font-size: 0.9rem; }
                #dataTable th { cursor: pointer; user-select: none; font-weight: 600; position: relative; }
                #dataTable th.sorted-asc::after, #dataTable th.sorted-desc::after { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 0.7; }
                #dataTable th.sorted-asc::after { content: '▲'; }
                #dataTable th.sorted-desc::after { content: '▼'; }
                .positive-bg { background-color: rgba(39, 174, 96, 0.07); }
                .negative-bg { background-color: rgba(231, 76, 60, 0.07); }
                .legend-green { color: var(--positive); } .legend-red { color: var(--negative); } .legend-neutral { color: var(--text-secondary); }
            </style>
        `;
    }
}