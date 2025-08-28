import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class HistoricalTradesTab extends BaseTab {
    constructor(stockId) {
        super('history', 'آمار روزانه معاملات', stockId); 
        this.allTrades = [];
        this.currentPage = 0;
        this.ITEMS_PER_PAGE = 25;
        this.isLoading = false;
        this.isInitialized = false;
    }

    getTemplate() {
        return `
            <div class="widget-card">
                <div class="widget-header">
                    <h4>تاریخچه آمار روزانه معاملات</h4>
                </div>
                <div class="widget-body table-container" id="history-table-container">
                    <table class="dashboard-table" id="history-table">
                        <thead>
                            <tr>
                                <th>تاریخ</th><th>پایانی</th><th>تغییر</th><th>کمترین</th>
                                <th>بیشترین</th><th>تعداد</th><th>حجم</th><th>ارزش (میلیون تومان)</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                    <div id="loading-spinner" style="text-align:center; padding: 1rem; display:none;">در حال بارگذاری...</div>
                </div>
            </div>
            <style>
                .table-container { max-height: 70vh; overflow-y: auto; padding: 0 !important; }
                #history-table thead { position: sticky; top: 0; z-index: 1; }
            </style>
        `;
    }

    async fetchData() {
        if (this.allTrades.length > 0) return;
        this.isLoading = true;
        
        try {
            const response = await apiService.getClosingPriceDailyList(this.stockId, 0); 
            this.allTrades = response?.closingPriceDaily || [];
        } catch (error) {
            console.error('خطا در دریافت سابقه کامل معاملات:', error);
            const tableBody = document.querySelector('#history-table tbody');
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="negative">خطا در بارگذاری داده‌ها</td></tr>`;
        } finally {
            this.isLoading = false;
        }
    }

    renderMoreData() {
        if (this.isLoading || (this.currentPage * this.ITEMS_PER_PAGE) >= this.allTrades.length && this.currentPage > 0) return;
        this.isLoading = true;
        document.getElementById('loading-spinner').style.display = 'block';

        const startIndex = this.currentPage * this.ITEMS_PER_PAGE;
        const endIndex = startIndex + this.ITEMS_PER_PAGE;
        const newItems = this.allTrades.slice(startIndex, endIndex);

        if (newItems.length > 0) {
            const tableBody = document.querySelector('#history-table tbody');
            const content = newItems.map(day => {
                const pricePercentage = utils.calculatePercentage(day.pClosing, day.priceYesterday);
                const totalValue = day.qTotCap / 10 / 1e6;

                return `
                    <tr>
                        <td>${utils.formatDate(day.dEven)}</td>
                        <td>${day.pClosing.toLocaleString()} ${utils.formatPercentageSpan(pricePercentage)}</td>
                        <td class="${day.priceChange >= 0 ? 'positive' : 'negative'}">${day.priceChange.toLocaleString()}</td>
                        <td>${day.priceMin.toLocaleString()}</td>
                        <td>${day.priceMax.toLocaleString()}</td>
                        <td>${day.zTotTran.toLocaleString()}</td>
                        <td>${utils.formatNumberWithUnit(day.qTotTran5J)}</td>
                        <td>${totalValue.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
            tableBody.insertAdjacentHTML('beforeend', content);
            this.currentPage++;
        }
        
        document.getElementById('loading-spinner').style.display = 'none';
        this.isLoading = false;
    }
    
    setupScrollListener() {
        const container = document.getElementById('history-table-container');
        container.onscroll = () => {
            if (container.scrollHeight - container.scrollTop <= container.clientHeight + 100) {
                this.renderMoreData();
            }
        };
    }

    async init() {
        if (this.isInitialized) return;
        const container = document.getElementById(`${this.name}-container`);
        if (container) container.innerHTML = this.getTemplate();
        
        await this.fetchData();
        this.renderMoreData();
        this.setupScrollListener();
        this.isInitialized = true;
    }

    destroy() {
        super.destroy();
        this.isInitialized = false; 
    }
}