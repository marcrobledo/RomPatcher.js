/*
* Rom Patcher JS - Client Integration Framework
* Shared logic for integrating ROM server clients (RomM, etc.) into RomPatcherWeb
* License: MIT
*/

const ClientIntegration = (function () {
	/* ---- QR Code generation (inline, no external dependency) ---- */
	const QR = (function () {
		const QR_ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
		const _getTotalDataCodewords = function (version) {
			const eccBlocks = [
				[[19, 16, 13, 9], [34, 28, 22, 16], [55, 44, 34, 26], [80, 64, 48, 36], [108, 86, 62, 46], [136, 108, 76, 60]],
				[[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 2, 2], [1, 2, 2, 4], [1, 2, 4, 4], [2, 4, 4, 4]]
			];
			return eccBlocks[0][version - 1][0];
		};
		const _makeImpl = function (text) {
			var i, j, len = text.length, version = 1;
			if (len > 25) version = 2;
			if (len > 47) version = 3;
			if (len > 77) version = 4;
			if (len > 114) version = 5;
			if (len > 154) version = 6;
			var size = version * 4 + 17;
			var matrix = [];
			for (i = 0; i < size; i++) { matrix[i] = []; for (j = 0; j < size; j++) matrix[i][j] = 0; }
			var _putFinder = function (row, col) { for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) { if (row + r < 0 || row + r >= size || col + c < 0 || col + c >= size) continue; if (r >= 0 && r <= 6 && c >= 0 && c <= 6) matrix[row + r][col + c] = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0; } };
			_putFinder(0, 0); _putFinder(0, size - 7); _putFinder(size - 7, 0);
			for (i = 8; i < size - 8; i++) matrix[6][i] = matrix[i][6] = (i % 2 === 0) ? 1 : 0;
			var bitStream = [], isAlphaNum = true;
			for (i = 0; i < len && isAlphaNum; i++) if (QR_ALPHANUM.indexOf(text[i].toUpperCase()) === -1) isAlphaNum = false;
			var mode = isAlphaNum ? 2 : 4, _bits = function (val, n) { for (var b = n - 1; b >= 0; b--) bitStream.push((val >> b) & 1); };
			var bc = version <= 9 ? (isAlphaNum ? 9 : 8) : (isAlphaNum ? 11 : 16);
			_bits(mode, 4); _bits(len, bc);
			if (isAlphaNum) { for (i = 0; i + 1 < len; i += 2) _bits(QR_ALPHANUM.indexOf(text[i].toUpperCase()) * 45 + QR_ALPHANUM.indexOf(text[i + 1].toUpperCase()), 11); if (len % 2 === 1) _bits(QR_ALPHANUM.indexOf(text[len - 1].toUpperCase()), 6); }
			else { for (i = 0; i < len; i++) _bits(text.charCodeAt(i), 8); }
			var dataCodewords = _getTotalDataCodewords(version), totalBits = dataCodewords * 8;
			while (bitStream.length < totalBits) bitStream.push(0);
			var codewords = [];
			for (i = 0; i < dataCodewords; i++) { var bv = 0; for (j = 0; j < 8; j++) bv = (bv << 1) | (bitStream[i * 8 + j] || 0); codewords.push(bv); }
			var row = size - 1, col = size - 1, dir = -1;
			for (i = 0; i < codewords.length && row > 0; i++) { for (j = 7; j >= 0; j--) { var bit = (codewords[i] >> j) & 1; while ((row === 6) || (col === 6) || (row >= 0 && row <= 8 && col >= 0 && col <= 8) || (row >= 0 && row <= 8 && col >= size - 8 && col <= size - 1) || (row >= size - 8 && row <= size - 1 && col >= 0 && col <= 8)) { col += dir; if (col < 0 || col >= size) { col = dir === -1 ? 0 : size - 1; row--; if (row === 6) row--; dir = -dir; } } if (row >= 0 && row < size && col >= 0 && col < size) matrix[row][col] = bit; col += dir; if (col < 0 || col >= size) { col = dir === -1 ? 0 : size - 1; row--; if (row === 6) row--; dir = -dir; } } }
			for (i = 0; i < size; i++) for (j = 0; j < size; j++) if ((i + j) % 2 === 0 && matrix[i][j] !== 2) matrix[i][j] = matrix[i][j] ? 0 : 1;
			var fmt = [1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1];
			for (i = 0; i < 15; i++) { if (i < 6) { matrix[8][i] = fmt[i]; } else if (i < 8) { matrix[8][i + 1] = fmt[i]; } else { matrix[8][size - 15 + i] = fmt[i]; } if (i < 6) { matrix[i][8] = fmt[i]; } else if (i < 8) { matrix[i + 1][8] = fmt[i]; } else { matrix[size - 15 + i][8] = fmt[i]; } }
			return matrix;
		};
		return { generate: function (canvas, text, size) { size = size || 256; var matrix = _makeImpl(text), mSize = matrix.length, cell = Math.floor(size / mSize), as = cell * mSize; canvas.width = canvas.height = as; var ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, as, as); ctx.fillStyle = '#000000'; for (var r = 0; r < mSize; r++) for (var c = 0; c < mSize; c++) if (matrix[r][c]) ctx.fillRect(c * cell, r * cell, cell, cell); } };
	})();

	/* ---- State ---- */
	const _state = { selectedRom: null, patchedRom: null, sourcePlatformId: null, clientId: null };
	let _cachedHashes = null;
	let _searchMode = 'hash'; /* 'hash' or 'name' */

	/* Flag to suppress BinFile.prototype.save during _applyPatchAndRun */
	let _suppressSave = false;

	/* Extract validation hashes from a parsedPatch */
	const _cacheHashesFromPatch = function (parsedPatch) {
		_cachedHashes = null;
		if (!parsedPatch || typeof parsedPatch.getValidationInfo !== 'function') return;
		try {
			const info = parsedPatch.getValidationInfo();
			if (!info) return;
			const hashes = {};
			const crcValue = Array.isArray(info.value) ? info.value[0] : info.value;
			if (info.type === 'CRC32' && crcValue != null) {
				const crcHex = (typeof crcValue === 'number' ? crcValue.toString(16) : String(crcValue)).padStart(8, '0');
				hashes.crc_hash = crcHex;
			} else if (info.type === 'MD5' && crcValue != null) {
				hashes.md5_hash = String(crcValue).toLowerCase().replace('0x', '');
			} else if (info.type === 'SHA1' && crcValue != null) {
				hashes.sha1_hash = String(crcValue).toLowerCase();
			}
			if (Object.keys(hashes).length) _cachedHashes = hashes;
		} catch (e) {
			console.warn('[ClientIntegration] Failed to extract hashes from patch:', e.message);
		}
	};

	/* Parse hash string */
	const _parseHashStr = function (str) {
		str = str.trim().replace('0x', '').toLowerCase();
		if (/^[0-9a-f]{8}$/.test(str)) return { crc_hash: str };
		if (/^[0-9a-f]{32}$/.test(str)) return { md5_hash: str };
		if (/^[0-9a-f]{40}$/.test(str)) return { sha1_hash: str };
		return null;
	};

	/* ---- ZIP creation using zip-native.min.js ---- */
	const _createZip = async function (binFile, zipFileName, callback) {
		try {
			const writer = new zip.ZipWriter(new zip.BlobWriter());
			await writer.add(zipFileName, new zip.Uint8ArrayReader(binFile._u8array));
			const blob = await writer.close();
			const arrayBuffer = await blob.arrayBuffer();
			callback(arrayBuffer);
		} catch (error) {
			console.error('[ClientIntegration] Error creating zip:', error);
			/* Fallback to uncompressed */
			callback(binFile._u8array.buffer);
		}
	};

	/* Show a status message in the settings area */
	const _showStatus = function (msg, isError) {
		const el = document.getElementById('settings-client-status');
		const row = document.getElementById('settings-client-status-row');
		if (el && row) { el.textContent = msg; el.style.color = isError ? 'var(--rom-patcher-color-danger, #ff0030)' : 'green'; row.style.display = ''; setTimeout(function () { row.style.display = 'none'; }, 5000); }
	};

	/* Dynamically render client settings in the settings dialog */
	const _renderClientSettings = function (clientId) {
		const client = ClientRegistry.getClient(clientId);
		if (!client) return;
		const container = document.getElementById('client-settings-container');
		if (!container) return;
		container.innerHTML = '';
		const heading = document.createElement('div');
		heading.className = 'row row-lg m-b';
		heading.innerHTML = '<div></div><div><strong>' + (client.name || clientId) + ' Settings</strong></div>';
		container.appendChild(heading);
		const fieldValues = {};
		if (Array.isArray(client.settingsFields)) {
			client.settingsFields.forEach(function (field) {
				var row = document.createElement('div');
				row.className = 'row row-lg m-b';
				var labelCol = document.createElement('div');
				labelCol.innerHTML = '<label for="settings-client-field-' + field.id + '">' + field.label + '</label>';
				row.appendChild(labelCol);
				var inputCol = document.createElement('div');
				var input = document.createElement('input');
				input.type = field.type || 'text';
				input.id = 'settings-client-field-' + field.id;
				input.placeholder = field.placeholder || '';
				input.style.cssText = 'width:100%;box-sizing:border-box';
				inputCol.appendChild(input);
				row.appendChild(inputCol);
				container.appendChild(row);
				fieldValues[field.id] = input;
			});
		}
		const btnRow = document.createElement('div');
		btnRow.className = 'row row-lg m-b';
		const emptyCol = document.createElement('div');
		btnRow.appendChild(emptyCol);
		const btnCol = document.createElement('div');
		const testBtn = document.createElement('button'); testBtn.id = 'settings-client-test'; testBtn.className = 'rom-patcher-btn-small'; testBtn.textContent = 'Test Connection'; btnCol.appendChild(testBtn);
		const exportBtn = document.createElement('button'); exportBtn.id = 'settings-client-export'; exportBtn.className = 'rom-patcher-btn-small'; exportBtn.textContent = 'Export'; btnCol.appendChild(exportBtn);
		const importBtn = document.createElement('button'); importBtn.id = 'settings-client-import'; importBtn.className = 'rom-patcher-btn-small'; importBtn.textContent = 'Import'; btnCol.appendChild(importBtn);
		const qrBtn = document.createElement('button'); qrBtn.id = 'settings-client-qr'; qrBtn.className = 'rom-patcher-btn-small'; qrBtn.textContent = 'Show QR'; btnCol.appendChild(qrBtn);
		btnRow.appendChild(btnCol);
		container.appendChild(btnRow);
		var statusRow = document.createElement('div'); statusRow.className = 'row row-lg m-b'; statusRow.id = 'settings-client-status-row'; statusRow.style.display = 'none'; var emptyCol2 = document.createElement('div'); statusRow.appendChild(emptyCol2); var statusCol = document.createElement('div'); statusCol.id = 'settings-client-status'; statusCol.className = 'text-muted'; statusCol.style.cssText = 'font-size:12px'; statusRow.appendChild(statusCol); container.appendChild(statusRow);
		var qrContainer = document.createElement('div'); qrContainer.id = 'settings-client-qr-container'; qrContainer.style.cssText = 'display:none;text-align:center'; qrContainer.className = 'm-b'; var qrCanvas = document.createElement('canvas'); qrCanvas.id = 'settings-client-qr-canvas'; qrContainer.appendChild(qrCanvas); container.appendChild(qrContainer);
		client.settingsFields.forEach(function (field) { var inp = fieldValues[field.id]; if (inp && typeof client['_' + field.id] !== 'undefined') inp.value = client['_' + field.id] || ''; });
		var _saveOnChange = function () { client.settingsFields.forEach(function (f) { var inp = fieldValues[f.id]; if (inp) { client['_' + f.id] = inp.value.trim(); client.configure(client._url, client._apiKey); } }); client.saveSettings(); };
		client.settingsFields.forEach(function (f) { var inp = fieldValues[f.id]; if (inp) inp.addEventListener('change', _saveOnChange); });
		testBtn.addEventListener('click', async function () {
			client.settingsFields.forEach(function (f) { var inp = fieldValues[f.id]; if (inp) client['_' + f.id] = inp.value.trim(); });
			if (!client.isConfigured()) { _showStatus('Please fill in all fields.', true); return; }
			testBtn.disabled = true; testBtn.textContent = 'Testing...';
			try { var version = await client.testConnection(); _showStatus('Connected! ' + (client.name || clientId) + ' v' + version, false); }
			catch (e) { _showStatus('Connection failed: ' + e.message, true); }
			finally { testBtn.disabled = false; testBtn.textContent = 'Test Connection'; }
		});
		exportBtn.addEventListener('click', function () {
			try { var json = client.exportSettings ? client.exportSettings() : JSON.stringify(client.settings, null, 2); var blob = new Blob([json], { type: 'application/json' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'rompatcher-' + clientId + '-config.json'; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a); }
			catch (e) { _showStatus('Export failed: ' + e.message, true); }
		});
		importBtn.addEventListener('click', function () {
			var input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
			input.addEventListener('change', function (evt) {
				if (!this.files || !this.files.length) return;
				var r = new FileReader();
				r.onload = function (evt) {
					try {
						if (client.importSettings && client.importSettings(evt.target.result)) { client.settingsFields.forEach(function (f) { var inp = fieldValues[f.id]; if (inp && typeof client['_' + f.id] !== 'undefined') inp.value = client['_' + f.id] || ''; }); _showStatus('Settings imported successfully.', false); }
						else { _showStatus('Invalid config file format.', true); }
					} catch (e) { _showStatus('Import failed: ' + e.message, true); }
				};
				r.readAsText(this.files[0]);
			});
			input.click();
		});
		qrBtn.addEventListener('click', function () {
			var json; try { json = client.exportSettings ? client.exportSettings() : JSON.stringify(client.settings, null, 2); } catch (e) { _showStatus('Export settings first to generate QR.', true); return; }
			var canvas = document.getElementById('settings-client-qr-canvas'); var container = document.getElementById('settings-client-qr-container');
			if (canvas && container) { try { QR.generate(canvas, json, 256); container.style.display = ''; } catch (e) { _showStatus('QR generation failed: ' + e.message, true); } }
		});
		const dialog = document.getElementById('dialog-settings');
		if (dialog) { dialog.addEventListener('close', function () { var qc = document.getElementById('settings-client-qr-container'); if (qc) qc.style.display = 'none'; }); }
	};

	/* Register a client with hooks */
	const register = function (clientId, romSourceHooks) {
		const client = ClientRegistry.getClient(clientId);
		if (!client) { console.error('[ClientIntegration] Client "' + clientId + '" not found in registry'); return false; }
		if (typeof client.loadSettings === 'function') client.loadSettings();

		/* Render settings - but only if settings.js hasn't already created the UI */
		const settingsContainer = document.getElementById('client-settings-container');
		const settingsJsUiExists = document.getElementById('extensions-settings-section');
		if (settingsContainer && !settingsJsUiExists) {
			_renderClientSettings(clientId);
			var settingsBtn = document.getElementById('button-settings');
			if (settingsBtn) {
				settingsBtn.addEventListener('click', function () {
					if (Array.isArray(client.settingsFields)) { client.settingsFields.forEach(function (f) { var inp = document.getElementById('settings-client-field-' + f.id); if (inp && typeof client['_' + f.id] !== 'undefined') inp.value = client['_' + f.id] || ''; }); }
				});
			}
		}

		/* Update upload button label to show server name */
		const uploadBtn = document.getElementById('client-btn-upload');
		if (uploadBtn && client.name) uploadBtn.textContent = 'Upload to ' + client.name;

		/* Apply patch and then run the action when patching completes */
		const MAX_APPLY_RETRIES = 150; /* 30 seconds at 200ms intervals */
		const _applyPatchAndRun = function (action) {
			if (_state.patchedRom) {
				action(_state.patchedRom);
				return;
			}
			/* Trigger the hidden Apply Patch button */
			const hiddenBtn = document.getElementById('rom-patcher-button-apply');
			if (hiddenBtn && typeof RomPatcherWeb.applyPatch === 'function') {
				/* Suppress the default patchedRom.save() that fires after onpatch,
				   so the webapp doesn't auto-download the raw ROM before our action runs */
				_suppressSave = true;

				hiddenBtn.style.display = 'inline-block';
				hiddenBtn.disabled = false;
				let retries = 0;
				const _waitForResult = function () {
					if (_state.patchedRom) {
						/* Restore save() and run our action */
						_suppressSave = false;
						hiddenBtn.style.display = 'none';
						hiddenBtn.disabled = true;
						action(_state.patchedRom);
					} else {
						retries++;
						if (retries >= MAX_APPLY_RETRIES) {
							_suppressSave = false;
							hiddenBtn.style.display = 'none';
							hiddenBtn.disabled = true;
							console.error('[ClientIntegration] Patch apply timed out after ' + (MAX_APPLY_RETRIES * 200 / 1000) + 's');
							alert('Patch application timed out. Please try again.');
							return;
						}
						setTimeout(_waitForResult, 200);
					}
				};
				_waitForResult();
				hiddenBtn.click();
			}
		};

		/* Hook into RomPatcherWeb — directly modify internal settings callbacks after init */
		const MAX_HOOK_RETRIES = 150; /* 30 seconds at 200ms intervals */
		let _hookRetries = 0;
		const _hook = function () {
			if (typeof RomPatcherWeb === 'undefined') {
				_hookRetries++;
				if (_hookRetries >= MAX_HOOK_RETRIES) {
					console.error('[ClientIntegration] RomPatcherWeb not found after ' + (MAX_HOOK_RETRIES * 200 / 1000) + 's');
					return;
				}
				setTimeout(_hook, 200);
				return;
			}
			/* Wait for initialization to complete (webapp.js calls initialize on window.load) */
			let _waitAndPatchRetries = 0;
			const _waitAndPatch = function () {
				if (!RomPatcherWeb.isInitialized || !RomPatcherWeb.isInitialized()) {
					_waitAndPatchRetries++;
					if (_waitAndPatchRetries >= MAX_HOOK_RETRIES) {
						console.error('[ClientIntegration] RomPatcherWeb initialization timed out after ' + (MAX_HOOK_RETRIES * 200 / 1000) + 's');
						return;
					}
					setTimeout(_waitAndPatch, 200);
					return;
				}
				/* RomPatcherWeb is now initialized. We need to inject our callbacks.
				   RomPatcherWeb stores callbacks in a module-level `settings` object.
				   The public `setSettings` method merges callbacks. Call it with our hooks. */
				RomPatcherWeb.setSettings({
				onpatch: function (patchedRom) {
					_state.patchedRom = patchedRom;
					_state.clientId = clientId;
					/* Re-enable Download/Upload buttons after patching
					   (applyPatch calls disableAll which disables our buttons) */
					const dlBtn = document.getElementById('client-btn-download');
					if (dlBtn) dlBtn.disabled = false;
					const ulBtn = document.getElementById('client-btn-upload');
					if (ulBtn) ulBtn.disabled = !client.isConfigured();
				/* Update output name after patching */
				const nameInput = document.getElementById('client-output-name');
				if (nameInput && !nameInput.value.trim()) {
					const baseName = patchedRom.fileName.replace(/\.[^.]+$/, '');
					nameInput.value = baseName + ' (patched)';
					nameInput.placeholder = baseName + ' (patched)';
				}
				},
				onvalidaterom: function (romFile, validRom) {
					/* Enable Download/Upload buttons when ROM passes validation */
					if (validRom) {
						const outputSection = document.getElementById('client-output-section');
						if (outputSection) { outputSection.style.display = ''; }
						const nameInput = document.getElementById('client-output-name');
						if (nameInput && !nameInput.value.trim()) {
							const baseName = romFile.fileName.replace(/\.[^.]+$/, '');
							nameInput.value = baseName + ' (patched)';
							nameInput.placeholder = baseName + ' (patched)';
						}
							const dlBtn = document.getElementById('client-btn-download');
							if (dlBtn) dlBtn.disabled = false;
							const ulBtn = document.getElementById('client-btn-upload');
							const ulRow = document.getElementById('client-upload-platform-row');
							if (ulBtn) ulBtn.disabled = !client.isConfigured();
							if (ulRow) ulRow.style.display = client.isConfigured() ? '' : 'none';
							if (client.isConfigured() && typeof client.getPlatforms === 'function') { _loadPlatforms(client); }
						}
					},
				onloadpatch: function (binFile, embededPatchInfo, parsedPatch) {
					_cacheHashesFromPatch(parsedPatch);
					setTimeout(function () {
						const searchArea = document.getElementById('client-search-area');
							if (searchArea && client.isConfigured()) {
								searchArea.style.display = '';
								if (_cachedHashes && typeof romSourceHooks.onAutoLookup === 'function') {
									const searchInput = document.getElementById('client-search-value');
									const toggleBtn = document.getElementById('client-search-toggle');
									if (searchInput && toggleBtn) {
										_searchMode = 'hash';
										toggleBtn.textContent = 'Switch to Name';
										searchInput.placeholder = 'Enter CRC32, MD5 or SHA1...';
										searchInput.value = _cachedHashes.crc_hash || _cachedHashes.md5_hash || _cachedHashes.sha1_hash || '';
									}
									setTimeout(function () { _doSearch(client, romSourceHooks); }, 200);
								}
							}
						}, 100);
					}
				});
			};
			_waitAndPatch();
		};
		_hook();

		/* ---- Wire up DOM elements ---- */
		setTimeout(function () {
			/* Search toggle */
			let toggleBtn = document.getElementById('client-search-toggle');
			let searchInput = document.getElementById('client-search-value');
			if (toggleBtn && searchInput) {
				toggleBtn.addEventListener('click', function () {
					_searchMode = (_searchMode === 'hash') ? 'name' : 'hash';
					toggleBtn.textContent = _searchMode === 'hash' ? 'Switch to Name' : 'Switch to Hash';
					searchInput.placeholder = _searchMode === 'hash' ? 'Enter CRC32, MD5 or SHA1...' : 'Search ROM name...';
					searchInput.value = '';
					const resultsEl = document.getElementById('client-search-results');
					if (resultsEl) resultsEl.style.display = 'none';
				});
			}
			/* Search button */
			const searchBtn = document.getElementById('client-search-button');
			if (searchBtn) {
				searchBtn.addEventListener('click', function () { _doSearch(client, romSourceHooks); });
				if (searchInput) searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') _doSearch(client, romSourceHooks); });
			}

			/* Download button - applies patch first if needed.
			   Uses Blob+download directly (NOT patchedRom.save()) to avoid
			   mutating patchedRom.fileName and to bypass any stale
			   BinFile.prototype.save suppression state from previous patches. */
		const dlBtn = document.getElementById('client-btn-download');
		if (dlBtn) {
			dlBtn.addEventListener('click', function () {
				_applyPatchAndRun(function (patchedRom) {
					try {
						const wantZip = document.getElementById('client-output-zip').checked;
						const nameInp = document.getElementById('client-output-name');
						const origExt = patchedRom.fileName.match(/\.(\w+)$/);
						const ext = origExt ? '.' + origExt[1] : '.bin';
						const outName = nameInp && nameInp.value.trim()
							? nameInp.value.trim().replace(/\.\w+$/, '') + ext
							: patchedRom.fileName;

						/* CRITICAL: snapshot the u8array and fileName NOW.
						   If the user re-applies a patch or replaces the ROM
						   between this download and a subsequent one, the
						   patchedRom reference here will be invalidated. */
						const u8 = patchedRom._u8array;
						if (!u8 || u8.byteLength === 0) {
							throw new Error('patchedRom._u8array is empty or detached (byteLength=' + (u8 ? u8.byteLength : 'null') + ')');
						}
						const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

						let downloadName;

						/* Helper function to trigger download */
						const triggerDownload = function(blob, filename) {
							const url = URL.createObjectURL(blob);
							const a = document.createElement('a');
							a.href = url;
							a.download = filename;
							a.style.display = 'none';
							document.body.appendChild(a);
							a.click();
							/* Delay revoke so the browser has a chance to start the download */
							setTimeout(function () {
								try { URL.revokeObjectURL(url); } catch (e) { /* revoke failed, ignore */ }
								if (a.parentNode) a.parentNode.removeChild(a);
							}, 1000);
						};

						if (wantZip) {
							downloadName = outName.replace(/\.[^.]+$/, '') + '.zip';
							/* Use async _createZip with deflate compression */
							const binFile = { _u8array: new Uint8Array(buffer) };
							_createZip(binFile, outName, function(zipBuffer) {
								const blob = new Blob([zipBuffer], { type: 'application/zip' });
								triggerDownload(blob, downloadName);
							});
						} else {
							downloadName = outName;
							const blob = new Blob([buffer], { type: 'application/octet-stream' });
							triggerDownload(blob, downloadName);
						}
					} catch (e) {
						console.error('[ClientIntegration] Download failed:', e);
						alert('Download failed: ' + e.message);
						}
					});
				});
			}

			/* Upload button */
		const ulBtn = document.getElementById('client-btn-upload');
		if (ulBtn) {
			ulBtn.addEventListener('click', function () {
				_applyPatchAndRun(function (patchedRom) {
					if (!client.isConfigured()) return;
					const nameInp = document.getElementById('client-output-name');
					const platSelect = document.getElementById('client-upload-platform');
					const platId = platSelect && platSelect.value ? parseInt(platSelect.value) : _state.sourcePlatformId;
					const wantZip = document.getElementById('client-output-zip').checked;
					const origExt = patchedRom.fileName.match(/\.(\w+)$/);
					const ext = origExt ? '.' + origExt[1] : '.bin';
					const outName = nameInp && nameInp.value.trim() ? nameInp.value.trim().replace(/\.\w+$/, '') + ext : patchedRom.fileName;
						if (!platId) { alert('No platform selected.'); return; }
						if (typeof romSourceHooks.onUpload === 'function') {
							romSourceHooks.onUpload(client, patchedRom, platId, outName, wantZip, _createZip);
						}
					});
				});
			}
		}, 500);

		/* Show search area if configured */
		if (client.isConfigured()) {
			const searchArea = document.getElementById('client-search-area');
			if (searchArea) searchArea.style.display = '';
		}
		return true;
	};

	/* Perform search based on current mode */
	const _doSearch = async function (client, hooks) {
		const searchInput = document.getElementById('client-search-value');
		if (!searchInput || !searchInput.value.trim()) return;
		const val = searchInput.value.trim();
		if (_searchMode === 'hash') {
			const hashes = _parseHashStr(val);
			if (!hashes) { alert('Invalid hash. 8 hex=CRC32, 32=MD5, 40=SHA1'); return; }
			if (typeof hooks.onSearchByHash === 'function') await hooks.onSearchByHash(client, hashes);
		} else {
			if (typeof hooks.onSearchByName === 'function') await hooks.onSearchByName(client, val);
		}
	};

	/* Set selected ROM */
	const setSelectedRom = function (rom, platformId) {
		_state.selectedRom = rom;
		_state.sourcePlatformId = platformId || (rom ? rom.platform_id || null : null);
	};

	/* Load platforms */
	const _loadPlatforms = async function (client) {
		const select = document.getElementById('client-upload-platform');
		if (!select || typeof client.getPlatforms !== 'function') return;
		try {
			const platforms = await client.getPlatforms();
			while (select.options.length > 1) select.remove(1);
			if (platforms && Array.isArray(platforms)) {
				platforms.forEach(function (p) { var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.display_name || p.name || p.slug; if (_state.sourcePlatformId && p.id === _state.sourcePlatformId) opt.selected = true; select.appendChild(opt); });
			}
		} catch (e) { console.warn('[ClientIntegration] Failed to load platforms: ' + e.message); }
	};

	return {
		register: register,
		setSelectedRom: setSelectedRom,
		createZip: _createZip,
		showStatus: _showStatus,
		hashExists: function () { return _cachedHashes !== null; },
		getCachedHashes: function () { return _cachedHashes; }
	};
})();