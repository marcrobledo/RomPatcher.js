/* IPS module for Rom Patcher JS v20220417 - Marc Robledo 2016-2022 - http://www.marcrobledo.com/license */
/* File format specification: http://www.smwiki.net/wiki/IPS_file_format */



const IPS_MAGIC='PATCH';
const IPS_MAX_SIZE=0x1000000; //16 megabytes
const IPS_RECORD_RLE=0x0000;
const IPS_RECORD_SIMPLE=0x01;

function IPS(){
	this.records=[];
	this.truncate=false;
}
IPS.prototype.addSimpleRecord=function(o, d){
	this.records.push({offset:o, type:IPS_RECORD_SIMPLE, length:d.length, data:d})
}
IPS.prototype.addRLERecord=function(o, l, b){
	this.records.push({offset:o, type:IPS_RECORD_RLE, length:l, byte:b})
}
IPS.prototype.toString=function(){
	nSimpleRecords=0;
	nRLERecords=0;
	for(var i=0; i<this.records.length; i++){
		if(this.records[i].type===IPS_RECORD_RLE)
			nRLERecords++;
		else
			nSimpleRecords++;
	}
	var s='Simple records: '+nSimpleRecords;
	s+='\nRLE records: '+nRLERecords;
	s+='\nTotal records: '+this.records.length;
	if(this.truncate)
		s+='\nTruncate at: 0x'+this.truncate.toString(16);
	return s
}
IPS.prototype.export=function(fileName){
	var patchFileSize=5; //PATCH string
	for(var i=0; i<this.records.length; i++){
		if(this.records[i].type===IPS_RECORD_RLE)
			patchFileSize+=(3+2+2+1); //offset+0x0000+length+RLE byte to be written
		else
			patchFileSize+=(3+2+this.records[i].data.length); //offset+length+data
	}
	patchFileSize+=3; //EOF string
	if(this.truncate)
		patchFileSize+=3; //truncate

	tempFile=new MarcFile(patchFileSize);
	tempFile.fileName=fileName+'.ips';
	tempFile.writeString(IPS_MAGIC);
	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		tempFile.writeU24(rec.offset);
		if(rec.type===IPS_RECORD_RLE){
			tempFile.writeU16(0x0000);
			tempFile.writeU16(rec.length);
			tempFile.writeU8(rec.byte);
		}else{
			tempFile.writeU16(rec.data.length);
			tempFile.writeBytes(rec.data);
		}
	}

	tempFile.writeString('EOF');
	if(this.truncate)
		tempFile.writeU24(this.truncate);


	return tempFile
}
IPS.prototype.apply=function(romFile){
	if(this.truncate){
		if(this.truncate>romFile.fileSize){ //expand (discussed here: https://github.com/marcrobledo/RomPatcher.js/pull/46)
			tempFile=new MarcFile(this.truncate);
			romFile.copyToFile(tempFile, 0, romFile.fileSize, 0);
		}else{ //truncate
			tempFile=romFile.slice(0, this.truncate);
		}
	}else{
		//calculate target ROM size, expanding it if any record offset is beyond target ROM size
		var newFileSize=romFile.fileSize;
		for(var i=0; i<this.records.length; i++){
			var rec=this.records[i];
			if(rec.type===IPS_RECORD_RLE){
				if(rec.offset+rec.length>newFileSize){
					newFileSize=rec.offset+rec.length;
				}
			}else{
				if(rec.offset+rec.data.length>newFileSize){
					newFileSize=rec.offset+rec.data.length;
				}
			}
		}

		if(newFileSize===romFile.fileSize){
			tempFile=romFile.slice(0, romFile.fileSize);
		}else{
			tempFile=new MarcFile(newFileSize);
			romFile.copyToFile(tempFile,0);
		}
	}


	romFile.seek(0);

	for(var i=0; i<this.records.length; i++){
		tempFile.seek(this.records[i].offset);
		if(this.records[i].type===IPS_RECORD_RLE){
			for(var j=0; j<this.records[i].length; j++)
				tempFile.writeU8(this.records[i].byte);
		}else{
			tempFile.writeBytes(this.records[i].data);
		} 
	}

	return tempFile
}




function parseIPSFile(file){
	var patchFile=new IPS();
	file.seek(5);

	while(!file.isEOF()){
		var offset=file.readU24();

		if(offset===0x454f46){ /* EOF */
			if(file.isEOF()){
				break;
			}else if((file.offset+3)===file.fileSize){
				patchFile.truncate=file.readU24();
				break;
			}
		}

		var length=file.readU16();

		if(length===IPS_RECORD_RLE){
			patchFile.addRLERecord(offset, file.readU16(), file.readU8());
		}else{
			patchFile.addSimpleRecord(offset, file.readBytes(length));
		}
	}
	return patchFile;
}


function createIPSFromFiles(original, modified){
	var patch=new IPS();

	if(modified.fileSize<original.fileSize){
		patch.truncate=modified.fileSize;
	}

	//solucion: guardar startOffset y endOffset (ir mirando de 6 en 6 hacia atrás)
	var previousRecord={type:0xdeadbeef,startOffset:0,length:0};
	while(!modified.isEOF()){
		var b1=original.isEOF()?0x00:original.readU8();
		var b2=modified.readU8();

		if(b1!==b2){
			var RLEmode=true;
			var differentData=[];
			var startOffset=modified.offset-1;

			while(b1!==b2 && differentData.length<0xffff){
				differentData.push(b2);
				if(b2!==differentData[0])
					RLEmode=false;

				if(modified.isEOF() || differentData.length===0xffff)
					break;

				b1=original.isEOF()?0x00:original.readU8();
				b2=modified.readU8();
			}


			//check if this record is near the previous one
			var distance=startOffset-(previousRecord.offset+previousRecord.length);
			if(
				previousRecord.type===IPS_RECORD_SIMPLE &&
				distance<6 && (previousRecord.length+distance+differentData.length)<0xffff
			){
				if(RLEmode && differentData.length>6){
					// separate a potential RLE record
					original.seek(startOffset);
					modified.seek(startOffset);
					previousRecord={type:0xdeadbeef,startOffset:0,length:0};
				}else{
					// merge both records
					while(distance--){
						previousRecord.data.push(modified._u8array[previousRecord.offset+previousRecord.length]);
						previousRecord.length++;
					}
					previousRecord.data=previousRecord.data.concat(differentData);
					previousRecord.length=previousRecord.data.length;
				}
			}else{
				if(startOffset>=IPS_MAX_SIZE){
					throw new Error('files are too big for IPS format');
					return null;
				}

				if(RLEmode && differentData.length>2){
					patch.addRLERecord(startOffset, differentData.length, differentData[0]);
				}else{
					patch.addSimpleRecord(startOffset, differentData);
				}
				previousRecord=patch.records[patch.records.length-1];
			}
		}
	}




	if(modified.fileSize>original.fileSize){
		var lastRecord=patch.records[patch.records.length-1];
		var lastOffset=lastRecord.offset+lastRecord.length;

		if(lastOffset<modified.fileSize){
			patch.addSimpleRecord(modified.fileSize-1, [0x00]);
		}
	}


	return patch
}
