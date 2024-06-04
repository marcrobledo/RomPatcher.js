/* Rom Patcher JS v20230406 - Marc Robledo 2016-2023 - http://www.marcrobledo.com/license */

const TOO_BIG_ROM_SIZE=67108863;
const HEADERS_INFO=[
	[/\.nes$/, 16, 1024], //interNES
	[/\.fds$/, 16, 65500], //fwNES
	[/\.lnx$/, 64, 1024],
	//[/\.rom$/, 8192, 1024], //jaguar
	[/\.(pce|nes|gbc?|smc|sfc|fig|swc)$/, 512, 1024]
];


var romFile, patchFile, patch, romFile1, romFile2, tempFile, headerSize, oldHeader;


/* Shortcuts */
function addEvent(e,ev,f){e.addEventListener(ev,f,false)}
function el(e){return document.getElementById(e)}
function _(str){return (LOCALIZATION[AppSettings.langCode] && LOCALIZATION[AppSettings.langCode][str]) || LOCALIZATION['en'][str] || str}





/* custom patcher */
function isCustomPatcherEnabled(){
	return typeof CUSTOM_PATCHER!=='undefined' && typeof CUSTOM_PATCHER==='object' && CUSTOM_PATCHER.length
}
function parseCustomPatch(customPatch){
	patchFile=customPatch.fetchedFile;
	patchFile.seek(0);
	_readPatchFile();

	if(typeof patch.validateSource === 'undefined'){
		if(typeof customPatch.crc==='number'){
			patch.validateSource=function(romFile,headerSize){
				return customPatch.crc===crc32(romFile, headerSize)
			}
		}else if(typeof customPatch.crc==='object'){
			patch.validateSource=function(romFile,headerSize){
				for(var i=0; i<customPatch.crc.length; i++)
					if(customPatch.crc[i]===crc32(romFile, headerSize))
						return true;
				return false;
			}
		}
		validateSource();
	}
}	
function fetchPatch(customPatchIndex, compressedFileIndex){
	var customPatch=CUSTOM_PATCHER[customPatchIndex];

	setTabApplyEnabled(false);
	setMessage('apply', 'downloading', 'loading');

	var uri=decodeURI(customPatch.file.trim());

	//console.log(patchURI);

	if(typeof window.fetch==='function'){
		fetch(uri)
			.then(result => result.arrayBuffer()) // Gets the response and returns it as a blob
			.then(arrayBuffer => {
				patchFile=CUSTOM_PATCHER[customPatchIndex].fetchedFile=new MarcFile(arrayBuffer);
				patchFile.fileName=customPatch.file.replace(/^.*[\/\\]/g,'');

				if(patchFile.getExtension()!=='jar' && patchFile.readString(4).startsWith(ZIP_MAGIC))
					ZIPManager.parseFile(CUSTOM_PATCHER[customPatchIndex].fetchedFile, compressedFileIndex);
				else
					parseCustomPatch(CUSTOM_PATCHER[customPatchIndex]);

				setMessage('apply');
			})
			.catch(function(evt){
				setMessage('apply', (_('error_downloading')/* + evt.message */).replace('%s', CUSTOM_PATCHER[customPatchIndex].file.replace(/^.*[\/\\]/g,'')), 'error');
			});
	}else{
		var xhr=new XMLHttpRequest();
		xhr.open('GET', uri, true);
		xhr.responseType='arraybuffer';

		xhr.onload=function(evt){
			if(this.status===200){
				patchFile=CUSTOM_PATCHER[customPatchIndex].fetchedFile=new MarcFile(xhr.response);
				patchFile.fileName=customPatch.file.replace(/^.*[\/\\]/g,'');

				if(patchFile.getExtension()!=='jar' && patchFile.readString(4).startsWith(ZIP_MAGIC))
					ZIPManager.parseFile(CUSTOM_PATCHER[customPatchIndex].fetchedFile, compressedFileIndex);
				else
					parseCustomPatch(CUSTOM_PATCHER[customPatchIndex]);

				setMessage('apply');
			}else{
				setMessage('apply', _('error_downloading').replace('%s', CUSTOM_PATCHER[customPatchIndex].file.replace(/^.*[\/\\]/g,''))+' ('+this.status+')', 'error');
			}
		};

		xhr.onerror=function(evt){
			setMessage('apply', 'error_downloading', 'error');
		};

		xhr.send(null);
	}
}

