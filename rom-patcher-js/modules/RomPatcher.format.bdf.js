/* BDF module for Rom Patcher JS v20250914 - Marc Robledo 2025 - http://www.marcrobledo.com/license */
/* File format specification: https://www.daemonology.net/bsdiff/ */

const bz2 = require('./bz2/bz2');

const BDF_MAGIC='BSDIFF40';

if(typeof module !== "undefined" && module.exports){
	module.exports = BDF;
}

function BDF(){
    this.records=[];
    this.patchedSize=0;
}

BDF.prototype.apply=function(file){
    var tempFile=new BinFile(this.patchedSize);
    
    for (const record of this.records) {
        for (const b of record.diff) {
            tempFile.writeU8(file.readU8() + b);
        }
        tempFile.writeBytes(record.extra);
        file.seek(file.offset + record.skip);
    }
    return tempFile;
}

BDF.MAGIC = BDF_MAGIC;

BDF.fromFile=function(file){
    var patch=new BDF();

    file.seek(8);
    file.littleEndian=true;
    var controlSize=file.readU64();
    var diffSize=file.readU64();
    patch.patchedSize=file.readU64();

    var controlCompressed=file.readBytes(controlSize);
    var diffCompressed=file.readBytes(diffSize);
    var extraCompressed=file.readBytes(file.fileSize-file.offset);

    var controlFile=new BinFile(bz2.decompress(controlCompressed));
    controlFile.littleEndian=true;
    var diffFile=new BinFile(bz2.decompress(diffCompressed));
    var extraFile=new BinFile(bz2.decompress(extraCompressed));

    while(!controlFile.isEOF()){
        var diffLen=controlFile.readU64();
        var extraLen=controlFile.readU64();
        var skip=controlFile.readU64();
        if(skip&(1<<63))
            skip=-(skip&~(1<<63));
        var diff=diffFile.readBytes(diffLen);
        var extra=extraFile.readBytes(extraLen);
        patch.records.push({diff, extra, skip});
    }

    return patch;
}