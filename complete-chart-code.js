// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import { formatDate, formatNumberWithUnit } from './utils.js';

// ===== THEME & STYLE CONSTANTS =====
const THEMES = {dark:{CHART_BG:'#131722',AXIS_BG:'#131722',GRID_COLOR:'rgba(255,255,255,0.06)',AXIS_TEXT_COLOR:'#B2B5BE',CROSSHAIR_COLOR:'rgba(255,255,255,0.4)',CANDLE_GREEN:'#26A69A',CANDLE_RED:'#EF5350',POSITIVE_COLOR:'#26A69A',NEGATIVE_COLOR:'#EF5350',THRESHOLD_FRAME_COLOR:'rgba(255,255,255,0.4)',ZERO_LINE_COLOR:'rgba(255,255,255,0.8)',GAP_RECT_BROWN_COLOR:'rgba(139,69,19,0.7)',GAP_RECT_GOLD_COLOR:'rgba(218,165,32,0.7)',INDICATOR_PANE_BG:'rgba(255,255,255,0.03)',LEGEND_TEXT_COLOR:'#B2B5BE'},light:{CHART_BG:'#FFFFFF',AXIS_BG:'#FFFFFF',GRID_COLOR:'rgba(0,0,0,0.06)',AXIS_TEXT_COLOR:'#333333',CROSSHAIR_COLOR:'rgba(0,0,0,0.4)',CANDLE_GREEN:'#26A69A',CANDLE_RED:'#EF5350',POSITIVE_COLOR:'#26A69A',NEGATIVE_COLOR:'#EF5350',THRESHOLD_FRAME_COLOR:'rgba(0,0,0,0.4)',ZERO_LINE_COLOR:'rgba(0,0,0,0.8)',GAP_RECT_BROWN_COLOR:'rgba(139,69,19,0.7)',GAP_RECT_GOLD_COLOR:'rgba(218,165,32,0.7)',INDICATOR_PANE_BG:'rgba(0,0,0,0.02)',LEGEND_TEXT_COLOR:'#333333'}};
const Y_AXIS_WIDTH=95,X_AXIS_HEIGHT=40,CANDLE_SPACING=5,MIN_CANDLE_WIDTH=2,MAX_CANDLE_WIDTH=150,INITIAL_CANDLE_WIDTH=10;
const ZOOM_SENSITIVITY = 1.05, INITIAL_CANDLE_COUNT = 300, SCROLL_FETCH_THRESHOLD = 30, RIGHT_SIDE_PADDING_CANDLES = 5;
const Y_AXIS_DRAG_SENSITIVITY = 0.005;

// ===== INDICATOR ARCHITECTURE =====
class BaseIndicator {
    constructor(id, name, options = {}) { this.id = id; this.name = name; this.options = options; this.data = []; }
    calculate(allCandleData) { throw new Error("Calculate method must be implemented"); }
    draw(ctx, visibleData, chartDimensions, yAxisConfig, theme) { throw new Error("Draw method must be implemented"); }
    drawLegend(ctx, crosshairData, chartDimensions, theme) { throw new Error("DrawLegend method must be implemented"); }
    getPaneHeight(totalHeight) { return 0; }
    getSettingsModal(container, currentOptions) { return null; }
}

class VolumeIndicator extends BaseIndicator {
    constructor(id, options = { maPeriod: 20, maColor: '#FF6D00' }) { super(id, 'Volume', options); }
    getPaneHeight(totalHeight) { return totalHeight * 0.25; }

    calculate(allCandleData) {
        const maPeriod = this.options.maPeriod;
        this.data = allCandleData.map((d, i, arr) => {
            const vol = d.vol;
            let ma = null;
            if (i >= maPeriod - 1) {
                const sum = arr.slice(i - maPeriod + 1, i + 1).reduce((acc, curr) => acc + curr.vol, 0);
                ma = sum / maPeriod;
            }
            return { ...d, vol, vol_ma: ma };
        });
        return this.data;
    }

    draw(ctx, visibleData, { w, h, top }, yConf, theme) {
        const maxY = Math.max(...visibleData.map(d => d.vol)) * 1.2;
        const volToY = (val) => h - (val / maxY * h);
        ctx.fillStyle=theme.INDICATOR_PANE_BG;ctx.fillRect(0,top,w,h);ctx.strokeStyle=theme.GRID_COLOR;ctx.strokeRect(0,top,w,h);
        const volMaLine = [];
        visibleData.forEach((d, i) => {
            const x = (i * (yConf.candleWidth + CANDLE_SPACING)) + (yConf.candleWidth / 2);
            const barY = volToY(d.vol);
            ctx.fillStyle=d.color;ctx.globalAlpha=0.5;ctx.fillRect(x-yConf.candleWidth/2,top+barY,yConf.candleWidth,h-barY);ctx.globalAlpha=1.0;
            if (d.vol_ma) volMaLine.push({ x, y: top + volToY(d.vol_ma) });
        });
        if(volMaLine.length > 1){ctx.beginPath();ctx.moveTo(volMaLine[0].x,volMaLine[0].y);volMaLine.forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle=this.options.maColor;ctx.lineWidth=1.5;ctx.stroke();}
        ctx.fillStyle=theme.AXIS_TEXT_COLOR;ctx.fillText(formatNumberWithUnit(maxY),w+5,top+12);ctx.fillText(formatNumberWithUnit(maxY/2),w+5,top+h/2);
    }
    
