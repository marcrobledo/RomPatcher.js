/*
* ClientRegistry.js - Central registry for ROM server client modules
* Allows Rom Patcher JS to support multiple ROM server backends
* License: MIT
*/

const ClientRegistry = (function () {
	const _clients = {};

	return {
		register: function (clientModule) {
			if (!clientModule || typeof clientModule.id !== 'string') {
				console.error('[ClientRegistry] Invalid client module (missing id)');
				return false;
			}
			if (_clients[clientModule.id]) {
				console.warn('[ClientRegistry] Client "' + clientModule.id + '" already registered, overwriting');
			}
			_clients[clientModule.id] = clientModule;
			console.log('[ClientRegistry] Registered client "' + clientModule.id + '"');
			return true;
		},

		getClient: function (id) {
			return _clients[id] || null;
		},

		getAllClients: function () {
			return Object.values(_clients);
		},

		getConfiguredClients: function () {
			return Object.values(_clients).filter(function (c) {
				return c.isConfigured && c.isConfigured();
			});
		},

		getActiveClient: function () {
			/* Returns the first configured client, preferring the one that matches the active ROM source */
			const configured = this.getConfiguredClients();
			return configured.length > 0 ? configured[0] : null;
		},

		loadAllSettings: function () {
			const loaded = [];
			Object.values(_clients).forEach(function (client) {
				if (typeof client.loadSettings === 'function') {
					client.loadSettings();
					loaded.push(client.id);
				}
			});
			return loaded;
		},

		saveAllSettings: function () {
			Object.values(_clients).forEach(function (client) {
				if (typeof client.saveSettings === 'function') {
					client.saveSettings();
				}
			});
		}
	};
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = ClientRegistry;
}