function _parseROM(){
	el('checkbox-addheader').checked=false;
	el('checkbox-removeheader').checked=false;

	if(romFile.getExtension()!=='jar' && romFile.readString(4).startsWith(ZIP_MAGIC)){
		ZIPManager.parseFile(romFile);
		setTabApplyEnabled(false);
	}else{
		if(headerSize=canHaveFakeHeader(romFile)){
			el('row-addheader').className='row m-b';
			if(headerSize<1024){
				el('headersize').innerHTML=headerSize+'b';
			}else{
				el('headersize').innerHTML=parseInt(headerSize/1024)+'kb';
			}
			el('row-removeheader').className='row m-b hide';
		}else if(headerSize=hasHeader(romFile)){
			el('row-addheader').className='row m-b hide';
			el('row-removeheader').className='row m-b';
		}else{
			el('row-addheader').className='row m-b hide';
			el('row-removeheader').className='row m-b hide';
		}

		updateChecksums(romFile, 0);
	}
}






var UI={
	localize:function(){
		if(typeof LOCALIZATION[AppSettings.langCode]==='undefined')
			return false;

		var translatableElements=document.querySelectorAll('*[data-localize]');
		for(var i=0; i<translatableElements.length; i++){
			translatableElements[i].innerHTML=_(translatableElements[i].dataset.localize);
		}
	},
	showDialog:function(id){
		el('dialog-backdrop').className='show';
		el(id+'-dialog').className='dialog show';
	},
	hideDialog:function(id){
		el('dialog-backdrop').className='';
		el(id+'-dialog').className='dialog';
	},
	isDialogOpen:function(id){
		return el(id+'-dialog').className==='dialog show';
	},
	setLightTheme:function(val){
		if(val){
			document.body.className='light';
		}else{
			document.body.className='';
		}
	}
};

var AppSettings={
	langCode:(typeof navigator.userLanguage==='string')? navigator.userLanguage.substr(0,2) : 'en',
	outputFileNameMatch:false,
	fixChecksum:false,
	lightTheme:false,

	load:function(){
		if(typeof localStorage!=='undefined' && localStorage.getItem('rompatcher-js-settings')){
			try{
				var loadedSettings=JSON.parse(localStorage.getItem('rompatcher-js-settings'));

				if(typeof loadedSettings.langCode==='string' && typeof LOCALIZATION[loadedSettings.langCode]){
					this.langCode=loadedSettings.langCode;
					el('select-language').value=this.langCode;
				}
				if(loadedSettings.outputFileNameMatch===true){
					this.outputFileNameMatch=loadedSettings.outputFileNameMatch;
					el('switch-output-name').className='switch enabled';
				}
				if(loadedSettings.fixChecksum===true){
					this.fixChecksum=loadedSettings.fixChecksum;
					el('switch-fix-checksum').className='switch enabled';
				}
				if(loadedSettings.lightTheme===true){
					this.lightTheme=loadedSettings.lightTheme;
					el('switch-theme').className='switch enabled';
					UI.setLightTheme(true);
				}
			}catch(ex){
				console.error('Error while loading settings: '+ex.message);
			}
		}
	},

	save:function(){
		if(typeof localStorage!=='undefined')
			localStorage.setItem('rompatcher-js-settings', JSON.stringify(this));
	}
};

