/* Rom Patcher JS v20240302 - Marc Robledo 2016-2024 - http://www.marcrobledo.com/license */

self.importScripts(
	'./RomPatcher.js',
	'./modules/BinFile.js',
	'./modules/HashCalculator.js',
	'./modules/RomPatcher.format.ips.js',
	'./modules/RomPatcher.format.aps_n64.js',
	'./modules/RomPatcher.format.ups.js',
	'./modules/RomPatcher.format.bps.js',
	'./modules/RomPatcher.format.rup.js',
	'./modules/RomPatcher.format.ppf.js'
);


self.onmessage = event => { // listen for messages from the main thread
	const originalFile=new BinFile(event.data.originalRomU8Array);
	const modifiedFile=new BinFile(event.data.modifiedRomU8Array);
	const format=event.data.format;
	const metadata=event.data.metadata;

	const patch=RomPatcher.createPatch(originalFile, modifiedFile, format, metadata);
	const patchFile=patch.export('my_patch');

	self.postMessage(
		{
			originalRomU8Array:event.data.originalRomU8Array,
			modifiedRomU8Array:event.data.modifiedRomU8Array,
			patchFileU8Array:patchFile._u8array
		},
		[
			event.data.originalRomU8Array.buffer,
			event.data.modifiedRomU8Array.buffer,
			patchFile._u8array.buffer
		]
	);
};