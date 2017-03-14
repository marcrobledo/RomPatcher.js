/* ips-patcher.js v20160416 - Marc Robledo 2016 - http://www.marcrobledo.com/license */




/* Implement 3-byte reader/writer in MarcBinFile */
MarcBinFile.prototype.readThreeBytes=function(offset){
	return (this.readByte(offset+0) << 16)+(this.readByte(offset+1) << 8)+(this.readByte(offset+2))
}
MarcBinFile.prototype.writeThreeBytes=function(offset,val){
	this.writeBytes(offset, [(val & 0xff0000) >> 16, (val & 0x00ff00) >> 8, (val & 0x0000ff)]);
}






/* Shortcuts */
function addEvent(e,ev,f){e.addEventListener(ev,f,false)}
function el(e){return document.getElementById(e)}





/*
	IPS file format
	doc: http://www.smwiki.net/wiki/IPS_file_format
*/
var RECORD_RLE=0x0000;
var RECORD_SIMPLE=1;
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
IPS.prototype.buildFile=function(){
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
	tempFile.fileName='patch.ips';
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

	tempFile.save();
}
IPS.prototype.applyOnROM=function(romFile){
	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		if(rec.type===RECORD_RLE){
			if(rec.offset+rec.length>romFile.fileSize){
				alert('Invalid ROM file (too big?).');
				return false;
			}
		}else{
			if(rec.offset+rec.data.length>romFile.fileSize){
				alert('Invalid ROM file (too big?).');
				return false;
			}
		}
	}

	var patchedFile=new MarcBinFile(romFile.fileSize);
	patchedFile.fileName=romFile.fileName.replace(/\.(.*?)$/, ' (patched).$1');
	var clonedFileSize=this.truncate || romFile.fileSize;
	for(var i=0; i<romFile.fileSize; i++)
		patchedFile.writeByte(i, romFile.readByte(i));

	for(var i=0; i<this.records.length; i++){
		var rec=this.records[i];
		if(rec.type===RECORD_RLE){
			for(var j=0; j<rec.length; j++)
				patchedFile.writeByte(rec.offset+j, rec.byte);
		}else{
			for(var j=0; j<rec.data.length; j++)
				patchedFile.writeByte(rec.offset+j, rec.data[j]);
		} 
	}

	patchedFile.save();
}








addEvent(window,'load',function(){
	el('input-file-rom').value='';
	el('input-file-ips').value='';
	el('input-file-rom1').value='';
	el('input-file-rom2').value='';
});



var romFile, ipsFile, romFile1, romFile2, tempFile;

function openROM(f){
	romFile=new MarcBinFile(f, function(){
		if(romFile.fileSize>16777215)
			alert('Too big ROM file');
	});
}

function openROM1(f){
	romFile1=new MarcBinFile(f, function(){
		if(romFile1.fileSize>16777215)
			alert('Too big ROM file');
	});
}
function openROM2(f){
	romFile2=new MarcBinFile(f, function(){
		if(romFile2.fileSize>16777215)
			alert('Too big ROM file');
	});
}

function openIPS(f){
	tempFile=new MarcBinFile(f, readIPS);
}






function readIPS(){
	tempFile.littleEndian=false;

	if(tempFile.readString(0,5)!=='PATCH'){
		MarcDialogs.alert('Invalid IPS File');
		return false;
	}


	ipsFile=new IPS();
	var EOF=false;
	var seek=5;

	while(seek<tempFile.fileSize){
		var address=tempFile.readThreeBytes(seek);
		seek+=3;

		if(!EOF && address===0x454f46){ /* EOF */
			EOF=true;
		}else if(EOF){
			ipsFile.truncate=address;
		}else{
			var length=tempFile.readShort(seek);
			seek+=2;

			if(length==RECORD_RLE){
				ipsFile.addRLERecord(address, tempFile.readShort(seek), tempFile.readByte(seek+2));
				seek+=3;
			}else{
				ipsFile.addSimpleRecord(address, tempFile.readBytes(seek, length));
				seek+=length;
			}
		}
	}

	//el('span-ips-file').innerHTML=tempFile.fileName;
}


