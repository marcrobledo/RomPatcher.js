/*
	Cache Service Worker template by mrc 2019
	mostly based in:
	https://github.com/GoogleChrome/samples/blob/gh-pages/service-worker/basic/service-worker.js
	https://github.com/chriscoyier/Simple-Offline-Site/blob/master/js/service-worker.js
	https://gist.github.com/kosamari/7c5d1e8449b2fbc97d372675f16b566e	
	
	Note for GitHub Pages:
	there can be an unexpected behaviour (cache not updating) when site is accessed from
	https://user.github.io/repo/ (without index.html) in some browsers (Firefox)
	use absolute paths if hosted in GitHub Pages in order to avoid it
	also invoke sw with an absolute path:
	navigator.serviceWorker.register('/repo/_cache_service_worker.js', {scope: '/repo/'})
*/


/* MOD: fix old caches for mrc */
caches.keys().then(function(cacheNames){
	for(var i=0; i<cacheNames.length; i++){
		if(
			cacheNames[i]==='runtime' ||
			/^precache-\w+$/.test(cacheNames[i]) ||
			/^precache-editor-([\w\+]+)-\w+$/.test(cacheNames[i]) ||
			/^v?\d+\w?$/.test(cacheNames[i])
		){
			console.log('deleting old cache: '+cacheNames[i]);
			caches.delete(cacheNames[i]);
		}
	}
});

var PRECACHE_ID='rom-patcher-js';
var PRECACHE_VERSION='v7b';
var PRECACHE_URLS=[
	'/RomPatcher.js/','/RomPatcher.js/index.html',
	'/RomPatcher.js/manifest.json',
	'/RomPatcher.js/favicon.png',
	'/RomPatcher.js/logo114.png',
	'/RomPatcher.js/logo144.png',
	'/RomPatcher.js/logo192.png',
	'/RomPatcher.js/RomPatcher.css',
	'/RomPatcher.js/RomPatcher.js',
	'/RomPatcher.js/locale.js',
	'/RomPatcher.js/worker_apply.js',
	'/RomPatcher.js/worker_create.js',
	'/RomPatcher.js/worker_crc.js',
	'/RomPatcher.js/libs/MarcFile.js',
	'/RomPatcher.js/libs/zip.js',
	'/RomPatcher.js/libs/z-worker.js',
	'/RomPatcher.js/libs/inflate.js',
	'/RomPatcher.js/crc.js',
	'/RomPatcher.js/zip.js',
	'/RomPatcher.js/ips.js',
	'/RomPatcher.js/ups.js',
	'/RomPatcher.js/aps.js',
	'/RomPatcher.js/bps.js',
	'/RomPatcher.js/rup.js',
	'/RomPatcher.js/ppf.js',
	'/RomPatcher.js/pmsr.js',
	'/RomPatcher.js/vcdiff.js'
];



// install event (fired when sw is first installed): opens a new cache
self.addEventListener('install', evt => {
	evt.waitUntil(
		caches.open('precache-'+PRECACHE_ID+'-'+PRECACHE_VERSION)
			.then(cache => cache.addAll(PRECACHE_URLS))
			.then(self.skipWaiting())
	);
});


// activate event (fired when sw is has been successfully installed): cleans up old outdated caches
self.addEventListener('activate', evt => {
	evt.waitUntil(
		caches.keys().then(cacheNames => {
			return cacheNames.filter(cacheName => (cacheName.startsWith('precache-'+PRECACHE_ID+'-') && !cacheName.endsWith('-'+PRECACHE_VERSION)));
		}).then(cachesToDelete => {
			return Promise.all(cachesToDelete.map(cacheToDelete => {
				console.log('delete '+cacheToDelete);
				return caches.delete(cacheToDelete);
			}));
		}).then(() => self.clients.claim())
	);
});


// fetch event (fired when requesting a resource): returns cached resource when possible
self.addEventListener('fetch', evt => {
	if(evt.request.url.startsWith(self.location.origin)){ //skip cross-origin requests
		evt.respondWith(
			caches.match(evt.request).then(cachedResource => {
				if (cachedResource) {
					return cachedResource;
				}else{
					return fetch(evt.request);
				}
			})
		);
	}
});