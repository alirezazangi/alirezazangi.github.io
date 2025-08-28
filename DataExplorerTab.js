// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import { StockDataService } from './StockDataService.js';
import { formatNumberWithUnit } from './utils.js';

/**
 * 🚀 DataExplorerTab - A powerful tool to explore all available stock data.
 *
 * This tab serves as a demonstration and a utility for the StockDataService.
 * It allows you to:
 * - View all static (non-historical) data for the stock.
 * - See a list of all available historical data keys (like pClosing, buy_I_Volume, etc.).
 * - Interactively query the value of any historical key for any given day (by index).
 */
export class DataExplorerTab extends BaseTab {
    constructor(stockId) {
        super('data-explorer', 'کاوشگر داده', stockId);
        this.stockService = new StockDataService(this.stockId);
        this.stockData = null;
    }

    getTemplate() {
        return `
    < div id = "explorer-wrapper" >
                <div class="widget-card">
                    <div class="widget-header"><h4>🔍 کاوشگر داده‌های تاریخی</h4></div>
                    <div class="widget-body">
                        <p class="description">
                            این ابزار به شما اجازه می‌دهد به تمام داده‌های تاریخی سهم به سادگی دسترسی پیدا کنید. 
                            نام کلید مورد نظر (مثلاً <code>pClosing</code> برای قیمت پایانی) و اندیس روز (<code>0</code> برای امروز، <code>1</code> برای دیروز و ...) را وارد کنید.
                        </p>
                        <div class="interactive-query">
                            <div class="input-group">
                                <label for="data-key-input">نام کلید (Key):</label>
                                <input type="text" id="data-key-input" placeholder="مثال: pClosing یا buy_I_Volume">
                            </div>
                            <div class="input-group">
                                <label for="data-index-input">اندیس روز (Index):</label>
                                <input type="number" id="data-index-input" value="0" min="0">
                            </div>
                            <button id="get-value-btn">دریافت مقدار</button>
                        </div>
                        <div id="query-result" class="query-result-container"></div>
                    </div>
                </div>

                <div class="widget-card">
                    <div class="widget-header"><h4>📜 لیست تمام کلیدهای تاریخی موجود</h4></div>
                    <div id="historical-keys-list" class="widget-body keys-list">
                        <!-- Keys will be populated here -->
                    </div>
                </div>

                <div class="widget-card">
                    <div class="widget-header"><h4>ℹ️ داده‌های ثابت سهم</h4></div>
                    <div id="static-data-list" class="widget-body static-data">
                        <!-- Static data will be populated here -->
                    </div>
                </div>
            </div >
    <style>
        #explorer-wrapper {display: flex; flex-direction: column; gap: 1.5rem; }
        .description {font - size: 0.95rem; color: var(--text-secondary); line-height: 1.7; border-right: 3px solid var(--primary-accent); padding-right: 1rem; margin-bottom: 1.5rem; }
        .interactive-query {display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 1rem; }
        .input-group {display: flex; flex-direction: column; gap: 0.25rem; }
        .input-group label {font - size: 0.9rem; font-weight: 500; }
        .input-group input {padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; font-size: 1rem; }
        #get-value-btn {padding: 0.5rem 1.5rem; background-color: var(--primary-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
        .query-result-container {margin - top: 1rem; padding: 1rem; background-color: var(--bg-main); border-radius: 4px; min-height: 50px; font-family: monospace; font-size: 1.1rem; }
        .query-result-container .key {color: var(--primary-accent); }
        .query-result-container .index {color: var(--warning); }
        .query-result-container .value {color: var(--text-primary); font-weight: bold; }
        .keys-list {display: flex; flex-wrap: wrap; gap: 0.5rem; font-family: monospace; }
        .keys-list .key-item {background - color: #e9ecef; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
        .keys-list .key-item:hover {background - color: #ced4da; }
        .static-data {display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0.5rem 1.5rem; }
        .static-item {display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px dashed var(--border-color); }
        .static-item .key {font - weight: 500; color: var(--text-secondary); }
        .static-item .value {font - weight: 600; text-align: left; }
    </style>
`;
    }

    async init() {
        const container = document.getElementById(`${ this.name } -container`);
        if (container) {
            container.innerHTML = this.getTemplate();
            container.querySelector('#get-value-btn').addEventListener('click', () => this.handleQuery());
        }

        try {
            this.stockData = await this.stockService.getData();
            this.renderData();
        } catch (error) {
            container.innerHTML = `< p class="negative" > خطا در بارگذاری داده‌ها.لطفاً کنسول را بررسی کنید.</p > `;
        }
    }

    renderData() {
        const historicalKeys = [];
        const staticItems = [];

        Object.keys(this.stockData).forEach(key => {
            if (Array.isArray(this.stockData[key])) {
                historicalKeys.push(key);
            } else {
                staticItems.push({ key, value: this.stockData[key] });
            }
        });

        // Render historical keys
        const keysListEl = document.getElementById('historical-keys-list');
        keysListEl.innerHTML = historicalKeys.sort().map(key => `< span class="key-item" > ${ key }</span > `).join('');
        keysListEl.querySelectorAll('.key-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('data-key-input').value = item.textContent;
            });
        });

        // Render static data
        const staticListEl = document.getElementById('static-data-list');
        staticListEl.innerHTML = staticItems
            .map(item => `< div class="static-item" ><span class="key">${item.key}:</span><span class="value">${item.value}</span></div > `)
            .join('');
    }

    handleQuery() {
        const key = document.getElementById('data-key-input').value.trim();
        const index = parseInt(document.getElementById('data-index-input').value, 10);
        const resultEl = document.getElementById('query-result');

        if (!key) {
            resultEl.innerHTML = `< span class="negative" > لطفاً یک کلید وارد کنید.</span > `;
            return;
        }

        if (!this.stockData || !this.stockData.hasOwnProperty(key) || !Array.isArray(this.stockData[key])) {
            resultEl.innerHTML = `< span class="negative" > کلید '${key}' یافت نشد یا یک آرایه تاریخی نیست.</span > `;
            return;
        }

        const dataArray = this.stockData[key];
        if (index >= dataArray.length || index < 0) {
            resultEl.innerHTML = `< span class="negative" > اندیس '${index}' خارج از محدوده است. (محدوده مجاز: 0 تا ${ dataArray.length - 1 })</span > `;
            return;
        }

        const value = dataArray[index];
        const formattedValue = typeof value === 'number' ? formatNumberWithUnit(value) : (value ?? 'null');

        resultEl.innerHTML = `data.< span class="key" > ${ key }</span > [<span class="index">${index}</span>] = <span class="value">${formattedValue}</span>`;
    }
    
    // update is not needed for this static tab
    async update() {}
}