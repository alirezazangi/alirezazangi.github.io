import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

export class MainTab extends BaseTab {
    constructor(stockId) {
        super('main', 'اطلاعات اصلی', stockId);
    }

    /**
     * 📖 **EXPLANATION OF FIX:**
     * This `getTemplate` now defines the complete inner structure for the MainTab, including the grid layout
     * and the necessary styles. This makes the component more self-contained.
     * The `init` and `update` methods will now correctly find the `.widget-grid` container within the
     * tab's own generated DOM, which resolves the previous error.
     */
    getTemplate() {
        return `
            <div class="widget-grid">
                <!-- Widgets will be rendered here by the generateContent method -->
            </div>
            <style>
                .widget-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1.5rem;
                }
                .widget-card {
                    background-color: var(--bg-widget);
                    border-radius: var(--border-radius);
                    box-shadow: var(--shadow);
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                }
                .widget-card.full-span {
                    grid-column: 1 / -1;
                }
                .widget-header {
                    margin: -1.5rem -1.5rem 1rem -1.5rem;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                    background-color: var(--bg-main);
                    border-top-left-radius: var(--border-radius);
                    border-top-right-radius: var(--border-radius);
                }
                .widget-header h4 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                .widget-body {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem 1.5rem; /* More horizontal gap */
                    font-size: 0.95rem;
                }
                .data-point {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.35rem 0;
                    border-bottom: 1px dashed var(--border-color);
                }
                 .widget-body > .data-point:last-child {
                    border-bottom: none;
                }
                .data-point .label {
                    color: var(--text-secondary);
                }
                .data-point .value {
                    font-weight: 500;
                    direction: ltr; /* For numbers and percentages */
                    text-align: right;
                }
                .stock-name { font-weight: 600; } .stock-full-name { color: var(--text-secondary); font-size: 0.9em; } .stock-name-group {display: flex; flex-direction: column; align-items: flex-start;}
                .majma-notice {
                    background-color: #fffbe6;
                    border: 1px solid #ffe58f;
                    color: #d46b08;
                }
                .majma-notice .widget-header {
                    background-color: #fff1b8;
                }
            </style>
        `;
    }

    async fetchData() {
        try {
            const [infoResponse, dailyDataResponse, majmaResponse] = await Promise.all([
                apiService.getInstrumentInfo(this.stockId),
                apiService.getClosingPriceDaily(this.stockId),
                apiService.getCodalMajma(this.stockId)
            ]);

            if (!infoResponse || !dailyDataResponse) {
                console.error("Core data missing for main tab.");
                return null;
            }
            
            const majmaData = this.findMajmaNotice(majmaResponse?.preparedData);

            return {
                info: infoResponse.instrumentInfo,
                dailyData: dailyDataResponse.closingPriceDaily,
                majmaData
            };
        } catch (error) {
            console.error("Error fetching main tab data:", error);
            return null;
        }
    }
    
    findMajmaNotice(preparedData) {
        if (!preparedData || preparedData.length === 0) return { found: false };
        const notice = preparedData.find(day => day.title.includes("آگهی دعوت به مجمع"));
        if (!notice) return { found: false };

        const publishDateStr = String(notice.publishDateTime_DEven);
        const publishDate = new Date(parseInt(publishDateStr.substring(0, 4)), parseInt(publishDateStr.substring(4, 6)) - 1, parseInt(publishDateStr.substring(6, 8)));
        const daysPassed = Math.floor((new Date().getTime() - publishDate.getTime()) / (1000 * 3600 * 24));

        return {
            found: true,
            title: notice.title,
            publishDate: utils.formatDate(notice.publishDateTime_DEven),
            daysPassed
        };
    }

    calculateVolumeProportionality(currentVolume, avgVolume, baseVolume) {
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();

        const isBeforeMarketOpen = currentHour < 9;
        const isAfterMarketClose = currentHour > 12 || (currentHour === 12 && currentMinute >= 30);
        const isOutsideMarketHours = isBeforeMarketOpen || isAfterMarketClose;

        if (currentVolume >= baseVolume || isOutsideMarketHours) {
            const volumeProportionality = avgVolume > 0 ? (currentVolume / avgVolume) * 100 : 0;
            return {
                volumeProportionality: parseFloat(volumeProportionality.toFixed(2)),
                timeIndependent: true
            };
        }

        const startTime = new Date().setHours(9, 0, 0, 0);
        const endTime = new Date().setHours(12, 30, 0, 0);
        const totalMarketTime = endTime - startTime;
        const timePassed = currentTime.getTime() - startTime;
        const timePercentage = Math.max(0, Math.min(100, (timePassed / totalMarketTime) * 100));
        const expectedVolumeAtCurrentTime = (avgVolume * timePercentage) / 100;
        const volumeProportionality = expectedVolumeAtCurrentTime > 0 ? (currentVolume / expectedVolumeAtCurrentTime) * 100 : 0;

        return {
            currentTime: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
            timePercentage: timePercentage.toFixed(2),
            volumeProportionality: parseFloat(volumeProportionality.toFixed(2)),
            timeIndependent: false
        };
    }

