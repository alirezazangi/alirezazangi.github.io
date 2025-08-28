// ===== MODIFIED FILE: data-downloader-tab.js =====

// ===== IMPORTS & DEPENDENCIES =====
import { BaseTab } from './tsetmc-modular.js';
import * as apiService from './apiService.js';
import * as utils from './utils.js';

/**
 * 🚀 **DataDownloaderTab v3: Professional Quantitative Analysis Platform**
 *
 * This definitive version transforms the tab into a professional-grade tool with a
 * full-featured code editor and expanded data access.
 *
 * Key Architectural Upgrades:
 * 1.  **Integrated CodeMirror Editor**: Replaces textareas with the CodeMirror 6 editor,
 *     providing syntax highlighting, autocompletion, and a proper LTR coding environment.
 * 2.  **Expanded Unified Data Source**: Now automatically fetches and merges Price History,
 *     Client Type History, AND **Major Shareholder data** for the most recent day.
 * 3.  **Reliable Time-Series Access**: The data structure ensures `data.key[0]` consistently
 *     refers to the most recent day's data, enabling intuitive time-series comparisons.
 * 4.  **Structured Raw Data Export**: Adds "Download Raw JSON" and "Download Raw CSV" buttons,
 *     allowing users to export the complete, merged dataset before any custom processing.
 * 5.  **Enhanced UI/UX**: The UI is cleaner, provides better instructions, and gives more
 *     feedback during operations.
 */
export class DataDownloaderTab extends BaseTab {
    constructor(stockId) {
        super('data-downloader', 'پلتفرم تحلیل داده', stockId);
        this.elements = {}; // For caching DOM elements
        this.processedData = []; // To store the final data for download
        this.filterEditor = null; // To hold the CodeMirror instance
        this.customColsEditor = null; // To hold the CodeMirror instance
        this.isEditorLoading = false;
    }

    // ===== LIFECYCLE & UI RENDERING =====

    getTemplate() {
        return `
            <div class="downloader-container">
                <div class="downloader-controls widget-card">
                    <div class="control-group">
                        <label for="data-keys-input">کلیدهای داده (جدا شده با کاما):</label>
                        <input type="text" id="data-keys-input" placeholder="مثال: dEven,pClosing,qTotTran5J,buy_I_Volume" value="dEven,pClosing,qTotTran5J,buy_I_Volume,sell_I_Volume">
                        <small>کلیدهای پایه: dEven, pClosing, qTotTran5J, priceYesterday, buy_I_Volume, sell_I_Volume, و غیره. کلید جدید ` + '`shareholders`' + ` شامل سهامداران روز آخر است.</small>
                    </div>
                    <div class.control-group">
                        <label for="data-days-count">تعداد روزهای اخیر:</label>
                        <input type="number" id="data-days-count" value="250" min="1" max="2000">
                    </div>

                    <details class="advanced-section" open>
                        <summary>فیلتر پیشرفته (اختیاری)</summary>
                        <div class="editor-wrapper" id="filter-editor-wrapper">
                            <div id="filter-editor" class="code-editor-placeholder">در حال بارگذاری ویرایشگر کد...</div>
                        </div>
                    </details>

                    <details class="advanced-section" open>
                        <summary>ستون‌های سفارشی (اختیاری)</summary>
                        <div class="editor-wrapper" id="custom-columns-editor-wrapper">
                             <div id="custom-columns-editor" class="code-editor-placeholder">در حال بارگذاری ویرایشگر کد...</div>
                        </div>
                    </details>
                    
                    <div class="button-row">
                        <button id="run-downloader-btn" class="action-button">🚀 اجرای تحلیل</button>
                        <button id="download-csv-btn" class="action-button secondary-button" disabled>💾 دانلود CSV نتیجه</button>
                    </div>
                     <div class="button-row raw-download-row">
                        <button id="download-raw-json-btn" class="action-button raw-button">دانلود JSON خام</button>
                        <button id="download-raw-csv-btn" class="action-button raw-button">دانلود CSV خام</button>
                    </div>
                </div>
                
                <div id="downloader-error-log" class="error-log"></div>
                
                <div class="downloader-results widget-card">
                    <div class="table-wrapper">
                        <table id="downloader-results-table" class="dashboard-table">
                            <!-- Content will be generated dynamically -->
                        </table>
                    </div>
                </div>
            </div>
            <style>
                .downloader-container { display: flex; flex-direction: column; gap: 1.5rem; }
                .downloader-controls { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
                .widget-card { background-color: var(--bg-widget); border-radius: var(--border-radius); box-shadow: var(--shadow); }
                .control-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .control-group label { font-weight: 500; color: var(--text-secondary); }
                .control-group input { width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit; font-size: 0.95rem; }
                .control-group small { font-size: 0.8rem; color: #999; margin-top: 4px; }
                .advanced-section { margin-top: 0.5rem; }
                .advanced-section summary { cursor: pointer; font-weight: 500; margin-bottom: 0.5rem; }
                .button-row { display: flex; gap: 1rem; margin-top: 1rem; }
                .raw-download-row { margin-top: 0.5rem; }
                .action-button { flex-grow: 1; background-color: var(--primary-accent); color: white; border: none; padding: 0.8rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-weight: 600; font-size: 1rem;}
                .action-button:hover:not(:disabled) { background-color: var(--primary-accent-hover); }
                .action-button:disabled { background-color: #ccc; cursor: not-allowed; }
                .secondary-button { background-color: #6c757d; }
                .secondary-button:hover:not(:disabled) { background-color: #5a6268; }
                .raw-button { background-color: #17a2b8; font-size: 0.9rem; padding: 0.6rem; }
                .raw-button:hover:not(:disabled) { background-color: #138496; }
                .error-log { display: none; background-color: #fffbe6; border: 1px solid #ffe58f; color: #d46b08; padding: 1rem; border-radius: var(--border-radius); font-family: monospace; white-space: pre-wrap; }
                .table-wrapper { width: 100%; max-height: 80vh; overflow: auto; }
                .editor-wrapper { border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; }
                .code-editor-placeholder { padding: 1rem; color: #888; background-color: #f9f9f9; }
                .cm-editor { direction: ltr; text-align: left; }
            </style>
        `;
    }