    drawLegend(ctx, crosshairData, { top }, theme) {
        if (!crosshairData) return;
        ctx.font = '12px Arial';
        ctx.fillStyle = theme.LEGEND_TEXT_COLOR;
        const volText = `Volume: ${formatNumberWithUnit(crosshairData.vol)}`;
        const maText = crosshairData.vol_ma ? ` MA(${this.options.maPeriod}): ${formatNumberWithUnit(crosshairData.vol_ma)}` : '';
        ctx.fillText(`${volText}${maText}`, 10, top + 15);
    }

    getSettingsModal(container, currentOptions, onApply) {
        container.innerHTML = `
            <h4>Settings: Volume</h4>
            <div class="setting-item">
                <label for="vol-ma-period">MA Period:</label>
                <input type="number" id="vol-ma-period" value="${currentOptions.maPeriod}">
            </div>
            <button id="apply-settings">Apply</button>
        `;
        container.querySelector('#apply-settings').onclick = () => {
            const newPeriod = parseInt(container.querySelector('#vol-ma-period').value, 10);
            if (!isNaN(newPeriod) && newPeriod > 0) {
                onApply({ ...currentOptions, maPeriod: newPeriod });
            }
        };
    }
}

// Paste this code right after the VolumeIndicator class definition

class RSIIndicator extends BaseIndicator {
    constructor(id, options = { period: 14, overbought: 70, oversold: 30, color: '#2962FF' }) {
        super(id, 'RSI', options);
    }

    getPaneHeight(totalHeight) {
        return totalHeight * 0.25; // 25% of the total height for the RSI pane
    }

    calculate(allCandleData) {
        const period = this.options.period;
        const data = [];
        let gains = [];
        let losses = [];
        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 0; i < allCandleData.length; i++) {
            const candle = allCandleData[i];
            const prevCandle = i > 0 ? allCandleData[i - 1] : null;
            let rsi = null;

            if (prevCandle) {
                const change = candle.close - prevCandle.close;
                gains.push(change > 0 ? change : 0);
                losses.push(change < 0 ? -change : 0);

                if (i >= period) {
                    if (i === period) { // First calculation
                        avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
                        avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
                    } else { // Subsequent calculations use smoothing
                        avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
                        avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
                    }

                    if (avgLoss !== 0) {
                        const rs = avgGain / avgLoss;
                        rsi = 100 - (100 / (1 + rs));
                    } else {
                        rsi = 100;
                    }
                }
            }
            data.push({ ...candle, rsi });
        }
        this.data = data;
        return this.data;
    }

    draw(ctx, visibleData, { w, h, top }, yConf, theme) {
        const yRange = { min: 0, max: 100 };
        const valToY = (val) => top + (h - (val / 100 * h));

        // Draw pane background and border
        ctx.fillStyle = theme.INDICATOR_PANE_BG;
        ctx.fillRect(0, top, w, h);
        ctx.strokeStyle = theme.GRID_COLOR;
        ctx.strokeRect(0, top, w, h);

        // Draw Overbought and Oversold zones/lines
        const yOverbought = valToY(this.options.overbought);
        const yOversold = valToY(this.options.oversold);
        ctx.fillStyle = 'rgba(239, 83, 80, 0.1)'; // Light red for overbought zone
        ctx.fillRect(0, top, w, yOverbought - top);
        ctx.fillStyle = 'rgba(38, 166, 154, 0.1)'; // Light green for oversold zone
        ctx.fillRect(0, yOversold, w, h - (yOversold - top));

        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = theme.CROSSHAIR_COLOR;
        ctx.beginPath();
        ctx.moveTo(0, yOverbought); ctx.lineTo(w, yOverbought);
        ctx.moveTo(0, yOversold); ctx.lineTo(w, yOversold);
        ctx.stroke();
        ctx.setLineDash([]);


        // Draw RSI line
        const rsiLine = [];
        visibleData.forEach((d, i) => {
            if (d.rsi !== null) {
                const x = (i * (yConf.candleWidth + CANDLE_SPACING)) + (yConf.candleWidth / 2);
                rsiLine.push({ x, y: valToY(d.rsi) });
            }
        });

        if (rsiLine.length > 1) {
            ctx.beginPath();
            ctx.moveTo(rsiLine[0].x, rsiLine[0].y);
            rsiLine.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = this.options.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Draw Y-Axis labels for RSI (0, 30, 70, 100)
        ctx.fillStyle = theme.AXIS_TEXT_COLOR;
        ctx.fillText('100', w + 5, top + 12);
        ctx.fillText(this.options.overbought, w + 5, yOverbought + 4);
        ctx.fillText(this.options.oversold, w + 5, yOversold + 4);
        ctx.fillText('0', w + 5, top + h - 5);
    }

    drawLegend(ctx, crosshairData, { top }, theme) {
        if (!crosshairData || crosshairData.rsi === null) return;
        ctx.font = '12px Arial';
        ctx.fillStyle = theme.LEGEND_TEXT_COLOR;
        const rsiText = `RSI(${this.options.period}): `;
        const valueText = crosshairData.rsi.toFixed(2);

        ctx.fillText(rsiText, 10, top + 15);
        ctx.fillStyle = this.options.color;
        ctx.fillText(valueText, 10 + ctx.measureText(rsiText).width, top + 15);
    }
}