/* initialize app */
addEvent(window,'load',function(){
	/* zip-js web worker */
	zip.useWebWorkers=false;

	var script=document.createElement('script');
	script.src='scripts/zip.js/inflate.js';
	document.getElementsByTagName('head')[0].appendChild(script);

	/* load settings */
	AppSettings.load();
	UI.localize();

	
	el('row-file-patch').title=_('compatible_formats')+' IPS, UPS, APS, BPS, RUP, PPF, MOD (Paper Mario Star Rod), xdelta';
	
	el('input-file-rom').value='';
	el('input-file-patch').value='';
	setTabApplyEnabled(true);


	/* dirty fix for mobile Safari https://stackoverflow.com/a/19323498 */
	if(/Mobile\/\S+ Safari/.test(navigator.userAgent)){
		el('input-file-patch').accept='';
	}



	/* predefined patches */
	if(isCustomPatcherEnabled()){
		var select=document.createElement('select');
		select.disabled=true;
		select.id='input-file-patch';
		el('input-file-patch').parentElement.replaceChild(select, el('input-file-patch'));
		select.parentElement.title='';

		for(var i=0; i<CUSTOM_PATCHER.length; i++){
			CUSTOM_PATCHER[i].fetchedFile=false;

			CUSTOM_PATCHER[i].selectOption=document.createElement('option');
			CUSTOM_PATCHER[i].selectOption.value=i;
			CUSTOM_PATCHER[i].selectOption.innerHTML=CUSTOM_PATCHER[i].name || CUSTOM_PATCHER[i].file;
			select.appendChild(CUSTOM_PATCHER[i].selectOption);
			
			if(typeof CUSTOM_PATCHER[i].patches==='object'){
				for(var j=0; j<CUSTOM_PATCHER[i].patches.length; j++){					
					if(j===0){
						CUSTOM_PATCHER[i].patches[0].selectOption=CUSTOM_PATCHER[i].selectOption;
						CUSTOM_PATCHER[i].selectOption=null;
					}else{
						CUSTOM_PATCHER[i].patches[j].selectOption=document.createElement('option');
						select.appendChild(CUSTOM_PATCHER[i].patches[j].selectOption);
					}

					CUSTOM_PATCHER[i].patches[j].selectOption.value=i+','+j;
					CUSTOM_PATCHER[i].patches[j].selectOption.innerHTML=CUSTOM_PATCHER[i].patches[j].name || CUSTOM_PATCHER[i].patches[j].file;
				}
			}
		}

		addEvent(select,'change',function(){
			var selectedCustomPatchIndex, selectedCustomPatchCompressedIndex, selectedPatch;

			if(/^\d+,\d+$/.test(this.value)){
				var indexes=this.value.split(',');
				selectedCustomPatchIndex=parseInt(indexes[0]);
				selectedCustomPatchCompressedIndex=parseInt(indexes[1]);
				selectedPatch=CUSTOM_PATCHER[selectedCustomPatchIndex].patches[selectedCustomPatchCompressedIndex];
			}else{
				selectedCustomPatchIndex=parseInt(this.value);
				selectedCustomPatchCompressedIndex=null;
				selectedPatch=CUSTOM_PATCHER[selectedCustomPatchIndex];
			}
			
			
			if(selectedPatch.fetchedFile){
				parseCustomPatch(selectedPatch);
			}else{
				patch=null;
				patchFile=null;
				fetchPatch(selectedCustomPatchIndex, selectedCustomPatchCompressedIndex);
			}
		});
		fetchPatch(0, 0);
	
	}else{
		setTabCreateEnabled(true);
		el('input-file-rom1').value='';
		el('input-file-rom2').value='';

		el('switch-container').style.visibility='visible';

		addEvent(el('input-file-patch'), 'change', function(){
			setTabApplyEnabled(false);
			patchFile=new MarcFile(this, _readPatchFile)
		});
		addEvent(el('input-file-rom1'), 'change', function(){
			setTabCreateEnabled(false);
			romFile1=new MarcFile(this, function(){setTabCreateEnabled(true)});
		});
		addEvent(el('input-file-rom2'), 'change', function(){
			setTabCreateEnabled(false);
			romFile2=new MarcFile(this, function(){setTabCreateEnabled(true)});
		});
	}



	/* event listeners */
	addEvent(el('button-settings'), 'click', function(){
		UI.showDialog('settings');
	});
	addEvent(window, 'keyup', function(evt){
		if(evt.keyCode===27 && UI.isDialogOpen('settings')){
			UI.hideDialog('settings');
		}
	});
	addEvent(el('settings-dialog'), 'click', function(evt){
		evt.stopPropagation();
	});
	addEvent(el('zip-dialog'), 'click', function(evt){
		evt.stopPropagation();
	});
	addEvent(el('settings-close-dialog'), 'click', function(){
			UI.hideDialog('settings');
	});
	addEvent(el('dialog-backdrop'), 'click', function(){
		if(UI.isDialogOpen('settings')){
			UI.hideDialog('settings');
		}
	});
	addEvent(el('select-language'), 'change', function(){
		AppSettings.langCode=this.value;
		AppSettings.save();
		UI.localize();
	});
	addEvent(el('switch-output-name'), 'click', function(){
		if(this.className==='switch enabled'){
			this.className='switch disabled';
			AppSettings.outputFileNameMatch=false;
		}else{
			this.className='switch enabled';
			AppSettings.outputFileNameMatch=true;
		}
		AppSettings.save();
	});
	addEvent(el('switch-fix-checksum'), 'click', function(){
		if(this.className==='switch enabled'){
			this.className='switch disabled';
			AppSettings.fixChecksum=false;
		}else{
			this.className='switch enabled';
			AppSettings.fixChecksum=true;
		}
		AppSettings.save();
	});
	addEvent(el('switch-theme'), 'click', function(){
		if(this.className==='switch enabled'){
			this.className='switch disabled';
			AppSettings.lightTheme=false;
		}else{
			this.className='switch enabled';
			AppSettings.lightTheme=true;
		}
		UI.setLightTheme(AppSettings.lightTheme);
		AppSettings.save();
	});

	addEvent(el('input-file-rom'), 'change', function(){
		setTabApplyEnabled(false);
		romFile=new MarcFile(this, _parseROM);
	});
	addEvent(el('checkbox-removeheader'), 'change', function(){
		if(this.checked)
			updateChecksums(romFile, headerSize);
		else
			updateChecksums(romFile, 0);
	});
	addEvent(el('switch-create-button'), 'click', function(){
		setCreatorMode(!/enabled/.test(el('switch-create').className));
	});
	addEvent(el('button-apply'), 'click', function(){
		applyPatch(patch, romFile, false);
	});
	addEvent(el('button-create'), 'click', function(){
		createPatch(romFile1, romFile2, el('select-patch-type').value);
	});












	//setCreatorMode(true);
});



