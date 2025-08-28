import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class RealTimeTraderTab extends BaseTab {
    constructor(stockId) {
        super('realtime-traders', 'معاملات حقیقی-حقوقی لحظه‌ای', stockId);
    }
    
    getTemplate() {
        return `
            <div class="widget-card">
                <div class="widget-header">
                    <h4>خلاصه معاملات لحظه‌ای حقیقی و حقوقی</h4>
                </div>
                <div id="realtime-traders-content" class="widget-body" style="overflow-x: auto;">
                    <!-- Table will be rendered here -->
                </div>
            </div>
        `;
    }
    
    async fetchData() {
        try {
            const [dailyData, traderData] = await Promise.all([
                apiService.getClosingPriceDaily(this.stockId),
                apiService.getClientType(this.stockId)
            ]);
            return {
                dailyData: dailyData?.closingPriceDaily,
                traderData: traderData?.clientType
            };
        } catch (error) {
            console.error("Error fetching real-time traders data:", error);
            return null;
        }
    }
    
    calculateMetrics(traderData, dailyData) {
        if (!traderData || !dailyData) return null;
        
        const p = dailyData.pDrCotVal;
        const metrics = {
            individual: {},
            institutional: {}
        };

        metrics.individual.buyValue = p * traderData.buy_I_Volume;
        metrics.individual.sellValue = p * traderData.sell_I_Volume;
        metrics.individual.buyPerCapita = traderData.buy_CountI > 0 ? metrics.individual.buyValue / traderData.buy_CountI : 0;
        metrics.individual.sellPerCapita = traderData.sell_CountI > 0 ? metrics.individual.sellValue / traderData.sell_CountI : 0;
        metrics.individual.buyPower = metrics.individual.sellPerCapita > 0 ? metrics.individual.buyPerCapita / metrics.individual.sellPerCapita : 0;

        metrics.institutional.buyValue = p * traderData.buy_N_Volume;
        metrics.institutional.sellValue = p * traderData.sell_N_Volume;
        metrics.institutional.buyPerCapita = traderData.buy_CountN > 0 ? metrics.institutional.buyValue / traderData.buy_CountN : 0;
        metrics.institutional.sellPerCapita = traderData.sell_CountN > 0 ? metrics.institutional.sellValue / traderData.sell_CountN : 0;
        
        return metrics;
    }

    render(data) {
        const container = document.getElementById('realtime-traders-content');
        if (!data) {
             container.innerHTML = `<p>اطلاعات لحظه‌ای موجود نیست.</p>`;
             return;
        }

        const { traderData, dailyData } = data;
        const metrics = this.calculateMetrics(traderData, dailyData);
        if(!metrics || !traderData) {
             container.innerHTML = `<p>اطلاعات لحظه‌ای برای محاسبه موجود نیست.</p>`;
             return;
        }
        
        const i = metrics.individual;
        const n = metrics.institutional;

        container.innerHTML = `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>نوع</th><th>تعداد خریدار</th><th>ارزش خرید</th><th>سرانه خرید</th>
                        <th>تعداد فروشنده</th><th>ارزش فروش</th><th>سرانه فروش</th><th>قدرت خرید</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>حقیقی</strong></td>
                        <td class="buy">${traderData.buy_CountI.toLocaleString()}</td>
                        <td class="buy">${utils.formatNumberWithUnit(i.buyValue / 10)}</td>
                        <td class="buy">${utils.formatNumberWithUnit(i.buyPerCapita / 10)}</td>
                        <td class="sell">${traderData.sell_CountI.toLocaleString()}</td>
                        <td class="sell">${utils.formatNumberWithUnit(i.sellValue / 10)}</td>
                        <td class="sell">${utils.formatNumberWithUnit(i.sellPerCapita / 10)}</td>
                        <td class="buy">${i.buyPower.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td><strong>حقوقی</strong></td>
                        <td class="buy">${traderData.buy_CountN.toLocaleString()}</td>
                        <td class="buy">${utils.formatNumberWithUnit(n.buyValue / 10)}</td>
                        <td class="buy">${utils.formatNumberWithUnit(n.buyPerCapita / 10)}</td>
                        <td class="sell">${traderData.sell_CountN.toLocaleString()}</td>
                        <td class="sell">${utils.formatNumberWithUnit(n.sellValue / 10)}</td>
                        <td class="sell">${utils.formatNumberWithUnit(n.sellPerCapita / 10)}</td>
                        <td>-</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    async update() {
        const data = await this.fetchData();
        this.render(data);
    }

    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if(container) {
            container.innerHTML = this.getTemplate();
        }
        await this.update();
        this.startUpdateInterval(10000); // 10 seconds
    }
}