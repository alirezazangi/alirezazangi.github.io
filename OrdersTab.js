import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class OrdersTab extends BaseTab {
    constructor(stockId) {
        super('orders', 'عرضه و تقاضا', stockId);
    }

    getTemplate() {
        return `
            <div class="widget-card">
                <div class="widget-header">
                    <h4>جدول عرضه و تقاضا</h4>
                </div>
                <div id="orders-content" class="widget-body">
                    <!-- Tables will be rendered here -->
                </div>
            </div>
            <style>
                .volume-table { width: 100%; border-collapse: collapse; }
                .volume-table th, .volume-table td { 
                    text-align: center; 
                    padding: 0.75rem; 
                    font-size: 0.9rem; 
                    position: relative;
                    border-bottom: 1px solid var(--border-color);
                }
                .volume-table thead th { 
                    background-color: var(--bg-main); 
                    font-weight: 600; 
                    color: var(--text-secondary);
                }
                .volume-table tbody tr:last-child td { border-bottom: none; }
                .bar-chart { 
                    position: absolute; right: 0; top: 0; height: 100%; 
                    z-index: 1; opacity: 0.15; transition: width 0.3s ease;
                }
                .buy-volume .bar-chart { background-color: var(--positive); }
                .sell-volume .bar-chart { background-color: var(--negative); }
                .volume-table td span { position: relative; z-index: 2; }
                .totals-row, .averages-row { font-weight: 600; background-color: var(--bg-main); }
            </style>
        `;
    }

    async fetchData() {
        try {
            const [prices, instrumentInfo] = await Promise.all([
                apiService.getBestLimits(this.stockId),
                apiService.getInstrumentInfo(this.stockId)
            ]);
            return {
                prices: prices?.bestLimits,
                instrumentInfo: instrumentInfo?.instrumentInfo
            };
        } catch (error) {
            console.error("Error fetching orders data:", error);
            return null;
        }
    }

    render({ prices, instrumentInfo }) {
        const container = document.getElementById('orders-content');
        if (!container || !prices || !instrumentInfo) {
            if(container) container.innerHTML = '<p>اطلاعات عرضه و تقاضا در دسترس نیست.</p>';
            return;
        }

        const maxValues = this.calculateMaxValues(prices);
        const footerHTML = this.generateTableFooter(prices);

        container.innerHTML = `
            <table class="dashboard-table" style="margin-bottom: 1.5rem;">
                <thead>
                    <tr><th>میانگین حجم ماه</th><th>ارزش صف خرید</th><th>ارزش صف فروش</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${utils.formatNumberWithUnit(instrumentInfo.qTotTran5JAvg)}</td>
                        <td>${utils.formatNumberWithUnit(prices[0].qTitMeDem * prices[0].pMeDem / 10)} تومان</td>
                        <td>${utils.formatNumberWithUnit(prices[0].qTitMeOf * prices[0].pMeOf / 10)} تومان</td>
                    </tr>
                </tbody>
            </table>
            <table class="volume-table">
                <thead>${this.generateTableHeader()}</thead>
                <tbody>
                    ${prices.map(p => this.generateTableRow(p, maxValues)).join('')}
                    ${footerHTML}
                </tbody>
            </table>
        `;
    }
    
    generateTableHeader() {
        return `
            <tr>
                <th rowspan="2">#</th><th colspan="2">تعداد</th><th colspan="2">حجم (ارزش)</th><th colspan="2">سرانه خرید/فروش</th>
            </tr>
            <tr>
                <th>خرید</th><th>فروش</th><th>خرید</th><th>فروش</th><th>خرید</th><th>فروش</th>
            </tr>
        `;
    }
    
    generateTableRow(price, maxValues) {
        const buyValue = price.pMeDem * price.qTitMeDem;
        const sellValue = price.pMeOf * price.qTitMeOf;
        const buyPerCapita = price.zOrdMeDem > 0 ? buyValue / price.zOrdMeDem : 0;
        const sellPerCapita = price.zOrdMeOf > 0 ? sellValue / price.zOrdMeOf : 0;

        const getBarWidth = (value, maxValue) => maxValue > 0 ? (value / maxValue * 100) : 0;
        
        return `
            <tr>
                <td>${price.number}</td>
                <td class="buy-volume">
                    <div class="bar-chart" style="width:${getBarWidth(price.zOrdMeDem, maxValues.maxCount)}%"></div>
                    <span>${price.zOrdMeDem.toLocaleString()}</span>
                </td>
                <td class="sell-volume">
                    <div class="bar-chart" style="width:${getBarWidth(price.zOrdMeOf, maxValues.maxCount)}%"></div>
                    <span>${price.zOrdMeOf.toLocaleString()}</span>
                </td>
                <td class="buy-volume">
                    <div class="bar-chart" style="width:${getBarWidth(buyValue, maxValues.maxValue)}%"></div>
                    <span>${utils.formatNumberWithUnit(price.qTitMeDem)}</span>
                </td>
                <td class="sell-volume">
                     <div class="bar-chart" style="width:${getBarWidth(sellValue, maxValues.maxValue)}%"></div>
                    <span>${utils.formatNumberWithUnit(price.qTitMeOf)}</span>
                </td>
                <td class="buy-volume">
                    <div class="bar-chart" style="width:${getBarWidth(buyPerCapita, maxValues.maxPerCapita)}%"></div>
                    <span>${utils.formatNumberWithUnit(buyPerCapita / 10)}</span>
                </td>
                <td class="sell-volume">
                    <div class="bar-chart" style="width:${getBarWidth(sellPerCapita, maxValues.maxPerCapita)}%"></div>
                    <span>${utils.formatNumberWithUnit(sellPerCapita / 10)}</span>
                </td>
            </tr>
        `;
    }

    generateTableFooter(prices) {
        const totals = prices.reduce((acc, p) => {
            acc.buyCount += p.zOrdMeDem;
            acc.sellCount += p.zOrdMeOf;
            acc.buyValue += p.pMeDem * p.qTitMeDem;
            acc.sellValue += p.pMeOf * p.qTitMeOf;
            acc.buyVolume += p.qTitMeDem;
            acc.sellVolume += p.qTitMeOf;
            return acc;
        }, { buyCount: 0, sellCount: 0, buyValue: 0, sellValue: 0, buyVolume: 0, sellVolume: 0 });

        const avgBuyPerCapita = totals.buyCount > 0 ? totals.buyValue / totals.buyCount : 0;
        const avgSellPerCapita = totals.sellCount > 0 ? totals.sellValue / totals.sellCount : 0;
        
        return `
            <tr class="totals-row">
                <td>جمع</td>
                <td>${totals.buyCount.toLocaleString()}</td>
                <td>${totals.sellCount.toLocaleString()}</td>
                <td>${utils.formatNumberWithUnit(totals.buyVolume)}</td>
                <td>${utils.formatNumberWithUnit(totals.sellVolume)}</td>
                <td>${utils.formatNumberWithUnit(avgBuyPerCapita / 10)}</td>
                <td>${utils.formatNumberWithUnit(avgSellPerCapita / 10)}</td>
            </tr>
        `;
    }

    calculateMaxValues(prices) {
        return prices.reduce((max, p) => ({
            maxCount: Math.max(max.maxCount, p.zOrdMeDem, p.zOrdMeOf),
            maxValue: Math.max(max.maxValue, p.pMeDem * p.qTitMeDem, p.pMeOf * p.qTitMeOf),
            maxPerCapita: Math.max(max.maxPerCapita, (p.pMeDem * p.qTitMeDem) / (p.zOrdMeDem || 1), (p.pMeOf * p.qTitMeOf) / (p.zOrdMeOf || 1)),
        }), { maxCount: 0, maxValue: 0, maxPerCapita: 0 });
    }

    async update() {
        const data = await this.fetchData();
        if (data) {
            this.render(data);
        }
    }

    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if (container) {
            container.innerHTML = this.getTemplate();
        }
        await this.update();
        this.startUpdateInterval(10000);
    }
}