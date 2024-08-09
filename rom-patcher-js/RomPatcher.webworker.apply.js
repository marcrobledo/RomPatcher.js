/* Rom Patcher JS v20240302 - Marc Robledo 2016-2024 - http://www.marcrobledo.com/license */

self.importScripts(
	'./RomPatcher.js',
	'./modules/BinFile.js',
	'./modules/HashCalculator.js',
	'./modules/RomPatcher.format.ips.js',
	'./modules/RomPatcher.format.aps_n64.js',
	'./modules/RomPatcher.format.aps_gba.js',
	'./modules/RomPatcher.format.ups.js',
	'./modules/RomPatcher.format.bps.js',
	'./modules/RomPatcher.format.rup.js',
	'./modules/RomPatcher.format.ppf.js',
	'./modules/RomPatcher.format.pmsr.js',
	'./modules/RomPatcher.format.vcdiff.js'
);


self.onmessage = event => { // listen for messages from the main thread
	const romFile=new BinFile(event.data.romFileU8Array);
	romFile.fileName=event.data.romFileName;
	//romFile.fileType.event.data.romFileType;
	const patchFile=new BinFile(event.data.patchFileU8Array);
	patchFile.fileName=event.data.patchFileName;

	const patch=RomPatcher.parsePatchFile(patchFile);

	var errorMessage=false;


	var patchedRom;
	if(patch){
		try{
			patchedRom=RomPatcher.applyPatch(romFile, patch, event.data.options);
		}catch(evt){
			errorMessage=evt.message;
		}
	}else{
		errorMessage='Invalid patch file';
	}

	//console.log('postMessage');
	if(patchedRom){
		/* set custom output name if embeded patch */
		const patchExtraInfo=event.data.patchExtraInfo;
		if(patchExtraInfo){
			if(typeof patchExtraInfo.outputName === 'string')
				patchedRom.setName(patchExtraInfo.outputName);
			if(typeof patchExtraInfo.outputExtension === 'string')
				patchedRom.setExtension(patchExtraInfo.outputExtension);
		}

		self.postMessage(
			{
				success: !!errorMessage,
				romFileU8Array:event.data.romFileU8Array,
				patchFileU8Array:event.data.patchFileU8Array,
				patchedRomU8Array:patchedRom._u8array,
				patchedRomFileName:patchedRom.fileName,
				errorMessage:errorMessage
			},
			[
				event.data.romFileU8Array.buffer,
				event.data.patchFileU8Array.buffer,
				patchedRom._u8array.buffer
			]
		);
	}else{
		self.postMessage(
			{
				success: false,
				romFileU8Array:event.data.romFileU8Array,
				patchFileU8Array:event.data.patchFileU8Array,
				errorMessage:errorMessage
			},
			[
				event.data.romFileU8Array.buffer,
				event.data.patchFileU8Array.buffer
			]
		);
	}
};