export class LastCandleTab extends BaseTab {
    constructor(stockId) {
        super('candl1', 'نمودار قیمت (پلتفرم)', stockId);
        this.theme='light'; this.allCandlesData=[]; this.viewStartIndex=0; this.candleWidth=INITIAL_CANDLE_WIDTH;
        this.yAxisConfig={min:0,max:0,range:0,isAuto:true}; this.chartMode='crosshair';
        this.indicatorManager = { active: new Map(), available: { 'Volume': VolumeIndicator, 'RSI': RSIIndicator }, nextId: 0 };
        this.isPanning=false;this.isYAxisPanning=false;this.isXAxisPanning=false;this.isLoadingMore=false;
        this.panStartY=0;this.panStartX=0;this.panStartViewIndex=0;this.panStartYAxisConfig={};this.panStartCandleWidth=0;
        this.crosshairPos=null;this.tooltipData=null;this.yAxisBaselinePrice=0;
        this.contentEl=null;this.canvas=null;this.ctx=null;this.resizeObserver=null;
    }

    getTemplate(){return`<div id="chart-wrapper-${this.name}" class="tv-chart-wrapper"><canvas id="candleChart-${this.name}"></canvas><div id="chart-tooltip-${this.name}" class="chart-tooltip"></div><div id="indicator-menu-${this.name}" class="indicator-menu"></div><div id="settings-modal-${this.name}" class="settings-modal"></div><div class="chart-controls"><button data-action="pan" title="حرکت دادن نمودار">🖐️</button><button data-action="crosshair" title="نشانگر" class="active">➕</button><button data-action="indicators" title="اندیکاتورها">fx</button><button data-action="zoom-in" title="بزرگنمایی">+</button><button data-action="zoom-out" title="کوچک‌نمایی">-</button><button data-action="auto" title="نمای خودکار">Auto</button><button data-action="toggle-theme" title="تغییر تم">🎨</button></div></div>`;}
    async getChartData(t=0){const e=`chart_data_${this.stockId}`,i=Date.now(),s=JSON.parse(localStorage.getItem(e)||"{}");if(s.timestamp&&i-s.timestamp<864e5&&0===t)return void(this.allCandlesData=s.data);const a=300,[o]=await Promise.all([apiService.getClosingPriceDailyList(this.stockId,a,t)]);if(!o?.closingPriceDaily?.length)return[];this.mergeLastCandle(o.closingPriceDaily,(await apiService.getClosingPriceDaily(this.stockId))?.closingPriceDaily);const n=await this.fetchAllHistoricalThresholds(o.closingPriceDaily),l=o.closingPriceDaily.map(t=>{if(!t.priceYesterday||0===t.priceYesterday||0===t.pClosing||0===t.priceMax)return null;const e=this.getStaticThresholdForDate(n,null,t.dEven);return e&&0!==e.psGelStaMax?{open:t.priceFirst,close:t.pClosing,high:t.priceMax,low:t.priceMin,vol:t.qTotTran5J,max:e.psGelStaMax,min:e.psGelStaMin,color:t.pClosing>=t.priceFirst?THEMES.dark.CANDLE_GREEN:THEMES.dark.CANDLE_RED,finalPrice:t.pDrCotVal,date:formatDate(t.dEven),priceYesterday:t.priceYesterday}:null}).filter(Boolean).reverse();return 0===t&&(this.allCandlesData=l,localStorage.setItem(e,JSON.stringify({timestamp:i,data:this.allCandlesData}))),l}
    async initialDataLoad(){await this.getChartData(0);if(!this.allCandlesData.length)throw new Error("No valid candle data could be loaded.")}
    mergeLastCandle(h,l){if(l&&(l.pClosing!==h[0].pClosing||l.pDrCotVal!==h[0].pDrCotVal)){if(l.dEven===h[0].dEven)h[0]=l;else h.unshift(l);}}
    async fetchAllHistoricalThresholds(h){const d=[...new Set(h.map(i=>i.dEven.toString()))];const r=await Promise.all(d.map(dt=>apiService.getStaticThreshold(this.stockId,dt)));return r.map((res,i)=>res?.staticThreshold?.length?res.staticThreshold.map(th=>({...th,date:d[i]})):null).filter(Boolean).flat().sort((a,b)=>b.dEven-a.bEven);}
    getStaticThresholdForDate(h,i,d){if(i?.dEven===d&&i?.staticThreshold)return i.staticThreshold;const e=h.find(th=>th.dEven<=d);return e?{psGelStaMax:e.psGelStaMax,psGelStaMin:e.psGelStaMin}:null;}

