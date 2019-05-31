/* Rom Patcher JS v20181018 - Marc Robledo 2016-2018 - http://www.marcrobledo.com/license */

self.importScripts(
	'./libs/MarcFile.js',
	'./crc.js',
	'./ips.js',
	'./aps.js',
	'./ups.js',
	'./bps.js',
	'./rup.js',
	'./ppf.js',
	'./vcdiff.js'
);


self.onmessage = event => { // listen for messages from the main thread
	var romFile=new MarcFile(event.data.romFileU8Array);
	var patchFile=new MarcFile(event.data.patchFileU8Array);

	
	var patch;
	var header=patchFile.readString(6);
	if(header.startsWith(IPS_MAGIC)){
		patch=parseIPSFile(patchFile);
	}else if(header.startsWith(UPS_MAGIC)){
		patch=parseUPSFile(patchFile);
	}else if(header.startsWith(APS_MAGIC)){
		patch=parseAPSFile(patchFile);
	}else if(header.startsWith(BPS_MAGIC)){
		patch=parseBPSFile(patchFile);
	}else if(header.startsWith(RUP_MAGIC)){
		patch=parseRUPFile(patchFile);
	}else if(header.startsWith(PPF_MAGIC)){
		patch=parsePPFFile(patchFile);
	}else if(header.startsWith(VCDIFF_MAGIC)){
		patch=parseVCDIFF(patchFile);
	}else{
		throw new Error('error_invalid_patch');
	}

	//console.log('apply');
	var patchedRom;
	try{
		patchedRom=patch.apply(romFile, event.data.validateChecksums);
	}catch(e){
		throw e;
	}
	
	//console.log('postMessage');
	self.postMessage(
		{
			romFileU8Array:event.data.romFileU8Array,
			patchFileU8Array:event.data.patchFileU8Array,
			patchedRomU8Array:patchedRom._u8array
		},
		[
			event.data.romFileU8Array.buffer,
			event.data.patchFileU8Array.buffer,
			patchedRom._u8array.buffer
		]
	);
};