function canHaveFakeHeader(romFile){
	if(romFile.fileSize<=0x600000){
		for(var i=0; i<HEADERS_INFO.length; i++){
			if(HEADERS_INFO[i][0].test(romFile.fileName) && (romFile.fileSize%HEADERS_INFO[i][2]===0)){
				return HEADERS_INFO[i][1];
			}
		}
	}
	return 0;
}

function hasHeader(romFile){
	if(romFile.fileSize<=0x600200){
		if(romFile.fileSize%1024===0)
			return 0;

		for(var i=0; i<HEADERS_INFO.length; i++){
			if(HEADERS_INFO[i][0].test(romFile.fileName) && (romFile.fileSize-HEADERS_INFO[i][1])%HEADERS_INFO[i][1]===0){
				return HEADERS_INFO[i][1];
			}
		}
	} 
	return 0;
}





function updateChecksums(file, startOffset, force){
	if(file===romFile && file.fileSize>33554432 && !force){
		el('crc32').innerHTML='File is too big. <span onclick=\"updateChecksums(romFile,'+startOffset+',true)\">Force calculate checksum</span>';
		el('md5').innerHTML='';
		el('sha1').innerHTML='';
		setTabApplyEnabled(true);
		return false;
	}
	el('crc32').innerHTML='Calculating...';
	el('md5').innerHTML='Calculating...';

	window.setTimeout(function(){
		el('crc32').innerHTML=padZeroes(crc32(file, startOffset), 4);
		el('md5').innerHTML=padZeroes(md5(file, startOffset), 16);

		validateSource();
		setTabApplyEnabled(true);
	}, 30);

	if(window.crypto&&window.crypto.subtle&&window.crypto.subtle.digest){
		el('sha1').innerHTML='Calculating...';
		sha1(file);
	}
}