    renderChart() {
        if (!this.ctx || !this.allCandlesData.length) return;
        
        let totalIndicatorHeight = 0;
        this.indicatorManager.active.forEach(indicator => { totalIndicatorHeight += indicator.getPaneHeight(this.canvas.height); });
        
        const priceChartHeight = this.canvas.height - totalIndicatorHeight - X_AXIS_HEIGHT;
        const chartWidth = this.canvas.width - Y_AXIS_WIDTH;
        
        const availableWidthForCandles=chartWidth-(RIGHT_SIDE_PADDING_CANDLES*(this.candleWidth+CANDLE_SPACING));
        const numVisibleCandles = Math.floor(availableWidthForCandles / (this.candleWidth + CANDLE_SPACING));
        this.viewStartIndex = Math.max(0, Math.min(this.viewStartIndex, this.allCandlesData.length - numVisibleCandles));
        const visibleCandles = this.allCandlesData.slice(this.viewStartIndex, this.viewStartIndex + numVisibleCandles);

        if (visibleCandles.length === 0) return;
        
        if (this.yAxisConfig.isAuto){const t=Math.min(...visibleCandles.map(c=>c.low)),e=Math.max(...visibleCandles.map(c=>c.high)),i=(e-t)*.1;this.yAxisConfig.min=t-i,this.yAxisConfig.max=e+i,this.yAxisConfig.range=this.yAxisConfig.max-this.yAxisConfig.min}

        const theme = THEMES[this.theme];
        this.ctx.fillStyle = theme.CHART_BG;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid(chartWidth, priceChartHeight, theme);
        this.drawAxes(chartWidth, priceChartHeight, visibleCandles, theme);
        this.drawAllCandleFeatures(visibleCandles, chartWidth, priceChartHeight, theme, {candleWidth: this.candleWidth});
        this.drawCurrentPriceLine(visibleCandles.at(-1), chartWidth, priceChartHeight, theme);
        
        let currentTop = priceChartHeight;
        this.indicatorManager.active.forEach(indicator => {
            const paneHeight = indicator.getPaneHeight(this.canvas.height);
            const indicatorData = indicator.data.slice(this.viewStartIndex, this.viewStartIndex + numVisibleCandles);
            indicator.draw(this.ctx, indicatorData, { w: chartWidth, h: paneHeight, top: currentTop, yAxisWidth: Y_AXIS_WIDTH }, {candleWidth: this.candleWidth}, theme);
            const crosshairIndicatorData = indicator.data[this.viewStartIndex + Math.floor(this.crosshairPos?.x / (this.candleWidth + CANDLE_SPACING))];
            if (crosshairIndicatorData) indicator.drawLegend(this.ctx, crosshairIndicatorData, { top: currentTop + 5, indicator }, theme, () => this.removeIndicator(indicator.id), () => this.openIndicatorSettings(indicator.id));
            currentTop += paneHeight;
        });

        if(this.crosshairPos&&this.chartMode==='crosshair') this.drawCrosshair(chartWidth,priceChartHeight,theme);
        if(this.tooltipData&&this.chartMode==='crosshair') this.updateTooltip(theme);
    }
    