    async init() {
        const container = document.getElementById(`${this.name}-container`);
        if (!container) return;
        container.innerHTML = this.getTemplate();
        this.cacheDOMElements();
        this.setupEventListeners();
        this._initializeCodeEditors();
    }

    async _initializeCodeEditors() {
        if (this.filterEditor || this.isEditorLoading) return;
        this.isEditorLoading = true;

        try {
            // Dynamically load CodeMirror assets
            await utils.loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.js');
            await utils.loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/javascript.min.js');
            utils.loadStyle('https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.css');
            utils.loadStyle('https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/theme/dracula.min.css');

            const { EditorState, EditorView, basicSetup } = CM;
            const { javascript } = CM.javascript;

            const extensions = [basicSetup, javascript(), EditorView.theme({
                '&': { fontSize: '14px' },
                '.cm-scroller': { overflow: 'auto', fontFamily: 'monospace' }
            })];

            // Initialize Filter Editor
            const filterParent = document.getElementById('filter-editor');
            filterParent.innerHTML = ''; // Clear placeholder
            this.filterEditor = new EditorView({
                state: EditorState.create({
                    doc: `// فیلتر روزهایی که قیمت پایانی بالاتر از دیروز بوده\n// داده روز[0]، داده دیروز [1] و ...\nconst filterMask = data.pClosing.map((price, i) => {\n  if (i >= data.pClosing.length -1) return false; // avoid index out of bounds\n  return price > data.pClosing[i+1];\n});\n\nreturn filterMask;`,
                    extensions
                }),
                parent: filterParent
            });

            // Initialize Custom Columns Editor
            const customColsParent = document.getElementById('custom-columns-editor');
            customColsParent.innerHTML = ''; // Clear placeholder
            this.customColsEditor = new EditorView({
                state: EditorState.create({
                    doc: `// (cfiled0) یعنی یک ستون بساز\nconst dailyChange = data.pClosing.map((price, i) => price - data.priceYesterday[i]);\n\n// محاسبه قدرت خریدار حقیقی\nconst realBuyPower = data.buy_I_Volume.map((buyVol, i) => {\n  const sellVol = data.sell_I_Volume[i];\n  return sellVol > 0 ? buyVol / sellVol : 0;\n});\n\nreturn {\n  cfiled0_DailyChange: dailyChange,\n  cfiled1_RealBuyPower: realBuyPower\n};`,
                    extensions
                }),
                parent: customColsParent
            });

        } catch (error) {
            console.error("Failed to load CodeMirror editor:", error);
            document.getElementById('filter-editor').textContent = "خطا در بارگذاری ویرایشگر کد.";
            document.getElementById('custom-columns-editor').textContent = "خطا در بارگذاری ویرایشگر کد.";
        } finally {
            this.isEditorLoading = false;
        }
    }