function validateSource(){
	if(patch && romFile && typeof patch.validateSource !== 'undefined'){
		if(patch.validateSource(romFile, el('checkbox-removeheader').checked && hasHeader(romFile))){
			el('crc32').className='valid';
			setMessage('apply');
		}else{
			el('crc32').className='invalid';
			setMessage('apply', 'error_crc_input', 'warning');
		}
	}else{
		el('crc32').className='';
		setMessage('apply');
	}
}





function _getRomSystem(file){
	if(file.fileSize>0x0200 && file.fileSize%4===0){
		if(/\.gbc?/i.test(file.fileName)){
			var NINTENDO_LOGO=[
				0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0c, 0x00, 0x0d,
				0x00, 0x08, 0x11, 0x1f, 0x88, 0x89, 0x00, 0x0e, 0xdc, 0xcc, 0x6e, 0xe6, 0xdd, 0xdd, 0xd9, 0x99
			];
			file.offset=0x104;
			var valid=true;
			for(var i=0; i<NINTENDO_LOGO.length && valid; i++){
				if(NINTENDO_LOGO[i]!==file.readU8())
					valid=false;
			}
			if(valid)
				return 'gb';
		}else if(/\.(bin|md)?/i.test(file.fileName)){
			file.offset=0x0100;
			if(/SEGA (GENESIS|MEGA DR)/.test(file.readString(12)))
				return 'smd';
		}
	}
	return null;
}
function _getHeaderChecksumInfo(file){
	var info={
		system:_getRomSystem(file),
		current:null,
		calculated:null,
		fix:null
	}
	
	if(info.system==='gb'){
		/* get current checksum */
		file.offset=0x014d;
		info.current=file.readU8();

		/* calculate checksum */
		info.calculated=0x00;
		file.offset=0x0134;
		for(var i=0; i<=0x18; i++){
			info.calculated=((info.calculated - file.readU8() - 1) >>> 0) & 0xff;
		}

		/* fix checksum */
		info.fix=function(file){
			file.offset=0x014d;
			file.writeU8(this.calculated);
		}

	}else if(info.system==='smd'){
		/* get current checksum */
		file.offset=0x018e;
		info.current=file.readU16();

		/* calculate checksum */
		info.calculated=0x0000;
		file.offset=0x0200;
		while(!file.isEOF()){
			info.calculated=((info.calculated + file.readU16()) >>> 0) & 0xffff;
		}

		/* fix checksum */
		info.fix=function(file){
			file.offset=0x018e;
			file.writeU16(this.calculated);
		}
	}else{
		info=null;
	}

	return info;
}


