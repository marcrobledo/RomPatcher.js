/* RomPatcher.js v20180428 - Marc Robledo 2016-2018 - http://www.marcrobledo.com/license */
var MAX_ROM_SIZE=33554432;
var romFile, headeredRomFile, unheaderedRomFile, patch, romFile1, romFile2, tempFile;
/* Shortcuts */
function addEvent(e,ev,f){e.addEventListener(ev,f,false)}
function el(e){return document.getElementById(e)}



/* initialize app */
addEvent(window,'load',function(){
	/* service worker */
	if('serviceWorker' in navigator)
		navigator.serviceWorker.register('_cache_service_worker.js');


	el('input-file-rom').value='';
	el('input-file-patch').value='';
	el('input-file-rom1').value='';
	el('input-file-rom2').value='';

	addEvent(el('input-file-rom'), 'change', function(){
		romFile=new MarcBinFile(this, function(){
			el('checkbox-addheader').checked=false;
			el('checkbox-removeheader').checked=false;

			unheaderedRomFile=null;
			headeredRomFile=null;

			if(isSnesRom(romFile.fileName) && isPowerOfTwo(romFile.fileSize)){
				el('row-addheader').style.display='flex';
				el('row-removeheader').style.display='none';
			}else if(isSnesRom(romFile.fileName) && isHeadered(romFile.fileSize, 512)){
				el('row-addheader').style.display='none';
				el('row-removeheader').style.display='flex';
			}else{
				el('row-addheader').style.display='none';
				el('row-removeheader').style.display='none';
			}
	
			updateChecksums(romFile);
			validateSource();
		});
	});
	addEvent(el('input-file-patch'), 'change', function(){
		openPatchFile(this);
	});
	addEvent(el('input-file-rom1'), 'change', function(){
		romFile1=new MarcBinFile(this);
	});
	addEvent(el('input-file-rom2'), 'change', function(){
		romFile2=new MarcBinFile(this);
	});

	addEvent(el('checkbox-removeheader'), 'change', function(){
		if(!unheaderedRomFile){
			headeredRomFile=romFile;
			unheaderedRomFile=new MarcBinFile(headeredRomFile.fileSize-512);
			unheaderedRomFile.writeBytes(0, headeredRomFile.readBytes(512, headeredRomFile.fileSize-512));
			unheaderedRomFile.fileName=headeredRomFile.fileName;
		}

		if(this.checked)
			romFile=unheaderedRomFile;
		else
			romFile=headeredRomFile;


		updateChecksums(romFile);
		validateSource();
	});

	addEvent(el('checkbox-addheader'), 'change', function(){
		if(!headeredRomFile){
			unheaderedRomFile=romFile;
			headeredRomFile=new MarcBinFile(unheaderedRomFile.fileSize+512);
			headeredRomFile.writeBytes(512, unheaderedRomFile.readBytes(0, unheaderedRomFile.fileSize));
			headeredRomFile.fileName=unheaderedRomFile.fileName;
		}

		if(this.checked)
			romFile=headeredRomFile;
		else
			romFile=unheaderedRomFile;

		validateSource();
	});

	setTab(1);
});

function isSnesRom(fileName){return /\.(smc|sfc|fig|swc)$/.test(fileName)}
function isPowerOfTwo(fileSize){return (fileSize & (fileSize-1))===0}
function isHeadered(fileSize,headerSize){return isPowerOfTwo(fileSize-headerSize)}


function updateChecksums(file){
	el('rom-info').style.display='flex';
	sha1(file);

	var crc32str=crc32(file).toString(16);
	while(crc32str.length<8)
		crc32str='0'+crc32str;
	el('crc32').innerHTML=crc32str;
	el('md5').innerHTML=md5(file);
}

function validateSource(){
	if(patch && romFile && typeof patch.validateSource !== 'undefined'){
		el('crc32').className=patch.validateSource(romFile)?'valid':'invalid';
	}else{
		el('crc32').className='';
	}
}