    cacheDOMElements() {
        this.elements.keysInput = document.getElementById('data-keys-input');
        this.elements.daysCount = document.getElementById('data-days-count');
        this.elements.runButton = document.getElementById('run-downloader-btn');
        this.elements.downloadButton = document.getElementById('download-csv-btn');
        this.elements.downloadRawJsonBtn = document.getElementById('download-raw-json-btn');
        this.elements.downloadRawCsvBtn = document.getElementById('download-raw-csv-btn');
        this.elements.resultsTable = document.getElementById('downloader-results-table');
        this.elements.errorLog = document.getElementById('downloader-error-log');
    }

    setupEventListeners() {
        this.elements.runButton.addEventListener('click', () => this.runAnalysis());
        this.elements.downloadButton.addEventListener('click', () => this.downloadProcessedCSV());
        this.elements.downloadRawJsonBtn.addEventListener('click', () => this.downloadRawData('json'));
        this.elements.downloadRawCsvBtn.addEventListener('click', () => this.downloadRawData('csv'));
    }

    // ===== DATA FETCHING & PROCESSING PIPELINE =====

    async _fetchAndMergeData() {
        const days = parseInt(this.elements.daysCount.value, 10);

        const priceResponse = await apiService.getClosingPriceDailyList(this.stockId, days);
        const priceData = priceResponse?.closingPriceDaily || [];

        if (priceData.length === 0) return [];

        const mostRecentDate = priceData[0].dEven;

        const [clientTypeResponse, shareholderResponse] = await Promise.all([
            apiService.getClientTypeHistory(this.stockId),
            apiService.getShareholders(this.stockId, mostRecentDate) // Fetch shareholders for the most recent day
        ]);

        const clientTypeData = (clientTypeResponse?.clientType || []).slice(0, days);
        const recentShareholders = shareholderResponse?.shareShareholder || [];

        const mergedDataMap = new Map();
        priceData.forEach(row => mergedDataMap.set(row.dEven, { ...row }));

        clientTypeData.forEach(row => {
            if (mergedDataMap.has(row.recDate)) {
                const existing = mergedDataMap.get(row.recDate);
                mergedDataMap.set(row.recDate, { ...existing, ...row });
            }
        });

        // Attach shareholder data only to the most recent day's entry
        if (mergedDataMap.has(mostRecentDate)) {
            const latestEntry = mergedDataMap.get(mostRecentDate);
            latestEntry.shareholders = recentShareholders;
            mergedDataMap.set(mostRecentDate, latestEntry);
        }

        return Array.from(mergedDataMap.values()).sort((a, b) => (b.dEven || b.recDate) - (a.dEven || a.recDate));
    }