function _readPatchFile(){
	setTabApplyEnabled(false);
	patchFile.littleEndian=false;

	var header=patchFile.readString(6);
	if(patchFile.getExtension()!=='jar' && header.startsWith(ZIP_MAGIC)){
		patch=false;
		validateSource();
		setTabApplyEnabled(false);
		ZIPManager.parseFile(patchFile);
	}else{
		if(header.startsWith(IPS_MAGIC)){
			patch=parseIPSFile(patchFile);
		}else if(header.startsWith(UPS_MAGIC)){
			patch=parseUPSFile(patchFile);
		}else if(header.startsWith(APS_N64_MAGIC)){
			patch=parseAPSFile(patchFile);
		}else if(header.startsWith(APS_GBA_MAGIC)){
			patch=APSGBA.fromFile(patchFile);
		}else if(header.startsWith(BPS_MAGIC)){
			patch=parseBPSFile(patchFile);
		}else if(header.startsWith(RUP_MAGIC)){
			patch=parseRUPFile(patchFile);
		}else if(header.startsWith(PPF_MAGIC)){
			patch=parsePPFFile(patchFile);
		}else if(header.startsWith(PMSR_MAGIC)){
			patch=parseMODFile(patchFile);
		}else if(header.startsWith(VCDIFF_MAGIC)){
			patch=parseVCDIFF(patchFile);
		}else{
			patch=null;
			setMessage('apply', 'error_invalid_patch', 'error');
		}

		validateSource();
		setTabApplyEnabled(true);
	}
}





function preparePatchedRom(originalRom, patchedRom, headerSize){
	if(AppSettings.outputFileNameMatch){
		patchedRom.fileName=patchFile.fileName.replace(/\.\w+$/i, (/\.\w+$/i.test(originalRom.fileName)? originalRom.fileName.match(/\.\w+$/i)[0] : ''));
	}else{
		patchedRom.fileName=originalRom.fileName.replace(/\.([^\.]*?)$/, ' (patched).$1');
	}
	patchedRom.fileType=originalRom.fileType;
	if(headerSize){
		if(el('checkbox-removeheader').checked){
			var patchedRomWithOldHeader=new MarcFile(headerSize+patchedRom.fileSize);
			oldHeader.copyToFile(patchedRomWithOldHeader, 0);
			patchedRom.copyToFile(patchedRomWithOldHeader, 0, patchedRom.fileSize, headerSize);
			patchedRomWithOldHeader.fileName=patchedRom.fileName;
			patchedRomWithOldHeader.fileType=patchedRom.fileType;
			patchedRom=patchedRomWithOldHeader;
		}else if(el('checkbox-addheader').checked){
			patchedRom=patchedRom.slice(headerSize);

		}
	}



	/* fix checksum if needed */
	if(AppSettings.fixChecksum){
		var checksumInfo=_getHeaderChecksumInfo(patchedRom);
		if(checksumInfo && checksumInfo.current!==checksumInfo.calculated && confirm(_('fix_checksum_prompt')+' ('+padZeroes(checksumInfo.current)+' -> '+padZeroes(checksumInfo.calculated)+')')){
			checksumInfo.fix(patchedRom);
		}
	}




	setMessage('apply');
	patchedRom.save();
	
	//debug: create unheadered patch
	/*if(headerSize && el('checkbox-addheader').checked){
		createPatch(romFile, patchedRom);
	}*/
}




/*function removeHeader(romFile){
	//r._dataView=new DataView(r._dataView.buffer, headerSize);
	oldHeader=romFile.slice(0,headerSize);
	r=r.slice(headerSize);
}*/
function applyPatch(p,r,validateChecksums){
	if(p && r){
		if(headerSize){
			if(el('checkbox-removeheader').checked){
				//r._dataView=new DataView(r._dataView.buffer, headerSize);
				oldHeader=r.slice(0,headerSize);
				r=r.slice(headerSize);
			}else if(el('checkbox-addheader').checked){
				var romWithFakeHeader=new MarcFile(headerSize+r.fileSize);
				romWithFakeHeader.fileName=r.fileName;
				romWithFakeHeader.fileType=r.fileType;
				r.copyToFile(romWithFakeHeader, 0, r.fileSize, headerSize);

				//add FDS header
				if(/\.fds$/.test(r.FileName) && r.fileSize%65500===0){
					//romWithFakeHeader.seek(0);
					romWithFakeHeader.writeBytes([0x46, 0x44, 0x53, 0x1a, r.fileSize/65500]);
				}

				r=romWithFakeHeader;
			}
		}

		setMessage('apply', 'applying_patch', 'loading');

		try{
			p.apply(r, validateChecksums);
			preparePatchedRom(r, p.apply(r, validateChecksums), headerSize);

		}catch(e){
			setMessage('apply', 'Error: '+_(e.message), 'error');
		}

	}else{
		setMessage('apply', 'No ROM/patch selected', 'error');
	}
}







