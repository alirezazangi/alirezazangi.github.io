import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class PeakValleyTab extends BaseTab {
    constructor(stockId) {
        super('peak1', 'نمودار قله و دره', stockId);
    }

    getTemplate() {
        return `
            <div class="pv-controls">
                <input type="number" id="pv-data-count" value="200" min="20" max="1000" placeholder="تعداد روز">
                <input type="number" id="pv-levels-count" value="7" min="1" max="20" placeholder="تعداد سطوح">
                <button id="pv-update-btn">بروزرسانی</button>
            </div>
            <div class="pv-chart-container" style="position: relative; height: 70vh;">
                <canvas id="pv-chart"></canvas>
            </div>
        `;
    }

    async fetchData() {
        const dataCount = document.getElementById('pv-data-count')?.value || 200;
        try {
            const response = await apiService.getClosingPriceDailyList(this.stockId, dataCount);
            return response.closingPriceDaily || [];
        } catch (error) {
            console.error('Error fetching peak-valley data:', error);
            return [];
        }
    }

    calculateSupportResistanceLevels(data, numberOfLevels) {
        const prices = data.map(d => d.pClosing);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const binSize = (maxPrice - minPrice) / 100; // 100 bins for histogram
        const histogram = new Map();

        prices.forEach(price => {
            const bin = Math.floor((price - minPrice) / binSize);
            histogram.set(bin, (histogram.get(bin) || 0) + 1);
        });

        // Group nearby strong bins
        const sortedBins = Array.from(histogram.entries()).sort((a, b) => b[1] - a[1]);
        const levels = [];
        
        for (const [bin, strength] of sortedBins) {
            const price = minPrice + bin * binSize;
            // Check if this level is too close to an existing stronger level
            const isTooClose = levels.some(level => Math.abs(level.price - price) < (maxPrice - minPrice) * 0.02);
            if (!isTooClose) {
                levels.push({ price, strength });
            }
            if (levels.length >= numberOfLevels) break;
        }
        return levels;
    }

    drawChart(data) {
        const canvas = document.getElementById('pv-chart');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;

        const prices = data.map(d => d.pClosing);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const margin = { top: 20, right: 60, bottom: 40, left: 20 };
        const chartWidth = canvas.width - margin.left - margin.right;
        const chartHeight = canvas.height - margin.top - margin.bottom;

        const scaleX = (index) => margin.left + (index / (data.length - 1)) * chartWidth;
        const scaleY = (price) => margin.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw price line
        ctx.beginPath();
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        data.forEach((d, i) => ctx.lineTo(scaleX(i), scaleY(d.pClosing)));
        ctx.stroke();

        // Draw support/resistance levels
        const levelsCount = document.getElementById('pv-levels-count')?.value || 7;
        const levels = this.calculateSupportResistanceLevels(data, levelsCount);
        levels.forEach(level => {
            const y = scaleY(level.price);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 165, 0, ${0.3 + 0.7 * (level.strength / levels[0].strength)})`;
            ctx.setLineDash([5, 5]);
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + chartWidth, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#333';
            ctx.fillText(level.price.toLocaleString(), margin.left + chartWidth + 5, y + 3);
        });
    }

    async update() {
        const data = await this.fetchData();
        if (data.length > 0) {
            this.drawChart(data.reverse()); // Reverse to show oldest first
        }
    }

    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if(container) container.innerHTML = this.getTemplate();
        
        document.getElementById('pv-update-btn').addEventListener('click', () => this.update());
        await this.update();
    }
}