    pivotData(dataArray) {
        if (dataArray.length === 0) return {};
        const pivoted = {};
        // Get all possible keys from all objects
        const allKeys = new Set();
        dataArray.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));

        for (const key of allKeys) {
            pivoted[key] = dataArray.map(row => row[key] !== undefined ? row[key] : null); // Use null for missing values
        }
        return pivoted;
    }

    async runAnalysis() {
        if (this.isEditorLoading) {
            alert("Please wait for the code editor to finish loading.");
            return;
        }

        this.elements.runButton.disabled = true;
        this.elements.downloadButton.disabled = true;
        this.elements.runButton.textContent = 'در حال پردازش...';
        this.elements.errorLog.style.display = 'none';
        this.elements.resultsTable.innerHTML = '<thead><tr><th>در حال بارگذاری و ادغام داده‌ها...</th></tr></thead>';
        this.processedData = [];

        try {
            const mergedData = await this._fetchAndMergeData();
            if (mergedData.length === 0) {
                this.renderTable([], []);
                return;
            }

            const pivotedData = this.pivotData(mergedData);

            const filterCode = this.filterEditor.state.doc.toString();
            const customColsCode = this.customColsEditor.state.doc.toString();

            const functionBody = `
                let filterMask;
                // --- Start of User Filter Code ---
                ${filterCode}
                // --- End of User Filter Code ---

                // --- Start of User Custom Columns Code ---
                const customColumns = (() => {
                    ${customColsCode ? `return ( ${customColsCode} );` : 'return {};'}
                })();
                // --- End of User Custom Columns Code ---

                const finalFilterMask = typeof filterMask !== 'undefined' ? filterMask : new Array(data.dEven.length).fill(true);
                return { filterMask: finalFilterMask, customColumns };
            `;

            const executor = new Function('data', functionBody);
            const { filterMask, customColumns } = executor(pivotedData);

            let finalData = mergedData.filter((_, index) => filterMask && filterMask[index]);

            const customColNames = Object.keys(customColumns || {});
            if (customColNames.length > 0) {
                finalData = finalData.map(row => {
                    const newRow = { ...row };
                    const originalIndex = mergedData.findIndex(originalRow => (originalRow.dEven || originalRow.recDate) === (row.dEven || row.recDate));
                    if (originalIndex === -1) return newRow;

                    for (const colName of customColNames) {
                        if (customColumns[colName] && customColumns[colName][originalIndex] !== undefined) {
                            newRow[colName] = customColumns[colName][originalIndex];
                        }
                    }
                    return newRow;
                });
            }

            this.processedData = finalData;

            const headerKeys = this.elements.keysInput.value.split(',').map(k => k.trim()).filter(Boolean);
            const allHeaders = [...headerKeys, ...customColNames];

            this.renderTable(allHeaders, this.processedData);

            if (this.processedData.length > 0) {
                this.elements.downloadButton.disabled = false;
            }

        } catch (error) {
            this.logError(`An error occurred during execution:\n\n${error.message}\n\nStack: ${error.stack}`);
        } finally {
            this.elements.runButton.disabled = false;
            this.elements.runButton.textContent = '🚀 اجرای تحلیل';
        }
    }

    renderTable(headers, data) {
        if (data.length === 0) {
            this.elements.resultsTable.innerHTML = '<thead><tr><th>هیچ داده‌ای مطابق با شرایط شما یافت نشد.</th></tr></thead>';
            return;
        }

        const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${data.map(row => `
            <tr>
                ${headers.map(header => {
            const value = row[header];
            let displayValue = '-';
            if (value !== null && value !== undefined) {
                if (typeof value === 'number') {
                    displayValue = value.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
                } else if (header === 'dEven' || header === 'recDate') {
                    displayValue = utils.formatDate(value);
                } else if (Array.isArray(value)) {
                    displayValue = `[${value.length} items]`;
                } else if (typeof value === 'object') {
                    displayValue = '{...}';
                }
                else {
                    displayValue = value;
                }
            }
            return `<td>${displayValue}</td>`;
        }).join('')}
            </tr>
        `).join('')}</tbody>`;

        this.elements.resultsTable.innerHTML = thead + tbody;
    }

    async downloadRawData(format) {
        const button = format === 'json' ? this.elements.downloadRawJsonBtn : this.elements.downloadRawCsvBtn;
        button.disabled = true;
        button.textContent = 'در حال آماده‌سازی...';

        try {
            const rawMergedData = await this._fetchAndMergeData();
            if (rawMergedData.length === 0) {
                alert("No data available to download.");
                return;
            }

            if (format === 'json') {
                this.downloadFile(JSON.stringify(rawMergedData, null, 2), 'json');
            } else {
                this.downloadFile(this.convertToCSV(rawMergedData), 'csv');
            }

        } catch (error) {
            this.logError(`Failed to download raw data: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = `دانلود ${format.toUpperCase()} خام`;
        }
    }

    downloadProcessedCSV() {
        if (this.processedData.length === 0) {
            alert("No processed data to download. Please run an analysis first.");
            return;
        }
        this.downloadFile(this.convertToCSV(this.processedData), 'csv', 'processed');
    }

    convertToCSV(dataArray) {
        if (dataArray.length === 0) return "";
        const headers = Object.keys(dataArray[0]);
        let csvContent = headers.join(",") + "\r\n";
        dataArray.forEach(row => {
            const values = headers.map(header => {
                let cell = row[header];
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'object') cell = JSON.stringify(cell);
                cell = String(cell).replace(/"/g, '""');
                if (String(cell).includes(',')) cell = `"${cell}"`;
                return cell;
            });
            csvContent += values.join(",") + "\r\n";
        });
        return csvContent;
    }

    downloadFile(content, format, prefix = 'raw') {
        const mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;';
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement("a");

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute("href", url);
            link.setAttribute("download", `${prefix}_data_${this.stockId}_${date}.${format}`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    logError(message) {
        this.elements.errorLog.style.display = 'block';
        this.elements.errorLog.textContent = message;
    }

    // This tab is a tool and doesn't need a periodic update.
    async update() { }
}
