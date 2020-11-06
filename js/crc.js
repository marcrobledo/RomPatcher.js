/* Rom Patcher JS - CRC32/MD5/SHA-1/checksums calculators v20200926 - Marc Robledo 2016-2020 - http://www.marcrobledo.com/license */

function padZeroes(intVal, nBytes){
	var hexString=intVal.toString(16);
	while(hexString.length<nBytes*2)
		hexString='0'+hexString;
	return hexString
}


/* SHA-1 using WebCryptoAPI */
function _sha1_promise(hash){
	var bytes=new Uint8Array(hash);
	var hexString='';
	for(var i=0;i<bytes.length;i++)
		hexString+=padZeroes(bytes[i], 1);
	el('sha1').innerHTML=hexString;
}
function sha1(marcFile){
	window.crypto.subtle.digest('SHA-1', marcFile._u8array.buffer)
		.then(_sha1_promise)
		.catch(function(error){
			el('sha1').innerHTML='Error';
		})
	;
}



/* MD5 - from Joseph's Myers - http://www.myersdaily.org/joseph/javascript/md5.js */
const HEX_CHR='0123456789abcdef'.split('');
function _add32(a,b){return (a+b)&0xffffffff}
function _md5cycle(x,k){var a=x[0],b=x[1],c=x[2],d=x[3];a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);x[0]=_add32(a,x[0]);x[1]=_add32(b,x[1]);x[2]=_add32(c,x[2]);x[3]=_add32(d,x[3])}
function _md5blk(d){var md5blks=[],i;for(i=0;i<64;i+=4)md5blks[i>>2]=d[i]+(d[i+1]<<8)+(d[i+2]<<16)+(d[i+3]<<24);return md5blks}
function _cmn(q,a,b,x,s,t){a=_add32(_add32(a,q),_add32(x,t));return _add32((a<<s)|(a>>>(32-s)),b)}
function ff(a,b,c,d,x,s,t){return _cmn((b&c)|((~b)&d),a,b,x,s,t)}
function gg(a,b,c,d,x,s,t){return _cmn((b&d)|(c&(~d)),a,b,x,s,t)}
function hh(a,b,c,d,x,s,t){return _cmn(b^c^d,a,b,x,s,t)}
function ii(a,b,c,d,x,s,t){return _cmn(c^(b|(~d)),a,b,x,s,t)}
function md5(marcFile, headerSize){
	var data=headerSize? new Uint8Array(marcFile._u8array.buffer, headerSize):marcFile._u8array;

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
const CRC32_TABLE=(function(){
	var c,crcTable=[];
	for(var n=0;n<256;n++){
		c=n;
		for(var k=0;k<8;k++)
			c=((c&1)?(0xedb88320^(c>>>1)):(c>>>1));
		crcTable[n]=c;
	}
	return crcTable;
}());
function crc32(marcFile, headerSize, ignoreLast4Bytes){
	var data=headerSize? new Uint8Array(marcFile._u8array.buffer, headerSize):marcFile._u8array;

	var crc=0^(-1);

	var len=ignoreLast4Bytes?data.length-4:data.length;
	for(var i=0;i<len;i++)
		crc=(crc>>>8)^CRC32_TABLE[(crc^data[i])&0xff];

	return ((crc^(-1))>>>0);
}



/* Adler-32 - https://en.wikipedia.org/wiki/Adler-32#Example_implementation */
const ADLER32_MOD=0xfff1;
function adler32(marcFile, offset, len){
	var a=1, b=0;

	for(var i=0; i<len; i++){
		a=(a+marcFile._u8array[i+offset])%ADLER32_MOD;
		b=(b+a)%ADLER32_MOD;
	}

	return ((b<<16) | a)>>>0;
}




/* CRC16 */
/*
const CRC16_TABLE=(function(){
	var c,crcTable=[];
	for(var n=0;n<256;n++){
		c=n;
		for(var k=0;k<8;k++)
			c=((c&1)?(0x8408^(c>>>1)):(c>>>1));
		crcTable[n]=c;
	}
	return crcTable;
}());
function crc16(marcFile){
	var crc=0^(-1);

	for(var i=0;i<marcFile._u8array.length;i++)
		crc=((crc>>>8)&0x0ff)^CRC16_TABLE[(crc^marcFile._u8array[i])&0xff];

	return ((crc^(-1))>>>0) & 0xffff;
}
*/



		
		
		

/* specific ROM checksums */
/* this is unused code, might be used in a future so ROM checksums can be fixed after patching */
const CONSOLES=[
	{
		title:'Sega Mega Drive/Genesis',
		MEGADRIVE_LOGO:[0x53, 0x45, 0x47, 0x41, 0x20, 0x4d, 0x45, 0x47, 0x41, 0x20, 0x44, 0x52],
		GENESIS_LOGO:[0x53, 0x45, 0x47, 0x41, 0x20, 0x47, 0x45, 0x4e, 0x45, 0x53, 0x49, 0x53],
		checkHeader:function(marcFile){
			var megadrive=true;
			var genesis=true;
			for(var i=0; i<12 && (megadrive || genesis); i++){
				if(marcFile._u8array[0x100+i]!==this.MEGADRIVE_LOGO[i])
					megadrive=false;
				if(marcFile._u8array[0x100+i]!==this.GENESIS_LOGO[i])
					genesis=false;
			}
			return megadrive || genesis;
		},
		getChecksum:function(marcFile){
			return (marcFile._u8array[0x018e]<<8) + marcFile._u8array[0x018f];
		},
		recalculateChecksum:function(marcFile){
			var checksum=0;

			for(var i=0x200; i<marcFile.fileSize; i+=2)
				checksum=(checksum + (((marcFile._u8array[i]<<8) + marcFile._u8array[i+1])>>>0)) & 0xffff;

			return checksum
		},
		updateChecksum:function(marcFile, newChecksum){
			marcFile._u8array[0x18e]=newChecksum>>8;
			marcFile._u8array[0x18f]=newChecksum & 0xff;
		}
	},{
		title:'Game Boy',
		NINTENDO_LOGO:[0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0c, 0x00, 0x0d],
		checkHeader:function(marcFile){
			for(var i=0; i<this.NINTENDO_LOGO.length; i++){
				if(marcFile._u8array[0x104+i]!==this.NINTENDO_LOGO[i])
					return false;
			}
			return true;
		},
		getChecksum:function(marcFile){
			return marcFile._u8array[0x14d]
		},
		recalculateChecksum:function(marcFile){
			var checksum=0;

			for(var i=0x134; i<0x014d; i++){
				checksum=(checksum - marcFile._u8array[i] - 1) & 0xff;
			}

			return checksum
		},
		updateChecksum:function(marcFile, newChecksum){
			marcFile._u8array[0x014d]=newChecksum;


			/* global checksum isn't checked by real hw, but fix it anyway */
			var globalChecksumOld=(marcFile._u8array[0x014e]<<8) + marcFile._u8array[0x014f];
			var globalChecksumNew=0;
			for(var i=0x0000; i<0x014e; i++)
				globalChecksumNew=((globalChecksumNew + marcFile._u8array[i]) >>> 0) & 0xffff;
			for(i=0x0150;i<marcFile.fileSize; i++)
				globalChecksumNew=((globalChecksumNew + marcFile._u8array[i]) >>> 0) & 0xffff;
			if(globalChecksumOld!==globalChecksumNew){
				marcFile._u8array[0x014e]=globalChecksumNew>>8;
				marcFile._u8array[0x014f]=globalChecksumNew & 0xff;
			}
		}
	}
];
function checkConsole(marcFile){
	return false;
}
function fixConsoleChecksum(marcFile){
	var system=false;
	for(var i=0; i<CONSOLES.length && !system; i++)
		if(CONSOLES[i].checkHeader(marcFile))
			system=CONSOLES[i];
	if(!system)
		return false;
	
	var oldChecksum=console.getChecksum(marcFile);
	var newChecksum=console.recalculateChecksum(marcFile);
	
	if(oldChecksum!==newChecksum)
		if(alert('Fix '+console.title+' checksum?')){
			console.updateChecksum(marcFile, newChecksum);
			return true;
		}
	
	return false;
}