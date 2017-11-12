/* APS (N64) module for RomPatcher.js v20171112 - Marc Robledo 2017 - http://www.marcrobledo.com/license */
/* File format specification: https://github.com/btimofeev/UniPatcher/wiki/APS-(N64) */

var RECORD_RLE=0x0000;
var RECORD_SIMPLE=1;
var APS_MAGIC='APS10';

function APS(){
	this.records=[];
	this.headerType=0;
	this.encodingMethod=0;
	this.description='no description';

	this.header={};
}
APS.prototype.addRecord=function(o, d){
	this.records.push({offset:o, type:RECORD_SIMPLE, data:d})
}
APS.prototype.addRLERecord=function(o, l, b){
	this.records.push({offset:o, type:RECORD_RLE, length:l, byte:b})
}
APS.prototype.toString=function(){
	nSimpleRecords=0;
	nRLERecords=0;
	for(var i=0; i<this.records.length; i++){
		if(this.records[i].type===RECORD_RLE)
			nRLERecords++;
		else
			nSimpleRecords++;
	}
	var s='';
	s+='\Simple records: '+nSimpleRecords;
	s+='\nRLE records: '+nRLERecords;
	s+='\nTotal records: '+this.records.length;
	s+='\nHeader type: '+this.headerType;
	s+='\nEncoding method: '+this.encodingMethod;
	s+='\nDescription: '+this.description;
	s+='\nHeader: '+JSON.stringify(this.header);
	return s
}
APS.prototype.export=function(){
	var patchFileSize=(this.headerType===1)?78:61;

	for(var i=0; i<this.records.length; i++){
		if(this.records[i].type===RECORD_RLE)
			patchFileSize+=7;
		else
			patchFileSize+=5+this.records[i].data.length; //offset+length+data
	}

	tempFile=new MarcBinFile(patchFileSize);
	tempFile.littleEndian=true;
	tempFile.fileName='patch.aps';
	tempFile.writeString(0, APS_MAGIC, APS_MAGIC.length);
	tempFile.writeByte(5, this.headerType);
	tempFile.writeByte(6, this.encodingMethod);
	tempFile.writeString(7, this.description, 50);

	var seek;
	if(this.headerType===1){
		tempFile.writeByte(57, this.header.originalFileFormat);
		tempFile.writeString(58, this.header.cartId, 3);
		tempFile.writeBytes(61, this.header.crc);
		tempFile.writeBytes(69, this.header.pad);
		tempFile.writeInt(74, this.header.sizeOutput);
		seek=78;
	}else{
		tempFile.writeInt(57, this.header.sizeOutput);
		seek=61;
	}

	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		if(rec.type===RECORD_RLE){
			tempFile.writeInt(seek, rec.offset);
			tempFile.writeByte(seek+4, 0x00);
			tempFile.writeByte(seek+5, rec.byte);
			tempFile.writeByte(seek+6, rec.length);
			seek+=7;
		}else{
			tempFile.writeInt(seek, rec.offset);
			tempFile.writeByte(seek+4, rec.data.length);
			tempFile.writeBytes(seek+5, rec.data);
			seek+=5+rec.data.length;
		}
	}

	return tempFile
}
APS.prototype.apply=function(romFile){
	if(this.headerType===1){
		if(romFile.readString(0x3c, 3)!==this.header.cartId){
			MarcDialogs.alert('Error: invalid ROM cart id');
			return false;
		}
		var crc=romFile.readBytes(0x10, 8);
		var crcOk=true;
		for(var i=0; i<8 && crcOk; i++){
			if(crc[i]!==this.header.crc[i])
				crcOk=false;
		}
		if(!crcOk){
			MarcDialogs.alert('Error: invalid ROM checksum');
			return false;
		}
	}

	tempFile=new MarcBinFile(this.header.sizeOutput);

	for(var i=0; i<romFile.fileSize && i<this.header.sizeOutput; i++)
		tempFile.writeByte(i, romFile.readByte(i));

	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		if(rec.type===RECORD_RLE){
			for(var j=0; j<rec.length; j++)
				tempFile.writeByte(rec.offset+j, rec.byte);
		}else{
			for(var j=0; j<rec.data.length; j++)
				tempFile.writeByte(rec.offset+j, rec.data[j]);
		}
	}

	return tempFile
}




function readAPSFile(file){
	var patchFile=new APS();
	file.littleEndian=true;

	patchFile.headerType=file.readByte(5);
	patchFile.encodingMethod=file.readByte(6);
	patchFile.description=file.readString(7, 50);

	var seek;
	if(patchFile.headerType===1){
		patchFile.header.originalFileFormat=file.readByte(57);
		patchFile.header.cartId=file.readString(58, 3);
		patchFile.header.crc=file.readBytes(61, 8);
		patchFile.header.pad=file.readBytes(69, 5);
		patchFile.header.sizeOutput=file.readInt(74);
		seek=78;
	}else{
		patchFile.header.sizeOutput=file.readInt(57);
		seek=61;
	}

	while(seek<file.fileSize){
		var offset=file.readInt(seek);
		seek+=4;

		var length=file.readByte(seek);
		seek+=1;

		if(length==RECORD_RLE){
			patchFile.addRLERecord(offset, file.readByte(seek+1), file.readByte(seek));
			seek+=2;
		}else{
			patchFile.addRecord(offset, file.readBytes(seek, length));
			seek+=length;
		}
	}
	return patchFile;
}

function createAPSFromFiles(original, modified, N64header){
	tempFile=new APS();

	if(N64header){
		tempFile.headerType=1;

		tempFile.header.originalFileFormat=0;
		tempFile.header.cartId=original.readString(0x3c, 3);
		tempFile.header.crc=original.readBytes(0x10, 8);
		tempFile.header.pad=[0,0,0,0,0];
	}
	tempFile.header.sizeOutput=modified.fileSize;

	var seek=0;
	while(seek<modified.fileSize){
		var b1=original.readByte(seek);
		var b2=modified.readByte(seek);

		if(b1!==b2){
			var RLERecord=true;
			var differentBytes=[];
			var offset=seek;

			while(b1!==b2 && differentBytes.length<255){
				differentBytes.push(b2);
				if(b2!==differentBytes[0])
					RLERecord=false;
				seek++;
				b1=seek>original.fileSize?0x00:original.readByte(seek);
				b2=modified.readByte(seek);
			}

			if(RLERecord && differentBytes.length>2){
				tempFile.addRLERecord(offset, differentBytes.length, differentBytes[0]);
			}else{
				tempFile.addRecord(offset, differentBytes);
			}
			//seek++;
		}else{
			seek++;
		}
	}
	return tempFile
}