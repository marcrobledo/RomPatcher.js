/* Rom Patcher JS v20200502 - Marc Robledo 2016-2020 - http://www.marcrobledo.com/license */

self.importScripts(
	'./MarcFile.js',
	'./crc.js',
	'./formats/ips.js',
	'./formats/aps.js',
	'./formats/ups.js',
	'./formats/bps.js',
	'./formats/ppf.js',
	'./formats/rup.js'
);


	
self.onmessage = event => { // listen for messages from the main thread
	var sourceFile=new MarcFile(event.data.sourceFileU8Array);
	var modifiedFile=new MarcFile(event.data.modifiedFileU8Array);
	var mode=event.data.patchMode;

	sourceFile.seek(0);
	modifiedFile.seek(0);

	var patch;
	if(mode==='ips'){
		patch=createIPSFromFiles(sourceFile, modifiedFile);
	}else if(mode==='bps'){
		//use delta mode (slower, but smaller patch size) only with <4mb files
		patch=createBPSFromFiles(sourceFile, modifiedFile, (sourceFile.fileSize<=4194304));
	}else if(mode==='ups'){
		patch=createUPSFromFiles(sourceFile, modifiedFile);
	}else if(mode==='aps'){
		patch=createAPSFromFiles(sourceFile, modifiedFile);
	}else if(mode==='rup'){
		patch=createRUPFromFiles(sourceFile, modifiedFile);
	}else if(mode==='ppf'){
		patch=createPPFFromFiles(sourceFile, modifiedFile);
	}else{
		throw new Error('error_invalid_patch');
	}


	//special case: PPF+modified size>original size, skip verification
	if(!(mode==='ppf' && sourceFile.fileSize>modifiedFile.fileSize) && crc32(modifiedFile)!==crc32(patch.apply(sourceFile))){
		throw new Error('Unexpected error: verification failed. Patched file and modified file mismatch. Please report this bug.');
	}

	var newPatchFile=patch.export('file');
	
	//console.log('postMessage');
	self.postMessage(
		{
			//sourceFileU8Array:event.data.sourceFileU8Array,
			//modifiedFileU8Array:event.data.modifiedFileU8Array,
			patchFileU8Array:newPatchFile._u8array
		},
		[
			//event.data.sourceFileU8Array.buffer,
			//event.data.modifiedFileU8Array.buffer,
			newPatchFile._u8array.buffer
		]
	);
};