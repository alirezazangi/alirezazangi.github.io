// This file must be hosted on a server (e.g., at https://alirezazangi.ir/tabs/ExampleDynamicTab.js)
// It accesses the main application's dependencies via the global `window.tsetmc_deps` object.

// Destructure the necessary dependencies from the global object.
const { BaseTab, apiService, utils } = window.tsetmc_deps;

export class ExampleDynamicTab extends BaseTab {
    constructor(stockId) {
        // 'dynamic-example': a unique ID for the tab
        // 'تب داینامیک': The title shown in the UI menu
        super('dynamic-example', 'تب داینامیک', stockId);
    }

    /**
     * Defines the HTML structure and CSS for this tab.
     */
    getTemplate() {
        return `
            <div class="widget-card dynamic-tab-content">
                <h3>این یک تب داینامیک است!</h3>
                <p>این تب از سرور بارگذاری شده و بخشی از پکیج اصلی برنامه نیست.</p>
                <div id="dynamic-content-${this.name}">درحال دریافت اطلاعات...</div>
            </div>
            <style>
                .dynamic-tab-content {
                    padding: 2rem;
                    text-align: center;
                    border-left: 5px solid #ffc107; /* A yellow accent for dynamic tabs */
                }
            </style>
        `;
    }

    /**
     * This method is called once when the tab is opened.
     * It's the perfect place for initial data fetching and rendering.
     */
    async init() {
        console.log(`Dynamic Tab initialized for stock: ${this.stockId}`);
        // `update()` contains the data fetching logic, so we call it here.
        await this.update();
        // This example tab doesn't need to auto-refresh, so we don't start an interval.
    }

    /**
     * This method handles fetching data and updating the tab's content.
     */
    async update() {
        const contentEl = document.getElementById(`dynamic-content-${this.name}`);
        if (!contentEl) return;

        try {
            // Use the globally available apiService to fetch data from the Rust backend
            const infoResponse = await apiService.getInstrumentInfo(this.stockId);
            const info = infoResponse.instrumentInfo;
            contentEl.innerHTML = `
                <strong>نام نماد از بک‌اند:</strong> ${info.lVal30} (${info.lVal18AFC})
            `;
        } catch (error) {
            console.error("Error in dynamic tab:", error);
            contentEl.textContent = `خطا در دریافت اطلاعات: ${error}`;
        }
    }
}