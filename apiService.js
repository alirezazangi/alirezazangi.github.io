// ===== IMPORTS & DEPENDENCIES =====
import { isMarketHours } from './utils.js';

// ===== CONFIGURATION & CONSTANTS =====
const API_BASE_URL = 'https://cdn.tsetmc.com/api';
const CACHE = new Map();

/**
 * 📖 **EXPLANATION OF DYNAMIC CACHING:**
 * These constants define our new "smart caching" strategy.
 * - `REALTIME_CACHE_DURATION`: A very short cache (10 seconds) for data that changes constantly during market hours.
 * - `STATIC_CACHE_DURATION`: A long cache (1 hour) for data that rarely changes (like instrument info or historical data).
 * - `DEFAULT_OUT_OF_HOURS_CACHE`: A medium cache (5 minutes) for volatile data when the market is closed.
 * This approach ensures the app is highly responsive when it needs to be, and efficient otherwise.
 */
const REALTIME_CACHE_DURATION = 10 * 1000;      // 10 seconds for real-time data
const STATIC_CACHE_DURATION = 60 * 60 * 1000;   // 1 hour for static data
const DEFAULT_OUT_OF_HOURS_CACHE = 5 * 60 * 1000; // 5 minutes for default caching outside market hours

// ===== CORE LOGIC (Resilient Fetch) =====
// The core fetchWithCache function remains resilient as per the last fix.
// It will not throw errors and will return stale data or null on failure.
async function fetchWithCache(url, duration) {
    const now = Date.now();
    const cacheEntry = CACHE.get(url);

    // Use dynamic duration passed by the calling function
    if (cacheEntry && now - cacheEntry.timestamp < duration) {
        return cacheEntry.data;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        CACHE.set(url, { data, timestamp: now });
        return data;
    } catch (error) {
        console.error(`API fetch failed for ${url}. Error:`, error.message);
        if (cacheEntry) {
            console.warn(`[CACHE] Returning STALE data for ${url}.`);
            return cacheEntry.data;
        }
        return null;
    }
}

// ===== API ENDPOINTS (with Smart Caching) =====

/**
 * 💡 **HOW SMART CACHING IS APPLIED:**
 * Each function now checks `isMarketHours()` and selects an appropriate cache duration.
 * - **Real-time endpoints** (like getClosingPriceDaily, getClientType, getBestLimits) use a 10-second cache during market hours.
 * - **Static/Historical endpoints** (like getInstrumentInfo, getClientTypeHistory) use a long, 1-hour cache regardless of the time.
 */

// --- Real-time Sensitive Data ---
export const getClosingPriceDaily = (stockId) => fetchWithCache(`${API_BASE_URL}/ClosingPrice/GetClosingPriceDaily/${stockId}/0`, isMarketHours() ? REALTIME_CACHE_DURATION : DEFAULT_OUT_OF_HOURS_CACHE);
export const getClientType = (stockId) => fetchWithCache(`${API_BASE_URL}/ClientType/GetClientType/${stockId}/1/0`, isMarketHours() ? REALTIME_CACHE_DURATION : DEFAULT_OUT_OF_HOURS_CACHE);
export const getBestLimits = (stockId) => fetchWithCache(`${API_BASE_URL}/BestLimits/${stockId}`, isMarketHours() ? REALTIME_CACHE_DURATION : DEFAULT_OUT_OF_HOURS_CACHE);
export const getTradeHistory = (stockId) => fetchWithCache(`${API_BASE_URL}/Trade/GetTrade/${stockId}`, isMarketHours() ? REALTIME_CACHE_DURATION : DEFAULT_OUT_OF_HOURS_CACHE);
export const getBestLimitsHistory = (stockId, date) => fetchWithCache(`${API_BASE_URL}/BestLimits/${stockId}/${date}`, isMarketHours() ? REALTIME_CACHE_DURATION : DEFAULT_OUT_OF_HOURS_CACHE);
export const getStaticThreshold = (stockId, date) => fetchWithCache(`${API_BASE_URL}/MarketData/GetStaticThreshold/${stockId}/${date}`, isMarketHours() ? REALTIME_CACHE_DURATION : STATIC_CACHE_DURATION);

// --- Static or Historical Data (Long Cache) ---
export const getInstrumentInfo = (stockId) => fetchWithCache(`${API_BASE_URL}/Instrument/GetInstrumentInfo/${stockId}`, STATIC_CACHE_DURATION);
export const getInstrumentSearch = (query) => fetchWithCache(`https://cdn.tsetmc.com/api/Instrument/GetInstrumentSearch/${encodeURIComponent(query)}`, STATIC_CACHE_DURATION);
export const getClosingPriceDailyList = (stockId, count = 200) => fetchWithCache(`${API_BASE_URL}/ClosingPrice/GetClosingPriceDailyList/${stockId}/${count}`, STATIC_CACHE_DURATION);
export const getClientTypeHistory = (stockId) => fetchWithCache(`${API_BASE_URL}/ClientType/GetClientTypeHistory/${stockId}`, STATIC_CACHE_DURATION);
export const getShareholders = (stockId, date) => fetchWithCache(`${API_BASE_URL}/Shareholder/${stockId}/${date}`, STATIC_CACHE_DURATION);
export const getCodalMajma = (stockId) => fetchWithCache(`${API_BASE_URL}/Codal/GetPreparedDataByInsCode/5/${stockId}`, STATIC_CACHE_DURATION);

// --- External APIs ---
export const fetchSaraneData = async (stockId) => {
    const url = `https://api5.tablokhani.com/Process/singleOnline/${stockId}?v=1m0Ip&id=1`;
    try {
        // This external API is real-time by nature, so we don't cache it aggressively here.
        // It's called by tabs that have their own update intervals.
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Failed to fetch Sarane data for stock ${stockId}:`, error.message);
        return "";
    }
};