function _readPatchFile(){
	tempFile.littleEndian=false;

	if(tempFile.readString(0,5)===IPS_MAGIC){
		patch=readIPSFile(tempFile);
	}else if(tempFile.readString(0,4)===UPS_MAGIC){
		patch=readUPSFile(tempFile);
	}else if(tempFile.readString(0,5)===APS_MAGIC){
		patch=readAPSFile(tempFile);
	}else if(tempFile.readString(0,4)===BPS_MAGIC){
		patch=readBPSFile(tempFile);
	}/*else if(tempFile.readString(0,4)===APSGBA_MAGIC){
		patch=readAPSGBAFile(tempFile);
	}*/else {
		MarcDialogs.alert('Invalid IPS/UPS/APS/BPS file');
	}
	validateSource();
}
function openPatchFile(f){tempFile=new MarcBinFile(f, _readPatchFile)}
function applyPatchFile(p,r){
	if(p && r){
		var patchedROM=p.apply(r);
		patchedROM.fileName=r.fileName.replace(/\.(.*?)$/, ' (patched).$1');
		if(el('checkbox-addheader').checked){
			var unheaderedPatchedROM=new MarcBinFile(patchedROM.fileSize-512);
			unheaderedPatchedROM.fileName=patchedROM.fileName;
			unheaderedPatchedROM.writeBytes(0, patchedROM.readBytes(512, patchedROM.fileSize-512));
			unheaderedPatchedROM.save();
		}else{
			patchedROM.save();
		}
	}else{
		MarcDialogs.alert('No ROM/patch selected');
	}
}



function createPatchFile(){
	var mode=el('patch-type').value;
	if(!romFile1 || !romFile2){
		MarcDialogs.alert('No original/modified ROM file specified');
		return false;
	}else if(mode==='ips' && (romFile1.fileSize>MAX_IPS_SIZE || romFile2.fileSize>MAX_IPS_SIZE)){
		MarcDialogs.alert('Files are too big for IPS format');
		return false;
	}


	var newPatch;
	if(mode==='ips'){
		newPatch=createIPSFromFiles(romFile1, romFile2);
	}else if(mode==='ups'){
		newPatch=createUPSFromFiles(romFile1, romFile2);
	}else if(mode==='aps'){
		newPatch=createAPSFromFiles(romFile1, romFile2, false);
	}else if(mode==='apsn64'){
		newPatch=createAPSFromFiles(romFile1, romFile2, true);
	}/*else if(el('radio-apsgba').checked){
		newPatch=createAPSGBAFromFiles(romFile1, romFile2);
	}else if(el('radio-bps').checked){
		newPatch=createBPSFromFiles(romFile1, romFile2);
	}*/
	newPatch.export(romFile2.fileName.replace(/\.[^\.]+$/,'')).save();
}





function setTab(tab){
	for(var i=0; i<2; i++){
		if(i===tab){
			el('tab'+i).style.display='block';
			el('tabs').children[i].className='selected';
		}else{
			el('tab'+i).style.display=i===tab?'block':'none';
			el('tabs').children[i].className='clickable'
		}
	}
}




