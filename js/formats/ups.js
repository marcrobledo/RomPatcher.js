/* UPS module for Rom Patcher JS v20180930 - Marc Robledo 2017-2018 - http://www.marcrobledo.com/license */
/* File format specification: http://www.romhacking.net/documents/392/ */

const UPS_MAGIC='UPS1';

function UPS(){
	this.records=[];
	this.sizeInput=0;
	this.sizeOutput=0;
	this.checksumInput=0;
	this.checksumOutput=0;
}
UPS.prototype.addRecord=function(relativeOffset, d){
	this.records.push({offset:relativeOffset, XORdata:d})
}
UPS.prototype.toString=function(){
	var s='Records: '+this.records.length;
	s+='\nInput file size: '+this.sizeInput;
	s+='\nOutput file size: '+this.sizeOutput;
	s+='\nInput file checksum: '+padZeroes(this.checksumInput,4);
	s+='\nOutput file checksum: '+padZeroes(this.checksumOutput,4);
	return s
}
UPS.prototype.export=function(fileName){
	var patchFileSize=UPS_MAGIC.length;//UPS1 string
	patchFileSize+=UPS_getVLVLength(this.sizeInput); //input file size
	patchFileSize+=UPS_getVLVLength(this.sizeOutput); //output file size
	for(var i=0; i<this.records.length; i++){
		patchFileSize+=UPS_getVLVLength(this.records[i].offset);
		patchFileSize+=this.records[i].XORdata.length+1;
	}
	patchFileSize+=12; //input/output/patch checksums

	tempFile=new MarcFile(patchFileSize);
	tempFile.writeVLV=UPS_writeVLV;
	tempFile.fileName=fileName+'.ups';
	tempFile.writeString(UPS_MAGIC);

	tempFile.writeVLV(this.sizeInput);
	tempFile.writeVLV(this.sizeOutput);

	for(var i=0; i<this.records.length; i++){
		tempFile.writeVLV(this.records[i].offset);
		tempFile.writeBytes(this.records[i].XORdata);
		tempFile.writeU8(0x00);
	}
	tempFile.littleEndian=true;
	tempFile.writeU32(this.checksumInput);
	tempFile.writeU32(this.checksumOutput);
	tempFile.writeU32(crc32(tempFile, 0, true));

	return tempFile
}
UPS.prototype.validateSource=function(romFile,headerSize){return crc32(romFile,headerSize)===this.checksumInput}
UPS.prototype.apply=function(romFile, validate){
	if(validate && !this.validateSource(romFile)){
		throw new Error('error_crc_input');
	}


	/* copy original file */
	tempFile=new MarcFile(this.sizeOutput);
	romFile.copyToFile(tempFile, 0, this.sizeInput);

	romFile.seek(0);


	var nextOffset=0;
	for(var i=0; i<this.records.length; i++){
		var record=this.records[i];
		tempFile.skip(record.offset);
		romFile.skip(record.offset);

		for(var j=0; j<record.XORdata.length; j++){
			tempFile.writeU8((romFile.isEOF()?0x00:romFile.readU8()) ^ record.XORdata[j]);
		}
		tempFile.skip(1);
		romFile.skip(1);
	}

	if(validate && crc32(tempFile)!==this.checksumOutput){
		throw new Error('error_crc_output');
	}

	return tempFile
}


/* encode/decode variable length values, used by UPS file structure */
function UPS_writeVLV(data){
	while(1){
		var x=data & 0x7f;
		data=data>>7;
		if(data===0){
			this.writeU8(0x80 | x);
			break;
		}
		this.writeU8(x);
		data=data-1;
	}
}
function UPS_readVLV(){
	var data=0;

	var shift=1;
	while(1){
		var x=this.readU8();

		if(x==-1)
			throw new Error('Can\'t read UPS VLV at 0x'+(this.offset-1).toString(16));

		data+=(x&0x7f)*shift;
		if((x&0x80)!==0)
			break;
		shift=shift<<7;
		data+=shift;
	}
	return data
}
function UPS_getVLVLength(data){
	var len=0;
	while(1){
		var x=data & 0x7f;
		data=data>>7;
		len++;
		if(data===0){
			break;
		}
		data=data-1;
	}
	return len;
}


function parseUPSFile(file){
	var patch=new UPS();
	file.readVLV=UPS_readVLV;

	file.seek(UPS_MAGIC.length);

	patch.sizeInput=file.readVLV();
	patch.sizeOutput=file.readVLV();


	var nextOffset=0;
	while(file.offset<(file.fileSize-12)){
		var relativeOffset=file.readVLV();


		var XORdifferences=[];
		while(file.readU8()){
			XORdifferences.push(file._lastRead);
		}
		patch.addRecord(relativeOffset, XORdifferences);
	}

	file.littleEndian=true;
	patch.checksumInput=file.readU32();
	patch.checksumOutput=file.readU32();

	if(file.readU32()!==crc32(file, 0, true)){
		throw new Error('error_crc_patch');
	}

	file.littleEndian=false;
	return patch;
}



function createUPSFromFiles(original, modified){
	var patch=new UPS();
	patch.sizeInput=original.fileSize;
	patch.sizeOutput=modified.fileSize;


	var previousSeek=1;
	while(!modified.isEOF()){
		var b1=original.isEOF()?0x00:original.readU8();
		var b2=modified.readU8();

		if(b1!==b2){
			var currentSeek=modified.offset;
			var XORdata=[];

			while(b1!==b2){
				XORdata.push(b1 ^ b2);

				if(modified.isEOF())
					break;
				b1=original.isEOF()?0x00:original.readU8();
				b2=modified.readU8();
			}

			patch.addRecord(currentSeek-previousSeek, XORdata);
			previousSeek=currentSeek+XORdata.length+1;
		}
	}


	patch.checksumInput=crc32(original);
	patch.checksumOutput=crc32(modified);
	return patch
}