function createPatch(sourceFile, modifiedFile, mode){
	if(!sourceFile){
		setMessage('create', 'No source ROM file specified.', 'error');
		return false;
	}else if(!modifiedFile){
		setMessage('create', 'No modified ROM file specified.', 'error');
		return false;
	}


	if(CAN_USE_WEB_WORKERS){
		setTabCreateEnabled(false);

		setMessage('create', 'creating_patch', 'loading');

		webWorkerCreate.postMessage(
			{
				sourceFileU8Array:sourceFile._u8array,
				modifiedFileU8Array:modifiedFile._u8array,
				modifiedFileName:modifiedFile.fileName,
				patchMode:mode
			},[
				sourceFile._u8array.buffer,
				modifiedFile._u8array.buffer
			]
		);
		
		romFile1=new MarcFile(el('input-file-rom1'));
		romFile2=new MarcFile(el('input-file-rom2'));
	}else{
		try{
			sourceFile.seek(0);
			modifiedFile.seek(0);

			var newPatch;
			if(mode==='ips'){
				newPatch=createIPSFromFiles(sourceFile, modifiedFile);
			}else if(mode==='bps'){
				newPatch=createBPSFromFiles(sourceFile, modifiedFile, (sourceFile.fileSize<=4194304));
			}else if(mode==='ups'){
				newPatch=createUPSFromFiles(sourceFile, modifiedFile);
			}else if(mode==='aps'){
				newPatch=createAPSFromFiles(sourceFile, modifiedFile);
			}else if(mode==='rup'){
				newPatch=createRUPFromFiles(sourceFile, modifiedFile);
			}else{
				setMessage('create', 'error_invalid_patch', 'error');
			}


			if(crc32(modifiedFile)===crc32(newPatch.apply(sourceFile))){
				newPatch.export(modifiedFile.fileName.replace(/\.[^\.]+$/,'')).save();
			}else{
				setMessage('create', 'Unexpected error: verification failed. Patched file and modified file mismatch. Please report this bug.', 'error');
			}

		}catch(e){
			setMessage('create', 'Error: '+_(e.message), 'error');
		}
	}
}




/* GUI functions */
function setMessage(tab, key, className){
	var messageBox=el('message-'+tab);
	if(key){
        messageBox.setAttribute('data-localize',key);
		if(className==='loading'){
			messageBox.className='message';
			messageBox.innerHTML='<span class="loading"></span> '+_(key);
		}else{
			messageBox.className='message '+className;
			if(className==='warning')
				messageBox.innerHTML='&#9888; '+_(key);
			else if(className==='error')
				messageBox.innerHTML='&#10007; '+_(key);
			else
				messageBox.innerHTML=_(key);
		}
		messageBox.style.display='inline';
	}else{
		messageBox.style.display='none';
	}
}

