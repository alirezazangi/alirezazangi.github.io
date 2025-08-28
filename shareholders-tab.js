// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

// ===== CORE BUSINESS LOGIC =====

export class ShareholdersTab extends BaseTab {
    constructor(stockId) {
        super('shareholders', 'کارت عملکرد سهامداران برتر', stockId);
        this.endDate = new Date();
        this.startDate = new Date();
        this.startDate.setDate(this.endDate.getDate() - 30);
        this.dependenciesLoaded = false;
    }

    formatDateForApi(date) {
        if (!date || typeof persianDate !== 'function') {
            console.error("Date conversion failed. persian-date library is not available.");
            throw new Error("Date conversion failed.");
        }
        return new persianDate(date).format('YYYYMMDD');
    }

    async fetchData() {
        try {
            const timeDifference = this.endDate.getTime() - this.startDate.getTime();
            const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
            const daysToFetch = Math.max(daysDifference, 0) + 15;

            const history = await apiService.getClosingPriceDailyList(this.stockId, daysToFetch);
            const tradingDays = history.closingPriceDaily || [];
            if (tradingDays.length < 2) return null;

            const startDateStr = this.formatDateForApi(this.startDate);
            const endDateStr = this.formatDateForApi(this.endDate);

            const filteredTradingDays = tradingDays.filter(d => 
                d.dEven.toString() >= startDateStr && d.dEven.toString() <= endDateStr
            );

            if (filteredTradingDays.length < 2) return null;

            const priceMap = new Map(filteredTradingDays.map(d => [d.dEven.toString(), d]));

            const shareholderPromises = filteredTradingDays.map(day => 
                apiService.getShareholders(this.stockId, day.dEven).then(data => ({
                    date: day.dEven.toString(),
                    shareholders: data?.shareShareholder ? Array.from(new Map(data.shareShareholder.map(s => [s.shareHolderName, s])).values()) : [],
                }))
            );
            
            const dailyData = (await Promise.all(shareholderPromises))
                .map(d => ({ ...d, priceData: priceMap.get(d.date) }))
                .filter(d => d.priceData)
                .sort((a, b) => parseInt(a.date) - parseInt(b.date));

            return this.analyzePerformance(dailyData);
        } catch (error) {
            console.error("Critical error in fetchData:", error);
            return null;
        }
    }
    