/* to-do!!! */
function createIPS(original, modified){
	tempFile=new IPS();

	if(modified.fileSize<original.fileSize)
		tempFile.truncate=modified.fileSize;

	var seek=0;
	while(seek<modified.fileSize){
		var b1=original.readByte(seek);
		var b2=modified.readByte(seek);

		if(b1!==b2){
			var RLERecord=true;
			var originalSeek=seek;
			var length=1;

			/* buscar diferencia en los próximos 6 bytes (para ganar espacio) */
			var nearbyDifference=true;
			while(nearbyDifference){
				var seekStart=6;
				while(seek+seekStart>modified.fileSize){
					seekStart--;
				}
				for(var i=seekStart;i>0 && nearbyDifference;i--){
					var bc1=original.readByte(seek+i);
					var bc2=modified.readByte(seek+i);

					if(bc1!=bc2){
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
				tempFile.addRLERecord(originalSeek, length, data[0]);
			}else{
				tempFile.addSimpleRecord(originalSeek, data);
			}

			seek=originalSeek+length;
		}else{
			seek++;
		}
	}
	tempFile.buildFile();
}


/* MarcBinFile.js v20190703 - Marc Robledo 2014-2016 - http://www.marcrobledo.com/license */
function MarcBinFile(a,b){if("function"!=typeof window.FileReader)throw console.error("MarcBinFile.js: Browser doesn't support FileReader."),"Invalid browser";if("object"==typeof a&&a.name&&a.size)this.file=a,this.fileName=this.file.name,this.fileSize=this.file.size,this.fileType=a.type;else if("object"==typeof a&&a.files){if(1!=a.files.length){for(var c=[],d=a.files.length,e=function(){d--,0==d&&b&&b.call()},f=0;f<a.files.length;f++)c.push(new MarcBinFile(a.files[f],e));return c}this.file=a.files[0],this.fileName=this.file.name,this.fileSize=this.file.size,this.fileType=this.file.type}else{if("number"!=typeof a)throw console.error("MarcBinFile.js: Invalid type of file."),"Invalid file.";this.file=!1,this.fileName="newfile.hex",this.fileSize=a,this.fileType="application/octet-stream"}this.littleEndian=function(){var a=new ArrayBuffer(2);return new DataView(a).setInt16(0,256,!0),256===new Int16Array(a)[0]}(),this.file?(this.fileReader=new FileReader,this.fileReader.addEventListener("load",function(){this.dataView=new DataView(this.result)},!1),b&&this.fileReader.addEventListener("load",b,!1),this.fileReader.readAsArrayBuffer(this.file)):(this.fileReader=new ArrayBuffer(this.fileSize),this.fileReader.dataView=new DataView(this.fileReader),b&&b.call())}var saveAs=saveAs||function(a){"use strict";if("undefined"==typeof navigator||!/MSIE [1-9]\./.test(navigator.userAgent)){var b=a.document,c=function(){return a.URL||a.webkitURL||a},d=b.createElementNS("http://www.w3.org/1999/xhtml","a"),e="download"in d,f=function(a){var b=new MouseEvent("click");a.dispatchEvent(b)},g=/Version\/[\d\.]+.*Safari/.test(navigator.userAgent),h=a.webkitRequestFileSystem,i=a.requestFileSystem||h||a.mozRequestFileSystem,j=function(b){(a.setImmediate||a.setTimeout)(function(){throw b},0)},k="application/octet-stream",l=0,m=500,n=function(b){var d=function(){"string"==typeof b?c().revokeObjectURL(b):b.remove()};a.chrome?d():setTimeout(d,m)},o=function(a,b,c){b=[].concat(b);for(var d=b.length;d--;){var e=a["on"+b[d]];if("function"==typeof e)try{e.call(a,c||a)}catch(a){j(a)}}},p=function(a){return/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\ufeff",a],{type:a.type}):a},q=function(b,j,m){m||(b=p(b));var t,u,z,q=this,r=b.type,s=!1,v=function(){o(q,"writestart progress write writeend".split(" "))},w=function(){if(u&&g&&"undefined"!=typeof FileReader){var d=new FileReader;return d.onloadend=function(){var a=d.result;u.location.href="data:attachment/file"+a.slice(a.search(/[,;]/)),q.readyState=q.DONE,v()},d.readAsDataURL(b),void(q.readyState=q.INIT)}if(!s&&t||(t=c().createObjectURL(b)),u)u.location.href=t;else{var e=a.open(t,"_blank");void 0==e&&g&&(a.location.href=t)}q.readyState=q.DONE,v(),n(t)},x=function(a){return function(){if(q.readyState!==q.DONE)return a.apply(this,arguments)}},y={create:!0,exclusive:!1};return q.readyState=q.INIT,j||(j="download"),e?(t=c().createObjectURL(b),void setTimeout(function(){d.href=t,d.download=j,f(d),v(),n(t),q.readyState=q.DONE})):(a.chrome&&r&&r!==k&&(z=b.slice||b.webkitSlice,b=z.call(b,0,b.size,k),s=!0),h&&"download"!==j&&(j+=".download"),(r===k||h)&&(u=a),i?(l+=b.size,void i(a.TEMPORARY,l,x(function(a){a.root.getDirectory("saved",y,x(function(a){var c=function(){a.getFile(j,y,x(function(a){a.createWriter(x(function(c){c.onwriteend=function(b){u.location.href=a.toURL(),q.readyState=q.DONE,o(q,"writeend",b),n(a)},c.onerror=function(){var a=c.error;a.code!==a.ABORT_ERR&&w()},"writestart progress write abort".split(" ").forEach(function(a){c["on"+a]=q["on"+a]}),c.write(b),q.abort=function(){c.abort(),q.readyState=q.DONE},q.readyState=q.WRITING}),w)}),w)};a.getFile(j,{create:!1},x(function(a){a.remove(),c()}),x(function(a){a.code===a.NOT_FOUND_ERR?c():w()}))}),w)}),w)):void w())},r=q.prototype,s=function(a,b,c){return new q(a,b,c)};return"undefined"!=typeof navigator&&navigator.msSaveOrOpenBlob?function(a,b,c){return c||(a=p(a)),navigator.msSaveOrOpenBlob(a,b||"download")}:(r.abort=function(){var a=this;a.readyState=a.DONE,o(a,"abort")},r.readyState=r.INIT=0,r.WRITING=1,r.DONE=2,r.error=r.onwritestart=r.onprogress=r.onwrite=r.onabort=r.onerror=r.onwriteend=null,s)}}("undefined"!=typeof self&&self||"undefined"!=typeof window&&window||this.content);"undefined"!=typeof module&&module.exports?module.exports.saveAs=saveAs:"undefined"!=typeof define&&null!==define&&null!=define.amd&&define([],function(){return saveAs}),MarcBinFile.prototype.isReady=function(){return 2==this.fileReader.readyState},MarcBinFile.prototype.save=function(){var a=new Blob([this.fileReader.dataView],{type:this.fileType});saveAs(a,this.fileName)},MarcBinFile.prototype.readByte=function(a){return this.fileReader.dataView.getUint8(a)},MarcBinFile.prototype.readByteSigned=function(a){return this.fileReader.dataView.getInt8(a)},MarcBinFile.prototype.readBytes=function(a,b){for(var c=new Array(b),d=0;d<b;d++)c[d]=this.readByte(a+d);return c},MarcBinFile.prototype.readShort=function(a){return this.fileReader.dataView.getUint16(a,this.littleEndian)},MarcBinFile.prototype.readShortSigned=function(a){return this.fileReader.dataView.getInt16(a,this.littleEndian)},MarcBinFile.prototype.readInt=function(a){return this.fileReader.dataView.getUint32(a,this.littleEndian)},MarcBinFile.prototype.readIntSigned=function(a){return this.fileReader.dataView.getInt32(a,this.littleEndian)},MarcBinFile.prototype.readFloat32=function(a){return this.fileReader.dataView.getFloat32(a,this.littleEndian)},MarcBinFile.prototype.readFloat64=function(a){return this.fileReader.dataView.getFloat64(a,this.littleEndian)},MarcBinFile.prototype.readString=function(a,b){for(var c=this.readBytes(a,b),d="",e=0;e<b&&c[e]>0;e++)d+=String.fromCharCode(c[e]);return d},MarcBinFile.prototype.writeByte=function(a,b){this.fileReader.dataView.setUint8(a,b,this.littleEndian)},MarcBinFile.prototype.writeByteSigned=function(a,b){this.fileReader.dataView.setInt8(a,b,this.littleEndian)},MarcBinFile.prototype.writeBytes=function(a,b){for(var c=0;c<b.length;c++)this.writeByte(a+c,b[c])},MarcBinFile.prototype.writeShort=function(a,b){this.fileReader.dataView.setUint16(a,b,this.littleEndian)},MarcBinFile.prototype.writeShortSigned=function(a,b){this.fileReader.dataView.setInt16(a,b,this.littleEndian)},MarcBinFile.prototype.writeInt=function(a,b){this.fileReader.dataView.setUint32(a,b,this.littleEndian)},MarcBinFile.prototype.writeIntSigned=function(a,b){this.fileReader.dataView.setInt32(a,b,this.littleEndian)},MarcBinFile.prototype.writeFloat32=function(a,b){this.fileReader.dataView.setFloat32(a,b,this.littleEndian)},MarcBinFile.prototype.writeFloat64=function(a,b){this.fileReader.dataView.setFloat64(a,b,this.littleEndian)},MarcBinFile.prototype.writeString=function(a,b,c){for(var d=0;d<c;d++)this.writeByte(a+d,0);for(var d=0;d<b.length&&d<c;d++)this.writeByte(a+d,b.charCodeAt(d))};

/* FileSaver.min.js: https://github.com/eligrey/FileSaver.js/blob/master/FileSaver.min.js */
var saveAs=saveAs||function(view){"use strict";if(typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var doc=view.document,get_URL=function(){return view.URL||view.webkitURL||view},save_link=doc.createElementNS("http://www.w3.org/1999/xhtml","a"),can_use_save_link="download"in save_link,click=function(node){var event=new MouseEvent("click");node.dispatchEvent(event)},is_safari=/Version\/[\d\.]+.*Safari/.test(navigator.userAgent),webkit_req_fs=view.webkitRequestFileSystem,req_fs=view.requestFileSystem||webkit_req_fs||view.mozRequestFileSystem,throw_outside=function(ex){(view.setImmediate||view.setTimeout)(function(){throw ex},0)},force_saveable_type="application/octet-stream",fs_min_size=0,arbitrary_revoke_timeout=500,revoke=function(file){var revoker=function(){if(typeof file==="string"){get_URL().revokeObjectURL(file)}else{file.remove()}};if(view.chrome){revoker()}else{setTimeout(revoker,arbitrary_revoke_timeout)}},dispatch=function(filesaver,event_types,event){event_types=[].concat(event_types);var i=event_types.length;while(i--){var listener=filesaver["on"+event_types[i]];if(typeof listener==="function"){try{listener.call(filesaver,event||filesaver)}catch(ex){throw_outside(ex)}}}},auto_bom=function(blob){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)){return new Blob(["\ufeff",blob],{type:blob.type})}return blob},FileSaver=function(blob,name,no_auto_bom){if(!no_auto_bom){blob=auto_bom(blob)}var filesaver=this,type=blob.type,blob_changed=false,object_url,target_view,dispatch_all=function(){dispatch(filesaver,"writestart progress write writeend".split(" "))},fs_error=function(){if(target_view&&is_safari&&typeof FileReader!=="undefined"){var reader=new FileReader;reader.onloadend=function(){var base64Data=reader.result;target_view.location.href="data:attachment/file"+base64Data.slice(base64Data.search(/[,;]/));filesaver.readyState=filesaver.DONE;dispatch_all()};reader.readAsDataURL(blob);filesaver.readyState=filesaver.INIT;return}if(blob_changed||!object_url){object_url=get_URL().createObjectURL(blob)}if(target_view){target_view.location.href=object_url}else{var new_tab=view.open(object_url,"_blank");if(new_tab==undefined&&is_safari){view.location.href=object_url}}filesaver.readyState=filesaver.DONE;dispatch_all();revoke(object_url)},abortable=function(func){return function(){if(filesaver.readyState!==filesaver.DONE){return func.apply(this,arguments)}}},create_if_not_found={create:true,exclusive:false},slice;filesaver.readyState=filesaver.INIT;if(!name){name="download"}if(can_use_save_link){object_url=get_URL().createObjectURL(blob);setTimeout(function(){save_link.href=object_url;save_link.download=name;click(save_link);dispatch_all();revoke(object_url);filesaver.readyState=filesaver.DONE});return}if(view.chrome&&type&&type!==force_saveable_type){slice=blob.slice||blob.webkitSlice;blob=slice.call(blob,0,blob.size,force_saveable_type);blob_changed=true}if(webkit_req_fs&&name!=="download"){name+=".download"}if(type===force_saveable_type||webkit_req_fs){target_view=view}if(!req_fs){fs_error();return}fs_min_size+=blob.size;req_fs(view.TEMPORARY,fs_min_size,abortable(function(fs){fs.root.getDirectory("saved",create_if_not_found,abortable(function(dir){var save=function(){dir.getFile(name,create_if_not_found,abortable(function(file){file.createWriter(abortable(function(writer){writer.onwriteend=function(event){target_view.location.href=file.toURL();filesaver.readyState=filesaver.DONE;dispatch(filesaver,"writeend",event);revoke(file)};writer.onerror=function(){var error=writer.error;if(error.code!==error.ABORT_ERR){fs_error()}};"writestart progress write abort".split(" ").forEach(function(event){writer["on"+event]=filesaver["on"+event]});writer.write(blob);filesaver.abort=function(){writer.abort();filesaver.readyState=filesaver.DONE};filesaver.readyState=filesaver.WRITING}),fs_error)}),fs_error)};dir.getFile(name,{create:false},abortable(function(file){file.remove();save()}),abortable(function(ex){if(ex.code===ex.NOT_FOUND_ERR){save()}else{fs_error()}}))}),fs_error)}),fs_error)},FS_proto=FileSaver.prototype,saveAs=function(blob,name,no_auto_bom){return new FileSaver(blob,name,no_auto_bom)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(blob,name,no_auto_bom){if(!no_auto_bom){blob=auto_bom(blob)}return navigator.msSaveOrOpenBlob(blob,name||"download")}}FS_proto.abort=function(){var filesaver=this;filesaver.readyState=filesaver.DONE;dispatch(filesaver,"abort")};FS_proto.readyState=FS_proto.INIT=0;FS_proto.WRITING=1;FS_proto.DONE=2;FS_proto.error=FS_proto.onwritestart=FS_proto.onprogress=FS_proto.onwrite=FS_proto.onabort=FS_proto.onerror=FS_proto.onwriteend=null;return saveAs}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);if(typeof module!=="undefined"&&module.exports){module.exports.saveAs=saveAs}else if(typeof define!=="undefined"&&define!==null&&define.amd!=null){define([],function(){return saveAs})}