/* CRC32/MD5/SHA-1 calculators */
var HEX_CHR='0123456789abcdef'.split('');
var CRC_TABLE=false;
var CAN_USE_CRYPTO_API=(window.crypto&&window.crypto.subtle&&window.crypto.subtle.digest);
/* SHA-1 using WebCryptoAPI */
function sha1(file){
	if(CAN_USE_CRYPTO_API && file.fileSize<=MAX_ROM_SIZE){

		window.crypto.subtle.digest('SHA-1', file.fileReader.dataView.buffer).then(function(hash){
			//console.log('SHA-1:'+);
			var bytes=new Uint8Array(hash);
			var hexString='';
			for(var i=0;i<bytes.length;i++)
				if(bytes[i]<16)
					hexString+='0'+bytes[i].toString(16);
				else
					hexString+=bytes[i].toString(16);
			el('sha1').innerHTML=hexString;
		}).catch(function(error){
			console.error(error);
		});
	}
}
/* MD5 - from Joseph's Myers - http://www.myersdaily.org/joseph/javascript/md5.js */
function _add32(a,b){return (a+b)&0xffffffff}
function _md5cycle(x,k){var a=x[0],b=x[1],c=x[2],d=x[3];a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);x[0]=_add32(a,x[0]);x[1]=_add32(b,x[1]);x[2]=_add32(c,x[2]);x[3]=_add32(d,x[3])}
function _md5blk(d){var md5blks=[],i;for(i=0;i<64;i+=4)md5blks[i>>2]=d[i]+(d[i+1]<<8)+(d[i+2]<<16)+(d[i+3]<<24);return md5blks}
function _cmn(q,a,b,x,s,t){a=_add32(_add32(a,q),_add32(x,t));return _add32((a<<s)|(a>>>(32-s)),b)}
function ff(a,b,c,d,x,s,t){return _cmn((b&c)|((~b)&d),a,b,x,s,t)}
function gg(a,b,c,d,x,s,t){return _cmn((b&d)|(c&(~d)),a,b,x,s,t)}
function hh(a,b,c,d,x,s,t){return _cmn(b^c^d,a,b,x,s,t)}
function ii(a,b,c,d,x,s,t){return _cmn(c^(b|(~d)),a,b,x,s,t)}
function md5(file){
	var data=new Uint8Array(file.fileReader.dataView.buffer);

	var n=data.length,state=[1732584193,-271733879,-1732584194,271733878],i;
	for(i=64;i<=data.length;i+=64)
		_md5cycle(state,_md5blk(data.slice(i-64,i)));
	data=data.slice(i-64);
	var tail=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
	for(i=0;i<data.length;i++)
		tail[i>>2]|=data[i]<<((i%4)<<3);
	tail[i>>2]|=0x80<<((i%4)<<3);
	if(i>55){
		_md5cycle(state,tail);
		for(i=0;i<16;i++)tail[i]=0;
	}
	tail[14]=n*8;
	_md5cycle(state,tail);

	for(var i=0;i<state.length;i++){
		var s='',j=0;
		for(;j<4;j++)
			s+=HEX_CHR[(state[i]>>(j*8+4))&0x0f]+HEX_CHR[(state[i]>>(j*8))&0x0f];
		state[i]=s;
	}
	return state.join('')
}
/* CRC32 - from Alex - https://stackoverflow.com/a/18639999 */
function _makeCRCTable(){
	var c,crcTable=[];
	for(var n=0;n<256;n++){
		c=n;
		for(var k=0;k<8;k++)
			c=((c&1)?(0xedb88320^(c>>>1)):(c>>>1));
		crcTable[n]=c;
	}
	return crcTable;
}
function crc32(file,ignoreLast4Bytes){
	var data=new Uint8Array(file.fileReader.dataView.buffer);
	if(!CRC_TABLE)
		CRC_TABLE=_makeCRCTable();

	var crc=0^(-1);

	var len=ignoreLast4Bytes?data.length-4:data.length;
	for(var i=0;i<len;i++)
		crc=(crc>>>8)^CRC_TABLE[(crc^data[i])&0xff];

	return ((crc^(-1))>>>0);
}