    priceToY(p,h){return h-((p-this.yAxisConfig.min)/this.yAxisConfig.range*h);}
    yToPrice(y,h){return((h-y)/h*this.yAxisConfig.range)+this.yAxisConfig.min;}
    indexToX(i){return(i*(this.candleWidth+CANDLE_SPACING))+(this.candleWidth/2);}
    drawGrid(w,h,t){this.ctx.strokeStyle=t.GRID_COLOR;this.ctx.lineWidth=1;const p=this.yAxisConfig.range/8;for(let i=1;i<=8;i++){const s=this.priceToY(this.yAxisConfig.min+i*p,h);this.ctx.beginPath();this.ctx.moveTo(0,s);this.ctx.lineTo(w,s);this.ctx.stroke()}const e=Math.floor(w/6/(this.candleWidth+CANDLE_SPACING));for(let r=e;r<w;r+=e){const a=this.indexToX(r);if(a>w)break;this.ctx.beginPath();this.ctx.moveTo(a,0);this.ctx.lineTo(a,this.canvas.height-X_AXIS_HEIGHT);this.ctx.stroke()}}
    drawAxes(w,h,vc,t){this.ctx.fillStyle=t.AXIS_BG;this.ctx.fillRect(w,0,Y_AXIS_WIDTH,this.canvas.height);this.ctx.fillRect(0,h,w,X_AXIS_HEIGHT);this.ctx.font="12px Arial";const b=this.yAxisBaselinePrice||vc.at(-1)?.priceYesterday||0;const p=this.yAxisConfig.range/8;for(let i=0;i<=8;i++){const s=this.yAxisConfig.min+i*p;const e=this.priceToY(s,h);const a=b>0?(s-b)/b*100:0;this.ctx.fillStyle=t.AXIS_TEXT_COLOR;this.ctx.fillText(s.toLocaleString(void 0,{minimumFractionDigits:0}),w+10,e+4);this.ctx.fillStyle=a>=0?t.POSITIVE_COLOR:t.NEGATIVE_COLOR;this.ctx.fillText(`(${a.toFixed(2)}%)`,w+10,e+18)}this.ctx.fillStyle=t.AXIS_TEXT_COLOR;const c=Math.floor(vc.length/6);for(let r=0;r<vc.length;r+=Math.max(1,c)){const o=this.indexToX(r);this.ctx.fillText(vc[r].date,o-25,h+25)}}
    drawAllCandleFeatures(c,w,h,t,yConf){c.forEach((d,i)=>{const x=this.indexToX(i);const fT=this.priceToY(d.max,h),fB=this.priceToY(d.min,h);this.ctx.strokeStyle=t.THRESHOLD_FRAME_COLOR;this.ctx.lineWidth=1.5;this.ctx.strokeRect(x-yConf.candleWidth/2-1,fT,yConf.candleWidth+2,fB-fT);const zL=this.priceToY(d.priceYesterday,h);this.ctx.lineWidth=2;this.ctx.strokeStyle=t.ZERO_LINE_COLOR;this.ctx.beginPath();this.ctx.moveTo(x-yConf.candleWidth/2,zL);this.ctx.lineTo(x+yConf.candleWidth/2,zL);this.ctx.stroke();const bY=this.priceToY(d.open,h),cY=this.priceToY(d.close,h),fP=this.priceToY(d.finalPrice,h),hP=this.priceToY(d.high,h),lP=this.priceToY(d.low,h);const bBY=Math.max(bY,cY),bTY=Math.min(bY,cY);if(d.finalPrice<Math.min(d.open,d.close)){this.ctx.fillStyle=t.GAP_RECT_BROWN_COLOR;this.ctx.fillRect(x-yConf.candleWidth/2,bBY,yConf.candleWidth,fP-bBY);}if(d.finalPrice>Math.max(d.open,d.close)){this.ctx.fillStyle=t.GAP_RECT_GOLD_COLOR;this.ctx.fillRect(x-yConf.candleWidth/2,fP,yConf.candleWidth,bTY-fP);}this.ctx.strokeStyle=d.color;this.ctx.lineWidth=1.5;this.ctx.beginPath();this.ctx.moveTo(x,hP);this.ctx.lineTo(x,lP);this.ctx.stroke();this.ctx.fillStyle=d.color;this.ctx.fillRect(x-yConf.candleWidth/2,bY,yConf.candleWidth,cY-bY);});}
    drawCurrentPriceLine(lc,w,h,t){if(!lc)return;const y=this.priceToY(lc.close,h);this.ctx.setLineDash([3,5]);this.ctx.strokeStyle=lc.color;this.ctx.beginPath();this.ctx.moveTo(0,y);this.ctx.lineTo(w+10,y);this.ctx.stroke();this.ctx.setLineDash([]);this.ctx.fillStyle=lc.color;this.ctx.fillRect(w+10,y-10,Y_AXIS_WIDTH-10,20);this.ctx.fillStyle=t.CHART_BG==='#FFFFFF'?'#FFFFFF':t.AXIS_TEXT_COLOR;this.ctx.fillText(lc.close.toLocaleString(),w+15,y+4);}
    drawCrosshair(w,h,t){const{x,y}=this.crosshairPos;if(x>w)return;this.ctx.strokeStyle=t.CROSSHAIR_COLOR;this.ctx.lineWidth=1;this.ctx.setLineDash([5,5]);this.ctx.beginPath();this.ctx.moveTo(x,0);this.ctx.lineTo(x,this.canvas.height-X_AXIS_HEIGHT);this.ctx.stroke();if(y<h){this.ctx.beginPath();this.ctx.moveTo(0,y);this.ctx.lineTo(w,y);this.ctx.stroke()}this.ctx.setLineDash([]);const p=this.yToPrice(y,h);const pY=y-10<0?0:y+10>h?h-20:y-10;this.ctx.fillStyle=t.AXIS_TEXT_COLOR;this.ctx.fillRect(w,pY,Y_AXIS_WIDTH,20);this.ctx.fillStyle=t.CHART_BG;this.ctx.textAlign='center';this.ctx.fillText(p.toLocaleString(),w+Y_AXIS_WIDTH/2,pY+14);const ci=this.viewStartIndex+Math.floor(x/(this.candleWidth+CANDLE_SPACING));const c=this.allCandlesData[ci];if(c){const tw=this.ctx.measureText(c.date).width+10;const dX=x-tw/2;const dLX=dX+tw>w?w-tw:dX<0?0:dX;this.ctx.fillStyle=t.AXIS_TEXT_COLOR;this.ctx.fillRect(dLX,h,tw,20);this.ctx.fillStyle=t.CHART_BG;this.ctx.textAlign='center';this.ctx.fillText(c.date,dLX+tw/2,h+15)}this.ctx.textAlign='start';}