function setElementEnabled(element,status){
	if(status){
		el(element).className='enabled';
	}else{
		el(element).className='disabled';
	}
	el(element).disabled=!status;
}
function setTabCreateEnabled(status){
	if(
		(romFile1 && romFile1.fileSize>TOO_BIG_ROM_SIZE) ||
		(romFile2 && romFile2.fileSize>TOO_BIG_ROM_SIZE)
	){
		setMessage('create',_('warning_too_big'),'warning');
	}
	setElementEnabled('input-file-rom1', status);
	setElementEnabled('input-file-rom2', status);
	setElementEnabled('select-patch-type', status);
	if(romFile1 && romFile2 && status){
		setElementEnabled('button-create', status);
	}else{
		setElementEnabled('button-create', false);
	}
}
function setTabApplyEnabled(status){
	setElementEnabled('input-file-rom', status);
	setElementEnabled('input-file-patch', status);
	if(romFile && status && (patch || isCustomPatcherEnabled())){
		setElementEnabled('button-apply', status);
	}else{
		setElementEnabled('button-apply', false);
	}
}
function setCreatorMode(creatorMode){
	if(creatorMode){
		el('tab0').style.display='none';
		el('tab1').style.display='block';
		el('switch-create').className='switch enabled'
	}else{
		el('tab0').style.display='block';
		el('tab1').style.display='none';
		el('switch-create').className='switch disabled'
	}
}






/* FileSaver.js (source: http://purl.eligrey.com/github/FileSaver.js/blob/master/src/FileSaver.js)
 * A saveAs() FileSaver implementation.
 * 1.3.8
 * 2018-03-22 14:03:47
 *
 * By Eli Grey, https://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */
var saveAs=saveAs||function(c){"use strict";if(!(void 0===c||"undefined"!=typeof navigator&&/MSIE [1-9]\./.test(navigator.userAgent))){var t=c.document,f=function(){return c.URL||c.webkitURL||c},s=t.createElementNS("http://www.w3.org/1999/xhtml","a"),d="download"in s,u=/constructor/i.test(c.HTMLElement)||c.safari,l=/CriOS\/[\d]+/.test(navigator.userAgent),p=c.setImmediate||c.setTimeout,v=function(t){p(function(){throw t},0)},w=function(t){setTimeout(function(){"string"==typeof t?f().revokeObjectURL(t):t.remove()},4e4)},m=function(t){return/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(t.type)?new Blob([String.fromCharCode(65279),t],{type:t.type}):t},r=function(t,n,e){e||(t=m(t));var r,o=this,a="application/octet-stream"===t.type,i=function(){!function(t,e,n){for(var r=(e=[].concat(e)).length;r--;){var o=t["on"+e[r]];if("function"==typeof o)try{o.call(t,n||t)}catch(t){v(t)}}}(o,"writestart progress write writeend".split(" "))};if(o.readyState=o.INIT,d)return r=f().createObjectURL(t),void p(function(){var t,e;s.href=r,s.download=n,t=s,e=new MouseEvent("click"),t.dispatchEvent(e),i(),w(r),o.readyState=o.DONE},0);!function(){if((l||a&&u)&&c.FileReader){var e=new FileReader;return e.onloadend=function(){var t=l?e.result:e.result.replace(/^data:[^;]*;/,"data:attachment/file;");c.open(t,"_blank")||(c.location.href=t),t=void 0,o.readyState=o.DONE,i()},e.readAsDataURL(t),o.readyState=o.INIT}r||(r=f().createObjectURL(t)),a?c.location.href=r:c.open(r,"_blank")||(c.location.href=r);o.readyState=o.DONE,i(),w(r)}()},e=r.prototype;return"undefined"!=typeof navigator&&navigator.msSaveOrOpenBlob?function(t,e,n){return e=e||t.name||"download",n||(t=m(t)),navigator.msSaveOrOpenBlob(t,e)}:(e.abort=function(){},e.readyState=e.INIT=0,e.WRITING=1,e.DONE=2,e.error=e.onwritestart=e.onprogress=e.onwrite=e.onabort=e.onerror=e.onwriteend=null,function(t,e,n){return new r(t,e||t.name||"download",n)})}}("undefined"!=typeof self&&self||"undefined"!=typeof window&&window||this);