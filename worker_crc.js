/* Rom Patcher JS v20181018 - Marc Robledo 2016-2018 - http://www.marcrobledo.com/license */

self.importScripts(
	'./libs/MarcFile.js',
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