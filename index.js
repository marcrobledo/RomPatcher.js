#! /usr/bin/env node

/*
	CLI implementation for Rom Patcher JS
	https://github.com/marcrobledo/RomPatcher.js
	by Marc Robledo, released under MIT license: https://github.com/marcrobledo/RomPatcher.js/blob/master/LICENSE

	Usage:
		Install needed dependencies:
		> npm install

		Patch a ROM:
		> node index.js patch "my_rom.bin" "my_patch.ips"

		Create a patch from two ROMs:
		> node index.js create "original_rom.bin" "modified_rom.bin"

		For more options:
		> node index.js patch --help
		> node index.js create --help
*/


const chalk=require('chalk');
const { program } = require('commander')
const RomPatcher = require('./rom-patcher-js/RomPatcher');


program
    .command('patch')
    .description('patches a ROM')
    .argument('<rom_file>','the ROM file that will be patched')
    .argument('<patch_file>', 'the patch to apply')
    .option('-v, --validate-checksum','should validate checksum')
    .option('-h1, --add-header','adds a temporary header to the provided ROM for patches that require headered ROMs')
    .option('-h0, --remove-header','removes ROM header temporarily for patches that require headerless ROMs')
    .option('-f, --fix-checksum','fixes any known ROM header checksum if possible')
    .option('-s, --output-suffix','add a (patched) suffix to output ROM file name')
    .action(function(romPath, patchPath, options) {
		try{
			const romFile=new BinFile(romPath);
			const patchFile=new BinFile(patchPath);

			const patch=RomPatcher.parsePatchFile(patchFile);
			if(!patch)
				throw new Error('Invalid patch file');

			const patchedRom=RomPatcher.applyPatch(romFile, patch, options);
			patchedRom.save();
			console.log(chalk.green('successfully saved to ' + patchedRom.fileName));
		}catch(err){
			console.log(chalk.bgRed('error: ' + err.message));
		}
	});

program
    .command('create')
    .description('creates a patch based on two ROMs')
    .argument('<original_rom_file>', 'the original ROM')
    .argument('<modified_rom_file>','the modified ROM')
    .option('-f, --format','patch format (allowed values: ips [default], bps, ppf, ups, aps, rup)')
    .action(function(originalRomPath, modifiedRomPath, options) {
		try{
			const originalFile=new BinFile(originalRomPath);
			const modifiedFile=new BinFile(modifiedRomPath);

			const patch=RomPatcher.createPatch(originalFile, modifiedFile, options.format);
		}catch(err){
			console.log(chalk.bgBlue('Error: ' + err.message));
		}
	});

program.parse()