    setupAllEventListeners(){const t=this.contentEl.querySelector(".chart-controls"),e=this.contentEl.querySelector(".indicator-menu");this.canvas.onmousedown=this.handleMouseDown.bind(this),this.canvas.onmouseup=this.handleMouseUp.bind(this),this.canvas.onmouseleave=()=>{this.isPanning=this.isYAxisPanning=this.isXAxisPanning=!1,this.crosshairPos=null,this.tooltipData=null,this.renderChart()},this.canvas.onwheel=this.handleWheel.bind(this),this.canvas.onmousemove=this.handleMouseMove.bind(this),t.addEventListener("click",i=>{const s=i.target.dataset.action,a=t.querySelector(`[data-action="${s}"]`);if("pan"===s)this.setChartMode("pan"),a.classList.add("active"),t.querySelector('[data-action="crosshair"]').classList.remove("active");else if("crosshair"===s)this.setChartMode("crosshair"),a.classList.add("active"),t.querySelector('[data-action="pan"]').classList.remove("active");else if("indicators"===s)e.style.display="block"===e.style.display?"none":"block";else"zoom-in"===s?this.zoom(1.2):"zoom-out"===s?this.zoom(1/1.2):"auto"===s?this.autoFit():"toggle-theme"===s&&this.toggleTheme()});this.buildIndicatorMenu(e)}
    handleMouseDown(t){const e=this.canvas.width-Y_AXIS_WIDTH,i=this.canvas.height-X_AXIS_HEIGHT;this.canvas.style.cursor="grabbing";if("pan"===this.chartMode)this.isPanning=!0,this.panStartX=t.clientX,this.panStartViewIndex=this.viewStartIndex;else if(t.offsetX>e)this.isYAxisPanning=!0,this.panStartY=t.offsetY,this.panStartYAxisConfig={...this.yAxisConfig};else if(t.offsetY>i)this.isXAxisPanning=!0,this.panStartX=t.offsetX,this.panStartCandleWidth=this.candleWidth;else this.isPanning=!0,this.panStartX=t.clientX,this.panStartViewIndex=this.viewStartIndex}
    handleMouseUp(){this.isPanning=this.isYAxisPanning=this.isXAxisPanning=!1;this.canvas.style.cursor="pan"===this.chartMode?"grab":"crosshair"}
    async handleMouseMove(t){if(this.isPanning){const e=t.clientX-this.panStartX,i=Math.round(e/(this.candleWidth+CANDLE_SPACING));if(this.viewStartIndex=this.panStartViewIndex-i,this.viewStartIndex<SCROLL_FETCH_THRESHOLD&&!this.isLoadingMore){this.isLoadingMore=!0;const s=await this.getChartData(this.allCandlesData.length);s.length>0&&(this.allCandlesData.unshift(...s),this.viewStartIndex+=s.length,this.panStartViewIndex+=s.length),this.isLoadingMore=!1}}else if(this.isYAxisPanning){const a=t.offsetY-this.panStartY,o=1+a*Y_AXIS_DRAG_SENSITIVITY,h=this.panStartYAxisConfig.range/o;if(h>1){const n=this.yToPrice(this.panStartY,this.canvas.height-X_AXIS_HEIGHT);this.yAxisConfig.min=n-t.offsetY/(this.canvas.height-X_AXIS_HEIGHT)*h,this.yAxisConfig.max=this.yAxisConfig.min+h,this.yAxisConfig.range=h,this.yAxisConfig.isAuto=!1}}else this.isXAxisPanning?this.candleWidth=Math.max(MIN_CANDLE_WIDTH,Math.min(MAX_CANDLE_WIDTH,this.panStartCandleWidth*Math.max(.1,1+.01*(t.offsetX-this.panStartX)))):(this.crosshairPos={x:t.offsetX,y:t.offsetY},this.tooltipData=this.allCandlesData[this.viewStartIndex+Math.floor(this.crosshairPos.x/(this.candleWidth+CANDLE_SPACING))]);if(!this.isYAxisPanning)this.yAxisBaselinePrice=this.tooltipData?.priceYesterday||this.yAxisBaselinePrice;this.renderChart()}
    handleWheel(t){t.preventDefault();this.zoom(t.deltaY<0?ZOOM_SENSITIVITY:1/ZOOM_SENSITIVITY,t.offsetX)}
    zoom(t,e=(this.canvas.width-Y_AXIS_WIDTH)/2){const i=this.candleWidth;this.candleWidth=Math.max(MIN_CANDLE_WIDTH,Math.min(MAX_CANDLE_WIDTH,i*t));const s=e/(i+CANDLE_SPACING),a=e/(this.candleWidth+CANDLE_SPACING);this.viewStartIndex+=Math.round(s-a),this.renderChart()}
    autoFit(){this.yAxisConfig.isAuto=!0;this.candleWidth=INITIAL_CANDLE_WIDTH;this.setInitialView();this.renderChart()}
    toggleTheme(){this.theme="dark"===this.theme?"light":"dark";document.getElementById(`chart-wrapper-${this.name}`).classList.toggle("light-theme","light"===this.theme);this.allCandlesData.forEach(t=>{t.color=t.close>=t.open?THEMES[this.theme].CANDLE_GREEN:THEMES[this.theme].CANDLE_RED});this.renderChart()}
    setInitialView(){const t=this.canvas.width-Y_AXIS_WIDTH,e=Math.floor(t/(this.candleWidth+CANDLE_SPACING))-RIGHT_SIDE_PADDING_CANDLES;this.viewStartIndex=Math.max(0,this.allCandlesData.length-e)}
    setChartMode(t){this.chartMode=t;this.canvas.style.cursor="pan"===t?"grab":"crosshair";this.crosshairPos=null;this.tooltipData=null;this.renderChart()}
    updateTooltip(t){const e=document.getElementById(`chart-tooltip-${this.name}`);if(!this.tooltipData||!this.crosshairPos)return void(e.style.display="none");const i=this.tooltipData;e.style.display="block",e.style.borderColor=t.AXIS_TEXT_COLOR,e.style.backgroundColor=t.CHART_BG,e.style.color=t.AXIS_TEXT_COLOR;const s=(e,s)=>{if(i.priceYesterday<=0)return`${e.toLocaleString()}`;const a=(e-i.priceYesterday)/i.priceYesterday*100,o=a>=0?t.POSITIVE_COLOR:t.NEGATIVE_COLOR;return`<div><span style="color:${i.color}">${s}:</span> ${e.toLocaleString()} <span style="color: ${o}">(${a.toFixed(2)}%)</span></div>`};e.innerHTML=`<div><strong>${i.date}</strong></div>${s(i.open,"O")}${s(i.high,"H")}${s(i.low,"L")}${s(i.close,"C")}${s(i.finalPrice,"F")}<div><span>Vol:</span> ${formatNumberWithUnit(i.vol)}</div>`;const{x:a,y:o}=this.crosshairPos,h=this.canvas.getBoundingClientRect();e.style.left=`${h.left+a+20}px`,e.style.top=`${h.top+o+20}px`}
    buildIndicatorMenu(menuEl){menuEl.innerHTML="";for(const key in this.indicatorManager.available){const item=document.createElement("div");item.className="indicator-item";item.dataset.key=key;item.innerHTML=`<span>${key}</span><input type="checkbox" ${this.indicatorManager.active.has(key)?'checked':''}>`;item.addEventListener('change',e=>this.toggleIndicator(key,e.target.checked));menuEl.appendChild(item)}}
    toggleIndicator(key,isActive){if(isActive){const IndicatorClass=this.indicatorManager.available[key];const id=`${key}_${this.indicatorManager.nextId++}`;const indicator=new IndicatorClass(id);indicator.calculate(this.allCandlesData);this.indicatorManager.active.set(id,indicator)}else{for(const[id]of this.indicatorManager.active){if(id.startsWith(key))this.indicatorManager.active.delete(id)}}this.renderChart()}
    removeIndicator(id){this.indicatorManager.active.delete(id);this.buildIndicatorMenu(this.contentEl.querySelector('.indicator-menu'));this.renderChart()}
    openIndicatorSettings(id){const indicator=this.indicatorManager.active.get(id);const modal=document.getElementById(`settings-modal-${this.name}`);indicator.getSettingsModal(modal,indicator.options,newOptions=>{indicator.options=newOptions;indicator.calculate(this.allCandlesData);modal.style.display="none";this.renderChart()});modal.style.display="block"}

