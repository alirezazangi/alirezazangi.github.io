// ===== IMPORTS & DEPENDENCIES =====
import * as apiService from './apiService.js';
import * as utils from './utils.js';

// ===== CORE CLASSES =====

/**
 * 📖 **EXPLANATION OF FIX:**
 * The `getTemplate` method was creating a container with a title, which was redundant since the main header now shows the title.
 * The `createTabPane` method was wrapping the tab's template inside another div. This created a nested structure that was causing ID lookup failures in `MainTab`.
 * 
 * 💡 **SOLUTION:**
 * 1.  **Simplified `BaseTab.getTemplate`:** It now only returns a placeholder string. The responsibility of creating the container div is moved entirely to `createTabPane`.
 * 2.  **Corrected `createTabPane`:** It now creates a SINGLE container div for each tab with a predictable ID (`${tab.name}-container`). The tab's specific template (from its own `getTemplate` method) is then placed inside this single container.
 * This eliminates the nesting problem and ensures that when `MainTab.init` runs, `document.getElementById('main-container')` correctly finds the div created for it.
 */
export class BaseTab {
    constructor(name, title, stockId) {
        this.name = name;
        this.title = title;
        this.stockId = stockId;
        this.updateInterval = null;
    }

    // This method will now be overridden by tabs that need a specific structure, like MainTab.
    // By default, it returns an empty string, as the container is created by the Dashboard class.
    getTemplate() {
        return '';
    }

    async update() { throw new Error('Method update() must be implemented'); }
    async init() { throw new Error('Method init() must be implemented'); }
    startUpdateInterval(interval) {
        if (interval) {
            this.stopUpdateInterval();
            this.updateInterval = setInterval(() => this.update(), interval);
        }
    }
    stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    destroy() { this.stopUpdateInterval(); }
}

/**
 * @class Dashboard
 * @description Manages the dashboard with a responsive, nested sidebar menu.
 */
export class Dashboard {
    constructor(stockId) {
        this.stockId = stockId;
        this.tabRegistry = [];
        this.activeTab = null;
    }

    registerTabGroup(groupTitle, tabs) {
        this.tabRegistry.push({ type: 'group', title: groupTitle, tabs });
    }

    registerTab(tab) {
        this.tabRegistry.push({ type: 'single', tab });
    }

    createNavLink(tab) {
        return `<a href="#" class="nav-link" data-tab="${tab.name}">${tab.title}</a>`;
    }

    createTabPane(tab) {
        // This is the corrected, simplified structure.
        // It creates one parent div for the tab's content.
        // The tab's own getTemplate() populates the inner content.
        return `
            <div id="${tab.name}-container" class="tab-pane">
                ${tab.getTemplate()}
            </div>
        `;
    }