    generateContent(info, dailyData, majmaData) {
        if (!info || !dailyData) {
            return `<div class="widget-card"><div class="widget-body"><p>اطلاعات مورد نیاز برای نمایش وجود ندارد.</p></div></div>`;
        }
        
        const volumeResult = this.calculateVolumeProportionality(dailyData.qTotTran5J, info.qTotTran5JAvg, info.baseVol);
        const pY = dailyData.priceYesterday;

        const renderDataPoint = (label, value) => `<div class="data-point"><span class="label">${label}</span><span class="value">${value}</span></div>`;

        let content = '';

        if(majmaData?.found){
            content += `
            <div class="widget-card full-span majma-notice">
                <div class="widget-header"><h4>اطلاعیه مجمع</h4></div>
                <div class="widget-body" style="grid-template-columns: 1fr;">
                    ${renderDataPoint('عنوان', majmaData.title)}
                    ${renderDataPoint('تاریخ انتشار', `${majmaData.publishDate} (${majmaData.daysPassed.toLocaleString()} روز قبل)`)}
                </div>
            </div>`;
        }

        content += `
            <div class="widget-card">
                <div class="widget-header"><h4>اطلاعات پایه</h4></div>
                <div class="widget-body" style="grid-template-columns: 1fr;">
                    ${renderDataPoint('نام شرکت', info.lVal30)}
                    ${renderDataPoint('نماد', info.lVal18AFC)}
                    ${renderDataPoint('گروه', info.sector.lSecVal)}
                    ${renderDataPoint('EPS', info.eps?.estimatedEPS?.toLocaleString() || '-')}
                    ${renderDataPoint('P/E گروه', info.eps?.sectorPE || '-')}
                    ${renderDataPoint('تعداد سهام', utils.formatNumberWithUnit(info.zTitad))}
                    ${renderDataPoint('سهام شناور', `${info.kAjCapValCpsIdx}%`)}
                </div>
            </div>

            <div class="widget-card">
                <div class="widget-header"><h4>محدوده قیمت</h4></div>
                <div class="widget-body">
                    ${renderDataPoint('بازه سال', `${utils.formatPercentageSpan(utils.calculatePercentage(info.minYear, dailyData.priceYesterday))} ${info.minYear?.toLocaleString()} <br> ${utils.formatPercentageSpan(utils.calculatePercentage(info.maxYear, dailyData.priceYesterday))}${info.maxYear?.toLocaleString()}`)}
                    ${renderDataPoint('بازه هفته', `${utils.formatPercentageSpan(utils.calculatePercentage(info.minWeek, dailyData.priceYesterday))} ${info.minWeek?.toLocaleString()} <br> ${utils.formatPercentageSpan(utils.calculatePercentage(info.maxWeek, dailyData.priceYesterday))} ${info.maxWeek?.toLocaleString()}`)}
                    ${renderDataPoint('بازه مجاز روز', `${info.staticThreshold.psGelStaMin?.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(info.staticThreshold.psGelStaMin, pY))}`)}
                    ${renderDataPoint('', `${info.staticThreshold.psGelStaMax?.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(info.staticThreshold.psGelStaMax, pY))}`)}
                </div>
            </div>

            <div class="widget-card">
                <div class="widget-header"><h4>قیمت لحظه‌ای</h4></div>
                <div class="widget-body">
                    ${renderDataPoint('آخرین', `${dailyData.pDrCotVal.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(dailyData.pDrCotVal, pY))}`)}
                    ${renderDataPoint('پایانی', `${dailyData.pClosing.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(dailyData.pClosing, pY))}`)}
                    ${renderDataPoint('اولین', `${dailyData.priceFirst.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(dailyData.priceFirst, pY))}`)}
                    ${renderDataPoint('دیروز', pY.toLocaleString())}
                    ${renderDataPoint('کمترین روز', `${dailyData.priceMin.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(dailyData.priceMin, pY))}`)}
                    ${renderDataPoint('بیشترین روز', `${dailyData.priceMax.toLocaleString()} ${utils.formatPercentageSpan(utils.calculatePercentage(dailyData.priceMax, pY))}`)}
                </div>
            </div>
            
            <div class="widget-card">
                <div class="widget-header"><h4>حجم و ارزش معاملات</h4></div>
                <div class="widget-body">
                    ${renderDataPoint('حجم معاملات', `${utils.formatNumberWithUnit(dailyData.qTotTran5J)} ${utils.formatPercentageSpan(utils.calculatePercentage(dailyData.qTotTran5J, info.qTotTran5JAvg))}`)}
                    ${renderDataPoint('ارزش معاملات', `${utils.formatNumberWithUnit(dailyData.qTotCap / 10)} تومان`)}
                    ${renderDataPoint('تعداد معاملات', dailyData.zTotTran.toLocaleString())}
                    ${renderDataPoint('حجم مبنا', utils.formatNumberWithUnit(info.baseVol))}
                    ${renderDataPoint('میانگین حجم ماه', utils.formatNumberWithUnit(info.qTotTran5JAvg))}
                    ${renderDataPoint('ارزش به میانگین ماه', `<span class="${volumeResult.volumeProportionality > 100 ? 'positive' : 'negative'}">${volumeResult.volumeProportionality.toFixed(2)}%</span>`)}
                    ${renderDataPoint('وضعیت حجم', volumeResult.timeIndependent ? 'مستقل از زمان' : `وابسته به زمان (${volumeResult.timePercentage}%)`)}
                </div>
            </div>
        `;
        return content;
    }

    async update() {
        const data = await this.fetchData();
        // The container is now guaranteed to exist within this tab's scope.
        const container = document.querySelector(`#${this.name}-container .widget-grid`);
        
        if (data && container) {
            container.innerHTML = this.generateContent(data.info, data.dailyData, data.majmaData);
        } else if (container) {
            container.innerHTML = `<div class="widget-card"><p>خطا در بارگذاری اطلاعات. لطفاً دوباره تلاش کنید.</p></div>`;
        }
    }

    async init() {
        // We only need to find the container specific to this tab.
        const container = document.getElementById(`${this.name}-container`);
        if (container) {
            // The template with the grid layout is now provided by this class's own getTemplate().
            // So we can be sure the ".widget-grid" will be there after the template is rendered.
            if (!container.innerHTML.trim()) {
                 container.innerHTML = this.getTemplate();
            }
        }
        await this.update();
        this.startUpdateInterval(10000);
    }
}