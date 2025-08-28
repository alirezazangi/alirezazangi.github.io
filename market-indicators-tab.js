import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class MarketIndicatorsTab extends BaseTab {
    constructor(stockId) {
        super('market-indicators', 'نشانگرهای بازار', stockId);
        this.isInitialized = false;
    }

    getTemplate() {
        return `<div id="market-indicators-content-wrapper"></div>`;
    }

    async fetchData() {
        try {
            const [infoRes, dailyDataRes, majmaRes, historyRes] = await Promise.all([
                apiService.getInstrumentInfo(this.stockId),
                apiService.getClosingPriceDaily(this.stockId),
                apiService.getCodalMajma(this.stockId),
                apiService.getClosingPriceDailyList(this.stockId, 240) // Fetch enough for 1 year
            ]);

            const info = infoRes.instrumentInfo;
            const dailyData = dailyDataRes.closingPriceDaily;
            const historicalData = historyRes.closingPriceDaily;
            
            const majmaData = this.findMajmaNotice(majmaRes.preparedData);
            const performanceMetrics = this.calculatePerformanceMetrics(historicalData);
            const supportResistance = this.calculateSupportResistance(historicalData);

            return { info, dailyData, majmaData, performanceMetrics, supportResistance };
        } catch (error) {
            console.error('Error fetching market indicators data:', error);
            return null;
        }
    }
    
    findMajmaNotice(preparedData) {
        if (!preparedData?.length) return { found: false };
        const notice = preparedData.find(day => day.title.includes("آگهی دعوت به مجمع"));
        return notice ? { found: true } : { found: false };
    }

    calculatePerformanceMetrics(historicalData) {
        const metrics = {};
        if (!historicalData?.length) return metrics;

        const sortedData = [...historicalData].sort((a, b) => b.dEven - a.dEven);
        const currentPrice = sortedData[0].pClosing;

        [5, 20, 60, 120, 240].forEach(period => {
            if (sortedData.length > period) {
                const comparisonPrice = sortedData[period].pClosing;
                metrics[period] = parseFloat(utils.calculatePercentage(currentPrice, comparisonPrice));
            }
        });
        return metrics;
    }

    calculateSupportResistance(historicalData) {
        if (!historicalData || historicalData.length < 20) return { support: [], resistance: [] };

        const prices = historicalData.map(item => item.pClosing);
        const currentPrice = prices[prices.length - 1];
        
        // Simple peak/valley detection for levels
        const levels = [];
        for (let i = 5; i < prices.length - 5; i++) {
            const window = prices.slice(i - 5, i + 5);
            const isPeak = prices[i] === Math.max(...window);
            const isValley = prices[i] === Math.min(...window);
            if (isPeak || isValley) {
                levels.push({ price: prices[i], strength: 1 });
            }
        }
        
        // Group close levels
        const groupedLevels = levels.reduce((acc, level) => {
            const existing = acc.find(l => Math.abs(l.price - level.price) / level.price < 0.015);
            if(existing) {
                existing.price = (existing.price * existing.strength + level.price) / (existing.strength + 1);
                existing.strength++;
            } else {
                acc.push(level);
            }
            return acc;
        }, []);

        const sorted = groupedLevels.sort((a,b) => b.strength - a.strength);
        return {
            resistance: sorted.filter(l => l.price > currentPrice).slice(0, 3),
            support: sorted.filter(l => l.price < currentPrice).slice(0, 3)
        };
    }

    render(data) {
        const { info, dailyData, majmaData, performanceMetrics, supportResistance } = data;
        const indicators = this.getIndicatorStatus(info, dailyData, majmaData, supportResistance);
        const priceChangePercentage = utils.calculatePercentage(dailyData.pDrCotVal, dailyData.priceYesterday);
        const rangePercentage = utils.calculatePercentage(dailyData.pDrCotVal, info.staticThreshold.psGelStaMin) / utils.calculatePercentage(info.staticThreshold.psGelStaMax, info.staticThreshold.psGelStaMin) * 100;
        
        const indicatorsHTML = Object.values(indicators).filter(ind => ind.status).map(ind => this.generateCardHTML(ind)).join('');
        const performanceHTML = [5, 20, 60, 120, 240].map(p => this.generatePerformanceCardHTML(p, performanceMetrics)).join('');
        
        document.getElementById('market-indicators-content-wrapper').innerHTML = `
            <div class="mi-grid">
                <div class="mi-price-summary mi-card">
                    <h4>${info.lVal30} (${info.lVal18AFC})</h4>
                    <div class="price-value ${priceChangePercentage >= 0 ? 'positive' : 'negative'}">
                        ${dailyData.pDrCotVal.toLocaleString()}
                        ${utils.formatPercentageSpan(priceChangePercentage)}
                    </div>
                    <div class="price-gauge"><div style="width: ${rangePercentage}%"></div></div>
                    <div class="price-details">
                        <span>پایانی: ${dailyData.pClosing.toLocaleString()}</span>
                        <span>حجم: ${utils.formatNumberWithUnit(dailyData.qTotTran5J)}</span>
                    </div>
                </div>
                <div class="mi-sr mi-card">
                    ${this.generateSupportResistanceHTML(supportResistance, dailyData.pDrCotVal)}
                </div>
                <div class="mi-performance mi-card">
                    <h4>بازدهی سهم</h4>
                    <div class="performance-grid">${performanceHTML}</div>
                </div>
                <div class="mi-indicators mi-card">
                    <h4>نشانگرهای وضعیت</h4>
                    <div class="indicators-grid">${indicatorsHTML}</div>
                </div>
            </div>
            <style>
                .mi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1rem; }
                .mi-card { background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                .price-gauge { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin: 10px 0; }
                .price-gauge div { height: 100%; background: #2196F3; }
                .performance-grid { display: flex; justify-content: space-around; }
                .performance-card { text-align: center; }
                .indicators-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
                .indicator-card { padding: 10px; border-radius: 8px; text-align: center; color: white; }
                .sr-container { text-align: center; }
            </style>
        `;
    }
    
    getIndicatorStatus(info, dailyData, majmaData, sr) {
        return {
            lastVsClosing: { title: 'آخرین بالاتر از پایانی', status: dailyData.pDrCotVal > dailyData.pClosing, color: 'green' },
            yearHigh: { title: 'نزدیک سقف سال', status: Math.abs(utils.calculatePercentage(dailyData.pDrCotVal, info.maxYear)) <= 5, color: 'gold' },
            yearLow: { title: 'نزدیک کف سال', status: Math.abs(utils.calculatePercentage(dailyData.pDrCotVal, info.minYear)) <= 5, color: 'red' },
            hasMajma: { title: 'مجمع در پیش', status: majmaData.found, color: 'purple' },
            highVolume: { title: 'حجم بالا', status: (dailyData.qTotTran5J / info.qTotTran5JAvg) > 1.5, color: 'blue' }
        };
    }
    
    generateCardHTML(indicator) { return `<div class="indicator-card" style="background-color: ${indicator.color}">${indicator.title}</div>`; }
    generatePerformanceCardHTML(period, metrics) { return `<div class="performance-card"><div>${period} روز</div><div class="${metrics[period] >= 0 ? 'positive' : 'negative'}">${metrics[period]?.toFixed(2)}%</div></div>`; }
    generateSupportResistanceHTML(sr, currentPrice) {
        const resHtml = sr.resistance.map(l => `<div>مقاومت: ${l.price.toLocaleString()}</div>`).join('');
        const supHtml = sr.support.map(l => `<div>حمایت: ${l.price.toLocaleString()}</div>`).join('');
        return `<div class="sr-container"><h4>حمایت و مقاومت</h4>${resHtml}<div><b>قیمت فعلی: ${currentPrice.toLocaleString()}</b></div>${supHtml}</div>`;
    }

    async update() {
        const data = await this.fetchData();
        if (data) {
            this.render(data);
        }
    }

    async init() {
        if(this.isInitialized) return;
        const container = document.getElementById(`${this.name}-container`);
        if(container) container.innerHTML = this.getTemplate();
        await this.update();
        this.startUpdateInterval(10 * 60 * 1000); // 10 minutes
        this.isInitialized = true;
    }
}