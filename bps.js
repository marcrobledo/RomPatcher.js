/* BPS module for RomPatcher.js v20171112	 - Marc Robledo 2016-2017 - http://www.marcrobledo.com/license */
/* File format specification: https://www.romhacking.net/documents/746/ */

var BPS_MAGIC='BPS1';
var BPS_ACTION_SOURCE_READ=0;
var BPS_ACTION_TARGET_READ=1;
var BPS_ACTION_SOURCE_COPY=2;
var BPS_ACTION_TARGET_COPY=3;


function BPS(){
	this.sourceSize=0;
	this.targetSize=0;
	this.metaData='';
	this.actionsOffset=0;
	this.file=null;
	this.sourceChecksum=0;
	this.targetChecksum=0;
	this.patchChecksum=0;
}
BPS.prototype.toString=function(){
	var s='Source size: '+this.sourceSize;
	s+='\Target size: '+this.targetSize;
	s+='\nMetadata: '+this.metaData;
	s+='\nActions offset: '+this.actionsOffset;
	return s
}
/*BPS.prototype.export=function(){

}*/
BPS.prototype.apply=function(romFile){
	if(this.sourceChecksum!==crc32(romFile,false)){
		MarcDialogs.alert('Error: invalid source ROM checksum');
		return false;
	}
	
	
	// first we determine target file size
	var newFileSize=0;
	var seek=this.actionsOffset;
	while(seek<(this.file.fileSize-12)){
		var data=decodeBPS(this.file, seek);
		var action={type: data.number & 3, length: (data.number >> 2)+1};
		seek+=data.length;

		newFileSize+=action.length;
		if(action.type===BPS_ACTION_TARGET_READ){
			seek+=action.length;
		}else if(action.type===BPS_ACTION_SOURCE_COPY || action.type===BPS_ACTION_TARGET_COPY){
			seek+=decodeBPS(this.file, seek).length;
		}
	}
	tempFile=new MarcBinFile(newFileSize);


	//patch
	var outputOffset=0;
	var sourceRelativeOffset=0;
	var targetRelativeOffset=0;
	seek=this.actionsOffset;
	while(seek<(this.file.fileSize-12)){
		var data=decodeBPS(this.file, seek);
		var action={type: data.number & 3, length: (data.number >> 2)+1};
		//console.log('0x'+seek.toString(16)+' - action: '+action.type+':'+action.length);
		seek+=data.length;

		if(action.type===BPS_ACTION_SOURCE_READ){
			tempFile.writeBytes(outputOffset, romFile.readBytes(outputOffset, action.length));
			outputOffset+=action.length;

		}else if(action.type===BPS_ACTION_TARGET_READ){
			tempFile.writeBytes(outputOffset, this.file.readBytes(seek, action.length));
			outputOffset+=action.length;
			seek+=action.length;

		}else if(action.type===BPS_ACTION_SOURCE_COPY){
			var data2=decodeBPS(this.file, seek);
			seek+=data2.length;
			sourceRelativeOffset+=(data2.number & 1 ? -1 : +1) * (data2.number >> 1);
			while(action.length--){
				tempFile.writeByte(outputOffset, romFile.readByte(sourceRelativeOffset));
				outputOffset++;
				sourceRelativeOffset++;
			}
		}else if(action.type===BPS_ACTION_TARGET_COPY){
			var data2=decodeBPS(this.file, seek);
			seek+=data2.length;
			targetRelativeOffset += (data2.number & 1 ? -1 : +1) * (data2.number >> 1);
			while(action.length--) {
				tempFile.writeByte(outputOffset, tempFile.readByte(targetRelativeOffset));
				outputOffset++;
				targetRelativeOffset++;
			}
		}
	}

	if(this.targetChecksum!==crc32(tempFile,false)){
		MarcDialogs.alert('Warning: invalid target ROM checksum');
	}

	return tempFile
}



function readBPSFile(file){
	file.littleEndian=true;
	var patchFile=new BPS();

	var seek=4; //skip BPS1
	var decodedSourceSize=decodeBPS(file, seek);
	patchFile.sourceSize=decodedSourceSize.number;
	seek+=decodedSourceSize.length;
	var decodedTargetSize=decodeBPS(file, seek);
	patchFile.targetSize=decodedTargetSize.number;
	seek+=decodedTargetSize.length;

	var decodedMetaDataLength=decodeBPS(file, seek);
	seek+=decodedMetaDataLength.length;
	patchFile.metaData=file.readString(seek, decodedMetaDataLength.length);
	seek+=patchFile.metaData.length;

	patchFile.actionsOffset=seek;
	patchFile.file=file;

	patchFile.sourceChecksum=file.readInt(file.fileSize-12);
	patchFile.targetChecksum=file.readInt(file.fileSize-8);
	patchFile.patchChecksum=file.readInt(file.fileSize-4);

	if(patchFile.patchChecksum!==crc32(file,true)){
		MarcDialogs.alert('Warning: invalid patch checksum');
	}


	return patchFile;
}


/*function createBPSFromFiles(original, modified){
	
}*/


/*function encodeBPS(number){
	number=number>>>0;
	var dataBytes=[];
	while(true){
		var x = number & 0x7f;
		number >>= 7;
		if(number == 0){
			dataBytes.push(0x80 | x);
			break;
		}
		dataBytes.push(x);
		number--;
	}
	return dataBytes;
}*/
function decodeBPS(dataBytes, i){
	var number = 0, shift = 1;
	var len=0;
	while(true){
		var x = dataBytes.readByte(i);
		i++;
		len++;
		number += (x & 0x7f) * shift;
		if(x & 0x80)
			break;
		shift <<= 7;
		number += shift;
	}
	return {number:number,length:len};
}