/* MarcDialogs.js */
MarcDialogs=function(){function e(e,t,n){a?e.attachEvent("on"+t,n):e.addEventListener(t,n,!1)}function t(){s&&(o?history.go(-1):(c.className="dialog-overlay",s.className=s.className.replace(/ active/g,""),s=null))}function n(e){for(var t=0;t<s.dialogElements.length;t++){var n=s.dialogElements[t];if("INPUT"===n.nodeName&&"hidden"!==n.type||"INPUT"!==n.nodeName)return n.focus(),!0}return!1}function l(){s&&(s.style.marginLeft="-"+s.offsetWidth/2+"px",s.style.marginTop="-"+s.offsetHeight/2-30+"px")}var a=/MSIE 8/.test(navigator.userAgent),o=navigator.userAgent.match(/Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i)&&"function"==typeof history.pushState,i=["Cancel","Accept"],s=null,c=document.createElement("div");c.className="dialog-overlay",c.style.position="fixed",c.style.top="0",c.style.left="0",c.style.width="100%",c.style.height="100%",c.style.zIndex=8e3,e(c,"click",t),e(window,"load",function(){document.body.appendChild(c),o&&history.replaceState({myDialog:!1},null,null)}),e(window,"resize",l),o&&e(window,"popstate",function(e){e.state.myDialog?(s=e.state.myDialog,MarcDialogs.open(e.state.myDialog)):e.state.myDialog===!1&&s&&(c.className="dialog-overlay",s.className=s.className.replace(/ active/g,""),s=null)}),e(document,"keydown",function(e){s&&(27==e.keyCode?(e.preventDefault?e.preventDefault():e.returnValue=!1,t()):9==e.keyCode&&s.dialogElements[s.dialogElements.length-1]==document.activeElement&&(e.preventDefault?e.preventDefault():e.returnValue=!1,n()))});var d=null,u=null,m=null;return{open:function(e){s&&(s.className=s.className.replace(/ active/g,"")),o&&(s?history.replaceState({myDialog:e},null,null):(console.log("a"),history.pushState({myDialog:e},null,null))),c.className="dialog-overlay active",s="string"==typeof e?document.getElementById("dialog-"+e):e,s.className+=" active",s.style.position="fixed",s.style.top="50%",s.style.left="50%",s.style.zIndex=8001,s.dialogElements||(s.dialogElements=s.querySelectorAll("input,textarea,select")),n(),l(s),l(s)},close:t,alert:function(t){if(!d){d=document.createElement("div"),d.id="dialog-quick-alert",d.className="dialog",d.msg=document.createElement("div"),d.msg.style.textAlign="center",d.appendChild(d.msg),d.buttons=document.createElement("div"),d.buttons.className="buttons";var n=document.createElement("button");n.type="button",n.className="colored",n.innerHTML=i[1],e(n,"click",this.close),d.buttons.appendChild(n),d.appendChild(d.buttons),document.body.appendChild(d)}d.msg.innerHTML=t,MarcDialogs.open("quick-alert")},confirm:function(t,n){if(!u){u=document.createElement("div"),u.id="dialog-quick-confirm",u.className="dialog",u.msg=document.createElement("div"),u.msg.style.textAlign="center",u.appendChild(u.msg),u.buttons=document.createElement("div"),u.buttons.className="buttons";var l=document.createElement("button");l.type="button",l.innerHTML=i[1],e(l,"click",function(){m()}),u.buttons.appendChild(l);var a=document.createElement("button");a.type="button",a.innerHTML=i[0],e(a,"click",this.close),u.buttons.appendChild(a),u.appendChild(u.buttons),document.body.appendChild(u)}m=n,u.msg.innerHTML=t,MarcDialogs.open("quick-confirm")}}}();
/* MarcBinFile.js v20190703 - Marc Robledo 2014-2016 - http://www.marcrobledo.com/license */
function MarcBinFile(a,b){if("function"!=typeof window.FileReader)throw console.error("MarcBinFile.js: Browser doesn't support FileReader."),"Invalid browser";if("object"==typeof a&&a.name&&a.size)this.file=a,this.fileName=this.file.name,this.fileSize=this.file.size,this.fileType=a.type;else if("object"==typeof a&&a.files){if(1!=a.files.length){for(var c=[],d=a.files.length,e=function(){d--,0==d&&b&&b.call()},f=0;f<a.files.length;f++)c.push(new MarcBinFile(a.files[f],e));return c}this.file=a.files[0],this.fileName=this.file.name,this.fileSize=this.file.size,this.fileType=this.file.type}else{if("number"!=typeof a)throw console.error("MarcBinFile.js: Invalid type of file."),"Invalid file.";this.file=!1,this.fileName="newfile.hex",this.fileSize=a,this.fileType="application/octet-stream"}this.littleEndian=function(){var a=new ArrayBuffer(2);return new DataView(a).setInt16(0,256,!0),256===new Int16Array(a)[0]}(),this.file?(this.fileReader=new FileReader,this.fileReader.addEventListener("load",function(){this.dataView=new DataView(this.result)},!1),b&&this.fileReader.addEventListener("load",b,!1),this.fileReader.readAsArrayBuffer(this.file)):(this.fileReader=new ArrayBuffer(this.fileSize),this.fileReader.dataView=new DataView(this.fileReader),b&&b.call())}var saveAs=saveAs||function(a){"use strict";if("undefined"==typeof navigator||!/MSIE [1-9]\./.test(navigator.userAgent)){var b=a.document,c=function(){return a.URL||a.webkitURL||a},d=b.createElementNS("http://www.w3.org/1999/xhtml","a"),e="download"in d,f=function(a){var b=new MouseEvent("click");a.dispatchEvent(b)},g=/Version\/[\d\.]+.*Safari/.test(navigator.userAgent),h=a.webkitRequestFileSystem,i=a.requestFileSystem||h||a.mozRequestFileSystem,j=function(b){(a.setImmediate||a.setTimeout)(function(){throw b},0)},k="application/octet-stream",l=0,m=500,n=function(b){var d=function(){"string"==typeof b?c().revokeObjectURL(b):b.remove()};a.chrome?d():setTimeout(d,m)},o=function(a,b,c){b=[].concat(b);for(var d=b.length;d--;){var e=a["on"+b[d]];if("function"==typeof e)try{e.call(a,c||a)}catch(a){j(a)}}},p=function(a){return/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\ufeff",a],{type:a.type}):a},q=function(b,j,m){m||(b=p(b));var t,u,z,q=this,r=b.type,s=!1,v=function(){o(q,"writestart progress write writeend".split(" "))},w=function(){if(u&&g&&"undefined"!=typeof FileReader){var d=new FileReader;return d.onloadend=function(){var a=d.result;u.location.href="data:attachment/file"+a.slice(a.search(/[,;]/)),q.readyState=q.DONE,v()},d.readAsDataURL(b),void(q.readyState=q.INIT)}if(!s&&t||(t=c().createObjectURL(b)),u)u.location.href=t;else{var e=a.open(t,"_blank");void 0==e&&g&&(a.location.href=t)}q.readyState=q.DONE,v(),n(t)},x=function(a){return function(){if(q.readyState!==q.DONE)return a.apply(this,arguments)}},y={create:!0,exclusive:!1};return q.readyState=q.INIT,j||(j="download"),e?(t=c().createObjectURL(b),void setTimeout(function(){d.href=t,d.download=j,f(d),v(),n(t),q.readyState=q.DONE})):(a.chrome&&r&&r!==k&&(z=b.slice||b.webkitSlice,b=z.call(b,0,b.size,k),s=!0),h&&"download"!==j&&(j+=".download"),(r===k||h)&&(u=a),i?(l+=b.size,void i(a.TEMPORARY,l,x(function(a){a.root.getDirectory("saved",y,x(function(a){var c=function(){a.getFile(j,y,x(function(a){a.createWriter(x(function(c){c.onwriteend=function(b){u.location.href=a.toURL(),q.readyState=q.DONE,o(q,"writeend",b),n(a)},c.onerror=function(){var a=c.error;a.code!==a.ABORT_ERR&&w()},"writestart progress write abort".split(" ").forEach(function(a){c["on"+a]=q["on"+a]}),c.write(b),q.abort=function(){c.abort(),q.readyState=q.DONE},q.readyState=q.WRITING}),w)}),w)};a.getFile(j,{create:!1},x(function(a){a.remove(),c()}),x(function(a){a.code===a.NOT_FOUND_ERR?c():w()}))}),w)}),w)):void w())},r=q.prototype,s=function(a,b,c){return new q(a,b,c)};return"undefined"!=typeof navigator&&navigator.msSaveOrOpenBlob?function(a,b,c){return c||(a=p(a)),navigator.msSaveOrOpenBlob(a,b||"download")}:(r.abort=function(){var a=this;a.readyState=a.DONE,o(a,"abort")},r.readyState=r.INIT=0,r.WRITING=1,r.DONE=2,r.error=r.onwritestart=r.onprogress=r.onwrite=r.onabort=r.onerror=r.onwriteend=null,s)}}("undefined"!=typeof self&&self||"undefined"!=typeof window&&window||this.content);"undefined"!=typeof module&&module.exports?module.exports.saveAs=saveAs:"undefined"!=typeof define&&null!==define&&null!=define.amd&&define([],function(){return saveAs}),MarcBinFile.prototype.isReady=function(){return 2==this.fileReader.readyState},MarcBinFile.prototype.save=function(){var a=new Blob([this.fileReader.dataView],{type:this.fileType});saveAs(a,this.fileName)},MarcBinFile.prototype.readByte=function(a){return this.fileReader.dataView.getUint8(a)},MarcBinFile.prototype.readByteSigned=function(a){return this.fileReader.dataView.getInt8(a)},MarcBinFile.prototype.readBytes=function(a,b){for(var c=new Array(b),d=0;d<b;d++)c[d]=this.readByte(a+d);return c},MarcBinFile.prototype.readShort=function(a){return this.fileReader.dataView.getUint16(a,this.littleEndian)},MarcBinFile.prototype.readShortSigned=function(a){return this.fileReader.dataView.getInt16(a,this.littleEndian)},MarcBinFile.prototype.readInt=function(a){return this.fileReader.dataView.getUint32(a,this.littleEndian)},MarcBinFile.prototype.readIntSigned=function(a){return this.fileReader.dataView.getInt32(a,this.littleEndian)},MarcBinFile.prototype.readFloat32=function(a){return this.fileReader.dataView.getFloat32(a,this.littleEndian)},MarcBinFile.prototype.readFloat64=function(a){return this.fileReader.dataView.getFloat64(a,this.littleEndian)},MarcBinFile.prototype.readString=function(a,b){for(var c=this.readBytes(a,b),d="",e=0;e<b&&c[e]>0;e++)d+=String.fromCharCode(c[e]);return d},MarcBinFile.prototype.writeByte=function(a,b){this.fileReader.dataView.setUint8(a,b,this.littleEndian)},MarcBinFile.prototype.writeByteSigned=function(a,b){this.fileReader.dataView.setInt8(a,b,this.littleEndian)},MarcBinFile.prototype.writeBytes=function(a,b){for(var c=0;c<b.length;c++)this.writeByte(a+c,b[c])},MarcBinFile.prototype.writeShort=function(a,b){this.fileReader.dataView.setUint16(a,b,this.littleEndian)},MarcBinFile.prototype.writeShortSigned=function(a,b){this.fileReader.dataView.setInt16(a,b,this.littleEndian)},MarcBinFile.prototype.writeInt=function(a,b){this.fileReader.dataView.setUint32(a,b,this.littleEndian)},MarcBinFile.prototype.writeIntSigned=function(a,b){this.fileReader.dataView.setInt32(a,b,this.littleEndian)},MarcBinFile.prototype.writeFloat32=function(a,b){this.fileReader.dataView.setFloat32(a,b,this.littleEndian)},MarcBinFile.prototype.writeFloat64=function(a,b){this.fileReader.dataView.setFloat64(a,b,this.littleEndian)},MarcBinFile.prototype.writeString=function(a,b,c){for(var d=0;d<c;d++)this.writeByte(a+d,0);for(var d=0;d<b.length&&d<c;d++)this.writeByte(a+d,b.charCodeAt(d))};
/* Implement 3-byte reader/writer in MarcBinFile */
MarcBinFile.prototype.readThreeBytes=function(offset){return (this.readByte(offset+0) << 16)+(this.readByte(offset+1) << 8)+(this.readByte(offset+2))}
MarcBinFile.prototype.writeThreeBytes=function(offset,val){this.writeBytes(offset, [(val & 0xff0000) >> 16, (val & 0x00ff00) >> 8, (val & 0x0000ff)])}
/* FileSaver.min.js: https://github.com/eligrey/FileSaver.js/blob/master/FileSaver.min.js */
var saveAs=saveAs||function(view){"use strict";if(typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var doc=view.document,get_URL=function(){return view.URL||view.webkitURL||view},save_link=doc.createElementNS("http://www.w3.org/1999/xhtml","a"),can_use_save_link="download"in save_link,click=function(node){var event=new MouseEvent("click");node.dispatchEvent(event)},is_safari=/Version\/[\d\.]+.*Safari/.test(navigator.userAgent),webkit_req_fs=view.webkitRequestFileSystem,req_fs=view.requestFileSystem||webkit_req_fs||view.mozRequestFileSystem,throw_outside=function(ex){(view.setImmediate||view.setTimeout)(function(){throw ex},0)},force_saveable_type="application/octet-stream",fs_min_size=0,arbitrary_revoke_timeout=500,revoke=function(file){var revoker=function(){if(typeof file==="string"){get_URL().revokeObjectURL(file)}else{file.remove()}};if(view.chrome){revoker()}else{setTimeout(revoker,arbitrary_revoke_timeout)}},dispatch=function(filesaver,event_types,event){event_types=[].concat(event_types);var i=event_types.length;while(i--){var listener=filesaver["on"+event_types[i]];if(typeof listener==="function"){try{listener.call(filesaver,event||filesaver)}catch(ex){throw_outside(ex)}}}},auto_bom=function(blob){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)){return new Blob(["\ufeff",blob],{type:blob.type})}return blob},FileSaver=function(blob,name,no_auto_bom){if(!no_auto_bom){blob=auto_bom(blob)}var filesaver=this,type=blob.type,blob_changed=false,object_url,target_view,dispatch_all=function(){dispatch(filesaver,"writestart progress write writeend".split(" "))},fs_error=function(){if(target_view&&is_safari&&typeof FileReader!=="undefined"){var reader=new FileReader;reader.onloadend=function(){var base64Data=reader.result;target_view.location.href="data:attachment/file"+base64Data.slice(base64Data.search(/[,;]/));filesaver.readyState=filesaver.DONE;dispatch_all()};reader.readAsDataURL(blob);filesaver.readyState=filesaver.INIT;return}if(blob_changed||!object_url){object_url=get_URL().createObjectURL(blob)}if(target_view){target_view.location.href=object_url}else{var new_tab=view.open(object_url,"_blank");if(new_tab==undefined&&is_safari){view.location.href=object_url}}filesaver.readyState=filesaver.DONE;dispatch_all();revoke(object_url)},abortable=function(func){return function(){if(filesaver.readyState!==filesaver.DONE){return func.apply(this,arguments)}}},create_if_not_found={create:true,exclusive:false},slice;filesaver.readyState=filesaver.INIT;if(!name){name="download"}if(can_use_save_link){object_url=get_URL().createObjectURL(blob);setTimeout(function(){save_link.href=object_url;save_link.download=name;click(save_link);dispatch_all();revoke(object_url);filesaver.readyState=filesaver.DONE});return}if(view.chrome&&type&&type!==force_saveable_type){slice=blob.slice||blob.webkitSlice;blob=slice.call(blob,0,blob.size,force_saveable_type);blob_changed=true}if(webkit_req_fs&&name!=="download"){name+=".download"}if(type===force_saveable_type||webkit_req_fs){target_view=view}if(!req_fs){fs_error();return}fs_min_size+=blob.size;req_fs(view.TEMPORARY,fs_min_size,abortable(function(fs){fs.root.getDirectory("saved",create_if_not_found,abortable(function(dir){var save=function(){dir.getFile(name,create_if_not_found,abortable(function(file){file.createWriter(abortable(function(writer){writer.onwriteend=function(event){target_view.location.href=file.toURL();filesaver.readyState=filesaver.DONE;dispatch(filesaver,"writeend",event);revoke(file)};writer.onerror=function(){var error=writer.error;if(error.code!==error.ABORT_ERR){fs_error()}};"writestart progress write abort".split(" ").forEach(function(event){writer["on"+event]=filesaver["on"+event]});writer.write(blob);filesaver.abort=function(){writer.abort();filesaver.readyState=filesaver.DONE};filesaver.readyState=filesaver.WRITING}),fs_error)}),fs_error)};dir.getFile(name,{create:false},abortable(function(file){file.remove();save()}),abortable(function(ex){if(ex.code===ex.NOT_FOUND_ERR){save()}else{fs_error()}}))}),fs_error)}),fs_error)},FS_proto=FileSaver.prototype,saveAs=function(blob,name,no_auto_bom){return new FileSaver(blob,name,no_auto_bom)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(blob,name,no_auto_bom){if(!no_auto_bom){blob=auto_bom(blob)}return navigator.msSaveOrOpenBlob(blob,name||"download")}}FS_proto.abort=function(){var filesaver=this;filesaver.readyState=filesaver.DONE;dispatch(filesaver,"abort")};FS_proto.readyState=FS_proto.INIT=0;FS_proto.WRITING=1;FS_proto.DONE=2;FS_proto.error=FS_proto.onwritestart=FS_proto.onprogress=FS_proto.onwrite=FS_proto.onabort=FS_proto.onerror=FS_proto.onwriteend=null;return saveAs}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);if(typeof module!=="undefined"&&module.exports){module.exports.saveAs=saveAs}else if(typeof define!=="undefined"&&define!==null&&define.amd!=null){define([],function(){return saveAs})}

