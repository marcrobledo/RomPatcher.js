#! /usr/bin/env node
const { program } = require('commander')
const {applyPatch}  = require('./js/cmd')
program
    .command('patch')
    .description('List all the TODO tasks')
    .argument('<file>', 'the patch to apply')
    .argument('<file>','the rom file getting the patch')
    .option('-v, --validate-checksum','should validate checksum')
    .action((patch, romFile, options) => applyPatch(romFile, patch, options));

program.parse()