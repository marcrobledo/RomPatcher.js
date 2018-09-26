/* IPS module for RomPatcher.js v20180925 - Marc Robledo 2016-2018 - http://www.marcrobledo.com/license */
/* File format specification: http://www.smwiki.net/wiki/IPS_file_format */

var MAX_IPS_SIZE=16777216;
var RECORD_RLE=0x0000;
var RECORD_SIMPLE=1;
var IPS_MAGIC='PATCH';

function IPS(){
	this.records=[];
	this.truncate=false;
}
IPS.prototype.addSimpleRecord=function(o, d){
	this.records.push({offset:o, type:RECORD_SIMPLE, data:d})
}
IPS.prototype.addRLERecord=function(o, l, b){
	this.records.push({offset:o, type:RECORD_RLE, length:l, byte:b})
}
IPS.prototype.toString=function(){
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
	if(this.truncate)
		s+='\nTruncate at: 0x'+this.truncate.toString(16);
	return s
}
IPS.prototype.export=function(fileName){
	var binFileSize=0;
	binFileSize+=5; //PATCH string
	for(var i=0; i<this.records.length; i++){
		if(this.records[i].type===RECORD_RLE)
			binFileSize+=(3+2+2+1); //offset+0x0000+length+RLE byte to be written
		else
			binFileSize+=(3+2+this.records[i].data.length); //offset+length+data
	}
	binFileSize+=3; //EOF string
	if(this.truncate)
		binFileSize+=3; //truncate

	tempFile=new MarcBinFile(binFileSize);
	tempFile.littleEndian=false;
	tempFile.fileName=fileName+'.ips';
	tempFile.writeString(0, 'PATCH', 5);
	var seek=5;
	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		if(rec.type===RECORD_RLE){
			tempFile.writeThreeBytes(seek, rec.offset);
			tempFile.writeShort(seek+3, 0x0000);
			tempFile.writeShort(seek+5, rec.length);
			tempFile.writeByte(seek+7, rec.byte);
			seek+=3+2+2+1;
		}else{
			tempFile.writeThreeBytes(seek, rec.offset);
			tempFile.writeShort(seek+3, rec.data.length);
			tempFile.writeBytes(seek+5, rec.data);
			seek+=3+2+rec.data.length;
		}
	}

	tempFile.writeString(seek, 'EOF', 3);
	seek+=3;
	if(rec.truncate){
		tempFile.writeThreeBytes(seek, rec.truncate);
	}

	return tempFile
}
IPS.prototype.validateInput=function(romFile){return '?'}
IPS.prototype.apply=function(romFile){
	var newFileSize=romFile.fileSize;
	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		if(rec.type===RECORD_RLE){
			if(rec.offset+rec.length>newFileSize){
				newFileSize=rec.offset+rec.length;
			}
		}else{
			if(rec.offset+rec.data.length>newFileSize){
				newFileSize=rec.offset+rec.data.length;
			}
		}
	}

	tempFile=new MarcBinFile(newFileSize);

	var clonedFileSize=this.truncate || romFile.fileSize;
	for(var i=0; i<romFile.fileSize; i++)
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




function readIPSFile(file){
	var patchFile=new IPS();
	var EOF=false;
	var seek=5;

	while(seek<file.fileSize){
		var address=file.readThreeBytes(seek);
		seek+=3;

		if(!EOF && address===0x454f46){ /* EOF */
			EOF=true;
		}else if(EOF){
			patchFile.truncate=address;
		}else{
			var length=file.readShort(seek);
			seek+=2;

			if(length==RECORD_RLE){
				patchFile.addRLERecord(address, file.readShort(seek), file.readByte(seek+2));
				seek+=3;
			}else{
				patchFile.addSimpleRecord(address, file.readBytes(seek, length));
				seek+=length;
			}
		}
	}
	return patchFile;
}


function createIPSFromFiles(original, modified){
	tempFile=new IPS();

	if(modified.fileSize<original.fileSize){
		tempFile.truncate=modified.fileSize;
	}else if(modified.fileSize>original.fileSize){
		var originalTemp=new MarcBinFile(modified.fileSize);
		originalTemp.writeBytes(0, original.readBytes(0, original.fileSize));
		original=originalTemp;
	}

	var seek=0;
	while(seek<modified.fileSize){
		var b1=original.readByte(seek);
		var b2=modified.readByte(seek);

		if(b1!==b2){
			var RLERecord=true;
			var originalSeek=seek;
			var length=1;

			/* find difference in next 6 bytes (in order to save space) */
			/* force length to be 0xffff-6 bytes to keep IPS standard */
			var nearbyDifference=true;
			while(nearbyDifference && length<(0xffff-6)){
				if((seek+6)>=modified.fileSize){
					var finalSeek=modified.fileSize-seek-1;
					length+=finalSeek;
					seek+=finalSeek;
					break;
				}

				for(var i=6;i>0 && nearbyDifference;i--){
					if(original.readByte(seek+i)!==modified.readByte(seek+i)){
						length+=i;
						seek+=i;
						break;
					}else if(i==1){
						nearbyDifference=false;
					}
				}
			}

			var data=modified.readBytes(originalSeek, length);
			/* check RLE record */
			for(var i=1; i<length && RLERecord; i++){
				if(data[i]!==data[0])
					RLERecord=false;
			}

			if(RLERecord){
				if(length<3){
					tempFile.addSimpleRecord(originalSeek, data);
				}else{
					tempFile.addRLERecord(originalSeek, length, data[0]);
				}
				//tempFile.addRLERecord(originalSeek, length, data[0]);
			}else{
				tempFile.addSimpleRecord(originalSeek, data);
			}

			seek=originalSeek+length;
		}else{
			seek++;
		}
	}
	return tempFile
}