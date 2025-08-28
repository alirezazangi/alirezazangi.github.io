import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class TradersTab extends BaseTab {
    constructor(stockId) {
        super('traders', 'تاریخچه معاملات حقیقی-حقوقی', stockId);
        this.currentPage = 0;
        this.ITEMS_PER_PAGE = 25;
        this.isLoading = false;
        this.allData = [];
    }

    getTemplate() {
        return `
            <div class="widget-card">
                <div class="widget-header">
                    <h4>تاریخچه معاملات حقیقی و حقوقی</h4>
                </div>
                <div class="widget-body table-container" id="traders-table-container">
                    <table class="dashboard-table" id="traders-table">
                        <thead>
                            <tr>
                                <th rowspan="2">تاریخ</th><th colspan="3">خرید حقیقی</th><th colspan="3">فروش حقیقی</th>
                            </tr>
                            <tr>
                                <th>حجم</th><th>ارزش (میلیارد ریال)</th><th>تعداد</th><th>حجم</th><th>ارزش (میلیارد ریال)</th><th>تعداد</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                    <div id="traders-loading" style="text-align: center; padding: 1rem; display: none;">...</div>
                </div>
            </div>
            <style>
                .table-container { max-height: 70vh; overflow-y: auto; padding: 0 !important; }
                #traders-table thead { position: sticky; top: 0; z-index: 1; }
            </style>
        `;
    }
    
    async fetchData() {
        if(this.allData.length > 0) return;
        try {
            const response = await apiService.getClientTypeHistory(this.stockId);
            this.allData = response?.clientType || [];
        } catch (error) {
            console.error("Error fetching traders data:", error);
        }
    }

    renderMoreData() {
        if (this.isLoading) return;
        this.isLoading = true;

        const loadingIndicator = document.getElementById('traders-loading');
        loadingIndicator.style.display = 'block';

        const startIndex = this.currentPage * this.ITEMS_PER_PAGE;
        const endIndex = startIndex + this.ITEMS_PER_PAGE;
        const newItems = this.allData.slice(startIndex, endIndex);

        if (newItems.length > 0) {
            const tbody = document.querySelector('#traders-table tbody');
            const content = newItems.map(trade => `
                <tr>
                    <td>${utils.formatDate(trade.recDate)}</td>
                    <td class="buy">${utils.formatNumberWithUnit(trade.buy_I_Volume)}</td>
                    <td class="buy">${(trade.buy_I_Value / 1e9).toFixed(2)}</td>
                    <td class="buy">${trade.buy_I_Count.toLocaleString()}</td>
                    <td class="sell">${utils.formatNumberWithUnit(trade.sell_I_Volume)}</td>
                    <td class="sell">${(trade.sell_I_Value / 1e9).toFixed(2)}</td>
                    <td class="sell">${trade.sell_I_Count.toLocaleString()}</td>
                </tr>
            `).join('');
            tbody.insertAdjacentHTML('beforeend', content);
            this.currentPage++;
        }
        
        loadingIndicator.style.display = 'none';
        this.isLoading = false;
    }

    setupScrollListener() {
        const container = document.getElementById('traders-table-container');
        container.addEventListener('scroll', () => {
            if (container.scrollHeight - container.scrollTop <= container.clientHeight + 100) {
                this.renderMoreData();
            }
        });
    }

    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if(container) container.innerHTML = this.getTemplate();
        
        this.allData = [];
        this.currentPage = 0;
        
        await this.fetchData();
        this.renderMoreData();
        this.setupScrollListener();
    }
}