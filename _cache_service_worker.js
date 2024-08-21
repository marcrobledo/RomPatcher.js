/*
	Cache Service Worker for Rom Patcher JS by Marc Robledo
	https://github.com/marcrobledo/RomPatcher.js
	
	Used to cache the webapp files for offline use
*/

var PRECACHE_ID = 'rom-patcher-js';
var PRECACHE_VERSION = 'v30rc3';
var PRECACHE_URLS = [
	'/RomPatcher.js/', '/RomPatcher.js/index.html',
	'/RomPatcher.js/manifest.json',
	/* Rom Patcher JS core (code) */
	'/RomPatcher.js/rom-patcher-js/RomPatcher.js',
	'/RomPatcher.js/rom-patcher-js/RomPatcher.webapp.js',
	'/RomPatcher.js/rom-patcher-js/RomPatcher.webworker.apply.js',
	'/RomPatcher.js/rom-patcher-js/RomPatcher.webworker.create.js',
	'/RomPatcher.js/rom-patcher-js/RomPatcher.webworker.crc.js',
	'/RomPatcher.js/rom-patcher-js/modules/BinFile.js',
	'/RomPatcher.js/rom-patcher-js/modules/HashCalculator.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.ips.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.bps.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.ups.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.aps_n64.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.aps_gba.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.rup.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.ppf.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.pmsr.js',
	'/RomPatcher.js/rom-patcher-js/modules/RomPatcher.format.vcdiff.js',
	'/RomPatcher.js/rom-patcher-js/modules/zip.js/z-worker.js',
	'/RomPatcher.js/rom-patcher-js/modules/zip.js/zip.min.js',
	'/RomPatcher.js/rom-patcher-js/modules/zip.js/inflate.js',
	/* Rom Patcher JS core (web assets) */
	'/RomPatcher.js/rom-patcher-js/assets/icon_alert_orange.svg',
	'/RomPatcher.js/rom-patcher-js/assets/icon_check_circle_green.svg',
	'/RomPatcher.js/rom-patcher-js/assets/icon_upload.svg',
	'/RomPatcher.js/rom-patcher-js/assets/icon_x_circle_red.svg',
	/* webapp assets */
	'/RomPatcher.js/webapp/webapp.js',
	'/RomPatcher.js/webapp/style.css',
	'/RomPatcher.js/webapp/app_icon_16.png',
	'/RomPatcher.js/webapp/app_icon_114.png',
	'/RomPatcher.js/webapp/app_icon_144.png',
	'/RomPatcher.js/webapp/app_icon_192.png',
	'/RomPatcher.js/webapp/app_icon_maskable.png',
	'/RomPatcher.js/webapp/logo.png',
	'/RomPatcher.js/webapp/icon_close.svg',
	'/RomPatcher.js/webapp/icon_github.svg',
	'/RomPatcher.js/webapp/icon_heart.svg',
	'/RomPatcher.js/webapp/icon_settings.svg'
];



// install event (fired when sw is first installed): opens a new cache
self.addEventListener('install', evt => {
	evt.waitUntil(
		caches.open('precache-' + PRECACHE_ID + '-' + PRECACHE_VERSION)
			.then(cache => cache.addAll(PRECACHE_URLS))
			.then(self.skipWaiting())
	);
});


// activate event (fired when sw is has been successfully installed): cleans up old outdated caches
self.addEventListener('activate', evt => {
	evt.waitUntil(
		caches.keys().then(cacheNames => {
			return cacheNames.filter(cacheName => (cacheName.startsWith('precache-' + PRECACHE_ID + '-') && !cacheName.endsWith('-' + PRECACHE_VERSION)));
		}).then(cachesToDelete => {
			return Promise.all(cachesToDelete.map(cacheToDelete => {
				console.log('Delete cache: ' + cacheToDelete);
				return caches.delete(cacheToDelete);
			}));
		}).then(() => self.clients.claim())
	);
});


// fetch event (fired when requesting a resource): returns cached resource when possible
self.addEventListener('fetch', evt => {
	if (evt.request.url.startsWith(self.location.origin)) { //skip cross-origin requests
		evt.respondWith(
			caches.match(evt.request).then(cachedResource => {
				if (cachedResource) {
					return cachedResource;
				} else {
					return fetch(evt.request);
				}
			})
		);
	}
});