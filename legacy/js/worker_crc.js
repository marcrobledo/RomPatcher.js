/* Rom Patcher JS v20200502 - Marc Robledo 2016-2020 - http://www.marcrobledo.com/license */

self.importScripts(
	'./MarcFile.js',
	'./crc.js'
);



self.onmessage = event => { // listen for messages from the main thread
	var sourceFile=new MarcFile(event.data.u8array);

	self.postMessage(
		{
			crc32:crc32(sourceFile, event.data.startOffset),
			md5:md5(sourceFile, event.data.startOffset),
			u8array:event.data.u8array
		},
		[
			event.data.u8array.buffer
		]
	);
};