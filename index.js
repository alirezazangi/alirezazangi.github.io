

// --- App Data ---
const PRAYER_KEYS = ['ashura', 'ahd', 'tawassul', 'kumayl', 'sabah'];
const PRAYER_METADATA = {}; // Will be populated on startup

// --- Global State ---
let currentPrayerKey = null;
let currentPrayerData = null; // To hold the combined data for the current prayer
let currentAudioUrl = null; // The original, un-proxied URL of the current audio
let wakeLock = null;
let isWakeLockRequested = false; // MODIFIED to track user intent
let scrolling = false;
let cachedAudio = {};
let favorites = new Set();
let customPrayers = {}; // Kept for future compatibility, but not used by creator studio
let fontSizeLevel = 0;
let isFullScreen = false;
let isRepeating = false;
let scrollEndTimer;
let headerTitleTimer = null;
let lastViewedPrayer = null;

// A simple in-memory cache for prayer text data to avoid re-fetching
const prayerDataStore = {};

document.addEventListener('DOMContentLoaded', async function() {
    // --- DOM Element References ---
    const headerTitle = document.querySelector('header h1');
    const mainMenu = document.getElementById('mainMenu');
    const fullPrayerListContainer = document.getElementById('fullPrayerList');
    const favoritesSection = document.getElementById('favoritesSection');
    const favoritesContainer = document.getElementById('favoritesContainer');
    const searchBox = document.querySelector('.search-box');
    const prayerContainer = document.getElementById('prayerContainer');
    const prayerContent = document.getElementById('prayerContent');
    const prayerControls = document.getElementById('prayerControls');
    const settingsPanel = document.getElementById('settingsPanel');
    const audioPlayer = document.getElementById('audioPlayer');
    const backBtn = document.getElementById('backBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const keepScreenOnBtn = document.getElementById('keepScreenOn');
    const cacheNotice = document.getElementById('cacheNotice');
    const removeCacheBtn = document.getElementById('removeCacheBtn');
    const downloadDialog = document.getElementById('downloadDialog');
    const fileSizeSpan = document.getElementById('fileSize');
    const qariNameSpan = document.getElementById('qariName');
    const confirmDownloadBtn = document.getElementById('confirmDownloadBtn');
    const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
    const toggleFa = document.getElementById('toggleFa');
    const toggleEn = document.getElementById('toggleEn');
    const toggleFaLabel = document.getElementById('toggleFaLabel');
    const toggleEnLabel = document.getElementById('toggleEnLabel');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const increaseFontBtn = document.getElementById('increaseFontBtn');
    const decreaseFontBtn = document.getElementById('decreaseFontBtn');
    const prayerFavoriteBtn = document.getElementById('prayerFavoriteBtn');
    const forceClearCacheBtn = document.getElementById('forceClearCacheBtn');
    const exitDialog = document.getElementById('exitDialog');
    const confirmExitBtn = document.getElementById('confirmExitBtn');
    const cancelExitBtn = document.getElementById('cancelExitBtn');
    const toast = document.getElementById('toast');

    // --- Audio Player Controls ---
    const audioControlsContainer = document.getElementById('audioControlsContainer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = document.getElementById('playIcon');
    const audioProgress = document.getElementById('audioProgress');
    const audioProgressContainer = document.querySelector('.audio-progress-container');
    const audioTime = document.getElementById('audioTime');
    const seekBackwardBtn = document.getElementById('seekBackwardBtn');
    const seekForwardBtn = document.getElementById('seekForwardBtn');
    const repeatBtn = document.getElementById('repeatBtn');
    const reciterSelect = document.getElementById('reciterSelect');
    const playbackRateSelect = document.getElementById('playbackRateSelect');

    // --- Initial Setup ---
    await loadInitialMetadata();
    loadSettings();
    populatePrayerMenu();
    initServiceWorker();
    checkWakeLockSupport();
    updateOnlineStatus();
    loadBeautifulFonts();

    // --- Event Listeners ---
    mainMenu.addEventListener('click', handleMenuClick);
    searchBox?.addEventListener('input', filterPrayerList);
    backBtn?.addEventListener('click', () => { exitDialog.style.display = 'flex' });
    confirmExitBtn.addEventListener('click', () => {
        showToast("التماس دعا");
        goBackToMenu();
    });
    cancelExitBtn.addEventListener('click', () => { exitDialog.style.display = 'none'; });
    settingsBtn?.addEventListener('click', () => {
        settingsPanel.style.display = settingsPanel.style.display === 'flex' ? 'none' : 'flex';
    });
    keepScreenOnBtn?.addEventListener('click', toggleWakeLock);
    confirmDownloadBtn?.addEventListener('click', handleDownloadConfirm);
    cancelDownloadBtn?.addEventListener('click', handleDownloadCancel);
    removeCacheBtn?.addEventListener('click', () => cacheCurrentAudio(false));
    forceClearCacheBtn.addEventListener('click', forceClearAllCache);
    toggleFa?.addEventListener('change', () => toggleTranslation('fa', toggleFa.checked));
    toggleEn?.addEventListener('change', () => toggleTranslation('en', toggleEn.checked));
    darkModeToggle?.addEventListener('change', toggleDarkMode);
    increaseFontBtn?.addEventListener('click', () => changeFontSize(1));
    decreaseFontBtn?.addEventListener('click', () => changeFontSize(-1));
    prayerFavoriteBtn.addEventListener('click', () => toggleFavorite(currentPrayerKey));
    audioPlayer?.addEventListener('timeupdate', updateAudioProgress);
    audioPlayer?.addEventListener('ended', onAudioEnded);
    audioPlayer?.addEventListener('loadedmetadata', updateAudioProgress); // Update duration on load
    audioPlayer?.addEventListener('error', handleAudioError);
    prayerContainer?.addEventListener('scroll', handleScroll);
    prayerContent?.addEventListener('click', toggleFullScreen);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    playPauseBtn.addEventListener('click', togglePlayback);
    audioProgressContainer.addEventListener('click', seekAudio);
    seekBackwardBtn.addEventListener('click', () => seekRelative(-5));
    seekForwardBtn.addEventListener('click', () => seekRelative(5));
    repeatBtn.addEventListener('click', toggleRepeat);
    reciterSelect.addEventListener('change', handleReciterChange);
    playbackRateSelect.addEventListener('change', changePlaybackRate);


    // --- Functions ---

    /**
     * Wraps a URL with a CORS proxy to bypass cross-origin restrictions.
     * @param {string} url The original URL.
     * @returns {string} The proxied URL.
     */
    function getProxiedUrl(url) {
        // Using a different proxy that may be more reliable.
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }

    async function loadInitialMetadata() {
        const promises = PRAYER_KEYS.map(key =>
            fetch(`./data/${key}/meta.json`)
            .then(res => res.ok ? res.json() : Promise.reject(`Meta not found for ${key}`))
            .then(meta => {
                PRAYER_METADATA[key] = { key, ...meta };
            })
            .catch(err => console.error(err))
        );
        await Promise.all(promises);
    }

    function populatePrayerMenu() {
        fullPrayerListContainer.innerHTML = '';

        let prayerKeys = Object.keys(PRAYER_METADATA);
        prayerKeys.sort((a, b) => {
            if (a === lastViewedPrayer) return -1;
            if (b === lastViewedPrayer) return 1;
            return 0;
        });

        for (const key of prayerKeys) {
            const prayer = PRAYER_METADATA[key];
            if (!prayer) continue;

            const menuItem = createMenuItem(key, prayer);
            fullPrayerListContainer.appendChild(menuItem);
        }
        renderFavorites();
    }


    function createMenuItem(key, prayer) {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        menuItem.setAttribute('data-prayer', key);
        
        menuItem.innerHTML = `
            <span class="favorite-star" data-prayer-key="${key}">☆</span>
            <div class="menu-item-icon">${prayer.icon || '📜'}</div>
            <div class="menu-item-name">${prayer.name}</div>
        `;
        return menuItem;
    }

    function handleMenuClick(e) {
        const star = e.target.closest('.favorite-star');
        if (star) {
            e.stopPropagation();
            toggleFavorite(star.dataset.prayerKey);
            return;
        }

        const menuItem = e.target.closest('.menu-item');
        if (!menuItem) return;

        const prayerKey = menuItem.dataset.prayer;
        if (prayerKey) {
            loadPrayer(prayerKey);
        }
    }
    
    function toggleFavorite(prayerKey) {
        if (!prayerKey) return;
        favorites.has(prayerKey) ? favorites.delete(prayerKey) : favorites.add(prayerKey);
        localStorage.setItem('favorites', JSON.stringify(Array.from(favorites)));
        if (prayerKey === currentPrayerKey) updatePrayerFavoriteButton();
        renderFavorites();
    }

    function renderFavorites() {
        favoritesContainer.innerHTML = '';
        document.querySelectorAll('.favorite-star').forEach(star => {
            star.classList.remove('favorited');
            star.textContent = '☆';
        });

        if (favorites.size > 0) {
            favoritesSection.style.display = 'block';
            favorites.forEach(prayerKey => {
                const originalStar = document.querySelector(`.favorite-star[data-prayer-key="${prayerKey}"]`);
                if (originalStar) {
                    originalStar.classList.add('favorited');
                    originalStar.textContent = '★';
                }
                const prayerData = PRAYER_METADATA[prayerKey];
                if (prayerData) {
                    const menuItem = createMenuItem(prayerKey, prayerData);
                    menuItem.querySelector('.favorite-star').classList.add('favorited');
                    menuItem.querySelector('.favorite-star').textContent = '★';
                    favoritesContainer.appendChild(menuItem);
                }
            });
        } else {
            favoritesSection.style.display = 'none';
        }
    }

    async function fetchPrayerData(prayerKey) {
        if (prayerDataStore[prayerKey]) return prayerDataStore[prayerKey];

        const meta = PRAYER_METADATA[prayerKey];
        if (!meta) throw new Error("Metadata not found");
        
        const data = { ...meta, verses: {} };
        const filesToFetch = {
            arabic: `./data/${prayerKey}/arabic.txt`,
            farsi: `./data/${prayerKey}/farsi.txt`,
            english: `./data/${prayerKey}/english.txt`,
        };

        const promises = Object.entries(filesToFetch).map(async ([lang, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return; // File might not exist (e.g., english.txt)
                const text = await response.text();
                data.verses[lang] = text.split('\n').filter(Boolean);
            } catch (e) {
                console.warn(`Could not load ${lang} for ${prayerKey}`);
            }
        });

        await Promise.all(promises);
        prayerDataStore[prayerKey] = data;
        return data;
    }

    async function loadPrayer(prayerKey) {
        try {
            const prayer = await fetchPrayerData(prayerKey);
            currentPrayerKey = prayerKey;
            currentPrayerData = prayer;

            localStorage.setItem('lastViewedPrayer', prayerKey);
            lastViewedPrayer = prayerKey;

            // UI updates
            mainMenu.style.display = 'none';
            prayerContainer.style.display = 'block';
            prayerControls.style.display = 'flex';
            audioControlsContainer.style.display = 'flex';

            clearTimeout(headerTitleTimer);
            headerTitle.textContent = currentPrayerData.name;
            headerTitleTimer = setTimeout(() => { headerTitle.textContent = 'دعا و زیارت'; }, 60000);

            updatePrayerFavoriteButton();
            setupReciterSelector();
            await handleReciterChange();

            // Render content
            renderPrayerContent();
            prayerContainer.scrollTop = 0;

        } catch (error) {
            console.error("Could not load prayer:", error);
            alert("خطا در بارگیری اطلاعات دعا.");
            goBackToMenu();
        }
    }

    function renderPrayerContent() {
        prayerContent.innerHTML = '';
        const arabicVerses = currentPrayerData.verses.arabic || [];
        const farsiVerses = currentPrayerData.verses.farsi || [];
        const englishVerses = currentPrayerData.verses.english || [];
        const timings = currentPrayerData.verses.timings || [];
        
        const hasFarsi = farsiVerses.length > 0;
        const hasEnglish = englishVerses.length > 0;
        toggleFaLabel.style.display = hasFarsi ? 'flex' : 'none';
        toggleEnLabel.style.display = hasEnglish ? 'flex' : 'none';

        arabicVerses.forEach((verse, index) => {
            const verseElement = document.createElement('div');
            verseElement.className = 'prayer-block';
            verseElement.dataset.index = index;
            if (timings[index] !== undefined) {
                verseElement.dataset.time = timings[index];
            }

            let html = `<div class="prayer-text">${verse}</div>`;
            if(hasFarsi) html += `<div class="translation translation-fa" style="display: ${toggleFa.checked ? 'block' : 'none'};">${farsiVerses[index] || ''}</div>`;
            if(hasEnglish) html += `<div class="translation translation-en" style="display: ${toggleEn.checked ? 'block' : 'none'};">${englishVerses[index] || ''}</div>`;

            verseElement.innerHTML = html;
            
            verseElement.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.prayer-block').forEach(b => b.classList.remove('highlighted'));
                verseElement.classList.add('highlighted');
                if (verseElement.dataset.time) {
                    const newTime = parseInt(verseElement.dataset.time, 10) / 1000;
                    if (audioPlayer.readyState > 0 && isFinite(newTime)) {
                        audioPlayer.currentTime = newTime;
                    }
                }
            });
            prayerContent.appendChild(verseElement);
        });
    }

    function updatePrayerFavoriteButton() {
        const favIcon = prayerFavoriteBtn.querySelector('.btn-icon');
        if (favorites.has(currentPrayerKey)) {
            prayerFavoriteBtn.classList.add('favorited');
            favIcon.textContent = '★';
        } else {
            prayerFavoriteBtn.classList.remove('favorited');
            favIcon.textContent = '☆';
        }
    }

    function goBackToMenu() {
        audioPlayer.pause();
        audioPlayer.src = '';
        currentAudioUrl = null; // Reset audio state
        clearTimeout(headerTitleTimer);
        headerTitle.textContent = 'دعا و زیارت';
        playIcon.textContent = '▶️';
        prayerContainer.style.display = 'none';
        prayerControls.style.display = 'none';
        settingsPanel.style.display = 'none';
        audioControlsContainer.style.display = 'none';
        exitDialog.style.display = 'none';
        mainMenu.style.display = 'flex';
        populatePrayerMenu();
        if (isWakeLockRequested) {
            releaseWakeLock();
        }
        if (isFullScreen) exitFullScreen();
    }

    // --- Audio Player Logic ---
    function handleAudioError() {
        console.error('Error playing audio:', audioPlayer.error?.message || 'Unknown error');
        if (audioPlayer.error) {
            switch (audioPlayer.error.code) {
                case audioPlayer.error.MEDIA_ERR_ABORTED:
                    console.error('Playback aborted by user.');
                    break;
                case audioPlayer.error.MEDIA_ERR_NETWORK:
                    console.error('A network error occurred.');
                    break;
                case audioPlayer.error.MEDIA_ERR_DECODE:
                    console.error('Media decoding error.');
                    break;
                case audioPlayer.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    console.error('Source not supported. The URL might be invalid or the format not supported.');
                    break;
                default:
                    console.error('An unknown audio error occurred.');
                    break;
            }
        }
        playIcon.textContent = '▶️';
        alert('خطا در بارگیری فایل صوتی. لطفاً اتصال اینترنت خود را بررسی کرده و یا قاری دیگری را امتحان کنید.');
    }
    
    async function togglePlayback() {
        if (!currentAudioUrl) return; // Guard against no source
        if (audioPlayer.paused) {
            const currentReciter = currentPrayerData.reciters[reciterSelect.selectedIndex];
            if (!cachedAudio[currentReciter.audioUrl]) {
                qariNameSpan.textContent = currentReciter.name || 'پیش‌فرض';
                fileSizeSpan.textContent = '...'; // loading state
                downloadDialog.style.display = 'flex';

                const size = await getAudioFileSize(currentReciter.audioUrl);
                fileSizeSpan.textContent = size ? `${size}` : 'نامشخص';

            } else {
                startPlayback();
            }
        } else {
            audioPlayer.pause();
            playIcon.textContent = '▶️';
        }
    }
    
    function startPlayback() {
        audioPlayer.play().catch(err => {
            console.error('Error playing audio:', err.message);
            // The handleAudioError function will also catch this and show an alert.
            playIcon.textContent = '▶️';
        });
        playIcon.textContent = '⏸️';
    }

    function onAudioEnded() {
        if (isRepeating) {
            audioPlayer.currentTime = 0;
            audioPlayer.play();
        } else {
            playIcon.textContent = '▶️';
            document.querySelectorAll('.prayer-block.reading').forEach(b => b.classList.remove('reading'));
        }
    }

    function updateAudioProgress() {
        if (isFinite(audioPlayer.duration)) {
            const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            audioProgress.style.width = percentage + '%';
            
            const formatTime = (time) => {
                const minutes = Math.floor(time / 60);
                const seconds = Math.floor(time % 60);
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            };
            audioTime.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
            updateCurrentVerseHighlight();
        } else {
            audioTime.textContent = '00:00 / --:--';
        }
    }
    
    function seekAudio(e) {
        if (audioPlayer.readyState >= 1 && isFinite(audioPlayer.duration)) {
            const rect = audioProgressContainer.getBoundingClientRect();
            const position = (e.clientX - rect.left) / rect.width;
            const newTime = position * audioPlayer.duration;
            if (isFinite(newTime)) {
                audioPlayer.currentTime = newTime;
            }
        }
    }

    function seekRelative(seconds) {
        if (audioPlayer.readyState > 0 && isFinite(audioPlayer.currentTime)) {
            let newTime = audioPlayer.currentTime + seconds;
            newTime = Math.max(0, newTime); // Don't go below 0
            if (isFinite(audioPlayer.duration)) {
                newTime = Math.min(newTime, audioPlayer.duration); // Don't go past the end
            }
            audioPlayer.currentTime = newTime;
        }
    }
    
    function toggleRepeat() {
        isRepeating = !isRepeating;
        repeatBtn.classList.toggle('active', isRepeating);
    }

    function setupReciterSelector() {
        reciterSelect.innerHTML = '';
        currentPrayerData.reciters.forEach((reciter, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = reciter.name || `قاری ${index + 1}`;
            reciterSelect.appendChild(option);
        });
    }
    
    async function handleReciterChange() {
        const selectedIndex = reciterSelect.selectedIndex;
        const selectedReciter = currentPrayerData.reciters[selectedIndex];
        
        await loadTimingsForReciter(selectedReciter);
        renderPrayerContent(); // Re-render to apply new timings to data attributes

        if (selectedReciter && currentAudioUrl !== selectedReciter.audioUrl) {
            audioPlayer.pause();
            playIcon.textContent = '▶️';
            currentAudioUrl = selectedReciter.audioUrl;
            audioPlayer.src = getProxiedUrl(currentAudioUrl);
            audioPlayer.load();
            updateCacheStatus();
        }
    }

    async function loadTimingsForReciter(reciter) {
        if (!reciter || !reciter.timingKey) {
            console.warn('Reciter has no timingKey, clearing timings.');
            currentPrayerData.verses.timings = [];
            return;
        }
        try {
            const url = `./data/${currentPrayerKey}/timings_${reciter.timingKey}.json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Timings file not found at ${url}`);
            const timings = await response.json();
            currentPrayerData.verses.timings = timings;
        } catch (e) {
            console.error(`Could not load timings for ${reciter.name}:`, e);
            currentPrayerData.verses.timings = []; // Fallback to no timings
        }
    }

    function updateCurrentVerseHighlight() {
        if (audioPlayer.paused || scrolling || !currentPrayerData?.verses?.timings) return;
        const currentTime = audioPlayer.currentTime * 1000;
        const verses = prayerContent.querySelectorAll('.prayer-block');
        let activeVerse = null;

        verses.forEach((verse) => {
            const startTime = parseInt(verse.dataset.time || '0', 10);
            if (startTime <= currentTime) {
                activeVerse = verse;
            }
            verse.classList.remove('reading');
        });

        if (activeVerse) {
            activeVerse.classList.add('reading');
            activeVerse.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // --- Settings & Cache ---
    function loadSettings() {
        cachedAudio = JSON.parse(localStorage.getItem('cachedAudio') || '{}');
        favorites = new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
        lastViewedPrayer = localStorage.getItem('lastViewedPrayer');
        
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.body.classList.add('dark-mode');
            darkModeToggle.checked = true;
        }
        fontSizeLevel = parseInt(localStorage.getItem('fontSize') || '0', 10);
        updateFontSize();
        toggleFa.checked = localStorage.getItem('showFarsi') !== 'false';
        toggleEn.checked = localStorage.getItem('showEnglish') === 'true';

        const savedRate = localStorage.getItem('playbackRate') || '1';
        audioPlayer.playbackRate = parseFloat(savedRate);
        playbackRateSelect.value = savedRate;
    }

    function toggleTranslation(lang, show) {
        document.querySelectorAll(`.translation-${lang}`).forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
        localStorage.setItem(lang === 'fa' ? 'showFarsi' : 'showEnglish', show.toString());
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    }
    
    function changeFontSize(delta) {
        fontSizeLevel += delta;
        fontSizeLevel = Math.max(-3, Math.min(5, fontSizeLevel)); // Clamp value
        updateFontSize();
        localStorage.setItem('fontSize', fontSizeLevel.toString());
    }

    function changePlaybackRate(e) {
        const rate = parseFloat(e.target.value);
        audioPlayer.playbackRate = rate;
        localStorage.setItem('playbackRate', rate);
    }

    function updateFontSize() {
        const baseFontSize = 1.8;
        const newSize = baseFontSize + (fontSizeLevel * 0.2);
        document.documentElement.style.setProperty('--font-size-normal', `${newSize}rem`);
    }

    function handleDownloadConfirm() {
        downloadDialog.style.display = 'none';
        cacheCurrentAudio(true);
        startPlayback();
    }
    
    function handleDownloadCancel() {
        downloadDialog.style.display = 'none';
        startPlayback(); // Stream without caching
    }

    async function getAudioFileSize(url) {
        try {
            const proxiedUrl = getProxiedUrl(url);
            const response = await fetch(proxiedUrl, { method: 'HEAD' });
            if (response.ok) {
                const size = response.headers.get('Content-Length');
                if (size) {
                    return (parseInt(size, 10) / (1024 * 1024)).toFixed(1); // MB
                }
            }
        } catch (e) {
            console.warn('Could not get file size via HEAD, trying GET...');
            // Fallback to GET if HEAD fails (some servers/proxies don't support it)
            try {
                const response = await fetch(getProxiedUrl(url));
                 if (response.ok) {
                    const size = response.headers.get('Content-Length');
                    if (size) return (parseInt(size, 10) / (1024 * 1024)).toFixed(1);
                 }
            } catch (getErr) {
                 console.error('Could not get file size via GET either.', getErr);
            }
        }
        return null; // Return null on any failure
    }

    function cacheCurrentAudio(shouldCache) {
        const audioUrl = currentAudioUrl;
        if (!audioUrl) return;

        // Use the original URL as the key for our internal state
        cachedAudio[audioUrl] = shouldCache;
        localStorage.setItem('cachedAudio', JSON.stringify(cachedAudio));

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            // But tell the service worker to fetch and cache the proxied URL
            navigator.serviceWorker.controller.postMessage({
                action: 'cachePrayer',
                url: getProxiedUrl(audioUrl),
                cache: shouldCache
            });
        }
        updateCacheStatus();
    }
    
    function updateCacheStatus() {
        if (!currentAudioUrl) return;
        cacheNotice.style.display = cachedAudio[currentAudioUrl] ? 'flex' : 'none';
    }

    async function forceClearAllCache() {
        if (!confirm("آیا مطمئن هستید که می‌خواهید تمام اطلاعات ذخیره شده را پاک کنید؟ این عمل غیرقابل بازگشت است.")) return;
        
        try {
            // Clear localStorage
            localStorage.removeItem('cachedAudio');
            cachedAudio = {};
            
            // Clear caches via Service Worker
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ action: 'clearAllCache' });
            } else if ('caches' in window) { // Fallback for direct cache access
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
            alert("حافظه با موفقیت پاک شد. برنامه مجددا بارگیری می‌شود.");
            window.location.reload();
        } catch (error) {
            console.error("Failed to clear cache:", error);
            alert("خطا در پاک کردن حافظه.");
        }
    }


    // --- Misc Functions ---
    let toastTimer;
    function showToast(message) {
        if (!toast) return;
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add('show');
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }
    
    function checkWakeLockSupport() {
        if ('wakeLock' in navigator) {
            keepScreenOnBtn.style.display = 'block';
        } else {
            keepScreenOnBtn.style.display = 'none';
        }
    }

    async function acquireWakeLock() {
        if (!isWakeLockRequested || document.visibilityState !== 'visible') return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            keepScreenOnBtn.innerHTML = `<span class="btn-icon">💡</span> روشن`;
            wakeLock.addEventListener('release', () => {
                if (isWakeLockRequested) {
                    keepScreenOnBtn.innerHTML = `<span class="btn-icon">💡</span>`;
                }
            });
        } catch (err) {
            console.error(`Wake Lock failed: ${err.name}, ${err.message}`);
            if (err.name === 'NotAllowedError') {
                console.warn('Wake Lock permission denied. Hiding button.');
                keepScreenOnBtn.style.display = 'none';
            }
            isWakeLockRequested = false;
            keepScreenOnBtn.innerHTML = `<span class="btn-icon">💡</span>`;
        }
    }

    async function releaseWakeLock() {
        isWakeLockRequested = false;
        if (wakeLock !== null) {
            await wakeLock.release();
            wakeLock = null;
        }
        keepScreenOnBtn.innerHTML = `<span class="btn-icon">💡</span>`;
    }

    async function toggleWakeLock() {
        if (isWakeLockRequested) {
            await releaseWakeLock();
        } else {
            isWakeLockRequested = true;
            await acquireWakeLock();
        }
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'visible' && isWakeLockRequested) {
            acquireWakeLock();
        }
    }
    
    function enterFullScreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    }
    function exitFullScreen() {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
    function toggleFullScreen() {
        isFullScreen ? exitFullScreen() : enterFullScreen();
    }
    document.addEventListener('fullscreenchange', () => {
        isFullScreen = !!document.fullscreenElement;
        document.body.classList.toggle('fullscreen-mode', isFullScreen);
    });

    function filterPrayerList(e) {
        const query = e.target.value.toLowerCase().trim();
        const items = fullPrayerListContainer.querySelectorAll('.menu-item');
        items.forEach(item => {
            const name = item.querySelector('.menu-item-name').textContent.toLowerCase();
            const match = name.includes(query);
            item.style.display = match ? 'flex' : 'none';
        });
        const favItems = favoritesContainer.querySelectorAll('.menu-item');
        favItems.forEach(item => {
            const name = item.querySelector('.menu-item-name').textContent.toLowerCase();
            const match = name.includes(query);
            item.style.display = match ? 'flex' : 'none';
        });
    }

    function updateOnlineStatus() {}
    function handleScroll() {
        scrolling = true;
        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => { scrolling = false; }, 250);
    }
    function loadBeautifulFonts() {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Vazirmatn:wght@400;700&family=Noto+Naskh+Arabic:wght@700&display=swap';
        document.head.appendChild(fontLink);
    }
});

function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registered!', reg);
        }).catch(err => console.log('SW registration failed: ', err));
    }
}