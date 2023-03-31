/* Rom Patcher JS v20230331 - Marc Robledo 2016-2023 - http://www.marcrobledo.com/license */

self.importScripts(
	'./MarcFile.js',
	'./crc.js',
	'./formats/ips.js',
	'./formats/aps_n64.js',
	'./formats/aps_gba.js',
	'./formats/ups.js',
	'./formats/bps.js',
	'./formats/rup.js',
	'./formats/ppf.js',
	'./formats/pmsr.js',
	'./formats/vcdiff.js'
);


self.onmessage = event => { // listen for messages from the main thread
	var romFile=new MarcFile(event.data.romFileU8Array);
	var patchFile=new MarcFile(event.data.patchFileU8Array);

	var errorMessage=false;

	var patch;
	var header=patchFile.readString(6);
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
		errorMessage='error_invalid_patch';
	}

	//console.log('apply');
	var patchedRom;
	if(patch){
		try{
			patchedRom=patch.apply(romFile, event.data.validateChecksums);
		}catch(evt){
			errorMessage=evt.message;
		}
	}
	
	//console.log('postMessage');
	if(patchedRom){
		self.postMessage(
			{
				romFileU8Array:event.data.romFileU8Array,
				patchFileU8Array:event.data.patchFileU8Array,
				patchedRomU8Array:patchedRom._u8array,
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