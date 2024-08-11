/*
* Rom Patcher JS - Webapp implementation
* A web implementation for Rom Patcher JS
* By Marc Robledo https://www.marcrobledo.com
* Sourcecode: https://github.com/marcrobledo/RomPatcher.js
* License:
*
* MIT License
* 
* Copyright (c) 2016-2024 Marc Robledo
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/


/*
	to-do list:
	- allow multiple instances of RomPatcherWeb?
	- switch to ES6 classes and modules?
*/

const ROM_PATCHER_JS_PATH = './rom-patcher-js/';

var RomPatcherWeb = (function () {
	const SCRIPT_DEPENDENCIES = [
		'modules/BinFile.js',
		'modules/HashCalculator.js',
		'modules/RomPatcher.format.ips.js',
		'modules/RomPatcher.format.ups.js',
		'modules/RomPatcher.format.aps_n64.js',
		'modules/RomPatcher.format.aps_gba.js',
		'modules/RomPatcher.format.bps.js',
		'modules/RomPatcher.format.rup.js',
		'modules/RomPatcher.format.ppf.js',
		'modules/RomPatcher.format.pmsr.js',
		'modules/RomPatcher.format.vcdiff.js',
		'modules/zip.js/zip.min.js',
		'RomPatcher.js'
	];

	const WEB_CRYPTO_AVAILABLE = window.crypto && window.crypto.subtle && window.crypto.subtle.digest;
	const settings = {
		language: typeof navigator.language === 'string' ? navigator.language.substring(0, 2) : 'en',
		outputSuffix: true,
		fixChecksum: false,

		allowDropFiles: false,

		onloadrom: null,
		onvalidaterom: null,
		onloadpatch: null,
		onpatch: null
	};
	var romFile, patch;


	/* embeded patches */
	var embededPatchesInfo = null;
	const _parseEmbededPatchInfo = function (embededPatchInfo) {
		const parsedPatch = {
			file: embededPatchInfo.file.trim(),
			name: null,
			description: null,
			outputName: null,
			outputExtension: null,
			patches: null
		};

		if (typeof embededPatchInfo.name === 'string') {
			parsedPatch.name = embededPatchInfo.name.trim();
		} else {
			parsedPatch.name = embededPatchInfo.file.replace(/(.*?\/)+/g, '');
		}

		if (typeof embededPatchInfo.description === 'string') {
			parsedPatch.description = embededPatchInfo.description;
		}

		if (typeof embededPatchInfo.outputName === 'string') {
			parsedPatch.outputName = embededPatchInfo.outputName;
		}
		if (typeof embededPatchInfo.outputExtension === 'string') {
			parsedPatch.outputExtension = embededPatchInfo.outputExtension;
		}

		if (typeof embededPatchInfo.inputCrc32 !== 'undefined') {
			if (!Array.isArray(embededPatchInfo.inputCrc32))
				embededPatchInfo.inputCrc32 = [embededPatchInfo.inputCrc32];

			const validCrcs = embededPatchInfo.inputCrc32.map(function (crc32) {
				if (typeof crc32 === 'string' && /^(0x)?[0-9a-fA-F]{8}$/i.test(crc32.trim())) {
					return parseInt(crc32.replace('0x', ''), 16);
				} else if (typeof crc32 === 'number') {
					return crc32 >>> 0;
				} else {
					return null;
				}
			}).filter(function (crc32) {
				return typeof crc32 === 'number';
			});
			if (validCrcs.length) {
				parsedPatch.inputCrc32 = validCrcs;
			} else {
				console.warn('Invalid inputCrc32 for embeded patch', embededPatchInfo);
			}
		}

		return parsedPatch;
	}
	const _fetchPatchFile = function (embededPatchInfo) {
		htmlElements.disableAll();

		const spinnerHtml = '<span class="rom-patcher-spinner" id="rom-patcher-spinner-patch"></span>';


		const loadingSpan = document.createElement('span');
		loadingSpan.id = 'rom-patcher-span-loading-embeded-patch';
		loadingSpan.innerHTML = _('Downloading...') + ' ' + spinnerHtml;

		const inputFilePatch = htmlElements.get('input-file-patch');
		if (inputFilePatch) {
			inputFilePatch.parentElement.replaceChild(loadingSpan, inputFilePatch);
		} else {
			throw new Error('Rom Patcher JS: input#rom-patcher-input-file-patch[type=file] not found');
		}



		var uri = decodeURI(embededPatchInfo.file);

		fetch(uri)
			.then(result => result.arrayBuffer()) // Gets the response and returns it as a blob
			.then(arrayBuffer => {
				const fetchedFile = new BinFile(arrayBuffer);
				if (ZIPManager.isZipFile(fetchedFile)) {
					if (typeof embededPatchInfo.patches === 'object') {
						if (Array.isArray(embededPatchInfo.patches)) {
							embededPatchesInfo = embededPatchInfo.patches.map((embededPatchInfo) => _parseEmbededPatchInfo(embededPatchInfo));
						} else {
							console.warn('Rom Patcher JS: Invalid patches object for embeded patch', embededPatchInfo);
						}
					} else {
						embededPatchesInfo = [_parseEmbededPatchInfo(embededPatchInfo)];
					}
					loadingSpan.innerHTML = _('Unzipping...') + ' ' + spinnerHtml;
					ZIPManager.unzipEmbededPatches(arrayBuffer, embededPatchesInfo);
				} else {
					embededPatchesInfo = [_parseEmbededPatchInfo(embededPatchInfo)];
					loadingSpan.innerHTML = embededPatchesInfo[0].name;
					_setPatchInputSpinner(false);
					fetchedFile.fileName = embededPatchInfo.file;
					RomPatcherWeb.providePatchFile(fetchedFile);
				}
			})
			.catch(function (evt) {
				_setToastError((_('Error downloading %s') + '<br />' + evt.message).replace('%s', embededPatchInfo.file.replace(/^.*[\/\\]/g, '')));
			});
	};
	const _getEmbededPatchInfo = function (fileName) {
		if (embededPatchesInfo)
			return embededPatchesInfo.find((embededPatchInfo) => embededPatchInfo.file === fileName);
		return null;
	}



	const _padZeroes = function (intVal, nBytes) {
		var hexString = intVal.toString(16);
		while (hexString.length < nBytes * 2)
			hexString = '0' + hexString;
		return hexString
	}

	const _setElementsStatus = function (status) {
		htmlElements.setEnabled('input-file-rom', status);
		htmlElements.setEnabled('input-file-patch', status);
		htmlElements.setEnabled('select-file-patch', status);
		htmlElements.setEnabled('checkbox-alter-header', status);

		if (romFile && status && (patch /* || embededPatchesInfo */)) {
			htmlElements.setEnabled('button-apply', status);
		} else {
			htmlElements.setEnabled('button-apply', false);
		}
	};

	const _setInputFileSpinner = function (inputFileId, status) {
		const elementId = embededPatchesInfo && inputFileId === 'patch' ? ('select-file-' + inputFileId) : ('input-file-' + inputFileId);
		const spinnerId = 'spinner-' + inputFileId;

		htmlElements.removeClass(elementId, 'empty');


		if (status) {
			const spinner = document.createElement('spinner');
			spinner.id = 'rom-patcher-' + spinnerId;
			spinner.className = 'rom-patcher-spinner';

			const htmlInputFile = htmlElements.get(elementId);
			if (htmlInputFile)
				htmlInputFile.parentElement.appendChild(spinner);

			htmlElements.addClass(elementId, 'loading');
			htmlElements.removeClass(elementId, 'valid');
			htmlElements.removeClass(elementId, 'invalid');

			return spinner;
		} else {
			const spinner = htmlElements.get(spinnerId);
			if (spinner)
				spinner.parentElement.removeChild(spinner);
			htmlElements.removeClass(elementId, 'loading');

			return spinner;
		}
	}
	const _setRomInputSpinner = function (status) {
		return _setInputFileSpinner('rom', status);
	}
	const _setPatchInputSpinner = function (status) {
		return _setInputFileSpinner('patch', status);
	}
	const _setApplyButtonSpinner = function (status) {
		if (status) {
			htmlElements.setText('button-apply', '<span class="rom-patcher-spinner"></span> ' + _('Applying patch...'));
		} else {
			htmlElements.setText('button-apply', _('Apply patch'));
		}
	}
	const _setToastError = function (errorMessage, className) {
		const row = htmlElements.get('row-error-message');
		const span = htmlElements.get('error-message');
		if (row && span) {
			if (errorMessage) {
				htmlElements.addClass('row-error-message', 'show');
				htmlElements.setText('error-message', errorMessage);
				if (className === 'warning')
					htmlElements.addClass('error-message', 'warning');
				else
					htmlElements.removeClass('error-message', 'warning');
			} else {
				htmlElements.removeClass('row-error-message', 'show');
				htmlElements.setText('error-message', '');

			}
		} else {
			console.error('Rom Patcher JS: ' + errorMessage);
		}
	}

	const htmlElements = {
		get: function (id) {
			return document.getElementById('rom-patcher-' + id);
		},

		enableAll: function () {
			_setElementsStatus(true);
		},
		disableAll: function () {
			_setElementsStatus(false);
		},

		show: function (id) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).style.display = 'block';
		},
		hide: function (id) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).style.display = 'none';
		},

		setValue: function (id, val) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).value = val;
		},
		getValue: function (id, val, fallback) {
			if (document.getElementById('rom-patcher-' + id))
				return document.getElementById('rom-patcher-' + id).value;
			return fallback || 0;
		},
		setFakeFile: function (id, fileName) {
			if (document.getElementById('rom-patcher-input-file-' + id)) {
				try {
					/* add a fake file to the input file, so it shows the chosen file name */
					const fakeFile = new File(new Uint8Array(0), fileName);
					const dataTransfer = new DataTransfer();
					dataTransfer.items.add(fakeFile);
					document.getElementById('rom-patcher-input-file-' + id).files = dataTransfer.files;
				} catch (ex) {
					console.warning('File API constructor is not supported');
				}
			}
		},

		setText: function (id, text) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).innerHTML = text;
		},

		addClass: function (id, className) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).classList.add(className);
		},
		removeClass: function (id, className) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).classList.remove(className);
		},
		setClass: function (id, className) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).className = className;
		},

		setEnabled: function (id, enabled) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).disabled = !enabled;
		},
		setChecked: function (id, checked) {
			if (document.getElementById('rom-patcher-' + id))
				document.getElementById('rom-patcher-' + id).checked = !!checked;
		},
		isChecked: function (id) {
			if (document.getElementById('rom-patcher-' + id))
				return document.getElementById('rom-patcher-' + id).checked;
			return false;
		},

		setSpinner: function (inputFileId, status) {
			if (inputFileId !== 'rom' && inputFileId !== 'patch')
				throw new Error('RomPatcherWeb.htmlElements.setSpinner: only rom or patch input file ids are allowed');

			return _setInputFileSpinner(inputFileId, status);
		}
	}



	/* web workers */
	const webWorkerApply = new Worker(ROM_PATCHER_JS_PATH + 'RomPatcher.webworker.apply.js');
	webWorkerApply.onmessage = event => { // listen for events from the worker
		//retrieve arraybuffers back from webworker
		romFile._u8array = event.data.romFileU8Array;
		patch._originalPatchFile._u8array = event.data.patchFileU8Array;

		htmlElements.enableAll();
		_setApplyButtonSpinner(false);
		if (event.data.patchedRomU8Array && !event.data.errorMessage) {
			const patchedRom = new BinFile(event.data.patchedRomU8Array.buffer);
			patchedRom.fileName = event.data.patchedRomFileName;
			if (typeof settings.onpatch === 'function')
				settings.onpatch(patchedRom);
			patchedRom.save();
			_setToastError();
		} else {
			_setToastError(event.data.errorMessage);
		}
	};
	webWorkerApply.onerror = event => { // listen for exceptions from the worker
		htmlElements.enableAll();
		_setApplyButtonSpinner(false);
		_setToastError('webWorkerApply error: ' + event.message);
	};

	const webWorkerCrc = new Worker(ROM_PATCHER_JS_PATH + 'RomPatcher.webworker.crc.js');
	webWorkerCrc.onmessage = event => { // listen for events from the worker
		//console.log('received_crc');
		htmlElements.setText('span-crc32', _padZeroes(event.data.crc32, 4));
		htmlElements.setText('span-md5', _padZeroes(event.data.md5, 16));
		romFile._u8array = event.data.u8array;

		if (WEB_CRYPTO_AVAILABLE) {
			romFile.hashSHA1().then(function (res) {
				htmlElements.setText('span-sha1', res);
			});
		}

		if (event.data.rom) {
			htmlElements.setText('span-rom-info', event.data.rom);
			htmlElements.addClass('row-info-rom', 'show');
		}

		RomPatcherWeb.validateCurrentRom(event.data.checksumStartOffset);
		htmlElements.enableAll();
	};
	webWorkerCrc.onerror = event => { // listen for events from the worker
		_setToastError('webWorkerCrc error: ' + event.message);
	};

	const _getChecksumStartOffset = function () {
		if (romFile) {
			const headerInfo = RomPatcher.isRomHeadered(romFile);
			if (headerInfo) {
				const htmlCheckboxAlterHeader = htmlElements.get('checkbox-alter-header');
				if (htmlCheckboxAlterHeader && htmlCheckboxAlterHeader.checked)
					return headerInfo.size;
			}
		}
		return 0;
	}


	const _getScriptPath = function () {
		const currentScripts = document.querySelectorAll('script');
		var scriptPath;
		if (document.currentScript) {
			scriptPath = document.currentScript.src;
		} else {
			for (var i = 0; i < currentScripts.length; i++) {
				if (currentScripts[i].src.indexOf('RomPatcher.webapp.js') !== -1) {
					scriptPath = currentScripts[i].src;
					break;
				}
			}
			if (!scriptPath)
				scriptPath = './rom-patcher-js/';
		}
		return scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
	}
	const _getMissingDependencies = function () {
		const currentScripts = document.querySelectorAll('script');
		const scriptPath = _getScriptPath();
		var missingDependencies = [];
		for (var i = 0; i < SCRIPT_DEPENDENCIES.length && !isLoaded; i++) {
			var isLoaded = false;
			for (var j = 0; j < currentScripts.length; j++) {
				if (currentScripts[j].src === scriptPath + SCRIPT_DEPENDENCIES[i])
					isLoaded = true;
			}
			if (!isLoaded)
				missingDependencies.push(scriptPath + SCRIPT_DEPENDENCIES[i]);
		}

		return missingDependencies;
	}
	const _initialize = function (newSettings, embededPatchInfo) {
		/* embeded patches */
		var validEmbededPatch = false;
		if (embededPatchInfo) {
			if (typeof embededPatchInfo === 'string')
				embededPatchInfo = { file: embededPatchInfo };

			if (typeof embededPatchInfo === 'object') {
				if (typeof embededPatchInfo.file === 'string') {
					validEmbededPatch = true;
				} else {
					throw new Error('Rom Patcher JS: invalid embeded patch file');
				}
			}
		}



		/* check if Rom Patcher JS core is available */
		if (typeof RomPatcher !== 'object') {
			throw new Error('Rom Patcher JS: core not found');
		}



		/* check if zip-js web worker is available */
		if (typeof zip !== 'object' || typeof zip.useWebWorkers !== 'boolean') {
			throw new Error('Rom Patcher JS: zip.js web worker not found');
		}
		zip.useWebWorkers = true;
		zip.workerScriptsPath = ROM_PATCHER_JS_PATH + 'modules/zip.js/';

		/* check if all required HTML elements are in DOM */
		const htmlInputFileRom = htmlElements.get('input-file-rom');
		if (htmlInputFileRom && htmlInputFileRom.tagName === 'INPUT' && htmlInputFileRom.type === 'file') {
			htmlInputFileRom.addEventListener('change', function (evt) {
				htmlElements.disableAll();
				new BinFile(this, RomPatcherWeb.provideRomFile);
			});
		} else {
			throw new Error('Rom Patcher JS: input#rom-patcher-input-file-rom[type=file] not found');
		}
		const htmlInputFilePatch = htmlElements.get('input-file-patch');
		if (htmlInputFilePatch && htmlInputFilePatch.tagName === 'INPUT' && htmlInputFilePatch.type === 'file') {
			htmlInputFilePatch.addEventListener('change', function (evt) {
				htmlElements.disableAll();
				new BinFile(this, RomPatcherWeb.providePatchFile);
			});
		} else {
			throw new Error('Rom Patcher JS: input#rom-patcher-input-file-patch[type=file] not found');
		}
		const htmlButtonApply = htmlElements.get('button-apply');
		if (htmlButtonApply && htmlButtonApply.tagName === 'BUTTON') {
			htmlButtonApply.addEventListener('click', RomPatcherWeb.applyPatch);
		} else {
			throw new Error('Rom Patcher JS: button#rom-patcher-button-apply not found');
		}
		const htmlCheckboxAlterHeader = htmlElements.get('checkbox-alter-header');
		if (htmlCheckboxAlterHeader && htmlCheckboxAlterHeader.tagName === 'INPUT' && htmlCheckboxAlterHeader.type === 'checkbox') {
			htmlCheckboxAlterHeader.addEventListener('change', function (evt) {
				if (!romFile)
					return false;

				const headerInfo = RomPatcher.isRomHeadered(romFile);
				if (headerInfo) {
					htmlElements.disableAll();
					webWorkerCrc.postMessage({ u8array: romFile._u8array, fileName: romFile.fileName, checksumStartOffset: _getChecksumStartOffset() }, [romFile._u8array.buffer]);
				}
			});
		}
		/* set all default input status just in case HTML is wrong */
		htmlElements.disableAll();
		/* reset input files */
		htmlElements.setValue('input-file-rom', '');
		htmlElements.setValue('input-file-patch', '');


		/* translatable elements */
		const translatableElements = document.querySelectorAll('*[data-localize="yes"]');
		for (var i = 0; i < translatableElements.length; i++) {
			translatableElements[i].setAttribute('data-localize', translatableElements[i].innerHTML);
		}

		/* add drag and drop events */
		if (newSettings && newSettings.allowDropFiles) {
			window.addEventListener('dragover', function (evt) {
				if (_dragEventContainsFiles(evt))
					evt.preventDefault(); /* needed ! */
			});
			window.addEventListener('drop', function (evt) {
				evt.preventDefault();
				if (_dragEventContainsFiles(evt)) {
					const droppedFiles = evt.dataTransfer.files;
					if (droppedFiles && droppedFiles.length === 1) {
						new BinFile(droppedFiles[0], function (binFile) {
							if (RomPatcherWeb.getEmbededPatches()) {
								RomPatcherWeb.provideRomFile(binFile, true);
							} else if (ZIPManager.isZipFile(binFile)) {
								ZIPManager.unzipAny(binFile._u8array.buffer);
							} else if (RomPatcher.parsePatchFile(binFile)) {
								RomPatcherWeb.providePatchFile(binFile, null, true);
							} else {
								RomPatcherWeb.provideRomFile(binFile, true);
							}
						});
					}
				}
			});
			htmlInputFileRom.addEventListener('drop', function (evt) {
				evt.stopPropagation();
			});
			htmlInputFilePatch.addEventListener('drop', function (evt) {
				evt.stopPropagation();
			});
		}

		console.log('Rom Patcher JS initialized');
		initialized = true;


		/* initialize Rom Patcher */
		RomPatcherWeb.setSettings(newSettings);

		/* download embeded patch */
		if (validEmbededPatch)
			_fetchPatchFile(embededPatchInfo);
		else
			htmlElements.enableAll();
	}



	/* localization */
	const _ = function (str) { return ROM_PATCHER_LOCALE[settings.language] && ROM_PATCHER_LOCALE[settings.language][str] ? ROM_PATCHER_LOCALE[settings.language][str] : str };


	var initialized = false;
	var loading = 0;
	return {
		_: function (str) { /* public localization function for external usage purposes */
			return _(str);
		},
		getHtmlElements: function () {
			return htmlElements;
		},

		isInitialized: function () {
			return initialized;
		},
		getEmbededPatches: function () {
			return embededPatchesInfo;
		},

		provideRomFile: function (binFile, transferFakeFile) {
			htmlElements.disableAll();


			romFile = binFile;



			const canRomGetHeader = RomPatcher.canRomGetHeader(romFile);
			const isRomHeadered = RomPatcher.isRomHeadered(romFile);
			RomPatcherWeb.getHtmlElements().setChecked('checkbox-alter-header', false);
			if (canRomGetHeader) {
				RomPatcherWeb.getHtmlElements().setText('span-alter-header', _('Add %s header').replace('%s', _(canRomGetHeader.name)));
				RomPatcherWeb.getHtmlElements().addClass('row-alter-header', 'show');
			} else if (isRomHeadered) {
				RomPatcherWeb.getHtmlElements().setText('span-alter-header', _('Remove %s header').replace('%s', _(isRomHeadered.name)));
				RomPatcherWeb.getHtmlElements().addClass('row-alter-header', 'show');
			} else {
				RomPatcherWeb.getHtmlElements().setText('span-alter-header', '');
				RomPatcherWeb.getHtmlElements().removeClass('row-alter-header', 'show');
			}


			romFile.seek(0);


			_setRomInputSpinner(false);
			if (ZIPManager.isZipFile(romFile)) {
				ZIPManager.unzipRoms(romFile._u8array.buffer);
			} else {
				if (typeof settings.onloadrom === 'function')
					settings.onloadrom(romFile);
				RomPatcherWeb.calculateCurrentRomChecksums();
			}

			if (transferFakeFile) {
				htmlElements.setFakeFile('rom', romFile.fileName);
			}
		},

		providePatchFile: function (binFile, transferFakeFile) {
			htmlElements.disableAll();

			patch = null;
			if (binFile) {
				if (ZIPManager.isZipFile(binFile)) {
					ZIPManager.unzipPatches(binFile._u8array.buffer);
				} else {
					const parsedPatch = RomPatcher.parsePatchFile(binFile);
					if (parsedPatch) {
						patch = parsedPatch;
						_setPatchInputSpinner(false);

						const embededPatchInfo = _getEmbededPatchInfo(binFile.fileName);
						if (embededPatchInfo) {
							/* custom crc32s validation */
							if (embededPatchInfo.inputCrc32) {
								patch.validateSource = function (romFile, headerSize) {
									for (var i = 0; i < embededPatchInfo.inputCrc32.length; i++) {
										if (embededPatchInfo.inputCrc32[i] === romFile.hashCRC32(headerSize))
											return true;
									}
									return false;
								}
								patch.getValidationInfo = function () {
									return {
										'type': 'CRC32',
										'value': embededPatchInfo.inputCrc32
									}
								};
							}

							/* custom description */
							if (embededPatchInfo.description) {
								patch.getDescription = function () {
									return embededPatchInfo.description;
								}
							}
						}

						/* toggle ROM requirements */
						if (htmlElements.get('row-patch-requirements') && htmlElements.get('patch-requirements-value')) {
							if (typeof patch.getValidationInfo === 'function' && patch.getValidationInfo()) {
								var validationInfo = patch.getValidationInfo();
								if (Array.isArray(validationInfo) || !validationInfo.type) {
									validationInfo = {
										type: 'ROM',
										value: validationInfo
									}
								}
								htmlElements.setText('patch-requirements-value', '');

								htmlElements.setText('patch-requirements-type', validationInfo.type === 'ROM' ? _('Required ROM:') : _('Required %s:').replace('%s', validationInfo.type));

								if (!Array.isArray(validationInfo.value))
									validationInfo.value = [validationInfo.value];

								validationInfo.value.forEach(function (value) {
									var line = document.createElement('div');
									if (typeof value !== 'string') {
										if (validationInfo.type === 'CRC32') {
											value = value.toString(16);
											while (value.length < 8)
												value = '0' + value;
										} else {
											value = value.toString();
										}
									}
									/*
									var a=document.createElement('a');
									a.href='https://www.google.com/search?q=%22'+value+'%22';
									a.target='_blank';
									a.className='clickable';
									a.innerHTML=value;
									line.appendChild(a);
									*/
									line.innerHTML = value;
									htmlElements.get('patch-requirements-value').appendChild(line);
								});
								htmlElements.addClass('row-patch-requirements', 'show');
							} else {
								htmlElements.setText('patch-requirements-value', '');
								htmlElements.removeClass('row-patch-requirements', 'show');
							}
						}

						/* toggle patch description */
						if (typeof patch.getDescription === 'function' && patch.getDescription()) {
							htmlElements.setText('patch-description', patch.getDescription()/* .replace(/\n/g, '<br/>') */);
							//htmlElements.setTitle('patch-description', patch.getDescription());
							htmlElements.addClass('row-patch-description', 'show');
						} else {
							htmlElements.setText('patch-description', '');
							//htmlElements.setTitle('patch-description', '');
							htmlElements.removeClass('row-patch-description', 'show');
						}

						RomPatcherWeb.validateCurrentRom(_getChecksumStartOffset());

						if (typeof settings.onloadpatch === 'function') {
							settings.onloadpatch(binFile, embededPatchInfo, parsedPatch);
						}

						if (transferFakeFile) {
							htmlElements.setFakeFile('patch', binFile.fileName);
						}
					} else {
						_setToastError(_('Invalid patch file'));
					}
				}
			}

			if (patch) {
				htmlElements.removeClass('input-file-patch', 'invalid');
			} else {
				htmlElements.addClass('input-file-patch', 'invalid');
			}
			htmlElements.enableAll();
		},

		refreshRomFileName: function () {
			if (romFile)
				htmlElements.setFakeFile('rom', romFile.fileName);
		},

		pickEmbededFile: function (fileName) {
			if (typeof fileName !== 'string')
				throw new Error('Invalid embeded patch file name');

			const selectFilePatch = htmlElements.get('select-file-patch');
			if (selectFilePatch) {
				const embededPatchInfo = _getEmbededPatchInfo(fileName);
				if (embededPatchInfo && typeof embededPatchInfo.selectIndex === 'number' && selectFilePatch.value != embededPatchInfo.selectIndex) {
					selectFilePatch.value = embededPatchInfo.selectIndex;

					/* create and dispatch change event */
					const evt = new Event('change');
					selectFilePatch.dispatchEvent(evt);
				}
			} else {
				console.warn('RomPatcherWeb.pickEmbededFile: select-file-patch not found');
			}
		},

		initialize: function (newSettings, embededPatchInfo) {
			if (initialized)
				throw new Error('Rom Patcher JS was already initialized');
			else if (loading)
				throw new Error('Rom Patcher JS is already loading or has failed to load');


			/* check incompatible browsers */
			if (
				typeof window === 'undefined' ||
				typeof Worker !== 'function' ||
				typeof Array.isArray !== 'function' ||
				typeof window.addEventListener !== 'function'
				// !document.createElement('div').classList instanceof DOMTokenList
			)
				throw new Error('Rom Patcher JS: incompatible browser');


			/* queue script dependencies */
			const missingDependencies = _getMissingDependencies();
			loading = missingDependencies.length;
			const onLoadScript = function () {
				loading--;
				if (loading === 0) {
					try {
						_initialize(newSettings, embededPatchInfo);
					} catch (ex) {
						_setToastError(ex.message);
						htmlElements.disableAll();
					}
				}
			};
			const onErrorScript = function () {
				throw new Error('Rom Patcher JS: error loading script ' + script.src);
			};
			console.log('Rom Patcher JS: loading ' + missingDependencies.length + ' dependencies');
			missingDependencies.forEach(function (path) {
				var script = document.createElement('script');
				script.onload = onLoadScript;
				script.onerror = onErrorScript;
				script.src = path;

				document.head.appendChild(script);
			});
		},

		applyPatch: function () {
			if (romFile && patch) {
				const romPatcherOptions = {
					requireValidation: false,
					removeHeader: RomPatcher.isRomHeadered(romFile) && htmlElements.isChecked('checkbox-alter-header'),
					addHeader: RomPatcher.canRomGetHeader(romFile) && htmlElements.isChecked('checkbox-alter-header'),
					fixChecksum: settings.fixChecksum,
					outputSuffix: settings.outputSuffix
				};

				htmlElements.disableAll();
				_setApplyButtonSpinner(true);

				const embededPatchInfo = _getEmbededPatchInfo(patch._originalPatchFile.fileName);
				webWorkerApply.postMessage(
					{
						romFileU8Array: romFile._u8array,
						patchFileU8Array: patch._originalPatchFile._u8array,
						romFileName: romFile.fileName,
						patchFileName: patch._originalPatchFile.fileName,
						patchExtraInfo: embededPatchInfo,
						//romFileType:romFile.fileType,
						options: romPatcherOptions
					},
					[
						romFile._u8array.buffer,
						patch._originalPatchFile._u8array.buffer
					]
				);
			} else if (!romFile) {
				_setToastError(_('No ROM provided'));
			} else if (!patch) {
				_setToastError(_('No patch file provided'));
			}
		},

		calculateCurrentRomChecksums: function (force) {
			if (romFile.fileSize > 67108864 && !force) {
				htmlElements.setText('span-crc32', _('File is too big.') + ' <span class=\"clickable\" onclick=\"RomPatcherWeb.calculateCurrentRomChecksums(true)\">' + _('Force calculate checksum') + '</span>');
				htmlElements.setText('span-md5', '');
				htmlElements.setText('span-sha1', '');
				htmlElements.enableAll();
				return false;
			}

			htmlElements.setText('span-crc32', _('Calculating...'));
			htmlElements.setText('span-md5', _('Calculating...'));
			if (WEB_CRYPTO_AVAILABLE)
				htmlElements.setText('span-sha1', _('Calculating...'));

			htmlElements.setText('span-rom-info', '');
			htmlElements.removeClass('row-info-rom', 'show');

			htmlElements.disableAll();
			webWorkerCrc.postMessage({ u8array: romFile._u8array, fileName: romFile.fileName, checksumStartOffset: _getChecksumStartOffset() }, [romFile._u8array.buffer]);
		},

		validateCurrentRom: function (checksumStartOffset) {
			if (romFile && patch && typeof patch.validateSource === 'function') {
				const validRom = RomPatcher.validateRom(romFile, patch, checksumStartOffset ?? 0);
				if (validRom) {
					htmlElements.addClass('input-file-rom', 'valid');
					htmlElements.removeClass('input-file-rom', 'invalid');
					_setToastError();
				} else {
					htmlElements.addClass('input-file-rom', 'invalid');
					htmlElements.removeClass('input-file-rom', 'valid');
					_setToastError(_('Source ROM checksum mismatch'));
				}

				if (typeof settings.onvalidaterom === 'function')
					settings.onvalidaterom(romFile, validRom);
			} else {
				htmlElements.removeClass('input-file-rom', 'valid');
				htmlElements.removeClass('input-file-rom', 'invalid');
				_setToastError();
				if (romFile && patch && typeof settings.onvalidaterom === 'function')
					settings.onvalidaterom(romFile, true);
			}
		},

		enable: function () {
			htmlElements.enableAll();
		},
		disable: function () {
			htmlElements.disableAll();
		},
		setErrorMessage: function (message, className) {
			_setToastError(message, className);
		},
		translateUI: function (newLanguage) {
			if (typeof newLanguage === 'object' && typeof newLanguage.language === 'string')
				newLanguage = newLanguage.language;
			if (typeof newLanguage === 'string')
				settings.language = newLanguage;

			const translatableElements = document.querySelectorAll('*[data-localize]');
			for (var i = 0; i < translatableElements.length; i++) {
				translatableElements[i].innerHTML = _(translatableElements[i].getAttribute('data-localize'));
			}
		},

		getCurrentLanguage: function () {
			return settings.language;
		},
		setSettings: function (newSettings) {
			if (typeof newSettings === 'object') {
				if (typeof newSettings.language === 'string') {
					settings.language = newSettings.language;
					RomPatcherWeb.translateUI();
				}

				if (typeof newSettings.outputSuffix === 'boolean') {
					settings.outputSuffix = newSettings.outputSuffix;
				}
				if (typeof newSettings.fixChecksum === 'boolean') {
					settings.fixChecksum = newSettings.fixChecksum;
				}

				if (typeof newSettings.onloadrom === 'function')
					settings.onloadrom = newSettings.onloadrom;
				else if (typeof newSettings.onloadrom !== 'undefined')
					settings.onloadrom = null;

				if (typeof newSettings.onvalidaterom === 'function')
					settings.onvalidaterom = newSettings.onvalidaterom;
				else if (typeof newSettings.onvalidaterom !== 'undefined')
					settings.onvalidaterom = null;

				if (typeof newSettings.onloadpatch === 'function')
					settings.onloadpatch = newSettings.onloadpatch;
				else if (typeof newSettings.onloadpatch !== 'undefined')
					settings.onloadpatch = null;

				if (typeof newSettings.onpatch === 'function')
					settings.onpatch = newSettings.onpatch;
				else if (typeof newSettings.onpatch !== 'undefined')
					settings.onpatch = null;
			}
		}
	}
}());




