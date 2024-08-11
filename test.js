/*
	Test battery for Rom Patcher JS 
	https://github.com/marcrobledo/RomPatcher.js
	by Marc Robledo, released under MIT license: https://github.com/marcrobledo/RomPatcher.js/blob/master/LICENSE

	Usage:
	> npm install
	> npm run test

	You need to provide the following ROMs and patches, unzip them in
	_test_files/roms and _test_files/patches folders respectively:
	- IPS test
		- Patch: https://www.romhacking.net/hacks/3784/
		- ROM:   Super Mario Land 2 - 6 Golden Coins (USA, Europe).gb [CRC32=d5ec24e4]
	- BPS test
		- Patch: https://www.romhacking.net/translations/6297/
		- ROM:   Samurai Kid (Japan).gbc [CRC32=44a9ddfb]	
	- UPS test
		- Patch: https://mother3.fobby.net/
		- ROM:   Mother 3 (Japan).gba [CRC32=42ac9cb9]
	- APS test
		- Patch: http://dorando.emuverse.com/projects/eduardo_a2j/zelda-ocarina-of-time.html
		- ROM:   Legend of Zelda, The - Ocarina of Time (USA).z64 [CRC32=7e107c35]
	- RUP test
		- Patch: https://www.romhacking.net/translations/843/
		- ROM:   Uchuu no Kishi - Tekkaman Blade (Japan).sfc [CRC32=cd16c529]
	- xdelta test
		- Patch: https://www.romhacking.net/hacks/2871/
		- ROM:   New Super Mario Bros. (USA, Australia).nds [CRC32=0197576a]
*/

const chalk=require('chalk');
const { existsSync }=require('fs');

const BinFile = require('./rom-patcher-js/modules/BinFile');
const HashCalculator = require('./rom-patcher-js/modules/HashCalculator');
const RomPatcher = require('./rom-patcher-js/RomPatcher');



const TEST_PATH='_test_files/';
const TEST_PATCHES=[
	{
		title:'IPS - Super Mario Land 2 DX',
		romFile:'Super Mario Land 2 - 6 Golden Coins (USA, Europe).gb',
		romCrc32:0xd5ec24e4,
		patchFile:'SML2DXv181.ips',
		patchCrc32:0x0b742316,
		patchDownload:'https://www.romhacking.net/hacks/3784/',
		outputCrc32:0xf0799017
	},{
		title:'BPS - Samurai Kid translation',
		romFile:'Samurai Kid (Japan).gbc',
		romCrc32:0x44a9ddfb,
		patchFile:'samurai_kid_en_v1.bps',
		patchCrc32:0x2144df1c,
		patchDownload:'https://www.romhacking.net/translations/6297/',
		outputCrc32:0xed238edb
	},{
		title:'UPS - Mother 3 translation',
		romFile:'Mother 3 (Japan).gba',
		romCrc32:0x42ac9cb9,
		patchFile:'mother3.ups',
		patchCrc32:0x2144df1c,
		patchDownload:'https://mother3.fobby.net/',
		outputCrc32:0x8a3bc5a8
	},{
		title:'APS - Zelda OoT spanish translation',
		romFile:'Legend of Zelda, The - Ocarina of Time (USA).z64',
		romCrc32:0xcd16c529,
		patchFile:'ZELDA64.APS',
		patchCrc32:0x7b70119d,
		patchDownload:'http://dorando.emuverse.com/projects/eduardo_a2j/zelda-ocarina-of-time.html',
		outputCrc32:0x7866f1ca
	},{
		title:'Tekkaman Blade translation',
		romFile:'Uchuu no Kishi - Tekkaman Blade (Japan).sfc',
		romCrc32:0x7e107c35,
		patchFile:'Tekkaman Blade v1.0.rup',
		patchCrc32:0x621ab323,
		patchDownload:'https://www.romhacking.net/hacks/4633/',
		outputCrc32:0xe83e9b0a
	},{
		title:'NSMB Hack Domain Infusion',
		romFile:'New Super Mario Bros. (USA, Australia).nds',
		romCrc32:0x0197576a,
		patchFile:'nsmb_infusion10a.xdelta',
		patchCrc32:0xa211f97c,
		patchDownload:'https://www.romhacking.net/hacks/2871/',
		outputCrc32:0x9cecd976
	}
];

const _test=function(title, testFunction){
	try{
		const startTime=(new Date()).getTime();
		const result=testFunction.call();
		
		const executionTime=((new Date()).getTime() - startTime) / 1000;
		console.log(chalk.greenBright('√ '+title + ' ('+executionTime+'s)'));
	}catch(err){
		console.log(chalk.redBright('× '+title + ' - failed with error: '+err.message));
	}
};


