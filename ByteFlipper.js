/* ByteFlipper.js v20170717 - Marc Robledo 2013-2017 - http://www.marcrobledo.com/license */
function flipFile(){
	var type=el('radio8').checked?8:4;
	if(tempFile.fileSize>MAX_ROM_SIZE){
		MarcDialogs.alert('Too big file');
		return false;
	}else if(tempFile.fileSize%type!==0){
		MarcDialogs.alert('File is not divisible by '+type);
		return false;
	}

	var tempFile2=new MarcBinFile(tempFile.fileSize);
	var offset=0;
	for(var i=0; i<tempFile.fileSize; i+=type){
		tempFile2.writeBytes(offset, tempFile.readBytes(offset, type).reverse());
		offset+=type;
	}
	tempFile2.fileName=tempFile.fileName.replace(/\.(.*?)$/, ' (byteflipped).$1');
	tempFile2.save();
}
function flipBytesInFile(){
	if(el('input-file-flip').files.length)
		tempFile=new MarcBinFile(el('input-file-flip'), flipFile);
	else
		MarcDialogs.alert('No file selected');
}