/* ZIP manager */
const ZIPManager = (function (romPatcherWeb) {
	const _ = romPatcherWeb._;
	const htmlElements = romPatcherWeb.getHtmlElements();

	const _setRomInputSpinner = function (status) {
		htmlElements.setSpinner('rom', status);
	};
	const _setPatchInputSpinner = function (status) {
		htmlElements.setSpinner('patch', status);

	};

	const ZIP_MAGIC = '\x50\x4b\x03\x04';

	const FILTER_PATCHES = /\.(ips|ups|bps|aps|rup|ppf|mod|xdelta|vcdiff)$/i;
	//const FILTER_ROMS=/(?<!\.(txt|diz|rtf|docx?|xlsx?|html?|pdf|jpe?g|gif|png|bmp|webp|zip|rar|7z))$/i; //negative lookbehind is not compatible with Safari https://stackoverflow.com/a/51568859
	const FILTER_NON_ROMS = /(\.(txt|diz|rtf|docx?|xlsx?|html?|pdf|jpe?g|gif|png|bmp|webp|zip|rar|7z))$/i;


	const DIALOG_BACKDROP_FALLBACK_ID = 'rom-patcher-dialog-zip-backdrop';
	const dialogZip = document.createElement('dialog');
	dialogZip.id = 'rom-patcher-dialog-zip';
	dialogZip.className = 'rom-patcher-dialog';

	const dialogZipMessage = document.createElement('div');
	dialogZipMessage.id = 'rom-patcher-dialog-zip-message';
	dialogZip.appendChild(dialogZipMessage);

	const dialogZipList = document.createElement('ul');
	dialogZipList.id = 'rom-patcher-dialog-zip-file-list';
	dialogZip.appendChild(dialogZipList);

	const _filterEntriesRoms = function (zipEntries) {
		/* get ROM files only by ignoring patches */
		const filteredEntries = zipEntries.filter(function (elem) {
			return !FILTER_NON_ROMS.test(elem.filename) && !FILTER_PATCHES.test(elem.filename);
		});
		_sortFileEntries(filteredEntries);
		return filteredEntries;
	}
	const _filterEntriesPatches = function (zipEntries) {
		/* get ROM files only by ignoring patches */
		const filteredEntries = zipEntries.filter(function (elem) {
			return FILTER_PATCHES.test(elem.filename);
		});
		_sortFileEntries(filteredEntries);
		return filteredEntries;
	}
	const _sortFileEntries = function (entries) {
		/* sort patch files by name and folder */
		entries
			.sort(function (file1, file2) {
				return file1.filename.toLowerCase().replace(/\.\S+$/, '').localeCompare(file2.filename.toLowerCase().replace(/\.\S+$/, ''));
			})
			.sort(function (file1, file2) {
				var file1Folder = file1.filename.indexOf('/') === -1 ? 0 : 1;
				var file2Folder = file2.filename.indexOf('/') === -1 ? 0 : 1;
				return file1Folder - file2Folder;
			});
	}

	const _unzipEntry = function (zippedEntry, onUnzip) {
		htmlElements.disableAll();
		if (onUnzip === romPatcherWeb.provideRomFile) {
			_setRomInputSpinner(true);
		} else if (onUnzip === romPatcherWeb.providePatchFile) {
			_setPatchInputSpinner(true);
		} else {
			throw new Error('ZIPManager._unzipEntry: invalid onUnzip callback');
		}
		zippedEntry.getData(new zip.BlobWriter(), function (blob) {
			const fileReader = new FileReader();
			fileReader.onload = function () {
				const binFile = new BinFile(this.result);
				binFile.fileName = zippedEntry.filename;

				/* transfer files to input elements */
				if (onUnzip === romPatcherWeb.provideRomFile) {
					_setRomInputSpinner(false);
					onUnzip(binFile, true);
				} else {
					_setPatchInputSpinner(false);
					onUnzip(binFile, true);
				}
			};
			fileReader.readAsArrayBuffer(blob);
		});
	};

	const _showFilePicker = function (zipEntries, onUnzip) {
		const _evtClickEntry = function (evt) {
			if (typeof dialogZip.close === 'function') {
				dialogZip.close();
			} else {
				document.getElementById(DIALOG_BACKDROP_FALLBACK_ID).style.display = 'none';
			}
			_unzipEntry(this.zipEntry, onUnzip);
		}

		if (onUnzip === romPatcherWeb.provideRomFile) {
			dialogZipMessage.innerHTML = _('ROM file:');
		} else if (onUnzip === romPatcherWeb.providePatchFile) {
			dialogZipMessage.innerHTML = _('Patch file:');
		} else {
			throw new Error('ZIPManager._unzipEntry: invalid onUnzip callback');
		}

		dialogZipList.innerHTML = '';
		for (var i = 0; i < zipEntries.length; i++) {
			var li = document.createElement('li');
			li.zipEntry = zipEntries[i];
			li.innerHTML = zipEntries[i].filename;
			li.title = zipEntries[i].filename;
			li.addEventListener('click', _evtClickEntry);
			dialogZipList.appendChild(li);
		}


		if (typeof dialogZip.showModal === 'function') {
			if (!document.getElementById(dialogZip.id))
				document.body.appendChild(dialogZip);

			dialogZip.showModal();
		} else {
			/* fallback for incompatible browsers */
			if (!document.getElementById(DIALOG_BACKDROP_FALLBACK_ID)) {
				const dialogBackdrop = document.createElement('div');
				dialogBackdrop.id = DIALOG_BACKDROP_FALLBACK_ID;
				dialogBackdrop.className = 'rom-patcher-dialog-backdrop';
				dialogBackdrop.style.position = 'fixed';
				dialogBackdrop.style.top = '0';
				dialogBackdrop.style.left = '0';
				dialogBackdrop.style.width = '100%';
				dialogBackdrop.style.height = '100%';
				dialogBackdrop.style.display = 'none';
				dialogBackdrop.style.alignContent = 'center';
				dialogBackdrop.style.justifyContent = 'center';
				dialogBackdrop.style.zIndex = 1000;
				dialogBackdrop.appendChild(dialogZip);
				document.body.appendChild(dialogBackdrop);
			}

			document.getElementById(DIALOG_BACKDROP_FALLBACK_ID).style.display = 'flex';
			dialogZip.style.display = 'block';
		}
	}

	const _unzipError = function (zipReader) {
		if (zipReader.message)
			console.error('zip.js: ' + zipReader.message);
		romPatcherWeb.enable();
		romPatcherWeb.setErrorMessage(_('Error unzipping file'), 'error');
	};


	return {
		isZipFile: function (binFile) {
			binFile.seek(0);
			return binFile.getExtension() !== 'jar' && binFile.readString(4).startsWith(ZIP_MAGIC);
		},

		unzipRoms: function (arrayBuffer) {
			zip.createReader(
				new zip.BlobReader(new Blob([arrayBuffer])),
				/* success */
				function (zipReader) {
					zipReader.getEntries(function (zipEntries) {
						const filteredEntries = _filterEntriesRoms(zipEntries);

						if (filteredEntries.length === 1) {
							_unzipEntry(filteredEntries[0], romPatcherWeb.provideRomFile);
						} else if (filteredEntries.length > 1) {
							_showFilePicker(filteredEntries, romPatcherWeb.provideRomFile);
							romPatcherWeb.enable();
						} else {
							/* no possible patchable files found in zip, treat zip file as ROM file */
							romPatcherWeb.calculateCurrentRomChecksums();
						}
					});
				},
				/* failed */
				_unzipError
			);
		},

		unzipPatches: function (arrayBuffer) {
			zip.createReader(
				new zip.BlobReader(new Blob([arrayBuffer])),
				/* success */
				function (zipReader) {
					zipReader.getEntries(function (zipEntries) {
						const filteredEntries = _filterEntriesPatches(zipEntries);

						if (filteredEntries.length === 1) {
							_unzipEntry(filteredEntries[0], romPatcherWeb.providePatchFile);
						} else if (filteredEntries.length > 1) {
							_showFilePicker(filteredEntries, romPatcherWeb.providePatchFile);
						} else {
							romPatcherWeb.providePatchFile(null);
						}

					});
				},
				/* failed */
				_unzipError
			);
		},

		unzipAny: function (arrayBuffer) {
			zip.createReader(
				new zip.BlobReader(new Blob([arrayBuffer])),
				/* success */
				function (zipReader) {
					zipReader.getEntries(function (zipEntries) {
						const filteredEntriesRoms = _filterEntriesRoms(zipEntries);
						const filteredEntriesPatches = _filterEntriesPatches(zipEntries);

						if (filteredEntriesRoms.length && filteredEntriesPatches.length === 0) {
							if (filteredEntriesRoms.length === 1) {
								_unzipEntry(filteredEntriesRoms[0], romPatcherWeb.provideRomFile);
							} else {
								_showFilePicker(filteredEntriesRoms, romPatcherWeb.provideRomFile);
								romPatcherWeb.enable();
							}
						} else if (filteredEntriesPatches.length && filteredEntriesRoms.length === 0) {
							if (filteredEntriesPatches.length === 1) {
								_unzipEntry(filteredEntriesPatches[0], romPatcherWeb.providePatchFile);
							} else {
								_showFilePicker(filteredEntriesPatches, romPatcherWeb.providePatchFile);
							}
						} else {
							console.warn('ZIPManager.unzipAny: zip file contains both ROMs and patches, cannot guess');
						}
					});
				},
				/* failed */
				_unzipError
			);
		},

		unzipEmbededPatches: function (arrayBuffer, embededPatchesInfo) {
			zip.createReader(
				new zip.BlobReader(new Blob([arrayBuffer])),
				/* success */
				function (zipReader) {
					zipReader.getEntries(function (zipEntries) {
						const filteredEntries = _filterEntriesPatches(zipEntries);

						if (filteredEntries.length) {
							if (filteredEntries.length === 1) {
								if (embededPatchesInfo) {
									embededPatchesInfo[0].file = filteredEntries[0].filename;
									htmlElements.setText('span-loading-embeded-patch', embededPatchesInfo[0].file);
								} else {
									htmlElements.setText('span-loading-embeded-patch', filteredEntries[0].filename);
								}
							} else {
								var select = document.createElement('select');
								select.id = 'rom-patcher-select-file-patch';

								const spanLoadingEmbededPatch = htmlElements.get('span-loading-embeded-patch');
								if (spanLoadingEmbededPatch) {
									spanLoadingEmbededPatch.parentElement.replaceChild(select, spanLoadingEmbededPatch);

									for (var i = 0; i < filteredEntries.length; i++) {
										const embededPatchInfo = embededPatchesInfo.find((embededPatchInfo) => embededPatchInfo.file === filteredEntries[i].filename);
										var option = document.createElement('option');
										option.innerHTML = embededPatchInfo ? embededPatchInfo.name : filteredEntries[i].filename;
										option.value = i;
										select.appendChild(option);
										if (embededPatchInfo) {
											embededPatchInfo.selectIndex = i;
										}
									}

									select.addEventListener('change', function (evt) {
										const fileIndex = parseInt(this.value);
										_unzipEntry(filteredEntries[fileIndex], romPatcherWeb.providePatchFile);
									});
								} else {
									throw new Error('rom-patcher-select-file-patch not found');
								}
							}

							//_setPatchInputSpinner(false);
							_unzipEntry(filteredEntries[0], romPatcherWeb.providePatchFile);
						} else {
							romPatcherWeb.setErrorMessage(_('No valid patches found in ZIP'), 'error');
							romPatcherWeb.disable();
						}
					});
				},
				/* failed */
				_unzipError
			);
		}
	}
})(RomPatcherWeb);