const TEST_DATA = (new Uint8Array([
	98, 91, 64, 8, 35, 53, 122, 167, 52, 253, 222, 156, 247, 82, 227, 213, 22, 221, 17, 247, 107, 102, 164, 254, 221, 102, 207, 63, 117, 164, 223, 10, 223, 200, 150, 4, 77, 250, 111, 64, 233, 118, 1, 36, 1, 60, 208, 245, 136, 126, 29, 231, 168, 18, 125, 172, 11, 184, 81, 20, 16, 30, 154, 16, 236, 21, 5, 74, 255, 112, 171, 198, 185, 89, 2, 98, 45, 164, 214, 55, 103, 15, 217, 95, 212, 133, 184, 21, 67, 144, 198, 163, 76, 35, 248, 229, 163, 37, 103, 33, 193, 160, 161, 245, 125, 144, 193, 178, 31, 253, 119, 168, 169, 187, 195, 165, 205, 140, 222, 134, 249, 68, 224, 248, 144, 207, 18, 126
])).buffer;




_test('HashCalculator integrity', function(){
	if(HashCalculator.md5(TEST_DATA) !== '55c76e7e683fd7cd63c673c5df3efa6e')
		throw new Error('invalid MD5');
	if(HashCalculator.crc32(TEST_DATA).toString(16) !== '903a031b')
		throw new Error('invalid CRC32');
	if(HashCalculator.adler32(TEST_DATA).toString(16) !== 'ef984205')
		throw new Error('invalid ADLER32');
	if(HashCalculator.crc16(TEST_DATA).toString(16) !== '96e4')
		throw new Error('invalid SHA1');
});


const MODIFIED_TEST_DATA = (new Uint8Array([
	98, 91, 64, 8, 35, 53, 122, 167, 52, 253, 222, 156, 247, 82, 227, 213, 22, 221, 17, 247, 107, 102, 164, 254, 221, 8, 207, 63, 117, 164, 223, 10, 1, 77, 87, 123, 48, 9, 111, 64, 233, 118, 1, 36, 1, 60, 208, 245, 136, 126, 29, 231, 168, 18, 125, 172, 11, 184, 81, 20, 16, 30, 154, 16, 236, 21, 5, 74, 255, 112, 171, 198, 185, 89, 2, 98, 45, 164, 214, 55, 103, 15, 217, 95, 212, 133, 184, 21, 67, 144, 198, 163, 76, 35, 248, 229, 163, 37, 103, 33, 193, 96, 77, 255, 117, 89, 193, 61, 64, 253, 119, 82, 49, 187, 195, 165, 205, 140, 222, 134, 249, 68, 224, 248, 144, 207, 18, 126
])).buffer;
['ips','bps','ppf','ups','aps','rup'].forEach(function(patchFormat){
	_test('create and apply '+patchFormat.toUpperCase(), function(){
		const originalFile=new BinFile(TEST_DATA);
		const modifiedFile=new BinFile(MODIFIED_TEST_DATA);
		const patch=RomPatcher.createPatch(originalFile, modifiedFile, patchFormat);
		const patchedFile=RomPatcher.applyPatch(originalFile, patch, {requireValidation:true});
		if(patchedFile.hashCRC32() !== modifiedFile.hashCRC32())
			throw new Error('modified and patched files\' crc32 do not match');
	})
});




TEST_PATCHES.forEach(function(patchInfo){
	const patchPath=TEST_PATH+'patches/'+patchInfo.patchFile;
	if(!existsSync(patchPath)){
		console.log(chalk.yellow('! skipping patch '+patchInfo.title));
		console.log(chalk.yellow('        patch file not found: '+patchInfo.patchFile));
		console.log(chalk.yellow('        download patch at '+patchInfo.patchDownload));
		return false;
	}
	const patchFile=new BinFile(patchPath);
	if(patchFile.hashCRC32() !== patchInfo.patchCrc32){
		console.log(patchFile.hashCRC32().toString(16));
		console.log(chalk.yellow('! skipping '+patchInfo.title+' test: invalid patch crc32'));
		console.log(chalk.yellow('        download correct patch at '+patchInfo.patchDownload));
		return false;
	}


	const romPath=TEST_PATH+'roms/'+patchInfo.romFile;
	if(!existsSync(romPath)){
		console.log(chalk.yellow('! skipping patch '+patchInfo.title));
		console.log(chalk.yellow('        ROM file not found: '+patchInfo.romFile));
		return false;
	}
	const romFile=new BinFile(romPath);
	if(romFile.hashCRC32() !== patchInfo.romCrc32){
		console.log(chalk.yellow('! skipping '+patchInfo.title+' test: invalid ROM crc32'));
		return false;
	}


	_test('patch '+patchInfo.title, function(){
		const patch=RomPatcher.parsePatchFile(patchFile);
		const patchedRom=RomPatcher.applyPatch(romFile, patch, {requireValidation:true});
		if(patchedRom.hashCRC32() !== patchInfo.outputCrc32)
			throw new Error('invalid patched file crc32');
	});
});


