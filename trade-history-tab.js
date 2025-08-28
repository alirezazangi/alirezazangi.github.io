    /**
     * 📊 **ENHANCED SHAREHOLDER CARD WITH ADVANCED MARKET STATISTICS**
     * Creates comprehensive shareholder analysis card with risk metrics and market statistics
     * @param {object} p - Enhanced shareholder profile with statistical data.
     * @param {boolean} isTop - Flag for top performer styling.
     * @returns {string} Complete HTML for advanced shareholder card.
     */
    createEnhancedShareholderCard(p, isTop) {
        const formatPLPercent = (value) => (!isFinite(value)) ? '' : `(${value >= 0 ? '+' : ''}${value.toFixed(1)}%)`;
        const roiPercent = formatPLPercent(p.roi);
        
        // Performance score classification
        const getPerformanceClass = (score) => {
            if (score >= 80) return 'score-excellent';
            if (score >= 65) return 'score-good';
            if (score >= 40) return 'score-fair';
            return 'score-poor';
        };
        
        // Risk classification
        const getRiskClass = (riskScore) => {
            if (riskScore <= 30) return 'risk-low';
            if (riskScore <= 60) return 'risk-medium';
            return 'risk-high';
        };
        
        const getRiskLabel = (riskScore) => {
            if (riskScore <= 30) return 'کم ریسک';
            if (riskScore <= 60) return 'متوسط';
            return 'پرریسک';
        };
        
        // Metric classification helpers
        const getMetricClass = (value, thresholds) => {
            if (value >= thresholds.excellent) return 'metric-excellent';
            if (value >= thresholds.good) return 'metric-good';
            if (value >= thresholds.warning) return 'metric-warning';
            return 'metric-poor';
        };
        
        const riskClass = getRiskClass(p.riskScore);
        const performanceClass = getPerformanceClass(p.performanceScore);
        
        return `
            <div class="shareholder-card ${isTop ? 'top-performer' : ''} ${riskClass === 'risk-high' ? 'high-risk' : ''} ${riskClass === 'risk-low' ? 'low-risk' : ''}">
                <div class="card-header">
                    <span class="shareholder-name">${p.name}</span>
                    <div class="performance-badges">
                        ${isTop ? '<span class="top-badge">⭐ برترین عملکرد</span>' : ''}
                        <span class="risk-badge ${riskClass}">${getRiskLabel(p.riskScore)}</span>
                    </div>
                </div>
                
                <div class="kpi-main">
                    <div class="kpi-main-label">💰 مجموع سود/زیان کل (تومان)</div>
                    <div class="kpi-main-value ${p.totalPL >= 0 ? 'positive' : 'negative'}">
                        ${utils.formatNumberWithUnit(p.totalPL)}
                        <span class="kpi-main-percent ${p.roi >= 0 ? 'positive' : 'negative'}">${roiPercent}</span>
                        <span class="performance-score ${performanceClass}">امتیاز: ${p.performanceScore.toFixed(0)}</span>
                    </div>
                </div>

                <!-- Risk Assessment Indicator -->
                <div style="padding: 0 0.5rem; margin-bottom: 1rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">⚖️ ارزیابی ریسک (۰-۱۰۰)</div>
                    <div class="risk-indicator">
                        <div class="risk-pointer" style="left: ${p.riskScore}%;"></div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center;">امتیاز ریسک: ${p.riskScore.toFixed(0)}</div>
                </div>

                <!-- Key Performance Indicators Grid -->
                <div class="kpi-grid">
                    <div class="kpi-item">
                        <div class="kpi-item-value ${getMetricClass(p.sharpeRatio, {excellent: 1.5, good: 1.0, warning: 0.5})}">${p.sharpeRatio.toFixed(2)}</div>
                        <div class="kpi-item-label">📊 نسبت شارپ</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-item-value ${getMetricClass(p.beta, {excellent: 0.8, good: 1.0, warning: 1.3})}">${p.beta.toFixed(2)}</div>
                        <div class="kpi-item-label">📈 بتا (ریسک سیستماتیک)</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-item-value ${p.maxDrawdown <= 10 ? 'metric-excellent' : p.maxDrawdown <= 20 ? 'metric-good' : 'metric-poor'}">${p.maxDrawdown.toFixed(1)}%</div>
                        <div class="kpi-item-label">📉 حداکثر کاهش</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-item-value ${p.annualizedVolatility <= 20 ? 'metric-excellent' : p.annualizedVolatility <= 40 ? 'metric-good' : 'metric-poor'}">${p.annualizedVolatility.toFixed(1)}%</div>
                        <div class="kpi-item-label">📊 نوسان سالانه</div>
                    </div>
                </div>

                <!-- Tabbed Statistics Sections -->
                <div class="stats-tabs">
                    <div class="stats-tab active" data-tab="performance-${p.name.replace(/[^a-zA-Z0-9]/g, '')}">💹 عملکرد</div>
                    <div class="stats-tab" data-tab="risk-${p.name.replace(/[^a-zA-Z0-9]/g, '')}">⚠️ ریسک</div>
                    <div class="stats-tab" data-tab="trading-${p.name.replace(/[^a-zA-Z0-9]/g, '')}">🔄 معاملات</div>
                </div>

                <!-- Performance Statistics -->
                <div class="stats-content active" id="performance-${p.name.replace(/[^a-zA-Z0-9]/g, '')}">
                    <div class="details-section">
                        <div class="section-header">💰 عملکرد مالی</div>
                        <div class="detail-item">
                            <span class="detail-label">س/ز محقق شده</span>
                            <span class="detail-value ${p.realizedPL >= 0 ? 'positive' : 'negative'}">${utils.formatNumberWithUnit(p.realizedPL)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">س/ز محقق نشده</span>
                            <span class="detail-value ${p.unrealizedPL >= 0 ? 'positive' : 'negative'}">${utils.formatNumberWithUnit(p.unrealizedPL)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">
                                <span class="tooltip-trigger" title="نسبت سود به ضرر با تعدیل ریسک">نسبت سورتینو</span>
                            </span>
                            <span class="detail-value ${getMetricClass(p.sortinoRatio, {excellent: 1.5, good: 1.0, warning: 0.5})}">${p.sortinoRatio.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">
                                <span class="tooltip-trigger" title="نسبت بازدهی سالانه به حداکثر کاهش">نسبت کالمار</span>
                            </span>
                            <span class="detail-value ${getMetricClass(p.calmarRatio, {excellent: 2.0, good: 1.0, warning: 0.5})}">${p.calmarRatio.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <!-- Risk Statistics -->
                <div class="stats-content" id="risk-${p.name.replace(/[^a-zA-Z0-9]/g, '')}">
                    <div class="details-section">
                        <div class="section-header">⚠️ تحلیل ریسک</div>
                        <div class="detail-item">
                            <span class="detail-label">
                                <span class="tooltip-trigger" title="ارزش در معرض خطر با اطمینان ۹۵٪">VaR (۹۵٪)</span>
                            </span>
                            <span class="detail-value metric-warning">${p.valueAtRisk.toFixed(1)}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">
                                <span class="tooltip-trigger" title="نسبت اطلاعات: بازدهی فعال نسبت به خطای ردیابی">نسبت اطلاعات</span>
                            </span>
                // ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

// ===== STATISTICAL MODELS & CALCULATIONS =====
const calculateDateDifferenceInDays = (d1, d2) => {
    if (!d1 || !d2) return 0;
    const date1 = new Date(d1.substring(0, 4), d1.substring(4, 6) - 1, d1.substring(6, 8));
    const date2 = new Date(d2.substring(0, 4), d2.substring(4, 6) - 1, d2.substring(6, 8));
    return Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24));
};

/**
 * 📊 **ADVANCED STATISTICAL CALCULATIONS FOR MARKET ANALYSIS**
 * Enhanced with comprehensive market metrics and risk analysis
 */
class MarketStatistics {
    // Sharpe Ratio calculation (risk-adjusted return)
    static calculateSharpeRatio(returns, riskFreeRate = 0.2) { // Default 20% risk-free rate for Iran
        if (!returns || returns.length < 2) return 0;
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);
        return volatility > 0 ? (avgReturn - riskFreeRate) / volatility : 0;
    }

    // Maximum Drawdown calculation
    static calculateMaxDrawdown(cumulativeReturns) {
        if (!cumulativeReturns || cumulativeReturns.length < 2) return 0;
        let maxDrawdown = 0;
        let peak = cumulativeReturns[0];
        
        for (let i = 1; i < cumulativeReturns.length; i++) {
            if (cumulativeReturns[i] > peak) {
                peak = cumulativeReturns[i];
            }
            const drawdown = ((peak - cumulativeReturns[i]) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        return maxDrawdown;
    }

    // Value at Risk (VaR) at 95% confidence level
    static calculateVaR(returns, confidenceLevel = 0.95) {
        if (!returns || returns.length < 10) return 0;
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
        return Math.abs(sortedReturns[index] || 0);
    }

    // Beta calculation relative to market (requires market returns)
    static calculateBeta(stockReturns, marketReturns) {
        if (!stockReturns || !marketReturns || stockReturns.length !== marketReturns.length) return 1;
        
        const stockMean = stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length;
        const marketMean = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
        
        let covariance = 0;
        let marketVariance = 0;
        
        for (let i = 0; i < stockReturns.length; i++) {
            covariance += (stockReturns[i] - stockMean) * (marketReturns[i] - marketMean);
            marketVariance += Math.pow(marketReturns[i] - marketMean, 2);
        }
        
        return marketVariance > 0 ? covariance / marketVariance : 1;
    }

    // Sortino Ratio (downside deviation focus)
    static calculateSortinoRatio(returns, targetReturn = 0) {
        if (!returns || returns.length < 2) return 0;
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const downside = returns.filter(r => r < targetReturn);
        if (downside.length === 0) return Infinity;
        
        const downsideDeviation = Math.sqrt(
            downside.reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / returns.length
        );
        return downsideDeviation > 0 ? (avgReturn - targetReturn) / downsideDeviation : 0;
    }

    // Information Ratio (active return vs tracking error)
    static calculateInformationRatio(portfolioReturns, benchmarkReturns) {
        if (!portfolioReturns || !benchmarkReturns || portfolioReturns.length !== benchmarkReturns.length) return 0;
        
        const activeReturns = portfolioReturns.map((r, i) => r - (benchmarkReturns[i] || 0));
        const avgActiveReturn = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
        const trackingError = Math.sqrt(
            activeReturns.reduce((sum, r) => sum + Math.pow(r - avgActiveReturn, 2), 0) / activeReturns.length
        );
        return trackingError > 0 ? avgActiveReturn / trackingError : 0;
    }

    // Calmar Ratio (annual return / max drawdown)
    static calculateCalmarRatio(annualReturn, maxDrawdown) {
        return maxDrawdown > 0 ? annualReturn / maxDrawdown : 0;
    }

    // Win/Loss Ratio for trades
    static calculateWinLossRatio(trades) {
        const wins = trades.filter(t => t.profitLoss > 0);
        const losses = trades.filter(t => t.profitLoss < 0);
        
        if (losses.length === 0) return wins.length > 0 ? Infinity : 0;
        
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.profitLoss, 0) / wins.length : 0;
        const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.profitLoss, 0) / losses.length);
        
        return avgLoss > 0 ? avgWin / avgLoss : 0;
    }

    // Profit Factor (gross profit / gross loss)
    static calculateProfitFactor(trades) {
        const grossProfit = trades.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
        const grossLoss = Math.abs(trades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
        return grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
    }

    // Average holding period analysis
    static analyzeHoldingPeriods(trades) {
        const holdingPeriods = trades.filter(t => t.holdingDays > 0).map(t => t.holdingDays);
        if (holdingPeriods.length === 0) return { avg: 0, median: 0, max: 0, min: 0 };
        
        const sorted = [...holdingPeriods].sort((a, b) => a - b);
        return {
            avg: holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length,
            median: sorted[Math.floor(sorted.length / 2)],
            max: Math.max(...holdingPeriods),
            min: Math.min(...holdingPeriods)
        };
    }

    // Market timing analysis
    static analyzeMarketTiming(trades, priceData) {
        if (!trades || !priceData || trades.length === 0) return { buyTiming: 0, sellTiming: 0 };
        
        const buys = trades.filter(t => t.shareChange > 0);
        const sells = trades.filter(t => t.shareChange < 0);
        
        // Analyze if buys happened at relatively low prices and sells at high prices
        const buyTiming = this.calculateTimingScore(buys, priceData, 'buy');
        const sellTiming = this.calculateTimingScore(sells, priceData, 'sell');
        
        return { buyTiming, sellTiming };
    }

    static calculateTimingScore(trades, priceData, type) {
        if (trades.length === 0) return 0;
        
        const prices = priceData.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        
        if (priceRange === 0) return 50; // Neutral if no price movement
        
        let totalScore = 0;
        trades.forEach(trade => {
            const normalizedPrice = (trade.priceToman * 10 - minPrice) / priceRange; // 0-1 scale
            // For buys: lower prices are better (score closer to 100)
            // For sells: higher prices are better (score closer to 100)
            const score = type === 'buy' ? (1 - normalizedPrice) * 100 : normalizedPrice * 100;
            totalScore += score;
        });
        
        return totalScore / trades.length;
    }
}

// ===== CORE BUSINESS LOGIC =====

export class ShareholdersTab extends BaseTab {
    constructor(stockId) {
        super('shareholders', '🎯 کارت عملکرد سهامداران برتر', stockId);
    }
    
    /**
     * 🧠 **ARCHITECT'S NOTE: Enhanced Data Retrieval with Market Context**
     * Now includes additional market data for statistical analysis
     * @param {string} startDateStr - Start date in "YYYYMMDD" format.
     * @param {string} endDateStr - End date in "YYYYMMDD" format.
     * @returns {Promise<object|null>} The enhanced analysis object or null on failure.
     */
    async fetchData(startDateStr, endDateStr) {
        try {
            const dateDiff = calculateDateDifferenceInDays(startDateStr, endDateStr);
            if (dateDiff > 120) {
                throw new Error("بازه زمانی بسیار بزرگ است. لطفاً یک دوره ۱۲۰ روزه یا کمتر انتخاب کنید.");
            }

            // Fetch extended history for better statistical analysis
            const history = await apiService.getClosingPriceDailyList(this.stockId, dateDiff + 10);
            if (!history?.closingPriceDaily) return null;

            const priceMap = new Map(history.closingPriceDaily.map(d => [d.dEven.toString(), d.pClosing]));
            const tradingDaysInRange = history.closingPriceDaily.filter(d => {
                const dateNum = d.dEven.toString();
                return dateNum >= startDateStr && dateNum <= endDateStr;
            });
            
            if (tradingDaysInRange.length < 2) return null;

            const shareholderPromises = tradingDaysInRange.map(day => 
                apiService.getShareholders(this.stockId, day.dEven).then(data => {
                    const correctDateShareholders = data?.shareShareholder?.filter(s => s.dEven === day.dEven) || [];
                    return {
                        date: day.dEven.toString(),
                        shareholders: Array.from(new Map(correctDateShareholders.map(s => [s.shareHolderName, s])).values()),
                    };
                })
            );
            
            const dailyData = (await Promise.all(shareholderPromises))
                .map(d => ({ ...d, price: priceMap.get(d.date) || 0 }))
                .filter(d => d.price > 0)
                .sort((a, b) => parseInt(a.date) - parseInt(b.date));

            return this.analyzePerformance(dailyData);
        } catch (error) {
            console.error("Error in ShareholdersTab fetchData:", error);
            throw error;
        }
    }
    
    /**
     * 🧠 **ARCHITECT'S NOTE: Enhanced Statistical Analysis Engine**
     * Now includes comprehensive market statistics and risk metrics
     * @param {Array<object>} analysisData - Clean, sorted daily data for analysis.
     * @returns {object|null} Enhanced analysis with advanced statistics.
     */
    analyzePerformance(analysisData) {
        if (!analysisData || analysisData.length < 2) return null;
        
        const profiles = new Map();
        const firstDay = analysisData[0];
        const lastDay = analysisData[analysisData.length - 1];
        const totalPeriodDays = calculateDateDifferenceInDays(firstDay.date, lastDay.date);

        // Calculate market returns for benchmarking
        const marketReturns = [];
        for (let i = 1; i < analysisData.length; i++) {
            const dailyReturn = ((analysisData[i].price - analysisData[i-1].price) / analysisData[i-1].price) * 100;
            marketReturns.push(dailyReturn);
        }

        const allShareholdersEver = new Set(analysisData.flatMap(day => day.shareholders.map(s => s.shareHolderName)));
        const firstDayMap = new Map(firstDay.shareholders.map(s => [s.shareHolderName, s]));

        // Initialize enhanced profiles with statistical tracking
        allShareholdersEver.forEach(name => {
            const firstDayData = firstDayMap.get(name);
            const startShares = firstDayData?.numberOfShares || 0;
            profiles.set(name, {
                name, startShares, currentShares: startShares,
                totalCostBasis: startShares * (firstDay.price / 10),
                realizedPL: 0, totalInvestment: 0, successfulSells: 0,
                totalBuyTrades: 0, totalSellTrades: 0,
                firstActivityDate: firstDayData ? firstDay.date : null,
                lastActivityDate: firstDayData ? firstDay.date : null,
                tradeLog: [],
                // 📊 Enhanced statistical tracking
                dailyReturns: [],
                cumulativeReturns: [100], // Start at 100 (base value)
                portfolioValues: [startShares * (firstDay.price / 10)],
                tradeProfits: [],
                buyPrices: [],
                sellPrices: [],
                holdingPeriods: []
            });
        });

        // Process daily changes with enhanced tracking
        for (let i = 1; i < analysisData.length; i++) {
            const day = analysisData[i];
            const prevDay = analysisData[i-1];
            const prevDayMap = new Map(prevDay.shareholders.map(s => [s.shareHolderName, s]));
            const activeNames = new Set([...prevDayMap.keys(), ...day.shareholders.map(s => s.shareHolderName)]);

            for (const name of activeNames) {
                const profile = profiles.get(name);
                if (!profile) continue;
                
                const prevShares = prevDayMap.get(name)?.numberOfShares || 0;
                const currentShares = day.shareholders.find(s => s.shareHolderName === name)?.numberOfShares || 0;
                const shareChange = currentShares - prevShares;
                
                // Calculate daily portfolio value and return
                const currentPortfolioValue = currentShares * (day.price / 10);
                const prevPortfolioValue = profile.portfolioValues[profile.portfolioValues.length - 1] || 0;
                const dailyReturn = prevPortfolioValue > 0 ? ((currentPortfolioValue - prevPortfolioValue) / prevPortfolioValue) * 100 : 0;
                
                profile.portfolioValues.push(currentPortfolioValue);
                profile.dailyReturns.push(dailyReturn);
                profile.cumulativeReturns.push(profile.cumulativeReturns[profile.cumulativeReturns.length - 1] * (1 + dailyReturn / 100));
                
                if (Math.round(shareChange) === 0) continue;
                
                const priceToman = day.price / 10;
                const avgBuyPrice = (profile.currentShares > 0) ? profile.totalCostBasis / profile.currentShares : 0;
                
                if (shareChange > 0) {
                    profile.totalBuyTrades++;
                    profile.buyPrices.push(priceToman);
                    profile.totalCostBasis += shareChange * priceToman;
                    profile.totalInvestment += shareChange * priceToman;
                } else {
                    profile.totalSellTrades++;
                    profile.sellPrices.push(priceToman);
                    const costOfSoldShares = Math.abs(shareChange) * avgBuyPrice;
                    const saleProceeds = Math.abs(shareChange) * priceToman;
                    const profitOnTrade = saleProceeds - costOfSoldShares;
                    const profitPercent = costOfSoldShares > 0 ? (profitOnTrade / costOfSoldShares) * 100 : 0;
                    
                    profile.realizedPL += profitOnTrade;
                    profile.tradeProfits.push(profitPercent);
                    if (profitOnTrade > 0) profile.successfulSells++;
                    profile.totalCostBasis -= costOfSoldShares;
                    
                    // Calculate holding period for this trade
                    const lastBuyIndex = profile.tradeLog.slice().reverse().findIndex(t => t.shareChange > 0);
                    if (lastBuyIndex !== -1) {
                        const lastBuyDate = profile.tradeLog[profile.tradeLog.length - 1 - lastBuyIndex].date;
                        const holdingDays = calculateDateDifferenceInDays(lastBuyDate, day.date);
                        profile.holdingPeriods.push(holdingDays);
                    }
                }
                
                profile.currentShares = currentShares;
                if (!profile.firstActivityDate) profile.firstActivityDate = day.date;
                profile.lastActivityDate = day.date;
                profile.tradeLog.push({ 
                    date: day.date, 
                    shareChange, 
                    priceToman,
                    profitLoss: shareChange < 0 ? (Math.abs(shareChange) * priceToman) - (Math.abs(shareChange) * avgBuyPrice) : 0
                });
            }
        }
        
        const latestPriceToman = lastDay.price / 10;
        
        // 📊 **ENHANCED STATISTICAL ANALYSIS**
        const finalProfiles = Array.from(profiles.values())
            .filter(p => p.tradeLog.length > 0)
            .map(p => {
                // Basic metrics
                p.unrealizedPL = p.currentShares * latestPriceToman - p.totalCostBasis;
                p.totalPL = p.realizedPL + p.unrealizedPL;
                p.holdingDuration = p.firstActivityDate ? calculateDateDifferenceInDays(p.firstActivityDate, p.lastActivityDate) + 1 : 0;
                p.winRate = p.totalSellTrades > 0 ? (p.successfulSells / p.totalSellTrades) * 100 : 0;
                p.roi = p.totalInvestment > 0 ? (p.totalPL / p.totalInvestment) * 100 : 0;
                
                // Buy success rate
                const successfulBuys = p.tradeLog.filter(t => t.shareChange > 0 && latestPriceToman > t.priceToman).length;
                p.buySuccessRate = p.totalBuyTrades > 0 ? (successfulBuys / p.totalBuyTrades) * 100 : 0;

                // 📊 **ADVANCED MARKET STATISTICS**
                
                // Risk-adjusted returns
                p.sharpeRatio = MarketStatistics.calculateSharpeRatio(p.dailyReturns);
                p.sortinoRatio = MarketStatistics.calculateSortinoRatio(p.dailyReturns);
                p.informationRatio = MarketStatistics.calculateInformationRatio(p.dailyReturns, marketReturns.slice(0, p.dailyReturns.length));
                
                // Risk metrics
                p.maxDrawdown = MarketStatistics.calculateMaxDrawdown(p.cumulativeReturns);
                p.valueAtRisk = MarketStatistics.calculateVaR(p.dailyReturns);
                p.beta = MarketStatistics.calculateBeta(p.dailyReturns, marketReturns.slice(0, p.dailyReturns.length));
                p.calmarRatio = MarketStatistics.calculateCalmarRatio(p.roi, p.maxDrawdown);
                
                // Trading performance metrics
                p.winLossRatio = MarketStatistics.calculateWinLossRatio(p.tradeLog.filter(t => t.shareChange < 0));
                p.profitFactor = MarketStatistics.calculateProfitFactor(p.tradeLog.filter(t => t.shareChange < 0));
                
                // Volatility analysis
                if (p.dailyReturns.length > 1) {
                    const avgReturn = p.dailyReturns.reduce((a, b) => a + b, 0) / p.dailyReturns.length;
                    p.volatility = Math.sqrt(p.dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / p.dailyReturns.length);
                    p.annualizedVolatility = p.volatility * Math.sqrt(252); // 252 trading days per year
                } else {
                    p.volatility = 0;
                    p.annualizedVolatility = 0;
                }
                
                // Holding period analysis
                p.holdingStats = MarketStatistics.analyzeHoldingPeriods(p.tradeLog);
                
                // Market timing analysis
                const timingAnalysis = MarketStatistics.analyzeMarketTiming(p.tradeLog, analysisData);
                p.buyTimingScore = timingAnalysis.buyTiming;
                p.sellTimingScore = timingAnalysis.sellTiming;
                
                // Average buy/sell prices
                p.avgBuyPrice = p.buyPrices.length > 0 ? p.buyPrices.reduce((a, b) => a + b, 0) / p.buyPrices.length : 0;
                p.avgSellPrice = p.sellPrices.length > 0 ? p.sellPrices.reduce((a, b) => a + b, 0) / p.sellPrices.length : 0;
                
                // Trade frequency analysis
                p.tradeFrequency = totalPeriodDays > 0 ? (p.totalBuyTrades + p.totalSellTrades) / totalPeriodDays * 30 : 0; // trades per month
                
                // Position sizing analysis
                const positionSizes = p.tradeLog.map(t => Math.abs(t.shareChange * t.priceToman));
                p.avgPositionSize = positionSizes.length > 0 ? positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length : 0;
                p.maxPositionSize = positionSizes.length > 0 ? Math.max(...positionSizes) : 0;
                
                // Strategy classification with enhanced criteria
                if (p.holdingDuration > 20 && p.currentShares > p.startShares && p.tradeFrequency < 2) {
                    p.strategy = 'انباشت بلندمدت';
                    p.strategyRisk = 'متوسط';
                } else if (p.holdingDuration < 10 && p.totalSellTrades > 0 && p.tradeFrequency > 10) {
                    p.strategy = 'نوسان‌گیر کوتاه‌مدت';
                    p.strategyRisk = 'بالا';
                } else if (p.currentShares < p.startShares && p.startShares > 0) {
                    p.strategy = 'خروج تدریجی';
                    p.strategyRisk = 'پایین';
                } else if (p.tradeFrequency > 5 && p.volatility > 3) {
                    p.strategy = 'معامله‌گر فعال';
                    p.strategyRisk = 'بالا';
                } else {
                    p.strategy = 'فعال در سهم';
                    p.strategyRisk = 'متوسط';
                }
                
                // Risk score calculation (0-100, higher = riskier)
                p.riskScore = Math.min(100, Math.max(0, 
                    (p.volatility * 10) + 
                    (p.maxDrawdown / 2) + 
                    (p.tradeFrequency * 2) +
                    (p.beta > 1.5 ? 20 : 0) +
                    (p.valueAtRisk * 3)
                ));
                
                // Overall performance score (0-100)
                p.performanceScore = Math.min(100, Math.max(0,
                    (p.roi > 0 ? Math.min(p.roi / 2, 30) : Math.max(p.roi / 3, -20)) +
                    (p.sharpeRatio * 15) +
                    (p.winRate / 3) +
                    (p.buySuccessRate / 3) +
                    (100 - p.riskScore) / 5 +
                    20 // Base score
                ));

                // Update trade log with timing analysis
                p.tradeLog.forEach(trade => {
                    trade.pricePLPercent = trade.priceToman > 0 ? ((latestPriceToman - trade.priceToman) / trade.priceToman) * 100 : 0;
                });
                
                return p;
            })
            .sort((a, b) => b.performanceScore - a.performanceScore); // Sort by performance score

        return { 
            profiles: finalProfiles, 
            startDate: firstDay.date, 
            endDate: lastDay.date,
            marketStats: {
                totalReturn: ((lastDay.price - firstDay.price) / firstDay.price) * 100,
                volatility: marketReturns.length > 0 ? Math.sqrt(marketReturns.reduce((sum, r) => sum + r * r, 0) / marketReturns.length) : 0,
                maxDrawdown: MarketStatistics.calculateMaxDrawdown(analysisData.map((d, i) => (d.price / firstDay.price) * 100))
            }
        };
    }
    
    renderControlPanel() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const formatDateForInput = (date) => date.toISOString().split('T')[0];

        return `
            <style>
                #shareholder-control-panel { 
                    display: flex; gap: 1rem; align-items: center; justify-content: center; 
                    padding: 1.5rem; background: linear-gradient(135deg, var(--bg-main) 0%, var(--bg-widget) 100%); 
                    border-radius: var(--border-radius); margin-bottom: 2rem; flex-wrap: wrap; 
                    border: 1px solid var(--border-color); box-shadow: var(--shadow);
                }
                .date-input-group { 
                    display: flex; flex-direction: column; gap: 0.25rem; 
                }
                .date-input-group label { 
                    font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; 
                }
                .date-input-group input { 
                    padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; 
                    font-family: var(--font-family-persian); transition: border-color 0.2s;
                    background: var(--bg-widget);
                }
                .date-input-group input:focus {
                    outline: none; border-color: var(--primary-accent); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
                }
                #run-shareholder-analysis-btn { 
                    padding: 0.7rem 2rem; font-weight: 600; font-size: 0.95rem; 
                    background: linear-gradient(135deg, var(--primary-accent) 0%, #1e40af 100%); 
                    color: white; border: none; border-radius: 8px; cursor: pointer; 
                    transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                #run-shareholder-analysis-btn:hover { 
                    transform: translateY(-1px); box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.15);
                }
                .analysis-info {
                    font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;
                    text-align: center; font-style: italic;
                }
            </style>
            <div id="shareholder-control-panel">
                <div class="date-input-group">
                    <label for="shareholder-start-date">📅 تاریخ شروع</label>
                    <input type="date" id="shareholder-start-date" value="${formatDateForInput(thirtyDaysAgo)}">
                </div>
                <div class="date-input-group">
                    <label for="shareholder-end-date">📅 تاریخ پایان</label>
                    <input type="date" id="shareholder-end-date" value="${formatDateForInput(today)}">
                </div>
                <button id="run-shareholder-analysis-btn">🚀 اجرای تحلیل پیشرفته</button>
                <div class="analysis-info">
                    📊 تحلیل شامل ۱۵+ متریک آماری پیشرفته بورس می‌باشد
                </div>
            </div>
            <div id="shareholder-results-area"></div>
        `;
    }

    /**
     * 📊 **MARKET OVERVIEW DASHBOARD**
     * Renders market statistics and benchmark comparison
     */
    renderMarketOverview(marketStats) {
        return `
            <div class="market-overview">
                <div class="market-stat">
                    <div class="market-stat-label">📈 بازدهی کل بازار</div>
                    <div class="market-stat-value ${marketStats.totalReturn >= 0 ? 'positive' : 'negative'}">
                        ${marketStats.totalReturn.toFixed(1)}%
                    </div>
                </div>
                <div class="market-stat">
                    <div class="market-stat-label">📊 نوسان بازار</div>
                    <div class="market-stat-value">${marketStats.volatility.toFixed(1)}%</div>
                </div>
                <div class="market-stat">
                    <div class="market-stat-label">📉 حداکثر کاهش</div>
                    <div class="market-stat-value negative">${marketStats.maxDrawdown.toFixed(1)}%</div>
                </div>
            </div>
        `;
    }

    renderResults(analysis) {
        const resultsArea = document.getElementById('shareholder-results-area');
        if (!resultsArea) return;

        if (!analysis || !analysis.profiles || analysis.profiles.length === 0) {
            resultsArea.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-secondary);">در بازه زمانی انتخاب شده، فعالیتی که قابلیت تحلیل داشته باشد، یافت نشد.</p>`;
            return;
        }

        const { profiles, startDate, endDate, marketStats } = analysis;
        
        resultsArea.innerHTML = `
            <style>
                .analysis-period-title { 
                    text-align: center; color: var(--text-secondary); margin-bottom: 2rem; 
                    font-size: 1rem; font-weight: 600; background: var(--bg-main); 
                    padding: 1rem; border-radius: var(--border-radius); 
                    border: 1px solid var(--border-color); box-shadow: var(--shadow);
                }
                .market-overview {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
                    gap: 1rem; margin-bottom: 2rem; padding: 1rem; 
                    background: var(--bg-widget); border-radius: var(--border-radius); 
                    border: 1px solid var(--border-color);
                }
                .market-stat {
                    text-align: center; padding: 0.5rem;
                }
                .market-stat-label { 
                    font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem; 
                }
                .market-stat-value { 
                    font-size: 1.2rem; font-weight: 700; 
                }
                .scorecard-grid { 
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); 
                    gap: 1.5rem; 
                }
                .shareholder-card { 
                    background: var(--bg-widget); border-radius: var(--border-radius); 
                    box-shadow: var(--shadow); padding: 1.25rem; 
                    border-top: 4px solid var(--primary-accent); position: relative; 
                    display: flex; flex-direction: column; 
                    transition: transform 0.3s ease, box-shadow 0.3s ease; 
                }
                .shareholder-card:hover { 
                    transform: translateY(-3px); 
                    box-shadow: 0 12px 20px -3px rgba(0,0,0,0.12), 0 6px 8px -2px rgba(0,0,0,0.06); 
                }
                .shareholder-card.top-performer { 
                    border-color: #f39c12; background: linear-gradient(135deg, var(--bg-widget) 0%, rgba(243, 156, 18, 0.05) 100%); 
                }
                .shareholder-card.high-risk { 
                    border-color: #e74c3c; 
                }
                .shareholder-card.low-risk { 
                    border-color: #27ae60; 
                }
                .card-header { 
                    display: flex; justify-content: space-between; align-items: flex-start; 
                    margin-bottom: 1rem; padding: 0 0.5rem; 
                }
                .shareholder-name { 
                    font-size: 1.2rem; font-weight: 700; color: var(--text-primary); 
                    max-width: 60%; word-wrap: break-word;
                }
                .performance-badges {
                    display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end;
                }
                .top-badge { 
                    background: #f39c12; color: white; padding: 0.25rem 0.6rem; 
                    border-radius: 12px; font-size: 0.75rem; font-weight: 600; 
                }
                .risk-badge {
                    padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;
                }
                .risk-low { background: #27ae60; color: white; }
                .risk-medium { background: #f39c12; color: white; }
                .risk-high { background: #e74c3c; color: white; }
                .kpi-main { 
                    text-align: center; margin-bottom: 1.5rem; padding: 1.25rem; 
                    background: linear-gradient(135deg, var(--bg-main) 0%, rgba(59, 130, 246, 0.05) 100%); 
                    border-radius: 8px; border: 1px solid var(--border-color);
                }
                .kpi-main-label { 
                    font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; 
                }
                .kpi-main-value { 
                    font-size: 1.8rem; font-weight: 700; display: flex; 
                    align-items: center; justify-content: center; gap: 0.5rem;
                }
                .performance-score {
                    font-size: 0.9rem; padding: 0.25rem 0.8rem; border-radius: 20px;
                    font-weight: 600; margin-left: 0.5rem;
                }
                .score-excellent { background: #27ae60; color: white; }
                .score-good { background: #f39c12; color: white; }
                .score-fair { background: #3498db; color: white; }
                .score-poor { background: #e74c3c; color: white; }
                .kpi-grid {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;
                }
                .kpi-item {
                    text-align: center; padding: 0.75rem; background: var(--bg-main); 
                    border-radius: 6px; border: 1px solid var(--border-color);
                }
                .kpi-item-value {
                    font-size: 1.2rem; font-weight: 700; margin-bottom: 0.25rem;
                }
                .kpi-item-label {
                    font-size: 0.75rem; color: var(--text-secondary);
                }
                .details-section { 
                    padding: 0 0.5rem; margin-bottom: 1rem; 
                }
                .section-header { 
                    font-weight: 600; margin-bottom: 0.75rem; font-size: 1rem; 
                    color: var(--primary-accent); display: flex; align-items: center; gap: 0.5rem;
                }
                .detail-item { 
                    display: flex; justify-content: space-between; padding: 0.6rem 0; 
                    border-bottom: 1px solid #f0f0f0; font-size: 0.9rem;
                }
                .detail-label { 
                    color: var(--text-secondary); display: flex; align-items: center; gap: 0.25rem;
                }
                .detail-value { 
                    font-weight: 600; 
                }
                .metric-excellent { color: #27ae60; }
                .metric-good { color: #f39c12; }
                .metric-warning { color: #e67e22; }
                .metric-poor { color: #e74c3c; }
                .toggle-trades-btn { 
                    margin-top: auto; text-align: center; cursor: pointer; 
                    color: var(--primary-accent); font-weight: 500; padding: 1rem 0.5rem; 
                    transition: all 0.2s; border-radius: 6px;
                    background: var(--bg-main); border: 1px solid var(--border-color);
                }
                .toggle-trades-btn:hover { 
                    background: var(--primary-accent); color: white; transform: translateY(-1px);
                }
                .trades-details { 
                    display: none; margin-top: 1rem; max-height: 250px; overflow-y: auto; 
                    border-top: 1px solid var(--border-color); padding-top: 1rem; 
                    background: var(--bg-main); border-radius: 6px; padding: 1rem;
                }
                .tooltip-trigger { 
                    cursor: help; color: var(--text-secondary); border-bottom: 1px dotted var(--text-secondary); 
                }
                .stats-tabs {
                    display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color);
                }
                .stats-tab {
                    padding: 0.5rem 1rem; cursor: pointer; border-radius: 6px 6px 0 0;
                    font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
                    background: var(--bg-main); color: var(--text-secondary);
                }
                .stats-tab.active {
                    background: var(--primary-accent); color: white;
                }
                .stats-content {
                    display: none;
                }
                .stats-content.active {
                    display: block;
                }
                .risk-indicator {
                    width: 100%; height: 6px; border-radius: 3px; margin: 0.5rem 0;
                    background: linear-gradient(90deg, #27ae60 0%, #f39c12 50%, #e74c3c 100%);
                    position: relative;
                }
                .risk-pointer {
                    position: absolute; top: -2px; width: 10px; height: 10px;
                    background: white; border: 2px solid #333; border-radius: 50%;
                    transform: translateX(-50%);
                }
            </style>
            <div id="shareholder-control-panel">
                <div class="date-input-group">
                    <label for="shareholder-start-date">📅 تاریخ شروع</label>
                    <input type="date" id="shareholder-start-date" value="${formatDateForInput(thirtyDaysAgo)}">
                </div>
                <div class="date-input-group">
                    <label for="shareholder-end-date">📅 تاریخ پایان</label>
                    <input type="date" id="shareholder-end-date" value="${formatDateForInput(today)}">
                </div>
                <button id="run-shareholder-analysis-btn">🚀 اجرای تحلیل پیشرفته</button>
                <div class="analysis-info">
                    📊 تحلیل شامل ۱۵+ متریک آماری پیشرفته بورس می‌باشد
                </div>