    async switchTab(tabName) {
        let targetTab = null;
        this.tabRegistry.forEach(item => {
            if (item.type === 'single' && item.tab.name === tabName) {
                targetTab = item.tab;
            } else if (item.type === 'group') {
                const found = item.tabs.find(t => t.name === tabName);
                if (found) targetTab = found;
            }
        });

        if (!targetTab) return;

        if (this.activeTab) {
            this.activeTab.destroy();
            document.querySelector(`.nav-link.active`)?.classList.remove('active');
            document.querySelector(`.tab-pane.active`)?.classList.remove('active');
        }

        this.activeTab = targetTab;
        document.querySelector(`.nav-link[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById('active-tab-title').textContent = this.activeTab.title;
        // The container to activate now has the ID `${tabName}-container`
        document.getElementById(`${tabName}-container`)?.classList.add('active');
        
        await this.activeTab.init();

        document.getElementById('tsetmc-sidebar')?.classList.remove('open');
        document.getElementById('tsetmc-overlay')?.classList.remove('open');
    }

    createDashboardUI() {
        let navLinksHTML = '';
        let tabPanesHTML = '';

        this.tabRegistry.forEach(item => {
            if (item.type === 'single') {
                navLinksHTML += this.createNavLink(item.tab);
                tabPanesHTML += this.createTabPane(item.tab);
            } else if (item.type === 'group') {
                navLinksHTML += `
                    <div class="nav-group">
                        <button class="nav-group-toggle">${item.title}</button>
                        <div class="nav-group-content">
                            ${item.tabs.map(tab => this.createNavLink(tab)).join('')}
                        </div>
                    </div>
                `;
                tabPanesHTML += item.tabs.map(tab => this.createTabPane(tab)).join('');
            }
        });

        return `
            <div id="tsetmc-dashboard-wrapper">
                <div id="tsetmc-overlay"></div>
                <aside id="tsetmc-sidebar">
                    <div class="sidebar-header">
                        <h3>تحلیل تکنیکال</h3>
                        <div id="active-stock-display"></div>
                    </div>
                    <nav class="sidebar-nav">${navLinksHTML}</nav>
                </aside>
                <main id="tsetmc-main-content">
                    <header class="main-header">
                        <button id="hamburger-menu" class="hamburger-btn">☰</button>
                        <h2 id="active-tab-title"></h2>
                        <div class="search-container">
                             <input type="text" id="stock-search" placeholder="جستجوی نماد..." />
                             <div id="search-results"></div>
                        </div>
                        <button id="close-dashboard" class="close-btn" title="بستن داشبورد">×</button>
                    </header>
                    <div class="content-area">${tabPanesHTML}</div>
                </main>
            </div>
        `;
    }
    
    async displayActiveStockName() {
        const displayElement = document.getElementById('active-stock-display');
        if (!displayElement) return;

        try {
            const data = await apiService.getInstrumentInfo(this.stockId);
            if (data && data.instrumentInfo) {
                const info = data.instrumentInfo;
                displayElement.textContent = `${info.lVal18AFC} - ${info.lVal30}`;
            } else {
                displayElement.textContent = 'نماد یافت نشد';
            }
        } catch (error) {
            console.error("Failed to fetch stock name:", error);
            displayElement.textContent = 'خطا در دریافت اطلاعات';
        }
    }

    setupStyles() {
        if (!document.getElementById('google-font-vazirmatn')) {
            const fontLink = document.createElement('link');
            fontLink.id = 'google-font-vazirmatn';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
        
        const styleElement = document.getElementById('dashboard-responsive-styles');
        if (styleElement) styleElement.remove();

        const styles = `
            :root {
                --font-family-persian: 'Vazirmatn', sans-serif;
                --bg-main: #f8f9fa;
                --bg-sidebar: #ffffff;
                --bg-widget: #ffffff;
                --text-primary: #212529;
                --text-secondary: #6c757d;
                --border-color: #dee2e6;
                --primary-accent: #007bff;
                --primary-accent-hover: #0056b3;
                --positive: #27ae60;
                --negative: #e74c3c;
                --warning: #f39c12;
                --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --border-radius: 0.5rem;
                --sidebar-width: 280px;
                --header-height: 70px;
            }
            * { box-sizing: border-box; }
            #tsetmc-dashboard-wrapper {
                position: fixed; inset: 0; display: flex; direction: rtl;
                z-index: 9999; font-family: var(--font-family-persian);
                background-color: var(--bg-main); color: var(--text-primary);
                font-size: 14px;
            }
            #tsetmc-sidebar {
                width: var(--sidebar-width); background: var(--bg-sidebar);
                border-left: 1px solid var(--border-color); display: flex;
                flex-direction: column; transition: transform 0.3s ease-in-out; flex-shrink: 0;
            }
            .sidebar-header {
                padding: 1.5rem; border-bottom: 1px solid var(--border-color);
                text-align: center;
            }
            .sidebar-header h3 {
                margin: 0 0 0.5rem 0; font-size: 1.5rem; color: var(--primary-accent);
            }
            #active-stock-display {
                font-size: 0.9rem; color: var(--text-secondary); font-weight: 300;
            }
            .sidebar-nav {
                padding: 1rem; overflow-y: auto; flex-grow: 1;
            }
            .nav-link {
                display: block; padding: 0.8rem 1rem; border-radius: var(--border-radius);
                color: var(--text-primary); text-decoration: none; transition: all 0.2s ease;
                font-weight: 500; margin-bottom: 0.25rem;
                border-right: 3px solid transparent;
            }
            .nav-link:hover { background-color: var(--bg-main); }
            .nav-link.active {
                background-color: #e9f3ff; color: var(--primary-accent);
                border-right-color: var(--primary-accent);
            }
            #tsetmc-main-content {
                flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;
            }
            .main-header {
                height: var(--header-height); background: var(--bg-widget);
                border-bottom: 1px solid var(--border-color); display: flex;
                align-items: center; padding: 0 1.5rem; flex-shrink: 0; gap: 1rem;
            }
            #active-tab-title { font-size: 13px; font-weight: 600; margin: 0; }
            .hamburger-btn { display: none; background: none; border: none; font-size: 1.8rem; cursor: pointer; color: var(--text-secondary); }
            .search-container { position: relative; margin-right: auto; width: 100%; max-width: 400px; }
            #stock-search {
                width: 100%; padding: 0.6rem 1.2rem; border: 1px solid var(--border-color);
                border-radius: 20px; font-size: 0.95rem; transition: all 0.2s;
                background-color: var(--bg-main);
            }
            #stock-search:focus {
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
                border-color: var(--primary-accent); background-color: var(--bg-widget); outline: none;
            }
            #search-results {
                display: none; position: absolute; top: calc(100% + 5px);
                left: 0; right: 0; background: var(--bg-widget); border-radius: var(--border-radius);
                max-height: 300px; overflow-y: auto; z-index: 1000;
                box-shadow: var(--shadow); border: 1px solid var(--border-color);
            }
            .search-result {
                padding: 0.8rem 1.2rem; cursor: pointer; border-bottom: 1px solid var(--border-color);
                display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s;
            }
            .search-result:last-child { border-bottom: none; }
            .search-result:hover { background-color: var(--bg-main); }
            .stock-name { font-weight: 600; } .stock-full-name { color: var(--text-secondary); font-size: 0.9em; }
            .close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: var(--text-secondary); transition: color 0.2s; }
            .close-btn:hover { color: var(--negative); }
            .content-area {
                flex-grow: 1; overflow-y: auto; padding: 1.5rem;
            }
            .tab-pane { display: none; }
            .tab-pane.active { display: block; animation: fadeIn 0.4s ease; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            #tsetmc-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.4);
                opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease; z-index: 100;
            }
            #tsetmc-overlay.open { opacity: 1; visibility: visible; }
            .nav-group-toggle {
                width: 100%; background: none; border: none; padding: 0.8rem 1rem; font-size: 1rem;
                font-weight: 600; color: var(--text-primary); text-align: right; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center;
                border-radius: var(--border-radius);
            }
            .nav-group-toggle:hover { background-color: var(--bg-main); }
            .nav-group-toggle::after { content: '◀'; display: inline-block; transition: transform 0.2s ease; }
            .nav-group.open .nav-group-toggle::after { transform: rotate(-90deg); }
            .nav-group-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; padding-right: 1rem; }
            .nav-group.open .nav-group-content { max-height: 500px; }
            
            /* Modern Component Styles */
            .dashboard-table {
                border-collapse: collapse; width: 100%; background: var(--bg-widget);
                border-radius: var(--border-radius); overflow: hidden; font-size: 0.9rem;
            }
            .dashboard-table th, .dashboard-table td {
                padding: 0.9rem 1rem; text-align: center; border-bottom: 1px solid var(--border-color);
            }
            .dashboard-table thead th {
                background-color: var(--bg-main); font-weight: 600; color: var(--text-secondary);
                border-bottom-width: 2px;
            }
            .dashboard-table tbody tr:last-child td { border-bottom: none; }
            .dashboard-table tbody tr:nth-of-type(even) { background-color: var(--bg-main); }
            .positive { color: var(--positive) !important; font-weight: 500; }
            .negative { color: var(--negative) !important; font-weight: 500; }
            .buy { color: var(--positive); } .sell { color: var(--negative); }
            .section-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-accent); }
            
            /* Responsive Design */
            @media (max-width: 992px) {
                #tsetmc-sidebar {
                    position: fixed; top: 0; right: -100%; height: 100%;
                    transform: translateX(var(--sidebar-width)); z-index: 200; box-shadow: none; right:0;
                }
                #tsetmc-sidebar.open { transform: translateX(0); box-shadow: -5px 0 15px rgba(0,0,0,0.1); }
                .hamburger-btn { display: block; }
                .search-container { max-width: 250px; }
                .main-header { padding: 0 1rem; }
            }
        `;
        
        const newStyleElement = document.createElement('style');
        newStyleElement.id = 'dashboard-responsive-styles';
        newStyleElement.textContent = styles;
        document.head.appendChild(newStyleElement);
    }
    
    updateSearchResults(results) {
        const searchResults = document.getElementById('search-results');
        searchResults.style.display = results.length ? 'block' : 'none';
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="no-results" style="padding: 1rem; text-align: center; color: var(--text-secondary);">نتیجه‌ای یافت نشد</div>';
            return;
        }
        searchResults.innerHTML = results.map(stock => `<div class="search-result" data-inscode="${stock.insCode}"><div class="stock-name-group"><span class="stock-name">${stock.lVal18AFC}</span><span class="stock-full-name">${stock.lVal30}</span></div></div>`).join('');
        Array.from(searchResults.getElementsByClassName('search-result')).forEach(element => {
            element.addEventListener('click', () => {
                localStorage.setItem('selectedStockId', element.dataset.inscode);
                location.reload();
            });
        });
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => { e.preventDefault(); this.switchTab(link.dataset.tab); });
        });
        document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => { toggle.parentElement.classList.toggle('open'); });
        });

        const searchInput = document.getElementById('stock-search');
        let debounceTimeout;
        searchInput.addEventListener('input', e => {
            clearTimeout(debounceTimeout);
            const query = e.target.value.trim();
            if (query.length < 2) {
                document.getElementById('search-results').style.display = 'none'; return;
            }
            debounceTimeout = setTimeout(async () => {
                try {
                    const results = await apiService.getInstrumentSearch(query);
                    this.updateSearchResults(results?.instrumentSearch || []);
                } catch (error) { console.error("Search failed:", error); }
            }, 300);
        });

        const sidebar = document.getElementById('tsetmc-sidebar');
        const overlay = document.getElementById('tsetmc-overlay');
        document.getElementById('hamburger-menu').addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('open');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
        document.getElementById('close-dashboard').addEventListener('click', () => {
            document.getElementById('tsetmc-dashboard-wrapper')?.remove();
        });
    }

    async init() {
        if (!document.getElementById('dashboard-responsive-styles')) {
            this.setupStyles();
        } else {
            this.setupStyles();
        }
        document.body.insertAdjacentHTML('beforeend', this.createDashboardUI());
        
        await this.displayActiveStockName();
        this.setupEventListeners();

        let firstTabName = null;
        const firstItem = this.tabRegistry[0];
        if (firstItem) {
            firstTabName = firstItem.type === 'single' ? firstItem.tab.name : firstItem.tabs[0].name;
            const parentGroup = document.querySelector(`.nav-link[data-tab="${firstTabName}"]`)?.closest('.nav-group');
            parentGroup?.classList.add('open');
        }

        if (firstTabName) {
            await this.switchTab(firstTabName);
        }
    }
}