    async init(){this.contentEl=document.getElementById(`${this.name}-container`);if(!this.contentEl)return;this.contentEl.innerHTML=`<div class="tv-chart-wrapper"><div class="loading-message">در حال بارگذاری اطلاعات نمودار...</div></div>`;try{await this.initialDataLoad();this.contentEl.innerHTML=this.getTemplate();const t=document.getElementById(`chart-wrapper-${this.name}`);"light"===this.theme&&t.classList.add("light-theme"),this.canvas=document.getElementById(`candleChart-${this.name}`),this.ctx=this.canvas.getContext("2d"),this.resizeObserver=new ResizeObserver(()=>{this.canvas.width=t.clientWidth,this.canvas.height=t.clientHeight,this.renderChart()}),this.resizeObserver.observe(t),this.setupAllEventListeners(),this.setInitialView()}catch(t){console.error(t),this.contentEl.innerHTML=`<div class="tv-chart-wrapper"><div class="error-message">نمودار موجود نیست.</div></div>`}}
    destroy(){super.destroy();const t=document.getElementById(`chart-wrapper-${this.name}`);this.resizeObserver&&t&&this.resizeObserver.unobserve(t),this.canvas&&(this.canvas.onmousedown=this.canvas.onmouseup=this.canvas.onmouseleave=this.canvas.onwheel=this.canvas.onmousemove=null)}
}

