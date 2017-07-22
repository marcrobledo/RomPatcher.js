/* UPS module for RomPatcher.js v20170721 - Marc Robledo 2017 - http://www.marcrobledo.com/license */
/* File format specification: http://www.romhacking.net/documents/392/ */

var UPS_MAGIC='UPS1';

function UPS(){
	this.records=[];
	this.sizeInput=0;
	this.sizeOutput=0;
	this.checksumInput=0;
	this.checksumOutput=0;
	this.checksumPatch=0;
}
UPS.prototype.addRecord=function(o, d){
	this.records.push({offset:o, XORdata:d})
}
UPS.prototype.toString=function(){
	var s='Records: '+this.records.length;
	s+='\nInput file size: '+this.sizeInput;
	s+='\nOutput file size: '+this.sizeOutput;
	s+='\nInput file checksum: '+this.checksumInput;
	s+='\nOutput file checksum: '+this.checksumOutput;
	s+='\nPatch file checksum: '+this.checksumPatch;
	return s
}
UPS.prototype.export=function(){
	var encodedSizeInput=encodeVLV(this.sizeInput);
	var encodedSizeOutput=encodeVLV(this.sizeOutput);
	var encodedRecords=[];
	var binFileSize=0;
	binFileSize+=UPS_MAGIC.length; //UPS1 string
	binFileSize+=encodedSizeInput.length; //input file size
	binFileSize+=encodedSizeOutput.length; //output file size
	for(var i=0; i<this.records.length; i++){
		encodedRecords.push(encodeVLV(this.records[i].offset));
		binFileSize+=encodedRecords[i].length;
		binFileSize+=this.records[i].XORdata.length+1;
	}
	binFileSize+=12; //input/output/patch checksums

	tempFile=new MarcBinFile(binFileSize);
	tempFile.littleEndian=false;
	tempFile.fileName='patch.ups';
	tempFile.writeString(0, UPS_MAGIC, UPS_MAGIC.length);

	tempFile.writeBytes(4, encodedSizeInput);
	tempFile.writeBytes(4+encodedSizeInput.length, encodedSizeOutput);

	var seek=4+encodedSizeInput.length+encodedSizeOutput.length;
	for(var i=0; i<this.records.length; i++){
		tempFile.writeBytes(seek, encodedRecords[i]);
		seek+=encodedRecords[i].length;
		tempFile.writeBytes(seek, this.records[i].XORdata);
		seek+=this.records[i].XORdata.length;
		tempFile.writeByte(seek, 0);
		seek+=1;
	}
	tempFile.littleEndian=true;
	tempFile.writeInt(seek, this.checksumInput);
	tempFile.writeInt(seek+4, this.checksumOutput);
	tempFile.writeInt(seek+8, this.checksumPatch);

	return tempFile
}
UPS.prototype.apply=function(romFile){
	if(crc32(romFile)!==this.checksumInput){
		MarcDialogs.alert('Invalid input ROM');
		return false;
	}

	tempFile=new MarcBinFile(this.sizeOutput);

	/* copy original file */
	for(var i=0; i<romFile.fileSize; i++)
		tempFile.writeByte(i, romFile.readByte(i));

	var nextOffset=0;
	for(var i=0; i<this.records.length; i++){
		var nextDifference=this.records[i];
		nextOffset+=nextDifference.offset;
		for(var j=0; j<nextDifference.XORdata.length; j++){
			tempFile.writeByte(nextOffset+j, romFile.readByte(nextOffset+j) ^ nextDifference.XORdata[j]);
		}
		nextOffset+=nextDifference.XORdata.length+1;
	}

	if(crc32(tempFile)!==this.checksumOutput){
		MarcDialogs.alert('Invalid output ROM');
		return false;
	}

	return tempFile
}


/* encode/decode variable length values, used by UPS file structure */
function encodeVLV(offset){
	var bytes=[];
	while(1){
		var x=offset & 0x7f;
		offset=offset>>7;
		if(offset===0){
			bytes.push(0x80 | x);
			break;
		}
		bytes.push(x);
		offset=offset-1;
	}
	return bytes;
}
function decodeVLV(file, pos){
	var offset=0;
	var size=0;
	var shift=1;
	while(1){
		var x=file.readByte(pos);
		pos++;
		if(x==-1)
			console.error('corrupted UPS file?');
		size++;
		offset+=(x&0x7f)*shift;
		if((x&0x80)!==0)
			break;
		shift=shift<<7;
		offset+=shift;
	}
	return {offset:offset, size:size}
}


function readUPSFile(file){
	var patchFile=new UPS();

	var decodedInputFilesize=decodeVLV(tempFile,4);
	patchFile.sizeInput=decodedInputFilesize.offset;


	var decodedOutputFilesize=decodeVLV(tempFile,4+decodedInputFilesize.size);
	patchFile.sizeOutput=decodedOutputFilesize.offset;

	var seek=4+decodedInputFilesize.size+decodedOutputFilesize.size;
	var nextOffset=0;
	while(seek<(tempFile.fileSize-12)){
		var decodedOffset=decodeVLV(tempFile, seek);
		seek+=decodedOffset.size;

		nextOffset+=decodedOffset.offset;

		var bytes=[];
		var lastByte;
		while(lastByte=tempFile.readByte(seek)){
			bytes.push(lastByte);
			seek++;
		}
		seek++;
		patchFile.addRecord(decodedOffset.offset, bytes);
	}

	file.littleEndian=true;
	patchFile.checksumInput=tempFile.readInt(seek);
	patchFile.checksumOutput=tempFile.readInt(seek+4);
	patchFile.checksumPatch=tempFile.readInt(seek+8);

	if(patchFile.checksumPatch!==crc32(file, true)){
		MarcDialogs.alert('Invalid patch checksum');
	}
	return patchFile;
}



function createUPSFromFiles(original, modified){
	tempFile=new UPS();
	tempFile.sizeInput=original.fileSize;
	tempFile.sizeOutput=modified.fileSize;

	var seek=0;
	var previousSeek=0;
	while(seek<modified.fileSize){
		var b1=seek>original.fileSize?0x00:original.readByte(seek);
		var b2=modified.readByte(seek);

		if(b1!==b2){
			var currentSeek=seek;
			var differentBytes=[];

			while(b1!==b2){
				differentBytes.push(b1 ^ b2);
				seek++;
				b1=seek>original.fileSize?0x00:original.readByte(seek);
				b2=modified.readByte(seek);
			}

			var nextDifference=currentSeek-previousSeek;
			tempFile.addRecord(nextDifference, differentBytes);
			previousSeek=currentSeek+differentBytes.length+1;
			seek++;
		}else{
			seek++;
		}
	}


	tempFile.checksumInput=crc32(original);
	tempFile.checksumOutput=crc32(modified);
	//tempFile.checksumPatch=crc32(tempFile.export(), true);
	return tempFile
}