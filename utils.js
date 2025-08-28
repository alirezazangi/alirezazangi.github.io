// ===== UTILITY FUNCTIONS =====

/**
 * Formats a number into a more readable format with Persian units (هزار, میلیون, etc.).
 * @param {number} num The number to format.
 * @param {number} [unitIndex=0] The starting unit index.
 * @returns {string} The formatted number string.
 */
export function formatNumberWithUnit(num, unitIndex = 0) {
    if (num == null || isNaN(num)) {
        return '0';
    }
    const units = [
        ["", "هزار", "میلیون", "میلیارد", "همت"],
        ["", "هزار", "میلیون", "میلیارد", "تریلیارد", "تریلیون"]
    ];

    const isNegative = num < 0;
    num = Math.abs(num);

    let adjustedIndex = unitIndex;
    while (num >= 1000 && adjustedIndex < units[0].length - 1) {
        num /= 1000;
        adjustedIndex++;
    }

    const formattedNum = num.toLocaleString('fa-IR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    const displayUnit = units[1][adjustedIndex] === units[0][adjustedIndex] ? "" : ` (${units[1][adjustedIndex]})`;
    return `${isNegative ? "-" : ""}${formattedNum} ${units[0][adjustedIndex]}${unitIndex === 0 ? displayUnit : ""}`;
}

/**
 * Formats a date number (e.g., 14020105) into a string (e.g., "1402/01/05").
 * @param {number} dEven The date number.
 * @returns {string} The formatted date string.
 */
export function formatDate(dEven) {
    if (!dEven) return '';
    const dateStr = dEven.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}/${month}/${day}`;
}

/**
 * Formats a time number (e.g., 91030) into a string (e.g., "09:10:30").
 * @param {number} hEven The time number.
 * @returns {string} The formatted time string.
 */
export function formatTime(hEven) {
    const timeStr = hEven.toString().padStart(6, '0');
    const hours = timeStr.slice(0, 2);
    const minutes = timeStr.slice(2, 4);
    const seconds = timeStr.slice(4, 6);
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Calculates the percentage change between two values.
 * @param {number} value The current value.
 * @param {number} baseline The baseline value.
 * @returns {string} The percentage change as a formatted string.
 */
export function calculatePercentage(value, baseline) {
    if (baseline === 0 || !baseline) return '0.00';
    return ((value - baseline) / baseline * 100).toFixed(2);
}

/**
 * Creates a styled span for displaying percentage changes (positive/negative).
 * @param {number} percentage The percentage value.
 * @returns {string} The HTML string for the span.
 */
export function formatPercentageSpan(percentage) {
    const p = parseFloat(percentage);
    if (isNaN(p)) return '';
    const color = p >= 0 ? 'positive' : 'negative';
    const sign = p > 0 ? '+' : '';
    return `<span class="${color}">(${sign}${p.toFixed(2)}%)</span>`;
}

/**
 * 📖 **EXPLANATION OF FIX:**
 * The previous version was missing the `export` keyword before the `isMarketHours` function declaration.
 * Without `export`, the function is private to the `utils.js` module and cannot be imported by other files.
 * 
 * 💡 **SOLUTION:**
 * Simply adding `export` before `function isMarketHours()` makes it a "named export",
 * which solves the `SyntaxError`.
 */
export function isMarketHours() {
    const now = new Date();
    const day = now.getDay(); // Sunday: 0, Monday: 1, ..., Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
    const hour = now.getHours();

    // Market workdays in Iran are Saturday to Wednesday
    const isWorkDay = (day >= 0 && day <= 3) || day === 6;
    
    // Market hours are from 9:00 to 15:00 (3 PM)
    const isInMarketHours = hour >= 9 && hour < 15;

    return isWorkDay && isInMarketHours;
}

/**
 * Dynamically loads a script and returns a promise that resolves on load.
 * @param {string} src The URL of the script to load.
 * @param {string} [id] The ID to assign to the script element to prevent duplicates.
 * @returns {Promise<void>}
 */
export function loadScript(src, id) {
    return new Promise((resolve, reject) => {
        if (id && document.getElementById(id)) {
            // Script with this ID already exists, resolve immediately.
            resolve();
            return;
        }
        const script = document.createElement('script');
        if (id) {
            script.id = id;
        }
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Dynamically loads a stylesheet.
 * @param {string} href The URL of the stylesheet to load.
 */
export function loadStyle(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}