if(!document.getElementById('tv-chart-styles')){const s=document.createElement('style');s.id='tv-chart-styles';s.textContent=`
.tv-chart-wrapper{position:relative;width:100%;height:75vh;user-select:none;}.tv-chart-wrapper canvas{display:block;width:100%;height:100%;}.loading-message,.error-message{display:flex;justify-content:center;align-items:center;height:100%;font-size:1.2rem;color:#B2B5BE;background-color:#131722;}.tv-chart-wrapper.light-theme .loading-message,.tv-chart-wrapper.light-theme .error-message{color:#333;background-color:#FFF;}.error-message{color:#EF5350;}.chart-controls{position:absolute;bottom:${X_AXIS_HEIGHT+10}px;left:10px;z-index:10;display:flex;gap:5px;background:rgba(0,0,0,0.2);padding:4px;border-radius:6px;}.chart-controls button{background-color:transparent;color:#B2B5BE;border:1px solid transparent;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:14px;}.chart-controls button.active,.chart-controls button:hover{background-color:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);}
.tv-chart-wrapper.light-theme .chart-controls{background:rgba(255,255,255,0.7);}.tv-chart-wrapper.light-theme .chart-controls button{color:#333;}.tv-chart-wrapper.light-theme .chart-controls button.active,.tv-chart-wrapper.light-theme .chart-controls button:hover{background-color:rgba(0,0,0,0.1);border-color:rgba(0,0,0,0.2);}
.chart-tooltip{position:fixed;display:none;padding:8px;font-size:12px;z-index:20;border-radius:4px;pointer-events:none;line-height:1.6;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);white-space:nowrap;}.chart-tooltip div span:first-child{display:inline-block;width:20px;}
.indicator-menu{display:none;position:absolute;bottom:${X_AXIS_HEIGHT+50}px;left:10px;z-index:10;background-color:#1e222d;color:#B2B5BE;border:1px solid #363a45;border-radius:4px;padding:8px;}.tv-chart-wrapper.light-theme .indicator-menu{background-color:#f0f3fa;color:#333;border-color:#e0e3eb;}.indicator-item{padding:4px 8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;}.indicator-item:hover{background-color:rgba(255,255,255,0.05);}.tv-chart-wrapper.light-theme .indicator-item:hover{background-color:rgba(0,0,0,0.05);}
.settings-modal{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:30;background-color:#1e222d;color:#B2B5BE;border:1px solid #363a45;border-radius:6px;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,0.4);}.tv-chart-wrapper.light-theme .settings-modal{background-color:#f0f3fa;color:#333;border-color:#e0e3eb;}.setting-item{margin-bottom:12px;}.setting-item label{margin-right:8px;}`;document.head.appendChild(s);}