/* Patch Builder */
const PatchBuilderWeb = (function (romPatcherWeb) {
	var originalRom, modifiedRom;

	/* localization */
	const _ = function (str) {
		const language = romPatcherWeb.getCurrentLanguage();
		return ROM_PATCHER_LOCALE[language] && ROM_PATCHER_LOCALE[language][str] ? ROM_PATCHER_LOCALE[language][str] : str
	};

	const _setCreateButtonSpinner = function (status) {
		if (status) {
			document.getElementById('patch-builder-button-create').innerHTML = '<span class="rom-patcher-spinner"></span> ' + _('Creating patch...');
		} else {
			document.getElementById('patch-builder-button-create').innerHTML = _('Create patch');
		}
	}

	const _setToastError = function (errorMessage, className) {
		const row = document.getElementById('patch-builder-row-error-message');
		const span = document.getElementById('patch-builder-error-message');

		if (row && span) {
			if (errorMessage) {
				row.classList.add('show');
				span.innerHTML = errorMessage;
			} else {
				row.classList.remove('show');
				span.innerHTML = '';
			}
			if (className === 'warning')
				span.classList.add('warning');
			else
				span.classList.remove('warning');
		} else {
			if (className === 'warning')
				console.warn('Patch Builder JS: ' + errorMessage);
			else
				console.error('Patch Builder JS: ' + errorMessage);
		}
	}

	const _setElementsStatus = function (status) {
		document.getElementById('patch-builder-input-file-original').disabled = !status;
		document.getElementById('patch-builder-input-file-modified').disabled = !status;
		document.getElementById('patch-builder-select-patch-type').disabled = !status;
		if (originalRom && modifiedRom && status) {
			document.getElementById('patch-builder-button-create').disabled = !status;
		} else {
			document.getElementById('patch-builder-button-create').disabled = true
		}
	};

	const webWorkerCreate = new Worker(ROM_PATCHER_JS_PATH + 'RomPatcher.webworker.create.js');
	webWorkerCreate.onmessage = event => { // listen for events from the worker
		//retrieve arraybuffers back from webworker
		originalRom._u8array = event.data.originalRomU8Array;
		modifiedRom._u8array = event.data.modifiedRomU8Array;

		_setElementsStatus(true);
		_setCreateButtonSpinner(false);

		const patchFile = new BinFile(event.data.patchFileU8Array.buffer);
		patchFile.fileName = modifiedRom.getName() + '.' + document.getElementById('patch-builder-select-patch-type').value;
		patchFile.save();

		_setToastError();
	};
	webWorkerCreate.onerror = event => { // listen for events from the worker
		_setElementsStatus(true);
		_setCreateButtonSpinner(false);
		_setToastError('webWorkerCreate error: ' + event.message);
	};

	var initialized = false;
	return {
		isInitialized: function () {
			return initialized;
		},

		initialize: function () {
			if (initialized)
				throw new Error('Patch Builder JS was already initialized');
			else if (!romPatcherWeb.isInitialized())
				throw new Error('Rom Patcher JS must be initialized before Patch Builder JS');

			document.getElementById('patch-builder-button-create').disabled = true;

			document.getElementById('patch-builder-input-file-original').addEventListener('change', function () {
				_setElementsStatus(false);
				this.classList.remove('empty');
				originalRom = new BinFile(this.files[0], function (evt) {
					_setElementsStatus(true);

					if (RomPatcher.isRomTooBig(originalRom))
						_setToastError(_('Using big files is not recommended'), 'warning');
					else if (ZIPManager.isZipFile(originalRom))
						_setToastError(_('Patch creation is not compatible with zipped ROMs'), 'warning');
				});
			});
			document.getElementById('patch-builder-input-file-modified').addEventListener('change', function () {
				_setElementsStatus(false);
				this.classList.remove('empty');
				modifiedRom = new BinFile(this.files[0], function (evt) {
					_setElementsStatus(true);

					if (RomPatcher.isRomTooBig(modifiedRom))
						_setToastError(_('Using big files is not recommended'), 'warning');
					else if (ZIPManager.isZipFile(modifiedRom))
						_setToastError(_('Patch creation is not compatible with zipped ROMs'), 'warning');
				});
			});
			document.getElementById('patch-builder-button-create').addEventListener('click', function () {
				_setElementsStatus(false);
				_setCreateButtonSpinner(true);
				webWorkerCreate.postMessage(
					{
						originalRomU8Array: originalRom._u8array,
						modifiedRomU8Array: modifiedRom._u8array,
						format: document.getElementById('patch-builder-select-patch-type').value
					}, [
					originalRom._u8array.buffer,
					modifiedRom._u8array.buffer
				]
				);
			});

			console.log('Patch Builder JS initialized');
			initialized = true;
			_setElementsStatus(true);
		}
	}
}(RomPatcherWeb));




















