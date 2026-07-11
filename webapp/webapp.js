/* Rom Patcher JS (complete webapp implementation) v20260711 - Marc Robledo 2016-2026 - http://www.marcrobledo.com/license */


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
	theme: 'default',
	showDonationInfoOn: null
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

		if (typeof loadedSettings.showDonationInfoOn === 'number')
			settings.showDonationInfoOn = loadedSettings.showDonationInfoOn;
	} catch (err) {
		console.error('Error while loading settings: ' + err.message);
	}
}
const buildSettingsForWebapp = function () {
	return {
		language: settings.language,
		outputSuffix: settings.outputSuffix,
		fixChecksum: settings.fixChecksum,
		allowDropFiles: true
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
		RomPatcherDonationInfo.retranslate();
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
		if (!RomPatcherWeb.isInitialized())
			throw new Error('Rom Patcher JS is not initialized yet');

		if (/disabled/.test(document.getElementById('switch-create').className)) {
			try {
				if (!PatchBuilderWeb.isInitialized())
					PatchBuilderWeb.initialize();
			} catch (err) {
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

	/* show donation info */
	RomPatcherDonationInfo.show();

	try {
		const initialSettings = buildSettingsForWebapp();
		RomPatcherWeb.initialize(initialSettings);
		RomPatcherDonationInfo.retranslate();
	} catch (err) {
		var message = err.message;
		if (/incompatible browser/i.test(message) || /variable RomPatcherWeb/i.test(message))
			message = 'Your browser is outdated and it is not compatible with the latest version of Rom Patcher JS.<br/><a href="legacy/">Try the legacy version</a>';

		document.getElementById('rom-patcher-container').innerHTML = message;
		document.getElementById('rom-patcher-container').style.color = 'red';
	}
});




const RomPatcherDonationInfo = (function () {
	const LOCALE = {
		'en': [
			'In light of recent global tech changes, Rom Patcher JS infrastructure costs have increased.',
			'If you\'d like to help, any donation will go toward covering these costs and will be greatly appreciated.',
			'Donate',
			'Dismiss',
		],
		'fr': [
			'À la lumière des récents changements technologiques à l\'échelle mondiale, les coûts d\'infrastructure de Rom Patcher JS ont augmenté.',
			'Si vous souhaitez nous aider, tout don contribuera à couvrir ces coûts et sera grandement apprécié.',
			'Faire un don',
			'Fermer',
		],
		'de': [
			'Aufgrund der jüngsten globalen Veränderungen im Technologiesektor sind die Infrastrukturkosten von Rom Patcher JS gestiegen.',
			'Wenn du uns unterstützen möchtest, hilft jede Spende dabei, diese Kosten zu decken, und ist sehr willkommen.',
			'Spenden',
			'Schließen',
		],
		'es': [
			'Debido a los recientes cambios tecnológicos a nivel mundial, los costes de infraestructura de Rom Patcher JS han aumentado.',
			'Si deseas ayudar, cualquier donación contribuirá a cubrir estos costes y será bienvenida.',
			'Donar',
			'Cerrar',
		],
		'it': [
			'A causa dei recenti cambiamenti tecnologici a livello globale, i costi dell\'infrastruttura di Rom Patcher JS sono aumentati.',
			'Se desideri aiutarci, qualsiasi donazione contribuirà a coprire questi costi e sarà molto apprezzata.',
			'Fai una donazione',
			'Chiudi',
		],
		'nl': [
			'Door recente wereldwijde veranderingen in de technologiesector zijn de infrastructuurkosten van Rom Patcher JS gestegen.',
			'Als je wilt helpen, draagt elke donatie bij aan het dekken van deze kosten en wordt die enorm gewaardeerd.',
			'Doneren',
			'Sluiten',
		],
		'sv': [
			'På grund av de senaste globala förändringarna inom teknik har infrastrukturkostnaderna för Rom Patcher JS ökat.',
			'Om du vill hjälpa till går alla donationer till att täcka dessa kostnader och uppskattas mycket.',
			'Donera',
			'Stäng',
		],
		'ca': [
			'A causa dels recents canvis tecnològics a escala mundial, els costos d\'infraestructura de Rom Patcher JS han augmentat.',
			'Si vols ajudar, qualsevol donació contribuirà a cobrir aquests costos i serà benvinguda.',
			'Donar',
			'Tancar',
		],
		'ca-va': [
			'A causa dels recents canvis tecnològics a escala mundial, els costos d\'infraestructura de Rom Patcher JS han augmentat.',
			'Si vols ajudar, qualsevol donació contribuirà a cobrir aquests costos i serà benvinguda.',
			'Donar',
			'Tancar',
		],
		'ru': [
			'В связи с недавними глобальными изменениями в сфере технологий расходы на инфраструктуру Rom Patcher JS выросли.',
			'Если вы хотите помочь, любое пожертвование пойдёт на покрытие этих расходов и будет искренне оценено.',
			'Пожертвовать',
			'Закрыть',
		],
		'pt-br': [
			'Devido às recentes mudanças tecnológicas em nível global, os custos de infraestrutura do Rom Patcher JS aumentaram.',
			'Se você quiser ajudar, qualquer doação contribuirá para cobrir esses custos e será muito bem-vinda.',
			'Doar',
			'Fechar',
		],
		'ja': [
			'近年の世界的な技術環境の変化により、Rom Patcher JS のインフラ運用コストが増加しています。',
			'ご支援いただける場合は、いただいた寄付をこれらの費用の補填に充てさせていただきます。ご協力に心より感謝いたします。',
			'寄付する',
			'閉じる',
		],
		'zh-cn': [
			'由于近期全球技术环境的变化，Rom Patcher JS 的基础设施成本有所增加',
			'如果您愿意支持我们，任何捐赠都将用于支付这些成本，我们将不胜感激。',
			'捐赠',
			'关闭',
		],
		'zh-tw': [
			'由於近期全球技術環境的變化，Rom Patcher JS 的基礎設施成本有所增加。',
			'如果您願意支持我們，任何捐款都將用於支付這些成本，我們將不勝感激。',
			'捐款',
			'關閉',
		]
	};

	return {
		show: function () {
			if(location.protocol !== 'file:' && window.location.hostname === 'www.marcrobledo.com' && document.getElementById('donation-info')){
				if (settings.showDonationInfoOn === null || Date.now() > settings.showDonationInfoOn) {
					document.getElementById('donation-info').style.display = 'block';
				}

				const _evtClickDonationInfoBtn = function (evt) {
					document.getElementById('donation-info').style.display = 'none';
					settings.showDonationInfoOn = Date.now() + 30 * 24 * 60 * 60 * 1000;
					saveSettings();
				};
				if (document.getElementById('btn-donation-info-donate'))
					document.getElementById('btn-donation-info-donate').addEventListener('click', _evtClickDonationInfoBtn);
				if (document.getElementById('btn-donation-info-dismiss'))
					document.getElementById('btn-donation-info-dismiss').addEventListener('click', _evtClickDonationInfoBtn);
			}
		},
		retranslate: function () {
			const currentLang = RomPatcherWeb.getCurrentLanguage();
			const locale = LOCALE[currentLang] || LOCALE['en'];

			const elems = document.querySelectorAll('*[data-donation-info-localize="yes"]');
			elems.forEach(function (elem, index) {
				if (index < locale.length)
					elem.innerHTML = locale[index];
			});

			return locale;
		}
	}
}());