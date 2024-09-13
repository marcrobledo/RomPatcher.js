/* Rom Patcher JS (complete webapp implementation) v20240809 - Marc Robledo 2016-2024 - http://www.marcrobledo.com/license */


/* service worker */
const FORCE_HTTPS = true;
if (FORCE_HTTPS && location.protocol === 'http:')
	location.href = window.location.href.replace('http:', 'https:');
else if (location.protocol === 'https:' && 'serviceWorker' in navigator && window.location.hostname === 'www.marcrobledo.com')
	navigator.serviceWorker.register('/RomPatcher.js/_cache_service_worker.js', { scope: '/RomPatcher.js/' }); /* using absolute paths to avoid unexpected behaviour in GitHub Pages */


/* settings */
const LOCAL_STORAGE_SETTINGS_ID = 'rom-patcher-js-settings';
/* default settings */
const settings = {
	language: typeof navigator.userLanguage === 'string' ? navigator.userLanguage.substr(0, 2) : 'en',
	outputSuffix: true,
	fixChecksum: false,
	theme: 'default'
};
/* load settings from localStorage */
if (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_STORAGE_SETTINGS_ID)) {
	try {
		const loadedSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SETTINGS_ID));

		if (typeof loadedSettings.language === 'string')
			settings.language = loadedSettings.language;

		if (typeof loadedSettings.outputSuffix === 'boolean')
			settings.outputSuffix = loadedSettings.outputSuffix;

		if (typeof loadedSettings.fixChecksum === 'boolean')
			settings.fixChecksum = loadedSettings.fixChecksum;

		if (typeof loadedSettings.theme === 'string' && ['light'].indexOf(loadedSettings.theme) !== -1)
			settings.theme = loadedSettings.theme;
	} catch (err) {
		console.error('Error while loading settings: ' + err.message);
	}
}
const buildSettingsForWebapp = function () {
	return {
		language: settings.language,
		outputSuffix: settings.outputSuffix,
		fixChecksum: settings.fixChecksum,
		allowDropFiles: true,
		ondropfiles:function(evt){
			if(currentMode === 'creator'){
				ocument.getElementById('switch-create-button').click();
			}
		}
	};
}
const saveSettings = function () {
	if (typeof localStorage !== 'undefined')
		localStorage.setItem(LOCAL_STORAGE_SETTINGS_ID, JSON.stringify(settings));
	RomPatcherWeb.setSettings(buildSettingsForWebapp());
}


var currentMode = 'patcher';



window.addEventListener('load', function (evt) {
	/* set theme */
	document.body.className = 'theme-' + settings.theme;

	/* event listeners */
	document.getElementById('button-settings').addEventListener('click', function (evt) {
		document.getElementById('dialog-settings').showModal();
	});
	document.getElementById('dialog-settings-button-close').addEventListener('click', function (evt) {
		document.getElementById('dialog-settings').close();
	});

	document.getElementById('settings-language').value = settings.language;
	document.getElementById('settings-language').addEventListener('change', function () {
		settings.language = this.value;
		saveSettings();
		RomPatcherWeb.translateUI(settings.language);
	});

	document.getElementById('settings-output-suffix').checked = !settings.outputSuffix;
	document.getElementById('settings-output-suffix').addEventListener('change', function () {
		settings.outputSuffix = !this.checked;
		saveSettings();
	});

	document.getElementById('settings-fix-checksum').checked = settings.fixChecksum;
	document.getElementById('settings-fix-checksum').addEventListener('change', function () {
		settings.fixChecksum = this.checked;
		saveSettings();
	});

	document.getElementById('settings-light-theme').checked = settings.theme === 'light';
	document.getElementById('settings-light-theme').addEventListener('change', function () {
		settings.theme = this.checked ? 'light' : 'default';
		saveSettings();
		document.body.className = 'theme-' + settings.theme;
	});

	document.getElementById('switch-create-button').addEventListener('click', function () {
		if(!RomPatcherWeb.isInitialized())
			throw new Error('Rom Patcher JS is not initialized yet');

		if (/disabled/.test(document.getElementById('switch-create').className)) {
			try{
				if(!PatchBuilderWeb.isInitialized())
					PatchBuilderWeb.initialize();
			}catch(err){
				document.getElementById('patch-builder-container').innerHTML = err.message;
				document.getElementById('patch-builder-container').style.color = 'red';
			}

			currentMode = 'creator';
			document.getElementById('rom-patcher-container').style.display = 'none';
			document.getElementById('patch-builder-container').style.display = 'block';
			document.getElementById('switch-create').className = 'switch enabled';
		} else {
			currentMode = 'patcher';
			document.getElementById('rom-patcher-container').style.display = 'block';
			document.getElementById('patch-builder-container').style.display = 'none';
			document.getElementById('switch-create').className = 'switch disabled';
		}
	});

	try {
		const initialSettings = buildSettingsForWebapp();
		RomPatcherWeb.initialize(initialSettings);
	} catch (err) {
		var message = err.message;
		if (/incompatible browser/i.test(message) || /variable RomPatcherWeb/i.test(message))
			message = 'Your browser is outdated and it is not compatible with the latest version of Rom Patcher JS.<br/><a href="legacy/">Try the legacy version</a>';

		document.getElementById('rom-patcher-container').innerHTML = message;
		document.getElementById('rom-patcher-container').style.color = 'red';
	}
});

