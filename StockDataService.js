// StockDataService.js`(فایل جدید) **
// ===== IMPORTS & DEPENDENCIES =====
import * as apiService from './apiService.js';

/**
 * 🚀 StockDataService - The Central Data Brain
 *
 * 📖 **MISSION:**
 * To create a unified, easy-to-use data source for any stock. This service fetches all
 * relevant historical and static data, processes it, and provides it in a simple,
 * "magic array" format.
 *
 * 🎯 **KEY FEATURES:**
 * 1.  **Single Source of Truth**: Fetches data from multiple endpoints (`InstrumentInfo`,
 *     `ClosingPriceDailyList`, `ClientTypeHistory`) and merges them into one coherent object.
 * 2.  **Smart Caching**: Fetches data only once per instance. Subsequent calls return the
 *     cached data instantly.
 * 3.  **"Magic Array" Structure**: For any historical metric (e.g., 'pClosing', 'buy_I_Volume'),
 *     it provides a simple array where index `[0]` is the latest data, `[1]` is from the
 *     previous day, and so on. This makes accessing historical data incredibly intuitive.
 *     Example: `data.pClosing[10]` gives the closing price from 10 trading days ago.
 * 4.  **Generic & Future-Proof**: It automatically discovers all keys from the API responses.
 *     If the API adds a new field, this service will automatically include it without any code changes.
 * 5.  **Data Alignment**: It correctly aligns data from different sources by date, ensuring
 *     that `data.pClosing[5]` and `data.buy_I_Volume[5]` correspond to the exact same trading day.
 */
export class StockDataService {
    constructor(stockId) {
        this.stockId = stockId;
        this.data = {}; // This will hold the final, structured data.
        this.isDataReady = false;
        this.dataPromise = null; // Prevents multiple fetches if `getData` is called concurrently.
    }

    /**
     * The main public method to get the stock data.
     * It ensures that the data is fetched only once.
     * @returns {Promise<object>} A promise that resolves with the unified data object.
     */
    async getData() {
        if (this.isDataReady) {
            return this.data;
        }
        if (this.dataPromise) {
            return this.dataPromise;
        }
        // Start the fetching process and store the promise.
        this.dataPromise = this._fetchAllData();
        return this.dataPromise;
    }

    /**
     * Fetches all required data from different API endpoints concurrently.
     * @private
     */
    async _fetchAllData() {
        try {
            const [info, priceHistory, clientHistory] = await Promise.all([
                apiService.getInstrumentInfo(this.stockId),
                apiService.getClosingPriceDailyList(this.stockId, 0), // 0 to fetch all available data
                apiService.getClientTypeHistory(this.stockId)
            ]);

            this._processAndStructureData({ info, priceHistory, clientHistory });
            
            this.isDataReady = true;
            console.log(`[StockDataService] Data ready for stock ${ this.stockId }`, this.data);
            return this.data;

        } catch (error) {
            console.error(`[StockDataService] Failed to fetch or process data for stock ${ this.stockId }: `, error);
            // In case of error, reset the promise to allow retries.
            this.dataPromise = null;
            throw error; // Re-throw the error so the caller can handle it.
        }
    }

    /**
     * The core logic to merge, align, and structure the data.
     * @private
     * @param {object} apiResponses - An object containing responses from all APIs.
     */
    _processAndStructureData({ info, priceHistory, clientHistory }) {
        // 1. Process static data (like company name, sector, etc.)
        if (info && info.instrumentInfo) {
            Object.assign(this.data, info.instrumentInfo);
        }

        // 2. Merge historical data sources (price and client type) by date
        const combinedHistoryMap = new Map();

        // Add price history to the map
        if (priceHistory && priceHistory.closingPriceDaily) {
            priceHistory.closingPriceDaily.forEach(day => {
                combinedHistoryMap.set(day.dEven, { ...day });
            });
        }

        // Merge client type history into the map
        if (clientHistory && clientHistory.clientType) {
            clientHistory.clientType.forEach(day => {
                const dateKey = day.recDate;
                if (combinedHistoryMap.has(dateKey)) {
                    // Merge properties into the existing day's data
                    Object.assign(combinedHistoryMap.get(dateKey), day);
                }
            });
        }
        
        // Convert map to an array and sort by date descending (newest first)
        const sortedHistory = Array.from(combinedHistoryMap.values()).sort((a, b) => (b.dEven || b.recDate) - (a.dEven || a.recDate));

        if (sortedHistory.length === 0) return;

        // 3. Discover all available historical keys automatically
        const allKeys = new Set();
        sortedHistory.forEach(day => {
            Object.keys(day).forEach(key => allKeys.add(key));
        });

        // 4. Create the "Magic Array" structure
        // Initialize an empty array for each historical key
        for (const key of allKeys) {
            this.data[key] = [];
        }

        // Populate the arrays
        for (const dayData of sortedHistory) {
            for (const key of allKeys) {
                // For each day, push its value for that key into the corresponding array.
                // If a key doesn't exist for a particular day, push `null` to maintain alignment.
                this.data[key].push(dayData[key] ?? null);
            }
        }
    }
}