    analyzePerformance(analysisData) {
        if (!analysisData || analysisData.length < 2) return null;
        
        const profiles = new Map();
        const firstDay = analysisData[0];
        const lastDay = analysisData[analysisData.length - 1];

        const allShareholdersEver = new Set(analysisData.flatMap(day => day.shareholders.map(s => s.shareHolderName)));
        
        allShareholdersEver.forEach(name => {
            const firstDayData = firstDay.shareholders.find(s => s.shareHolderName === name);
            const startShares = firstDayData?.numberOfShares || 0;
            const priceToman = firstDay.priceData.pClosing / 10;
            profiles.set(name, {
                name, startShares,
                currentShares: startShares, totalCostBasis: startShares * priceToman, realizedPL: 0,
                totalInvestment: 0, totalSaleProceeds: 0, totalSharesBought: 0, totalSharesSold: 0,
                successfulSellsOnProfit: 0, grossProfit: 0, grossLoss: 0, totalBuyTrades: 0,
                totalSellTrades: 0, firstActivityDate: null, lastActivityDate: null,
                tradeLog: [], dailyPortfolioValue: []
            });
        });

        for (let i = 1; i < analysisData.length; i++) {
            const day = analysisData[i];
            const prevDay = analysisData[i - 1];
            const prevDayMap = new Map(prevDay.shareholders.map(s => [s.shareHolderName, s]));
            const activeNames = new Set([...prevDayMap.keys(), ...day.shareholders.map(s => s.shareHolderName)]);

            for (const name of activeNames) {
                const profile = profiles.get(name);
                if (!profile) continue;

                const prevShares = prevDayMap.get(name)?.numberOfShares || 0;
                const currentShares = day.shareholders.find(s => s.shareHolderName === name)?.numberOfShares || 0;
                const shareChange = currentShares - prevShares;

                if (Math.round(shareChange) === 0) continue;

                const priceToman = day.priceData.pClosing / 10;
                const avgBuyPrice = (profile.currentShares > 0) ? profile.totalCostBasis / profile.currentShares : 0;

                if (shareChange > 0) { // BUY
                    profile.totalBuyTrades++;
                    profile.totalSharesBought += shareChange;
                    profile.totalCostBasis += shareChange * priceToman;
                    profile.totalInvestment += shareChange * priceToman;
                } else { // SELL
                    profile.totalSellTrades++;
                    const soldAmount = Math.abs(shareChange);
                    profile.totalSharesSold += soldAmount;
                    const costOfSoldShares = soldAmount * avgBuyPrice;
                    const saleProceeds = soldAmount * priceToman;
                    const profitOnTrade = saleProceeds - costOfSoldShares;
                    profile.realizedPL += profitOnTrade;
                    profile.totalSaleProceeds += saleProceeds;

                    if (profitOnTrade > 0) {
                        profile.successfulSellsOnProfit++;
                        profile.grossProfit += profitOnTrade;
                    } else {
                        profile.grossLoss += profitOnTrade;
                    }
                    profile.totalCostBasis = Math.max(0, profile.totalCostBasis - costOfSoldShares);
                }
                const dailyPriceChangePercent = (day.priceData.pClosing - prevDay.priceData.pClosing) / prevDay.priceData.pClosing * 100;
                const timingScorePercent = shareChange > 0 ? -dailyPriceChangePercent : dailyPriceChangePercent;

                profile.currentShares = currentShares;
                if (!profile.firstActivityDate) profile.firstActivityDate = day.date;
                profile.lastActivityDate = day.date;
                profile.tradeLog.push({ date: day.date, shareChange, priceToman, timingScorePercent });
            }
        }

        for (const name of allShareholdersEver) {
            const profile = profiles.get(name);
            let shares = profile.startShares;
            for (const day of analysisData) {
                const trade = profile.tradeLog.find(t => t.date === day.date);
                if (trade) shares += trade.shareChange;
                profile.dailyPortfolioValue.push(shares * (day.priceData.pClosing / 10));
            }
        }
        
        const latestPriceToman = lastDay.priceData.pClosing / 10;
        
        return Array.from(profiles.values())
            .filter(p => p.tradeLog.length > 0)
            .map(p => {
                p.unrealizedPL = p.currentShares * latestPriceToman - p.totalCostBasis;
                p.totalPL = p.realizedPL + p.unrealizedPL;
                p.roi = p.totalInvestment > 0 ? (p.totalPL / p.totalInvestment) * 100 : 0;
                
                const successfulBuys = p.tradeLog.filter(t => t.shareChange > 0 && latestPriceToman > t.priceToman).length;
                p.buySuccessRate = p.totalBuyTrades > 0 ? (successfulBuys / p.totalBuyTrades) * 100 : 0;
                
                const successfulSellsByTiming = p.tradeLog.filter(t => t.shareChange < 0 && latestPriceToman < t.priceToman).length;
                p.sellTimingSuccessRate = p.totalSellTrades > 0 ? (successfulSellsByTiming / p.totalSellTrades) * 100 : 0;
                
                p.sellProfitabilityRate = p.totalSellTrades > 0 ? (p.successfulSellsOnProfit / p.totalSellTrades) * 100 : 0;

                p.avgBuyPrice = p.totalSharesBought > 0 ? p.totalInvestment / p.totalSharesBought : 0;
                p.avgSellPrice = p.totalSharesSold > 0 ? p.totalSaleProceeds / p.totalSharesSold : 0;
                p.profitFactor = p.grossLoss !== 0 ? Math.abs(p.grossProfit / p.grossLoss) : (p.grossProfit > 0 ? Infinity : 0);

                const dailyValues = p.dailyPortfolioValue;
                const dailyReturns = [];
                for (let i = 1; i < dailyValues.length; i++) {
                    dailyReturns.push(dailyValues[i - 1] > 0 ? (dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1] : 0);
                }

                if (dailyReturns.length > 1) {
                    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
                    const stdDev = Math.sqrt(dailyReturns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / dailyReturns.length);
                    p.volatility = stdDev * Math.sqrt(252) * 100;
                    p.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
                    let peak = -Infinity, maxDrawdown = 0;
                    dailyValues.forEach(value => {
                        if (value > peak) peak = value;
                        const drawdown = peak > 0 ? (peak - value) / peak : 0;
                        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
                    });
                    p.maxDrawdown = maxDrawdown * 100;
                    const annualizedReturn = Math.pow(1 + avgReturn, 252) - 1;
                    p.calmarRatio = p.maxDrawdown > 0 ? (annualizedReturn * 100) / p.maxDrawdown : 0;
                } else {
                    p.volatility = 0; p.sharpeRatio = 0; p.maxDrawdown = 0; p.calmarRatio = 0;
                }
                const avgPortfolioValue = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
                p.turnover = avgPortfolioValue > 0 ? (Math.min(p.totalInvestment, p.totalSaleProceeds) / avgPortfolioValue) * 100 : 0;
                p.holdingDuration = p.firstActivityDate ? this.calculateDateDifferenceInDays(p.firstActivityDate, p.lastActivityDate) + 1 : 0;
                p.strategy = this.determineStrategy(p);
                return p;
            })
            .sort((a, b) => b.totalPL - a.totalPL);
    }

