/*
* Rom Patcher JS - RomM Client Plugin
* Thin registration layer using the Client Integration Framework
* License: MIT
*/

(function () {
	const MAX_DEPENDENCY_RETRIES = 150; /* 30 seconds at 200ms intervals */

	/* Wait for all dependencies to load */
	let _retryCount = 0;
	const _init = function () {
		if (
			typeof ClientRegistry === 'undefined' ||
			typeof ClientIntegration === 'undefined' ||
			typeof RommClient === 'undefined'
		) {
			_retryCount++;
			if (_retryCount >= MAX_DEPENDENCY_RETRIES) {
				console.error('[ClientIntegration:romm] Failed to load dependencies after ' + MAX_DEPENDENCY_RETRIES + ' retries');
				return;
			}
			setTimeout(_init, 200);
			return;
		}

		/* Register the RomM client with the framework */
		console.log('[ClientIntegration:romm] Registering RomM client');

		/* Helper: download a ROM from server and load it into the ROM file slot */
		const _loadRomFromServer = async function (client, rom) {
			const romId = rom.id;
			const fileName = rom.fs_name || rom.file_name || 'rom.bin';
			try {
				const btns = document.querySelectorAll('#client-search-hash, #client-search-name');
				btns.forEach(function (b) { b.disabled = true; });

				const arrayBuffer = await client.downloadRom(romId, fileName);
				const binFile = new BinFile(arrayBuffer);
				binFile.fileName = fileName;
				ClientIntegration.setSelectedRom(rom, rom.platform_id || null);

				if (typeof RomPatcherWeb !== 'undefined' && RomPatcherWeb.provideRomFile) {
					RomPatcherWeb.provideRomFile(binFile, true);
				}
			} catch (e) {
				console.error('[ClientIntegration:romm] Failed to download ROM: ' + e.message);
				alert('Failed to download ROM from server: ' + e.message);
			} finally {
				const btns = document.querySelectorAll('#client-search-hash, #client-search-name');
				btns.forEach(function (b) { b.disabled = false; });
			}
		};

		ClientIntegration.register('romm', {
			/* Auto-lookup: called when a patch with hashes is loaded */
			onAutoLookup: async function (client, hashes) {
				if (!hashes) return;

				const hashInput = document.getElementById('client-hash-value');
				if (hashInput) {
					hashInput.value = hashes.crc_hash || hashes.md5_hash || hashes.sha1_hash || '';
				}

				try {
					const rom = await client.getRomByHash(hashes);
					if (rom) {
						/* Auto-download and load into ROM slot */
						await _loadRomFromServer(client, rom);
					}
				} catch (e) {
					console.warn('[ClientIntegration:romm] Auto-lookup failed: ' + e.message);
				}
			},

			/* Search by hash button */
			onSearchByHash: async function (client, hashes) {
				try {
					const rom = await client.getRomByHash(hashes);
					if (rom) {
						await _loadRomFromServer(client, rom);
					} else {
						alert('No ROM found with that hash on RomM.');
					}
				} catch (e) {
					alert('RomM hash search failed: ' + e.message);
				}
			},

			/* Search by name button */
			onSearchByName: async function (client, term) {
				try {
					const results = await client.searchRoms(term);
					const resultsDiv = document.getElementById('client-search-results');
					if (!resultsDiv) return;
					resultsDiv.innerHTML = '';
					if (results && results.items && results.items.length) {
						resultsDiv.style.display = '';
						results.items.forEach(function (rom) {
							const item = document.createElement('div');
							item.className = 'client-result-item';
							item.textContent = (rom.name || rom.fs_name || 'Unknown') + (rom.platform_display_name ? ' [' + rom.platform_display_name + ']' : '');
							item.title = 'ID: ' + rom.id + ' | CRC: ' + (rom.crc_hash || 'N/A');
							item.addEventListener('click', function () {
								_loadRomFromServer(client, rom);
								resultsDiv.style.display = 'none';
							});
							resultsDiv.appendChild(item);
						});
					} else {
						resultsDiv.style.display = '';
						resultsDiv.innerHTML = '<div class="text-muted" style="padding:8px;font-size:12px">No results found</div>';
					}
				} catch (e) {
					alert('RomM search failed: ' + e.message);
				}
			},

			/* Download selected ROM from server — delegates to _loadRomFromServer */
			onDownload: async function (client, selectedRom) {
				await _loadRomFromServer(client, selectedRom);
			},

			/* Upload patched ROM to server, then trigger a rescan so RomM
			   picks up the newly uploaded file. */
			onUpload: async function (client, patchedRom, platformId, fileName, wantZip, createZipFn) {
				const progressDiv = document.getElementById('client-progress');
				if (progressDiv) {
					progressDiv.style.display = '';
					progressDiv.textContent = 'Uploading to RomM... 0%';
				}

				const doUpload = function (buffer, uploadName) {
					client.uploadRom(platformId, uploadName, buffer, function (loaded, total) {
						const pct = Math.round(loaded / total * 100);
						if (progressDiv) progressDiv.textContent = 'Uploading to RomM... ' + pct + '%';
					}).then(function () {
						/* Upload complete.
						   Rescan disabled: scan_library endpoint does not currently
						   allow manual triggers. */
						// if (typeof client.rescanLibrary === 'function') {
						// 	if (progressDiv) progressDiv.textContent = 'Upload complete! Rescanning RomM library...';
						// 	return client.rescanLibrary().then(function () {
						// 		if (progressDiv) {
						// 			progressDiv.textContent = 'Upload complete and library rescanned!';
						// 			setTimeout(function () { progressDiv.style.display = 'none'; }, 3000);
						// 		}
						// 	});
						// } else {
						if (progressDiv) {
							progressDiv.textContent = 'Upload complete!';
							setTimeout(function () { progressDiv.style.display = 'none'; }, 3000);
						}
						// }
					}).catch(function (err) {
						if (progressDiv) progressDiv.textContent = '';
						alert('Upload to RomM failed: ' + err.message);
					});
				};

				if (wantZip) {
					const zipName = fileName.replace(/\.[^.]+$/, '') + '.zip';
					createZipFn(patchedRom, fileName, function (zipBuffer) {
						doUpload(zipBuffer, zipName);
					});
				} else {
					doUpload(patchedRom._u8array.buffer, fileName);
				}
			}
		});
	};

	/* Wait for DOM to be ready since scripts load in <head> before DOM is parsed */
	if (document.readyState !== 'loading') {
		_init();
	} else {
		document.addEventListener('DOMContentLoaded', function () {
			_init();
		});
	}
})();
