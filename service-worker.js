// نام و نسخه کش را تعریف می‌کنیم
const CACHE_NAME = 'prayer-app-v1';

// لیست فایل‌هایی که می‌خواهیم در مرحله نصب کش شوند
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  // فونت‌ها
  'https://fonts.googleapis.com/css2?family=Amiri&family=Vazirmatn:wght@400;700&display=swap',
  // تصاویر (آیکون‌های برنامه)
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  // منیفست
  '/manifest.json'
];

// فایل‌های صوتی دعاها که باید کش شوند
// این فایل‌ها باید دینامیک کش شوند (هنگامی که کاربر آنها را درخواست می‌کند)
const audioPrayersToCache = [
  'https://erfan.ir/files/sound/mafatih/998_128631_ziarat%20ashoora.mp3',
  'https://example.com/audio/ahd.mp3',
  'https://example.com/audio/kumayl.mp3',
  'https://example.com/audio/tawassul.mp3',
  'https://example.com/audio/sabah.mp3'
];

// رویداد نصب سرویس ورکر
self.addEventListener('install', event => {
  // مرحله نصب را تا اتمام کش شدن منابع تمدید می‌کنیم
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

// رویداد فعال‌سازی سرویس ورکر
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  // مرحله فعال‌سازی را تا اتمام پاکسازی کش‌های قدیمی تمدید می‌کنیم
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // حذف کش‌های قدیمی که در لیست مجاز نیستند
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // اعلام به مرورگر که این سرویس ورکر آماده کنترل کلاینت‌هاست
  return self.clients.claim();
});

// رویداد درخواست منابع
self.addEventListener('fetch', event => {
  // آدرس درخواست را چک می‌کنیم
  const url = new URL(event.request.url);
  
  // اگر درخواست برای فایل صوتی دعا بود
  if (isAudioPrayerRequest(event.request.url)) {
    // استراتژی Cache First برای فایل‌های صوتی دعاها
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // اگر در کش موجود باشد، آن را برمی‌گردانیم
          if (response) {
            return response;
          }
          
          // اگر در کش نباشد، از شبکه دریافت می‌کنیم
          return fetch(event.request).then(networkResponse => {
            // بررسی می‌کنیم آیا پاسخ معتبر است
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // برای کش کردن باید یک کپی از پاسخ ایجاد کنیم
            // چون پاسخ stream است و فقط یکبار قابل استفاده است
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          });
        })
    );
  } else {
    // استراتژی Network First برای سایر درخواست‌ها
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // بررسی می‌کنیم که پاسخ معتبر است
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // کش کردن پاسخ
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // در صورت عدم دسترسی به شبکه، از کش استفاده می‌کنیم
          return caches.match(event.request);
        })
    );
  }
});

// بررسی می‌کند آیا درخواست برای فایل صوتی دعا است
function isAudioPrayerRequest(url) {
  return audioPrayersToCache.some(prayerUrl => url.includes(prayerUrl)) || 
         url.includes('.mp3') || 
         url.includes('/audio/');
}

// پیام‌های ارسالی از صفحه را دریافت می‌کنیم
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // کش کردن یا حذف دعا
  if (event.data.action === 'cachePrayer') {
    const prayerUrl = event.data.url;
    
    if (prayerUrl) {
      if (event.data.cache) {
        // کش کردن فایل صوتی دعا
        caches.open(CACHE_NAME)
          .then(cache => {
            fetch(prayerUrl)
              .then(response => {
                cache.put(prayerUrl, response);
              })
              .catch(err => console.error('Error caching prayer:', err));
          });
      } else {
        // حذف فایل صوتی دعا از کش
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.delete(prayerUrl);
          });
      }
    }
  }
});

// یک رویداد سینک برای همگام‌سازی در پس‌زمینه
self.addEventListener('sync', event => {
  if (event.tag === 'syncUserPreferences') {
    event.waitUntil(syncUserPreferences());
  }
});

// همگام‌سازی تنظیمات کاربر
async function syncUserPreferences() {
  // این تابع می‌تواند تنظیمات کاربر را با سرور همگام‌سازی کند
  // در حال حاضر چیزی پیاده‌سازی نشده است
  console.log('Syncing user preferences in background');
}
