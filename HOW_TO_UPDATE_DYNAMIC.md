# راهنمای افزودن و آپدیت کردن تب‌های داینامیک

این سیستم به شما اجازه می‌دهد تا تب‌های جدیدی را به برنامه اضافه کنید **بدون اینکه نیاز به `build` مجدد و انتشار یک نسخه جدید از کل برنامه داشته باشید**. این کار برای اضافه کردن سریع ویژگی‌های جدید مبتنی بر فرانت‌اند بسیار مناسب است.

**مهم:** این روش برای تب‌هایی است که منطق آن‌ها کاملاً با جاوااسکریپت نوشته می‌شود. اگر نیاز به تغییر در بک‌اند Rust دارید، باید از فرآیند آپدیت کامل برنامه استفاده کنید (که در `HOW_TO_UPDATE.md` توضیح داده شده است).

## فرآیند گام به گام

**مرحله ۱: ساخت فایل جاوااسکریپت برای تب جدید**

1.  یک فایل جاوااسکریپت جدید بسازید (مثلاً `MyNewAnalysisTab.js`).
2.  کد تب خود را در این فایل بنویسید. شما باید از ساختار زیر پیروی کنید. می‌توانید از فایل `alirezazangi/tabs/ExampleDynamicTab.js` به عنوان یک الگو استفاده کنید.

    ```javascript
    // MyNewAnalysisTab.js

    // از این خط برای دسترسی به کلاس‌ها و ابزارهای اصلی برنامه استفاده کنید
    const { BaseTab, apiService, utils } = window.tsetmc_deps;

    // کلاس تب شما باید از BaseTab ارث‌بری کند
    export class MyNewAnalysisTab extends BaseTab {
        constructor(stockId) {
            // شناسه منحصر به فرد و عنوان تب را اینجا مشخص کنید
            super('my-new-tab', 'تحلیل جدید من', stockId);
        }

        // متد getTemplate باید ساختار HTML و CSS تب را برگرداند
        getTemplate() {
            return `<div class="widget-card"><h3>اینجا تحلیل جدید من است</h3></div>`;
        }

        // متد init برای اولین بار هنگام باز شدن تب اجرا می‌شود
        async init() {
            // منطق اولیه را اینجا قرار دهید
            console.log('تب جدید من باز شد!');
            await this.update();
        }

        // متد update برای دریافت داده و به‌روزرسانی محتوا استفاده می‌شود
        async update() {
            // می‌توانید از apiService برای فراخوانی بک‌اند Rust استفاده کنید
            const info = await apiService.getInstrumentInfo(this.stockId);
            console.log(info.instrumentInfo.lVal30);
        }
    }
    ```

**مرحله ۲: آپلود فایل جاوااسکریپت روی سرور**

فایل `MyNewAnalysisTab.js` را روی سرور خود آپلود کنید. برای مثال، آن را در مسیر `https://alirezazangi.ir/tabs/MyNewAnalysisTab.js` قرار دهید.

**مرحله ۳: به‌روزرسانی فایل مانیفست (`dynamic-tabs.json`)**

فایل `alirezazangi/dynamic-tabs.json` را باز کرده و اطلاعات تب جدید خود را به آرایه `tabs` اضافه کنید:

```json
{
  "tabs": [
    {
      "id": "example-dynamic-1",
      "name": "تب داینامیک نمونه",
      "className": "ExampleDynamicTab",
      "url": "https://alirezazangi.ir/tabs/ExampleDynamicTab.js",
      "version": "1.0.0",
      "targetGroup": "🛠️ ابزارها و خدمات"
    },
    {
      "id": "my-new-analysis-tab",
      "name": "تحلیل جدید من",
      "className": "MyNewAnalysisTab",
      "url": "https://alirezazangi.ir/tabs/MyNewAnalysisTab.js",
      "version": "1.0.0",
      "targetGroup": "📈 نمودارها و تحلیل تکنیکال"
    }
  ]
}
```

-   **`id`**: یک شناسه منحصر به فرد برای تب شما.
-   **`name`**: عنوانی که در منو نمایش داده می‌شود (این مقدار فعلاً استفاده نمی‌شود و عنوان داخل کلاس اصلی است).
-   **`className`**: نام دقیق کلاسی که در فایل جاوااسکریپت `export` کرده‌اید.
-   **`url`**: آدرس کامل فایل جاوااسکریپت روی سرور شما.
-   **`version`**: شماره نسخه تب. هرگاه کد این تب را تغییر دادید، این شماره را افزایش دهید (مثلاً به `1.0.1`) تا برنامه نسخه جدید را دانلود کند.
-   **`targetGroup`**: نام دقیق گروهی که می‌خواهید تب شما در آن قرار گیرد. اگر گروه وجود نداشته باشد، به صورت خودکار ساخته می‌شود.

**مرحله ۴: آپلود فایل `dynamic-tabs.json`**

فایل `dynamic-tabs.json` ویرایش شده را روی سرور خود در آدرس ریشه (`https://alirezazangi.ir/dynamic-tabs.json`) آپلود کنید.

**تمام شد!** دفعه بعد که کاربران برنامه را اجرا کنند، تب جدید شما به صورت خودکار دانلود شده و در منو ظاهر می‌شود.
