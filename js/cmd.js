const {MarcFile} = require("./MarcFile");
const {File} = require("./File")
const {IPS_MAGIC, parseIPSFile} = require("./formats/ips")
const {UPS_MAGIC, parseUPSFile} = require("./formats/ups")
const {APS_N64_MAGIC, parseAPSFile} = require("./formats/aps_n64")
const {APS_GBA_MAGIC, APSGBA} = require("./formats/aps_gba")
const {BPS_MAGIC, parseBPSFile} = require("./formats/bps")
const {RUP_MAGIC, parseRUPFile} = require("./formats/rup")
const {PPF_MAGIC, parsePPFFile} = require("./formats/ppf")
const {PMSR_MAGIC, parseMODFile} = require("./formats/pmsr")
const {VCDIFF_MAGIC, parseVCDIFF} = require("./formats/vcdiff")
const {ZIP_MAGIC, ZIPManager} = require("./formats/zip")
const {md5} = require("./crc")

function hasHeader(romFile){
    if(romFile.fileSize<=0x600200){
        if(romFile.fileSize%1024===0)
            return 0;

        for(var i=0; i<HEADERS_INFO.length; i++){
            if(HEADERS_INFO[i][0].test(romFile.fileName) && (romFile.fileSize-HEADERS_INFO[i][1])%HEADERS_INFO[i][1]===0){
                return HEADERS_INFO[i][1];
            }
        }
    }
    return 0;
}
function validateSource(patch, romFile){
    if(patch && romFile && typeof patch.validateSource !== 'undefined'){
        if(patch.validateSource(romFile, hasHeader(romFile))){
            console.log('apply');
        }else{
            console.warn('apply'+ 'error_crc_input'+ 'warning');
        }
    }else{
        console.log('valid source');
    }
}
function _readPatchFile(patchFile, romFile){
    patchFile.littleEndian=false;
    let patch;
    const header = patchFile.readString(6);
    if(patchFile.getExtension()!=='jar' && header.startsWith(ZIP_MAGIC)){
        patch=false;
        validateSource();
        ZIPManager.parseFile(patchFile);
    }else{
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
            patch=null;
            console.log('apply'+ 'error_invalid_patch'+ 'error');
        }

        validateSource(patchFile, romFile);
    }
    return patch;
}
function preparePatchedRom(originalRom, patchedRom, headerSize) {
    patchedRom.fileName = originalRom.fileName.replace(/\.([^\.]*?)$/, ' (patched).$1');
    patchedRom.fileType = originalRom.fileType;
    if (headerSize) {
        if (el('checkbox-removeheader').checked) {
            const patchedRomWithOldHeader = new MarcFile(headerSize + patchedRom.fileSize);
            oldHeader.copyToFile(patchedRomWithOldHeader, 0);
            patchedRom.copyToFile(patchedRomWithOldHeader, 0, patchedRom.fileSize, headerSize);
            patchedRomWithOldHeader.fileName = patchedRom.fileName;
            patchedRomWithOldHeader.fileType = patchedRom.fileType;
            patchedRom = patchedRomWithOldHeader;
        } else if (el('checkbox-addheader').checked) {
            patchedRom = patchedRom.slice(headerSize);

        }
    }


    /* fix checksum if needed */
    // if (false) {
    //     var checksumInfo = _getHeaderChecksumInfo(patchedRom);
    //     if (checksumInfo && checksumInfo.current !== checksumInfo.calculated && confirm(_('fix_checksum_prompt') + ' (' + padZeroes(checksumInfo.current) + ' -> ' + padZeroes(checksumInfo.calculated) + ')')) {
    //         checksumInfo.fix(patchedRom);
    //     }
    // }


    console.log('apply');
    patchedRom.save();
}



function padZeroes(intVal, nBytes){
    var hexString=intVal.toString(16);
    while(hexString.length<nBytes*2)
        hexString='0'+hexString;
    return hexString
}

/* CRC32 - from Alex - https://stackoverflow.com/a/18639999 */
const CRC32_TABLE=(function(){
    var c,crcTable=[];
    for(var n=0;n<256;n++){
        c=n;
        for(var k=0;k<8;k++)
            c=((c&1)?(0xedb88320^(c>>>1)):(c>>>1));
        crcTable[n]=c;
    }
    return crcTable;
}());
function crc32(marcFile, headerSize, ignoreLast4Bytes){
    var data=headerSize? new Uint8Array(marcFile._u8array.buffer, headerSize):marcFile._u8array;

    var crc=0^(-1);

    var len=ignoreLast4Bytes?data.length-4:data.length;
    for(var i=0;i<len;i++)
        crc=(crc>>>8)^CRC32_TABLE[(crc^data[i])&0xff];

    return ((crc^(-1))>>>0);
}
function updateChecksums(file, romFile, startOffset, force){
    if(file===romFile && file.fileSize>33554432 && !force){
        console.log('File is too big.  Force calculate checksum?  Add -f to command');
        return false;
    }

    console.log('crc32='+padZeroes(crc32(file, startOffset), 4));
    console.log('md5='+padZeroes(md5(file, startOffset), 16));
}
let headerSize;

function canHaveFakeHeader(romFile){
    if(romFile.fileSize<=0x600000){
        for(let i=0; i<HEADERS_INFO.length; i++){
            if(HEADERS_INFO[i][0].test(romFile.fileName) && (romFile.fileSize%HEADERS_INFO[i][2]===0)){
                return HEADERS_INFO[i][1];
            }
        }
    }
    return 0;
}
function _parseROM(romFile){
    if(romFile.getExtension()!=='jar' && romFile.readString(4).startsWith(ZIP_MAGIC)){
        ZIPManager.parseFile(romFile);
    }else{
        if(headerSize=canHaveFakeHeader(romFile)){
            if(headerSize<1024){
                console.log(headerSize+'b');
            }else{
                console.log(parseInt(headerSize/1024)+'kb');
            }
        }else if(headerSize=hasHeader(romFile)){
            // do nothing
        }else{
            // do nothing
        }

        updateChecksums(romFile, 0);
    }
}
const applyPatch = (patch, rom, validateChecksums) => {
    rom = new MarcFile(new File(rom));
    _parseROM(rom);
    patch = new MarcFile(new File(patch));
    patch = _readPatchFile(patch, rom);
    if (!patch || !rom)
        throw new Error('No ROM/patch selected');
    console.log('apply'+ 'applying_patch'+ 'loading');

    try {
        preparePatchedRom(rom, patch.apply(rom, validateChecksums), headerSize);
    } catch (e) {
        // console.log('apply'+ 'Error: ' + (e.message)+ 'error');
        throw e;
    }
}
module.exports = {applyPatch}