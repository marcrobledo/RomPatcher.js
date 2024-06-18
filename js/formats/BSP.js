/* BSP module for Rom Patcher JS v20220417 - Vagner Matheus 2016-2024 */
const BSP_MAGIC = 'BSP';
const BSP_VERSION = 1;
const BSP_MAX_SIZE = 0x1000000; // 16 megabytes

function BSP() {
    this.records = [];
}

BSP.prototype.addRecord = function(o, d) {
    this.records.push({offset: o, data: d});
};

BSP.prototype.toString = function() {
    let s = 'Records: ' + this.records.length;
    return s;
};

BSP.prototype.export = function(fileName) {
    let patchFileSize = 8; // BSP magic + version
    for (let i = 0; i < this.records.length; i++) {
        patchFileSize += 4 + this.records[i].data.length; // offset + data length
    }
    
    let tempFile = new MarcFile(patchFileSize);
    tempFile.fileName = fileName + '.bsp';
    tempFile.writeString(BSP_MAGIC);
    tempFile.writeU32(BSP_VERSION);

    for (let i = 0; i < this.records.length; i++) {
        let rec = this.records[i];
        tempFile.writeU32(rec.offset);
        tempFile.writeBytes(rec.data);
    }

    return tempFile;
};

BSP.prototype.apply = function(romFile) {
    let tempFile = new MarcFile(romFile.fileSize);
    romFile.copyToFile(tempFile, 0);

    for (let i = 0; i < this.records.length; i++) {
        tempFile.seek(this.records[i].offset);
        tempFile.writeBytes(this.records[i].data);
    }

    return tempFile;
};

function parseBSPFile(file) {
    let patchFile = new BSP();
    file.seek(4); // Skip magic
    let version = file.readU32();

    if (version !== BSP_VERSION) {
        throw new Error('Unsupported BSP version');
    }

    while (!file.isEOF()) {
        let offset = file.readU32();
        let length = file.fileSize - file.offset; // remaining bytes
        let data = file.readBytes(length);
        patchFile.addRecord(offset, data);
    }

    return patchFile;
}

function createBSPFromFiles(original, modified) {
    let patch = new BSP();

    while (!modified.isEOF()) {
        let b1 = original.isEOF() ? 0x00 : original.readU8();
        let b2 = modified.readU8();

        if (b1 !== b2) {
            let differentData = [];
            let startOffset = modified.offset - 1;

            while (b1 !== b2 && differentData.length < 0xffff) {
                differentData.push(b2);
                if (modified.isEOF() || differentData.length === 0xffff) {
                    break;
                }

                b1 = original.isEOF() ? 0x00 : original.readU8();
                b2 = modified.readU8();
            }

            if (startOffset >= BSP_MAX_SIZE) {
                throw new Error('Files are too big for BSP format');
                return null;
            }

            patch.addRecord(startOffset, differentData);
        }
    }

    return patch;
}
