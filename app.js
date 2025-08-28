// ===== IMPORTS & DEPENDENCIES =====
import { Dashboard } from './tsetmc-modular.js';
import { MainTab } from './MainTab.js';
import { HistoricalTradesTab } from './historical-trades-tab.js';
import { SaraneTab } from './sarane.js';
import { LastCandleTab } from './complete-chart-code.js';
import { CandlestickChartTab } from './CandlestickChartTab.js';
import { FilterTab } from './filter-tab(3).js';
import { OrdersTab } from './OrdersTab.js';
import { TradersTab } from './traders-tab.js';
import { TradersChartTab } from './traders-chart-tab.js';
// import { OrderBookChangesTab } from './order-book-changes-tab(1).js';
import { RealTimeTraderTab } from './complete-realtime-traders-tab.js';
import { MarketIndicatorsTab } from './market-indicators-tab.js';
// import { TradeHistoryTab_TSETMC_IR } from './trade-history-tab(1).js';
import { PeakValleyTab } from './peak-valley-tab.js';
import { ShareholdersTab } from './shareholders-tab.js';
// import { StatisticalAnalysisTab } from './statistical-analysis-tab.js';
// import { AdvancedAnalyticsTab } from './advanced-analytics-tab.js';
// import { QuantitativeFinanceTab } from './quantitative-finance-tab.js';
// 🚀 1. Import the new DataExplorerTab
import { DataExplorerTab } from './DataExplorerTab.js';
import { DataDownloaderTab } from './data-downloader-tab.js'; // 💡 IMPORT THE NEW TAB


// ===== INITIALIZATION & STARTUP =====

/**
 * Main application entry point.
 * Initializes the dashboard and registers all available tabs with improved organization.
 */
function main() {
    const stockId = localStorage.getItem('selectedStockId') || '7745894403636165';
    const dashboard = new Dashboard(stockId);

    // === دسته‌بندی تب‌ها به گروه‌های مختلف ===

    // گروه اصلی - داده‌های پایه
    dashboard.registerTab(new MainTab(stockId));
    dashboard.registerTab(new SaraneTab(stockId));

    // گروه نمودارها و تحلیل تکنیکال  
    dashboard.registerTabGroup('📈 نمودارها و تحلیل تکنیکال', [
        new LastCandleTab(stockId),
        new CandlestickChartTab(stockId),
        new TradersChartTab(stockId),
        new PeakValleyTab(stockId)
    ]);

    // گروه تحلیل‌های آماری و ریاضی
    dashboard.registerTabGroup('🧮 تحلیل‌های آماری و کمّی', [
        // new StatisticalAnalysisTab(stockId),
        // new AdvancedAnalyticsTab(stockId),
        // new QuantitativeFinanceTab(stockId)
        new DataDownloaderTab(stockId)
    ]);

    // گروه تحلیل بازار و شاخص‌ها
    dashboard.registerTabGroup('📊 تحلیل بازار و شاخص‌ها', [
        new MarketIndicatorsTab(stockId),
        new FilterTab(stockId)
    ]);

    // گروه معاملات و سفارش‌ها
    dashboard.registerTabGroup('💹 تحلیل معاملات', [
        new OrdersTab(stockId),
        // new OrderBookChangesTab(stockId),
        new HistoricalTradesTab(stockId),
        // new TradeHistoryTab_TSETMC_IR(stockId)
    ]);

    // گروه تحلیل معاملگران
    dashboard.registerTabGroup('👥 تحلیل معاملگران', [
        new RealTimeTraderTab(stockId),
        new TradersTab(stockId),
        new ShareholdersTab(stockId)
    ]);

    // 🚀 2. Add a new group for tools and register the new tab
    dashboard.registerTabGroup('🛠️ ابزارها و خدمات', [
        new DataExplorerTab(stockId)
    ]);

    // Initialize the dashboard UI and logic
    dashboard.init();
}

// Start the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', main);