const ROM_PATCHER_LOCALE = {
	'fr': {
		'Creator mode': 'Mode créateur',
		'Settings': 'Configurations',
		'Use patch name for output': 'Utiliser le nom du patch pour renommer la ROM une fois patchée',
		'Light theme': 'Thème Clair',

		'Apply patch': 'Appliquer le patch',
		'ROM file:': 'Fichier ROM:',
		'Patch file:': 'Fichier patch:',
		'Remove %s header': 'Supprimer l\'en-tête %s',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Formats compatibles:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Application du patch...',
		'Downloading...': 'Téléchargement...',
		'Unzipping...': 'Décompresser...',

		'Create patch': 'Créer le patch',
		'Original ROM:': 'ROM originale:',
		'Modified ROM:': 'ROM modifiée:',
		'Patch type:': 'Type de patch:',
		'Creating patch...': 'Création du patch...',

		'Source ROM checksum mismatch': 'Non-concordance de la somme de contrôle de la ROM source',
		'Target ROM checksum mismatch': 'Non-concordance de la somme de contrôle de la ROM cible',
		'Patch checksum mismatch': 'Non-concordance de la somme de contrôle du patch',
		'Error downloading %s': 'Erreur lors du téléchargement du patch',
		'Error unzipping file': 'Erreur lors de la décompression du fichier',
		'Invalid patch file': 'Fichier patch invalide',
		'Using big files is not recommended': 'L\'utilisation de gros fichiers n\'est pas recommandée'
	},
	'de': {
		'Creator mode': 'Erstellmodus',
		'Settings': 'Einstellungen',
		'Use patch name for output': 'Output ist Name vom Patch',
		'Fix ROM header checksum': 'Prüfsumme im ROM Header korrigieren',
		'Light theme': 'Helles Design',

		'Apply patch': 'Patch anwenden',
		'ROM file:': 'ROM-Datei:',
		'Patch file:': 'Patch-Datei:',
		'Remove %s header': 'Header entfernen %s',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Unterstützte Formate:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Patch wird angewandt...',
		'Downloading...': 'Herunterladen...',
		'Unzipping...': 'Entpacken...',

		'Create patch': 'Patch erstellen',
		'Original ROM:': 'Originale ROM:',
		'Modified ROM:': 'Veränderte ROM:',
		'Patch type:': 'Patch-Format:',
		'Creating patch...': 'Patch wird erstellt...',

		'Source ROM checksum mismatch': 'Prüfsumme der Input-ROM stimmt nicht überein',
		'Target ROM checksum mismatch': 'Prüfsumme der Output-ROM stimmt nicht überein',
		'Patch checksum mismatch': 'Prüfsumme vom Patch stimmt nicht überein',
		'Error downloading %s': 'Fehler beim Herunterladen vom %s',
		'Error unzipping file': 'Fehler beim Entpacken',
		'Invalid patch file': 'Ungültiger Patch',
		'Using big files is not recommended': 'Große Dateien zu verwenden ist nicht empfohlen'
	},
	'es': {
		'Creator mode': 'Modo creador',
		'Settings': 'Configuración',
		'Use patch name for output': 'Guardar con nombre del parche',
		'Fix ROM header checksum': 'Corregir checksum cabecera ROM',
		'Light theme': 'Tema claro',

		'Apply patch': 'Aplicar parche',
		'ROM file:': 'Archivo ROM:',
		'Patch file:': 'Archivo parche:',
		'Remove %s header': 'Quitar cabecera %s',
		'Add %s header': 'Añadir cabecera %s',
		'Compatible formats:': 'Formatos compatibles:',
		'Description:': 'Descripción:',
		'Required ROM:': 'ROM requerida:',
		'Required %s:': '%s requerido:',
		'Applying patch...': 'Aplicando parche...',
		'Downloading...': 'Descargando...',
		'Unzipping...': 'Descomprimiendo...',
		'Calculating...': 'Calculando...',
		'Force calculate checksum': 'Forzar cálculo de checksum',

		'Create patch': 'Crear parche',
		'Original ROM:': 'ROM original:',
		'Modified ROM:': 'ROM modificada:',
		'Patch type:': 'Tipo de parche:',
		'Creating patch...': 'Creando parche...',

		'Source ROM checksum mismatch': 'Checksum de ROM original no válida',
		'Target ROM checksum mismatch': 'Checksum de ROM creada no válida',
		'Patch checksum mismatch': 'Checksum de parche no válida',
		'Error downloading %s': 'Error descargando %s',
		'Error unzipping file': 'Error descomprimiendo archivo',
		'Invalid patch file': 'Archivo de parche no válido',
		'Using big files is not recommended': 'No es recomendable usar archivos muy grandes',

		'SNES copier': 'copión SNES'
	},
	'it': {
		'Creator mode': 'Modalità creatore',
		'Settings': 'Impostazioni',
		'Use patch name for output': 'Usa il nome della patch per uscita',
		'Light theme': 'Tema chiaro',

		'Apply patch': 'Applica patch',
		'ROM file:': 'File ROM:',
		'Patch file:': 'File patch:',
		'Remove %s header': 'Rimuovi header %s',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Formati:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Applica patch...',
		'Downloading...': 'Scaricamento...',
		'Unzipping...': 'Estrazione...',

		'Create patch': 'Crea patch',
		'Original ROM:': 'ROM originale:',
		'Modified ROM:': 'ROM modificata:',
		'Patch type:': 'Tipologia patch:',
		'Creating patch...': 'Creazione patch...',

		'Source ROM checksum mismatch': 'Checksum della ROM sorgente non valido',
		'Target ROM checksum mismatch': 'Checksum della ROM destinataria non valido',
		'Patch checksum mismatch': 'Checksum della patch non valido',
		'Error downloading %s': 'Errore di scaricamento %s',
		'Error unzipping file': 'Errore estrazione file',
		'Invalid patch file': 'File della patch non valido',
		'Using big files is not recommended': 'Non è raccomandato usare file di grandi dimensioni'
	},
	'nl': {
		'Creator mode': 'Creator-modus',
		'Settings': 'Settings',
		'Use patch name for output': 'Use patch name for output',
		'Light theme': 'Light theme',

		'Apply patch': 'Pas patch toe',
		'ROM file:': 'ROM bestand:',
		'Patch file:': 'Patch bestand:',
		'Remove %s header': 'Verwijder rubriek %s',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Compatibele formaten:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Patch toepassen...',
		'Downloading...': 'Downloaden...',
		'Unzipping...': 'Uitpakken...',

		'Create patch': 'Maak patch',
		'Original ROM:': 'Originale ROM:',
		'Modified ROM:': 'Aangepaste ROM:',
		'Patch type:': 'Type patch:',
		'Creating patch...': 'Patch maken...',

		'Source ROM checksum mismatch': 'Controlesom van bron-ROM komt niet overeen',
		'Target ROM checksum mismatch': 'Controlesom van doel-ROM komt niet overeen',
		'Patch checksum mismatch': 'Controlesom van patch komt niet overeen',
		'Error downloading %s': 'Fout bij downloaden van patch',
		'Error unzipping file': 'Fout bij uitpakken van bestand',
		'Invalid patch file': 'Ongeldig patchbestand',
		'Using big files is not recommended': 'Het gebruik van grote bestanden wordt niet aanbevolen'
	},
	'sv': {
		'Creator mode': 'Skaparläge',
		'Settings': 'Settings',
		'Use patch name for output': 'Use patch name for output',
		'Light theme': 'Light theme',

		'Apply patch': 'Tillämpa korrigeringsfil',
		'ROM file:': 'ROM-fil:',
		'Patch file:': 'Korrigeringsfil:',
		'Remove %s header': 'Ta bort rubrik %s',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Kompatibla format:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Tillämpar korrigeringsfil...',
		'Downloading...': 'Ladda ner...',
		'Unzipping...': 'Packa upp...',

		'Create patch': 'Skapa korrigeringsfil',
		'Original ROM:': 'Original-ROM:',
		'Modified ROM:': 'Modifierad ROM:',
		'Patch type:': 'Korrigeringsfil-typ:',
		'Creating patch...': 'Skapa korrigeringsfil...',

		'Source ROM checksum mismatch': 'ROM-källans kontrollsumman matchar inte',
		'Target ROM checksum mismatch': 'ROM-målets kontrollsumman matchar inte',
		'Patch checksum mismatch': 'korrigeringsfilens kontrollsumman matchar inte',
		'Error downloading %s': 'Fel vid nedladdning av korrigeringsfilen',
		'Error unzipping file': 'Det gick inte att packa upp filen',
		'Invalid patch file': 'Ogiltig korrigeringsfil',
		'Using big files is not recommended': 'Användning av stora filer rekommenderas inte'
	},
	'ca': {
		'Creator mode': 'Mode creador',
		'Settings': 'Configuració',
		'Use patch name for output': 'Desar amb nom del pedaç',
		'Light theme': 'Tema clar',

		'Apply patch': 'Aplicar pedaç',
		'ROM file:': 'Arxiu ROM:',
		'Patch file:': 'Arxiu pedaç:',
		'Remove %s header': 'Treure capçalera %s',
		'Add %s header': 'Afegir capçalera %s',
		'Compatible formats:': 'Formats compatibles:',
		'Description:': 'Descripció:',
		'Required ROM:': 'ROM requerida:',
		'Required %s:': '%s requerit:',
		'Applying patch...': 'Aplicant pedaç...',
		'Downloading...': 'Descarregant...',
		'Unzipping...': 'Descomprimint...',

		'Create patch': 'Crear pedaç',
		'Original ROM:': 'ROM original:',
		'Modified ROM:': 'ROM modificada:',
		'Patch type:': 'Tipus de pedaç:',
		'Creating patch...': 'Creant pedaç...',

		'Source ROM checksum mismatch': 'Checksum de ROM original no vàlida',
		'Target ROM checksum mismatch': 'Checksum de ROM creada no vàlida',
		'Patch checksum mismatch': 'Checksum de pedaç no vàlida',
		'Error downloading %s': 'Error descarregant %s',
		'Error unzipping file': 'Error descomprimint arxiu',
		'Invalid patch file': 'Arxiu de pedaç no vàlid',
		'Using big files is not recommended': 'No és recomanable usar arxius molt grans'
	},
	'ca-va': {
		'Creator mode': 'Mode creador',
		'Settings': 'Configuració',
		'Use patch name for output': 'Guardar amb nom del pedaç',
		'Light theme': 'Tema clar',

		'Apply patch': 'Aplicar pedaç',
		'ROM file:': 'Arxiu ROM:',
		'Patch file:': 'Arxiu pedaç:',
		'Remove %s header': 'Llevar capçalera %s',
		'Add %s header': 'Afegir capçalera %s',
		'Compatible formats:': 'Formats compatibles:',
		'Description:': 'Descripció:',
		'Required ROM:': 'ROM requerida:',
		'Required %s:': '%s requerit:',
		'Applying patch...': 'Aplicant pedaç...',
		'Downloading...': 'Descarregant...',
		'Unzipping...': 'Descomprimint...',

		'Create patch': 'Crear pedaç',
		'Original ROM:': 'ROM original:',
		'Modified ROM:': 'ROM modificada:',
		'Patch type:': 'Tipus de pedaç:',
		'Creating patch...': 'Creant pedaç...',

		'Source ROM checksum mismatch': 'Checksum de ROM original incorrecta',
		'Target ROM checksum mismatch': 'Checksum de ROM creada incorrecta',
		'Patch checksum mismatch': 'Checksum de pedaç incorrecte',
		'Error downloading %s': 'Error descarregant %s',
		'Error unzipping file': 'Error descomprimint arxiu',
		'Invalid patch file': 'Arxiu de pedaç incorrecte',
		'Using big files is not recommended': 'No és recomanable utilitzar arxius molt grans'
	},
	'ru': {
		'Creator mode': 'Режим создания',
		'Settings': 'Settings',
		'Use patch name for output': 'Use patch name for output',
		'Light theme': 'Light theme',

		'Apply patch': 'Применить патч',
		'ROM file:': 'Файл ROM:',
		'Patch file:': 'Файл патча:',
		'Remove %s header': 'Удалить заголовок перед применением',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Совместимые форматы:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Применяется патч...',
		'Downloading...': 'Загрузка...',
		'Unzipping...': 'Unzipping...',

		'Create patch': 'Создать патч',
		'Original ROM:': 'Оригинальный ROM:',
		'Modified ROM:': 'Изменённый ROM:',
		'Patch type:': 'Тип патча:',
		'Creating patch...': 'Патч создаётся...',

		'Source ROM checksum mismatch': 'Неправильная контрольная сумма входного ROM',
		'Target ROM checksum mismatch': 'Неправильная контрольная сумма выходного ROM',
		'Patch checksum mismatch': 'Неправильная контрольная сумма патча',
		'Error downloading %s': 'Ошибка при скачивании патча',
		'Error unzipping file': 'Error unzipping file',
		'Invalid patch file': 'Неправильный файл патча',
		'Using big files is not recommended': 'Не рекомендуется использовать большие файлы'
	},
	'pt-br': {
		'Creator mode': 'Modo criador',
		'Settings': 'Configurações',
		'Use patch name for output': 'Usar o nome do patch na saída',
		'Fix ROM header checksum': 'Consertar o checksum do cabeçalho da ROM',
		'Light theme': 'Tema leve',

		'Apply patch': 'Aplicar patch',
		'ROM file:': 'Arquivo da ROM:',
		'Patch file:': 'Arquivo do patch:',
		'Remove %s header': 'Remover cabeçalho %s',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': 'Formatos compatíveis:',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'Aplicando patch...',
		'Downloading...': 'Baixando...',
		'Unzipping...': 'Descompactando...',

		'Create patch': 'Criar patch',
		'Original ROM:': 'ROM original:',
		'Modified ROM:': 'ROM modificada:',
		'Patch type:': 'Tipo de patch:',
		'Creating patch...': 'Criando o patch...',

		'Source ROM checksum mismatch': 'O checksum da ROM original é inválido',
		'Target ROM checksum mismatch': 'O checksum da ROM alvo é inválido',
		'Patch checksum mismatch': 'O checksum do patch é inválido',
		'Error downloading %s': 'Erro ao baixar o %s',
		'Error unzipping file': 'Erro ao descompactar o arquivo',
		'Invalid patch file': 'Arquivo do patch inválido',
		'Using big files is not recommended': 'O uso de arquivos grandes não é recomendado'
	},
	'ja': {
		'Creator mode': '作成モード',
		'Settings': '設定',
		'Use patch name for output': 'パッチと同じ名前で出力',
		'Light theme': 'ライトテーマ',

		'Apply patch': 'パッチを当て',
		'ROM file:': 'ROMファィル：',
		'Patch file:': 'パッチファイル：',
		'Remove %s header': 'ヘッダーを削除',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': '互換性のあるフォーマット：',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': 'パッチを当ている…',
		'Downloading...': 'ダウンロードしている…',
		'Unzipping...': '解凍している…',

		'Create patch': 'パッチを作成',
		'Original ROM:': '元のROM：',
		'Modified ROM:': '変更されたROM：',
		'Patch type:': 'パッチのタイプ：',
		'Creating patch...': 'パッチを作成している…',

		'Source ROM checksum mismatch': 'ソースROMチェックサムの不一致',
		'Target ROM checksum mismatch': 'ターゲットROMチェクサムの不一致',
		'Patch checksum mismatch': 'バッチチェックサムの不一致',
		'Error downloading %s': 'パッチのダウンロードエラー',
		'Error unzipping file': 'パッチの解凍エラー',
		'Invalid patch file': '無効なパッチエラー',
		'Using big files is not recommended': '大きなファイルの使いはおすすめしない。'
	},
	'zh-cn': {
		'Creator mode': '创建模式',
		'Settings': '设置',
		'Use patch name for output': '修改后ROM文件名和补丁保持一致',
		'Light theme': '浅色主题',

		'Apply patch': '打补丁',
		'ROM file:': 'ROM文件：',
		'Patch file:': '补丁文件：',
		'Remove %s header': '删除文件头',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': '兼容补丁格式：',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': '正在打补丁……',
		'Downloading...': '正在下载……',
		'Unzipping...': '正在解压……',

		'Create patch': '创建补丁',
		'Original ROM:': '原始ROM：',
		'Modified ROM:': '修改后ROM：',
		'Patch type:': '补丁类型：',
		'Creating patch...': '正在创建补丁……',

		'Source ROM checksum mismatch': '原始ROM校验和不匹配',
		'Target ROM checksum mismatch': '目标ROM校验和不匹配',
		'Patch checksum mismatch': '补丁文件校验和不匹配',
		'Error downloading %s': '下载出错：%s',
		'Error unzipping file': '解压出错',
		'Invalid patch file': '无效补丁',
		'Using big files is not recommended': '不推荐使用大文件。'
	},
	'zh-tw': {
		'Creator mode': '創作者模式',
		'Settings': '設定',
		'Use patch name for output': '修改後ROM檔名和patch保持一致',
		'Fix ROM header checksum': '修正ROM檔頭校驗碼',
		'Light theme': '淺色主題',

		'Apply patch': '套用patch',
		'ROM file:': 'ROM檔：',
		'Patch file:': 'patch檔：',
		'Remove %s header': '刪除檔頭',
		//'Add %s header': 'Add %s header',
		'Compatible formats:': '相容格式：',
		//'Description:': 'Description:',
		//'Required ROM:': 'Required ROM:',
		//'Required %s:': 'Required %s:',
		'Applying patch...': '套用patch中……',
		'Downloading...': '下載中……',
		'Unzipping...': '解壓中……',

		'Create patch': '創建patch',
		'Original ROM:': '原始ROM：',
		'Modified ROM:': '修改後ROM：',
		'Patch type:': 'patch類型：',
		'Creating patch...': '正在創建patch……',

		'Source ROM checksum mismatch': '原始ROM校驗碼不匹配',
		'Target ROM checksum mismatch': '目標ROM校驗碼不匹配',
		'Patch checksum mismatch': 'patch檔校驗碼不匹配',
		'Error downloading %s': '下載出錯：%s',
		'Error unzipping file': '解壓出錯',
		'Invalid patch file': '無效的patch檔',
		'Using big files is not recommended': '不建議使用大檔。'
	}
};