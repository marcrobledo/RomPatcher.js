/* Rom Patcher JS v20240302 - Marc Robledo 2016-2024 - http://www.marcrobledo.com/license */

self.importScripts(
	'./RomPatcher.js',
	'./modules/BinFile.js',
	'./modules/HashCalculator.js'
);


self.onmessage = event => { // listen for messages from the main thread
	const binFile=new BinFile(event.data.u8array);
	binFile.fileName=event.data.fileName;
	const startOffset=typeof event.data.checksumStartOffset==='number'? event.data.checksumStartOffset : 0;

	self.postMessage(
		{
			action: event.data.action,
			crc32:binFile.hashCRC32(startOffset),
			md5:binFile.hashMD5(startOffset),
			checksumStartOffset: startOffset,
			rom:RomPatcher.getRomAdditionalChecksum(binFile),
			u8array:event.data.u8array
		},
		[event.data.u8array.buffer]
	);
};