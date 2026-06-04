/*
* RomM Settings - Minimal RomM extension for settings UI
* Always loaded. Provides RomM configuration in the settings dialog.
* Full RomM extension is loaded only if RomM is configured.
* License: MIT
*/

(function() {
	const SETTINGS_KEY = 'rom-patcher-js-client-romm';

	/* Load RomM config from localStorage */
	const loadConfig = function() {
		try {
			return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
		} catch(e) { return {}; }
	};

	const saveConfig = function(url, apiKey) {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({
			url: url.replace(/\/+$/, ''),
			apiKey: apiKey
		}));
	};

	const clearConfig = function() {
		localStorage.removeItem(SETTINGS_KEY);
	};

	const showStatus = function(msg, isError) {
		const el = document.getElementById('romm-settings-status');
		const row = document.getElementById('romm-settings-status-row');
		if (el && row) {
			el.textContent = msg;
			el.style.color = isError ? '#ff0030' : 'green';
			row.style.display = '';
			setTimeout(function() { row.style.display = 'none'; }, 5000);
		}
	};

	/* Dynamically load the full RomM extension scripts in dependency order */
	const loadFullExtension = function() {
		if (document.querySelector('script[src*="integration.js"]')) {
			console.log('[ClientIntegration:romm:settings] Full extension already loaded');
			return;
		}
		const scripts = [
			'./src/extensions/registry.js',
			'./src/extensions/romm/client.js',
			'./src/extensions/integration.js',
			'./src/extensions/romm/plugin.js'
		];
		console.log('[ClientIntegration:romm:settings] Loading scripts in order');
		/* Load scripts sequentially via onload chaining to guarantee dependency order */
		let loaded = 0;
		const loadNext = function() {
			if (loaded >= scripts.length) return;
			const src = scripts[loaded];
			loaded++;
			const s = document.createElement('script');
			s.src = src;
			s.onload = function() {
				console.log('[ClientIntegration:romm:settings] Loaded: ' + src);
				loadNext();
			};
			s.onerror = function(e) {
				console.error('[ClientIntegration:romm:settings] Failed to load: ' + src, e);
				loadNext();
			};
			document.head.appendChild(s);
		};
		loadNext();
	};

	/* Check if RomM is configured and load full extension if so */
	const config = loadConfig();
	if (config.url && config.apiKey) {
		console.log('[ClientIntegration:romm:settings] RomM is configured, loading full extension');
		loadFullExtension();
	}

	/* Render settings UI when DOM is ready */
	const init = function() {
		const container = document.getElementById('client-settings-container');
		if (!container) return;

		/* Build the Extensions section with collapsible RomM tab */
		var section = document.createElement('div');
		section.id = 'extensions-settings-section';
		section.innerHTML = [
			'<div class="m-b" style="font-weight:bold;font-size:14px">Extensions</div>',
			'<div id="extensions-tabs" class="m-b" style="display:flex;gap:4px;flex-wrap:wrap">',
				'<button id="ext-tab-romm" class="rom-patcher-btn-small ext-tab active" data-ext="romm" style="font-size:11px;padding:4px 12px">RomM</button>',
				/* Future extension tabs can be added here */
			'</div>',
			'<div id="ext-content-romm" class="ext-content" style="border:1px solid #ddd;border-radius:4px;padding:12px;background:#fafafa">',
				'<div style="margin-bottom:8px">',
					'<label for="romm-settings-url" style="display:block;font-size:12px;margin-bottom:2px">Server URL</label>',
					'<input type="url" id="romm-settings-url" placeholder="https://romm.example.com" style="width:100%;box-sizing:border-box;padding:6px" />',
				'</div>',
				'<div style="margin-bottom:10px">',
					'<label for="romm-settings-api-key" style="display:block;font-size:12px;margin-bottom:2px">API Key</label>',
					'<input type="password" id="romm-settings-api-key" placeholder="romm_xxxxxxxx..." style="width:100%;box-sizing:border-box;padding:6px" />',
				'</div>',
				'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">',
					'<button id="romm-settings-save" class="rom-patcher-btn-small">Save & Reload</button>',
					'<button id="romm-settings-test" class="rom-patcher-btn-small">Test</button>',
					'<button id="romm-settings-export" class="rom-patcher-btn-small">Export</button>',
					'<button id="romm-settings-import" class="rom-patcher-btn-small">Import</button>',
					'<button id="romm-settings-clear" class="rom-patcher-btn-small">Clear</button>',
				'</div>',
				'<div id="romm-settings-status-row" style="display:none;font-size:11px">',
					'<span id="romm-settings-status"></span>',
				'</div>',
			'</div>'
		].join('\n');
		container.appendChild(section);

		/* Tab switching logic */
		var tabs = container.querySelectorAll('.ext-tab');
		var contents = container.querySelectorAll('.ext-content');
		tabs.forEach(function(tab) {
			tab.addEventListener('click', function() {
				var ext = this.dataset.ext;
				tabs.forEach(function(t) { t.classList.remove('active'); t.style.background = ''; });
				this.classList.add('active');
				this.style.background = '#e0e0e0';
				contents.forEach(function(c) { c.style.display = 'none'; });
				var target = document.getElementById('ext-content-' + ext);
				if (target) target.style.display = '';
			});
		});
		/* Style active tab */
		var activeTab = container.querySelector('.ext-tab.active');
		if (activeTab) activeTab.style.background = '#e0e0e0';

		var urlInput = document.getElementById('romm-settings-url');
		var keyInput = document.getElementById('romm-settings-api-key');
		var saveBtn = document.getElementById('romm-settings-save');
		var testBtn = document.getElementById('romm-settings-test');
		var exportBtn = document.getElementById('romm-settings-export');
		var importBtn = document.getElementById('romm-settings-import');
		var clearBtn = document.getElementById('romm-settings-clear');

		/* Load existing values */
		const cfg = loadConfig();
		if (cfg.url) urlInput.value = cfg.url;
		if (cfg.apiKey) keyInput.value = cfg.apiKey;

		/* Save & Reload */
		if (saveBtn) {
			saveBtn.addEventListener('click', function() {
				saveConfig(urlInput.value.trim(), keyInput.value.trim());
				location.reload();
			});
		}

		/* Test Connection */
		if (testBtn) {
			testBtn.addEventListener('click', function() {
				const url = urlInput.value.trim().replace(/\/+$/, '');
				const key = keyInput.value.trim();
				if (!url || !key) {
					showStatus('Please enter both URL and API Key.', true);
					return;
				}
				testBtn.disabled = true;
				testBtn.textContent = 'Testing...';
				/* Use RommClient.testConnection if available (full extension loaded),
				   otherwise fall back to direct fetch (settings-only mode) */
				const runTest = async function() {
					try {
						let version;
						if (typeof RommClient !== 'undefined' && RommClient.isConfigured && RommClient.isConfigured()) {
							version = await RommClient.testConnection();
						} else {
							const r = await fetch(url + '/api/heartbeat', {
								headers: { 'Authorization': 'Bearer ' + key }
							});
							if (!r.ok) throw new Error('HTTP ' + r.status);
							const data = await r.json();
							version = data && data.SYSTEM && data.SYSTEM.VERSION ? data.SYSTEM.VERSION : 'unknown';
						}
						showStatus('Connected! RomM v' + version, false);
					} catch(err) {
						showStatus('Connection failed: ' + err.message, true);
					} finally {
						testBtn.disabled = false;
						testBtn.textContent = 'Test Connection';
					}
				};
				runTest();
			});
		}

		/* Export */
		if (exportBtn) {
			exportBtn.addEventListener('click', function() {
				const cfg = loadConfig();
				if (!cfg.url || !cfg.apiKey) {
					showStatus('No settings to export.', true);
					return;
				}
				var json = JSON.stringify({ url: cfg.url, apiKey: cfg.apiKey }, null, 2);
				var blob = new Blob([json], { type: 'application/json' });
				var url = URL.createObjectURL(blob);
				var a = document.createElement('a');
				a.href = url;
				a.download = 'rompatcher-romm-config.json';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				showStatus('Settings exported.', false);
			});
		}

		/* Import */
		if (importBtn) {
			importBtn.addEventListener('click', function() {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = '.json';
				input.addEventListener('change', function(e) {
					const file = e.target.files[0];
					if (!file) return;
					const reader = new FileReader();
					reader.onload = function(ev) {
						try {
							const data = JSON.parse(ev.target.result);
							if (data.url && data.apiKey) {
								saveConfig(data.url, data.apiKey);
								showStatus('Settings imported. Reloading...', false);
								setTimeout(function() { location.reload(); }, 1000);
							} else {
								showStatus('Invalid config file.', true);
							}
						} catch (err) {
							showStatus('Failed to parse file: ' + err.message, true);
						}
					};
					reader.readAsText(file);
				});
				input.click();
			});
		}

		/* Clear */
		if (clearBtn) {
			clearBtn.addEventListener('click', function() {
				clearConfig();
				location.reload();
			});
		}
	};

	if (document.readyState !== 'loading') {
		init();
	} else {
		document.addEventListener('DOMContentLoaded', init);
	}
})();