    determineStrategy(p) {
        if (p.turnover > 70) return 'نوسان‌گیر فعال';
        if (p.turnover < 15 && p.holdingDuration > 25) return 'نگهداری بلندمدت';
        if (p.currentShares < p.startShares && p.totalSellTrades > p.totalBuyTrades) return 'خروج تدریجی';
        if (p.currentShares > p.startShares && p.totalBuyTrades > p.totalSellTrades) return 'انباشت سهم';
        return 'فعال در سهم';
    }
    
    calculateDateDifferenceInDays = (d1, d2) => (!d1 || !d2) ? 0 : Math.ceil(Math.abs(new Date(d2.substring(0,4),d2.substring(4,6)-1,d2.substring(6,8)) - new Date(d1.substring(0,4),d1.substring(4,6)-1,d1.substring(6,8))) / (1000 * 60 * 60 * 24));
    
    createShareholderCard(p, isTop) {
        const roiPercent = p.roi !== Infinity ? `(${p.roi >= 0 ? '+' : ''}${p.roi.toFixed(1)}%)` : '';

        return `
            <div class="shareholder-card ${isTop ? 'top-performer' : ''}">
                <div class="card-header">
                    <span class="shareholder-name">${p.name}</span>
                    ${isTop ? '<span class="top-badge">★ بهترین عملکرد</span>' : ''}
                </div>
                <div class="kpi-main">
                    <div class="kpi-main-label">مجموع سود/زیان کل (تومان)</div>
                    <div class="kpi-main-value ${p.totalPL >= 0 ? 'positive' : 'negative'}">
                        ${utils.formatNumberWithUnit(p.totalPL)}
                        <span class="kpi-main-percent ${p.roi >= 0 ? 'positive' : 'negative'}">${roiPercent}</span>
                    </div>
                </div>
                <div class="details-section">
                    <div class="section-header">نرخ‌های موفقیت</div>
                    <div class="detail-item"><span class="detail-label">موفقیت خرید <span class="tooltip-trigger" title="درصد خریدهایی که قیمت فعلی بالاتر از قیمت خرید آنهاست.">&#9432;</span></span><span class="detail-value positive">${p.buySuccessRate.toFixed(0)}%</span></div>
                    <div class="detail-item"><span class="detail-label">موفقیت زمان‌بندی فروش <span class="tooltip-trigger" title="درصد فروش‌هایی که قیمت فعلی پایین‌تر از قیمت فروش آنهاست (فروش موفق).">&#9432;</span></span><span class="detail-value ${p.sellTimingSuccessRate >= 50 ? 'positive' : 'negative'}">${p.sellTimingSuccessRate.toFixed(0)}%</span></div>
                    <div class="detail-item"><span class="detail-label">موفقیت سودآوری فروش <span class="tooltip-trigger" title="درصد فروش‌هایی که با سود واقعی (نسبت به قیمت خرید) بسته شده‌اند.">&#9432;</span></span><span class="detail-value positive">${p.sellProfitabilityRate.toFixed(0)}%</span></div>
                </div>
                <div class="details-section">
                    <div class="section-header">آمار و تحلیل ریسک</div>
                    <div class="detail-item"><span class="detail-label">نرخ شارپ</span><span class="detail-value">${p.sharpeRatio.toFixed(2)}</span></div>
                    <div class="detail-item"><span class="detail-label">حداکثر افت سرمایه</span><span class="detail-value negative">${p.maxDrawdown.toFixed(1)}%</span></div>
                    <div class="detail-item"><span class="detail-label">نرخ کالمار</span><span class="detail-value">${p.calmarRatio.toFixed(2)}</span></div>
                </div>
                <div class="details-section">
                    <div class="section-header">استراتژی و معاملات</div>
                    <div class="detail-item"><span class="detail-label">استراتژی</span><span class="detail-value">${p.strategy}</span></div>
                    <div class="detail-item"><span class="detail-label">گردش پرتفوی</span><span class="detail-value">${p.turnover.toFixed(1)}%</span></div>
                    <div class="detail-item"><span class="detail-label">تعداد معاملات (خرید/فروش)</span><span class="detail-value"><span class="positive">${p.totalBuyTrades}</span> / <span class="negative">${p.totalSellTrades}</span></span></div>
                </div>
                <div class="toggle-trades-btn" data-name="${p.name}">نمایش جزئیات معاملات ▼</div>
                <div class="trades-details" id="trades-${p.name.replace(/[^a-zA-Z0-9]/g, '')}">
                    <table class="dashboard-table" style="font-size: 0.85rem;">
                        <thead><tr><th>تاریخ</th><th>تغییر سهام</th><th>قیمت معامله</th><th>امتیاز زمان‌بندی</th></tr></thead>
                        <tbody>${p.tradeLog.map(t => `<tr><td>${utils.formatDate(parseInt(t.date))}</td><td class="${t.shareChange > 0 ? 'positive' : 'negative'}">${utils.formatNumberWithUnit(t.shareChange)}</td><td>${utils.formatNumberWithUnit(t.priceToman)}</td><td class="${t.timingScorePercent >= 0 ? 'positive' : 'negative'}">${t.timingScorePercent.toFixed(1)}%</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`;
    }

    async loadDependencies() {
        if (this.dependenciesLoaded) return;
        try {
            await utils.loadScript('https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js', 'jquery-script');
            await utils.loadScript('https://cdn.jsdelivr.net/npm/persian-date/dist/persian-date.min.js', 'persian-date-script');
            utils.loadStyle('https://cdn.jsdelivr.net/npm/persian-datepicker/dist/css/persian-datepicker.min.css');
            await utils.loadScript('https://cdn.jsdelivr.net/npm/persian-datepicker/dist/js/persian-datepicker.min.js', 'persian-datepicker-script');
            this.dependenciesLoaded = true;
        } catch (error) {
            console.error("Critical dependency failure:", error);
            this.dependenciesLoaded = false;
            throw new Error("Failed to load date picker dependencies.");
        }
    }

    // Renders the results into the content area, leaving the static layout untouched.
    renderResults(profiles) {
        const resultsContainer = document.querySelector('#shareholders-container .scorecard-grid-container');
        if (!resultsContainer) return;

        const profilesHTML = profiles && profiles.length > 0
            ? profiles.map((p, index) => this.createShareholderCard(p, index === 0)).join('')
            : `<div class="no-data-message"><p>در بازه زمانی انتخاب شده، فعالیتی از سوی سهامداران عمده که قابلیت تحلیل داشته باشد، یافت نشد.</p></div>`;
        
        resultsContainer.innerHTML = profiles && profiles.length > 0 
            ? `<div class="scorecard-grid">${profilesHTML}</div>` 
            : profilesHTML;
    }
    
    // Sets up the date picker components on the static layout.
    setupDatePickersUI() {
        if (!this.dependenciesLoaded) return;
        try {
            $('#start-date-input').pDatepicker({
                initialValue: true,
                initialValueTimestamp: this.startDate.getTime(),
                format: 'L',
                onSelect: (unix) => { this.startDate = new Date(unix); }
            });
            $('#end-date-input').pDatepicker({
                initialValue: true,
                initialValueTimestamp: this.endDate.getTime(),
                format: 'L',
                onSelect: (unix) => { this.endDate = new Date(unix); }
            });
        } catch(e) {
            console.error("Error initializing date picker UI:", e);
        }
    }

    // Sets up a single, persistent event listener for the entire component.
    setupEventListeners() {
        const container = document.getElementById('shareholders-container');
        if (!container || container.hasAttribute('data-listener-attached')) return;

        container.setAttribute('data-listener-attached', 'true');
        container.addEventListener('click', (e) => {
            if (e.target.matches('.toggle-trades-btn')) {
                const card = e.target.closest('.shareholder-card');
                const details = card.querySelector('.trades-details');
                const isHidden = details.style.display === 'none' || details.style.display === '';
                details.style.display = isHidden ? 'block' : 'none';
                e.target.textContent = isHidden ? 'مخفی کردن جزئیات ▲' : 'نمایش جزئیات معاملات ▼';
            } else if (e.target.matches('#run-analysis-btn')) {
                this.updateResults();
            }
        });
    }

    // Fetches data and updates only the results portion of the DOM.
    async updateResults() {
        const contentArea = document.querySelector('#shareholders-container .scorecard-grid-container');
        if (contentArea) {
            contentArea.innerHTML = `<div class="no-data-message"><p>در حال اجرای تحلیل برای بازه زمانی جدید...</p></div>`;
        }
        try {
            const profiles = await this.fetchData();
            this.renderResults(profiles);
        } catch (error) {
            console.error("Failed during results update:", error);
            if (contentArea) {
                contentArea.innerHTML = `<div class="no-data-message"><p style="color:var(--negative);">خطا در پردازش داده‌ها.</p></div>`;
            }
        }
    }
    
    // Renders the main, static layout of the component once.
    renderLayout() {
        const container = document.getElementById('shareholders-container');
        container.innerHTML = `
            <style>
                .date-filter-container { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-main); border-radius: var(--border-radius); margin-bottom: 1.5rem; flex-wrap: wrap; }
                .date-input-group { display: flex; align-items: center; gap: 0.5rem; }
                .date-input { padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; text-align: center; cursor: pointer; background-color: var(--bg-widget); width: 120px; }
                .run-btn { padding: 0.6rem 1.5rem; background: var(--primary-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; transition: background-color 0.2s; }
                .run-btn:hover { background: var(--primary-accent-hover); }
                .scorecard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1.5rem; }
                .no-data-message { text-align: center; padding: 2rem; background: var(--bg-widget); border-radius: var(--border-radius); }
                .analysis-period-title { text-align: center; color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.95rem; font-weight: 500; background-color: var(--bg-main); padding: 0.6rem; border-radius: var(--border-radius); border: 1px solid var(--border-color); }
                .scorecard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.5rem; }
                .shareholder-card { background: var(--bg-widget); border-radius: var(--border-radius); box-shadow: var(--shadow); padding: 1rem; border-top: 4px solid var(--primary-accent); position: relative; display: flex; flex-direction: column; transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .shareholder-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }
                .shareholder-card.top-performer { border-color: #f39c12; }
                .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; padding: 0 0.5rem; }
                .shareholder-name { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); }
                .top-badge { background: #f39c12; color: white; padding: 0.3rem 0.8rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
                .kpi-main { text-align: center; margin-bottom: 1rem; padding: 1rem; background: var(--bg-main); border-radius: 6px;}
                .kpi-main-label { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
                .kpi-main-value { font-size: 1.8rem; font-weight: 700; }
                .kpi-main-percent { font-size: 1rem; font-weight: 500; margin-left: 8px; }
                .details-section { padding: 0 0.5rem; margin-bottom: 1rem; }
                .section-header { font-weight: 600; margin-bottom: 0.5rem; font-size: 1rem; color: var(--primary-accent); }
                .detail-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem;}
                .detail-label { color: var(--text-secondary); }
                .detail-value { font-weight: 500; }
                .toggle-trades-btn { margin-top: auto; text-align: center; cursor: pointer; color: var(--primary-accent); font-weight: 500; padding-top: 1rem; transition: color 0.2s; }
                .toggle-trades-btn:hover { color: var(--primary-accent-hover); }
                .trades-details { display: none; margin-top: 1rem; max-height: 200px; overflow-y: auto; border-top: 1px solid var(--border-color); padding-top: 1rem; }
                .tooltip-trigger { cursor: help; color: var(--text-secondary); border-bottom: 1px dotted var(--text-secondary); }
            </style>
            <div class="date-filter-container">
                <div class="date-input-group">
                    <label for="start-date-input">از تاریخ:</label>
                    <input type="text" id="start-date-input" class="date-input" readonly>
                </div>
                <div class="date-input-group">
                    <label for="end-date-input">تا تاریخ:</label>
                    <input type="text" id="end-date-input" class="date-input" readonly>
                </div>
                <button id="run-analysis-btn" class="run-btn">اجرای تحلیل</button>
            </div>
            <div class="scorecard-grid-container">
                 <div class="no-data-message"><p>در حال اجرای تحلیل اولیه...</p></div>
            </div>`;
    }

    /**
     * 💡 **ARCHITECTURAL REWORK: Correct Component Lifecycle**
     * 1. `init()` now handles the complete one-time setup.
     * 2. Dependencies are loaded first.
     * 3. The static layout is rendered once.
     * 4. Date pickers and event listeners are initialized once.
     * 5. `updateResults()` is called to fetch and render the initial data.
     * This robust structure prevents all previous lifecycle and state management bugs.
     */
    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if (!container) return;
        
        container.innerHTML = `<p style="text-align:center;padding:2rem;">در حال بارگذاری نیازمندی‌های تقویم...</p>`;
        
        try {
            await this.loadDependencies();
            this.renderLayout();
            this.setupDatePickersUI();
            this.setupEventListeners();
            await this.updateResults();
        } catch (error) {
            console.error("Initialization failed:", error);
            container.innerHTML = `<p style="color:var(--negative);text-align:center;padding:2rem;">خطا در بارگذاری تقویم شمسی. لطفا صفحه را رفرش کنید.</p>`;
        }
    }
    
    // BaseTab compatibility method, not used in the new lifecycle.
    async update() {
        console.warn("The 'update' method is deprecated. Use 'init' for setup and 'updateResults' for data refresh.");
    }
}