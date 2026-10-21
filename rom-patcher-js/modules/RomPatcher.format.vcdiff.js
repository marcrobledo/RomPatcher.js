/* VCDIFF module for RomPatcher.js v20261021 - Marc Robledo 2018-2026 - http://www.marcrobledo.com/license */
/* File format specification: https://tools.ietf.org/html/rfc3284 */
/* all pieces of code ported from other projects are mentioned below along their software licenses */

const VCDIFF_MAGIC='\xd6\xc3\xc4';

if(typeof module !== "undefined" && module.exports){
	module.exports = VCDIFF;
	BinFile = require("./BinFile");
}

function VCDIFF(patchFile){
	this.file=patchFile;
}
VCDIFF.prototype.toString=function(){
	return 'VCDIFF patch'
}

VCDIFF.prototype.apply=function(romFile, validate){
	//romFile._u8array=new Uint8Array(romFile._dataView.buffer);

	//var t0=performance.now();
	var parser=new VCDIFF_Parser(this.file);

	//read header
	parser.seek(4);
	var headerIndicator=parser.readU8();

	var secondaryDecompressor;
	if(headerIndicator & VCD_DECOMPRESS){
		//has secondary decompressor, read its id
		var secondaryDecompressorId=parser.readU8();
		secondaryDecompressor=XDELTA_COMPATIBLE_SECONDARY_DECOMPRESSORS.find(d => d.id===secondaryDecompressorId);

		if(secondaryDecompressor)
			console.info('using '+secondaryDecompressor.name+' secondary decompressor')
		else
			throw new Error('not implemented: secondary decompressor (id='+secondaryDecompressorId+')');
	}


	if(headerIndicator & VCD_CODETABLE){
		var codeTableDataLength=parser.read7BitEncodedInt();

		if(codeTableDataLength!==0)
			throw new Error('not implemented: custom code table'); // custom code table
	}

	if(headerIndicator & VCD_APPHEADER){
		// ignore app header data
		var appDataLength=parser.read7BitEncodedInt();
		parser.skip(appDataLength);
	}
	var headerEndOffset=parser.offset;

	//calculate target file size
	var newFileSize=0;
	while(!parser.isEOF()){
		var winHeader=parser.decodeWindowHeader();
		newFileSize+=winHeader.targetWindowLength;
		parser.skip(winHeader.addRunDataLength + winHeader.addressesLength + winHeader.instructionsLength);
	}
	tempFile=new BinFile(newFileSize);




	parser.seek(headerEndOffset);


	var secondaryDecoders = secondaryDecompressor? secondaryDecompressor.createSectionDecoders() : null;

	var cache = new VCD_AdressCache(4,3);
	var codeTable = VCD_DEFAULT_CODE_TABLE;

	var targetWindowPosition = 0; //renombrar

	while(!parser.isEOF()){
		var winHeader = parser.decodeWindowHeader();
		if(winHeader.deltaIndicator!==0 && !secondaryDecompressor){
			throw new Error('invalid windowHeader.deltaIndicator:'+winHeader.deltaIndicator);
		}

		var readSectionOffset = parser.offset;
		/* parse run data section */
		var addRunDataStream;
		if(winHeader.deltaIndicator & VCD_DATACOMP){
			/* secondary decoder for add run data section */
			const decompressed = secondaryDecoders.data.decodeSection(parser._u8array, readSectionOffset, winHeader.addRunDataLength);
			addRunDataStream = new VCDIFF_Parser(new BinFile(decompressed));
		}else{
			addRunDataStream = new VCDIFF_Parser(this.file, readSectionOffset);
		}
		readSectionOffset += winHeader.addRunDataLength;
		/* parse instruction section */
		var instructionsStream;
		if(winHeader.deltaIndicator & VCD_INSTCOMP){
			/* secondary decoder for instruction section */
			const decompressed = secondaryDecoders.inst.decodeSection(parser._u8array, readSectionOffset, winHeader.instructionsLength);
			instructionsStream = new VCDIFF_Parser(new BinFile(decompressed));
		}else{
			instructionsStream = new VCDIFF_Parser(this.file, readSectionOffset);
		}
		readSectionOffset += winHeader.instructionsLength;
		/* parse adress section */
		var addressesStream;
		if(winHeader.deltaIndicator & VCD_ADDRCOMP){
			/* secondary decoder for address section */
			const decompressed = secondaryDecoders.addr.decodeSection(parser._u8array, readSectionOffset, winHeader.addressesLength);
			addressesStream = new VCDIFF_Parser(new BinFile(decompressed));
		}else{
			addressesStream = new VCDIFF_Parser(this.file, readSectionOffset);
		}

		var addRunDataIndex = 0;

		cache.reset(addressesStream);

		var instructionsStreamEndOffset = (winHeader.deltaIndicator & VCD_INSTCOMP) ? instructionsStream.fileSize : readSectionOffset;
		while(instructionsStream.offset<instructionsStreamEndOffset){
			/*
			var instructionIndex=instructionsStream.readS8();
			if(instructionIndex===-1){
				break;
			}
			*/
			var instructionIndex = instructionsStream.readU8();


			for(var i=0; i<2; i++){
				var instruction=codeTable[instructionIndex][i];
				var size=instruction.size;

				if(size===0 && instruction.type!==VCD_NOOP){
					size=instructionsStream.read7BitEncodedInt()
				}

				if(instruction.type===VCD_NOOP){
					continue;

				}else if(instruction.type===VCD_ADD){
					addRunDataStream.copyToFile2(tempFile, addRunDataIndex+targetWindowPosition, size);
					addRunDataIndex += size;

				}else if(instruction.type===VCD_COPY){
					var addr = cache.decodeAddress(addRunDataIndex+winHeader.sourceLength, instruction.mode);
					var absAddr = 0;

					// source segment and target segment are treated as if they're concatenated
					var sourceData = null;
					if(addr < winHeader.sourceLength){
						absAddr = winHeader.sourcePosition + addr;
						if(winHeader.indicator & VCD_SOURCE){
							sourceData = romFile;
						}else if(winHeader.indicator & VCD_TARGET){
							sourceData = tempFile;
						}
					}else{
						absAddr = targetWindowPosition + (addr - winHeader.sourceLength);
						sourceData = tempFile;
					}

                    while(size--){
						tempFile._u8array[targetWindowPosition + addRunDataIndex++]=sourceData._u8array[absAddr++];
                        //targetU8[targetWindowPosition + targetWindowOffs++] = copySourceU8[absAddr++];
                    }
					//to-do: test
					//sourceData.copyToFile2(tempFile, absAddr, size, targetWindowPosition + addRunDataIndex);
					//addRunDataIndex += size;
				}else if(instruction.type===VCD_RUN){
					var runByte = addRunDataStream.readU8();
					var offset = targetWindowPosition + addRunDataIndex;
					for(var j=0; j<size; j++){
						tempFile._u8array[offset+j]=runByte;
					}

					addRunDataIndex += size;
				}else{
					throw new Error('invalid instruction type found');
				}
			}
		}

		if(validate && winHeader.adler32 && (winHeader.adler32 !== adler32(tempFile, targetWindowPosition, winHeader.targetWindowLength))){
			throw new Error('Target ROM checksum mismatch');
		}

		parser.skip(winHeader.addRunDataLength + winHeader.addressesLength + winHeader.instructionsLength);
		targetWindowPosition += winHeader.targetWindowLength;
	}

	//console.log((performance.now()-t0)/1000);
	return tempFile;
}

VCDIFF.MAGIC=VCDIFF_MAGIC;

VCDIFF.fromFile=function(file){
	return new VCDIFF(file);
}







function VCDIFF_Parser(binFile, offset)
{
	this.fileSize=binFile.fileSize;
	this._u8array=binFile._u8array;
    this.offset=offset || 0;

	/* reimplement readU8, readU32 and skip from BinFile */
	/* in web implementation, there are no guarantees BinFile will be dynamically loaded before this one */
	/* so we cannot rely on cloning BinFile.prototype */
	this.readU8 = binFile.readU8;
	this.readU32 = binFile.readU32;
	this.skip = binFile.skip;
	this.isEOF = binFile.isEOF;
	this.seek = binFile.seek;
}
VCDIFF_Parser.prototype.read7BitEncodedInt=function(){
	var num=0, bits = 0;

	do {
		bits = this.readU8();
		num = (num << 7) + (bits & 0x7f); 
	} while(bits & 0x80);

	return num;
}
VCDIFF_Parser.prototype.decodeWindowHeader=function(){
	var windowHeader={
		indicator:this.readU8(),
		sourceLength:0,
		sourcePosition:0,
		adler32:false
	};


	if(windowHeader.indicator & (VCD_SOURCE | VCD_TARGET)){
		windowHeader.sourceLength = this.read7BitEncodedInt();
		windowHeader.sourcePosition = this.read7BitEncodedInt();
	}

	windowHeader.deltaLength = this.read7BitEncodedInt();
	windowHeader.targetWindowLength = this.read7BitEncodedInt();
	windowHeader.deltaIndicator = this.readU8(); // secondary compression: 1=VCD_DATACOMP,2=VCD_INSTCOMP,4=VCD_ADDRCOMP
	if(windowHeader.deltaIndicator & ~(VCD_DATACOMP | VCD_INSTCOMP | VCD_ADDRCOMP)){
		throw new Error('unimplemented windowHeader.deltaIndicator:'+windowHeader.deltaIndicator);
	}
	
	windowHeader.addRunDataLength = this.read7BitEncodedInt();
	windowHeader.instructionsLength = this.read7BitEncodedInt();
	windowHeader.addressesLength = this.read7BitEncodedInt();

	if(windowHeader.indicator & VCD_ADLER32){
		windowHeader.adler32 = this.readU32();
	}


	return windowHeader;
}


VCDIFF_Parser.prototype.copyToFile2=function(target, targetOffset, len){
	for(var i=0; i<len; i++){
		target._u8array[targetOffset+i]=this._u8array[this.offset+i];
	}
	//this.file.copyToFile(target, this.offset, len, targetOffset);
	this.skip(len);
}

//------------------------------------------------------



// hdrIndicator
const VCD_DECOMPRESS = 0x01;
const VCD_CODETABLE  = 0x02;
const VCD_APPHEADER  = 0x04; // nonstandard?

// winIndicator
const VCD_SOURCE  = 0x01;
const VCD_TARGET  = 0x02;
const VCD_ADLER32 = 0x04;

// deltaIndicator (secondary-compressed sections)
const VCD_DATACOMP = 0x01;
const VCD_INSTCOMP = 0x02;
const VCD_ADDRCOMP = 0x04;





function VCD_Instruction(instruction, size, mode){
	this.type=instruction;
	this.size=size;
	this.mode=mode;
}

/*
	build the default code table (used to encode/decode instructions) specified in RFC 3284
	heavily based on
	https://github.com/vic-alexiev/TelerikAcademy/blob/master/C%23%20Fundamentals%20II/Homework%20Assignments/3.%20Methods/000.%20MiscUtil/Compression/Vcdiff/CodeTable.cs
*/
const VCD_NOOP=0;
const VCD_ADD=1;
const VCD_RUN=2;
const VCD_COPY=3;
const VCD_DEFAULT_CODE_TABLE=(function(){
	var entries=[];

	var empty = {type: VCD_NOOP, size: 0, mode: 0};

	// 0
	entries.push([{type: VCD_RUN, size: 0, mode: 0}, empty]);

	// 1,18
	for(var size=0; size<18; size++){
		entries.push([{type: VCD_ADD, size: size, mode: 0}, empty]);
	}

	// 19,162
	for(var mode=0; mode<9; mode++){
		entries.push([{type: VCD_COPY, size: 0, mode: mode}, empty]);
		
		for(var size=4; size<19; size++){
			entries.push([{type: VCD_COPY, size: size, mode: mode}, empty]);
		}
	}

	// 163,234
	for(var mode=0; mode<6; mode++){
		for(var addSize=1; addSize<5; addSize++){
			for(var copySize=4; copySize<7; copySize++){
				entries.push([{type:  VCD_ADD, size: addSize,  mode: 0},
							{type: VCD_COPY, size: copySize, mode: mode}]);
			}
		}
	}

	// 235,246
	for(var mode=6; mode<9; mode++){
		for(var addSize=1; addSize<5; addSize++){
			entries.push([{type:  VCD_ADD, size: addSize, mode: 0},
						{type: VCD_COPY, size:       4, mode: mode}]);
		}
	}

	// 247,255
	for(var mode=0; mode<9; mode++){
		entries.push([{type: VCD_COPY, size: 4, mode: mode},
					{type:  VCD_ADD, size: 1, mode: 0}]); 
	}

	return entries;
})();



/*
	ported from https://github.com/vic-alexiev/TelerikAcademy/tree/master/C%23%20Fundamentals%20II/Homework%20Assignments/3.%20Methods/000.%20MiscUtil/Compression/Vcdiff
	by Victor Alexiev (https://github.com/vic-alexiev) released under MIT License (https://github.com/vic-alexiev/TelerikAcademy/blob/master/LICENSE)
*/
const VCD_MODE_SELF=0;
const VCD_MODE_HERE=1;
function VCD_AdressCache(nearSize, sameSize){
	this.nearSize=nearSize;
	this.sameSize=sameSize;

	this.near=new Array(nearSize);
	this.same=new Array(sameSize*256);
}
VCD_AdressCache.prototype.reset=function(addressStream){
	this.nextNearSlot=0;
	this.near.fill(0);
	this.same.fill(0);

	this.addressStream=addressStream;
}
VCD_AdressCache.prototype.decodeAddress=function(here, mode){
	var address=0;

	if(mode===VCD_MODE_SELF){
		address=this.addressStream.read7BitEncodedInt();
	}else if(mode===VCD_MODE_HERE){
		address=here-this.addressStream.read7BitEncodedInt();
	}else if(mode-2<this.nearSize){ //near cache
		address=this.near[mode-2]+this.addressStream.read7BitEncodedInt();
	}else{ //same cache
		var m=mode-(2+this.nearSize);
		address=this.same[m*256+this.addressStream.readU8()];
	}
	
	this.update(address);
	return address;
}
VCD_AdressCache.prototype.update=function(address){
	if(this.nearSize>0){
		this.near[this.nextNearSlot]=address;
		this.nextNearSlot=(this.nextNearSlot+1)%this.nearSize;
	}

	if(this.sameSize>0){
		this.same[address%(this.sameSize*256)]=address;
	}
}



/* secondary decompressors */
const XD3_decodeBits=function(stream, nBits) {
	var value=0, vmask=1 << nBits;

	while(true){
		if(stream.curMask===0x100){
			if(stream.pos >= stream.end)
				throw new Error('secondary decoder end of input');
			stream.curByte = stream.input[stream.pos++];
			stream.curMask = 1;
		}

		vmask >>= 1;
		if(stream.curByte & stream.curMask)
			value |= vmask;
		stream.curMask <<= 1;

		if(vmask === 1)
			return value;
	}
};

const XDELTA3_DJW=(function(){
	/*
		ported from https://github.com/jmacd/xdelta/blob/main/xdelta3/xdelta3-djw.h
		by Joshua MacDonald (https://github.com/jmacd) released under Apache License 2.0 (http://www.apache.org/licenses/LICENSE-2.0)
	*/
	
	const ALPHABET_SIZE=256;
	const MAX_CODELEN=20;
	const TOTAL_CODES=22; // [RUN_0, RUN_1, 1-MAX_CODELEN]
	const RUN_1=1;
	const EXTRA_12OFFSET=7;
	const EXTRA_CODE_BITS=4;
	const CLCLEN_BITS=4;
	const MAX_CLCLEN=15;
	const GROUP_BITS=3;
	const SECTORSZ_MULT=5;
	const SECTORSZ_BITS=5;
	const GBCLEN_BITS=3;
	const MAX_GBCLEN=7;

	// initial MTF order of code lengths (0, basic codes, extra codes)
	const CLEN_MTF_INIT=[0, 4, 5, 6, 7, 8, 9, 10, 3, 11, 2, 12, 13, 1, 14, 15, 16, 17, 18, 19, 20];


	// build canonical prefix code decoding tables
	const _buildDecoder=function(clen, asize, absMax){
		const nrClen = new Array(absMax + 1).fill(0);
		for(var i=0; i<asize; i++){
			if(clen[i] > absMax)
				throw new Error('secondary decoder invalid code length');
			nrClen[clen[i]]++;
		}

		var minLen = 1;
		while(minLen <= absMax && !nrClen[minLen])
			minLen++;
		var maxLen = absMax;
		while(maxLen > 0 && !nrClen[maxLen])
			maxLen--;
		if(minLen > maxLen)
			throw new Error('secondary decoder invalid code');

		const tmpBase = new Array(absMax + 2).fill(0);
		const base = new Array(absMax + 2).fill(0);
		const limit = new Array(absMax + 2).fill(0);
		limit[minLen] = nrClen[minLen] - 1;
		for(var i=minLen+1; i<=maxLen; i++){
			var lastLimit = (limit[i - 1] + 1) << 1;
			tmpBase[i] = tmpBase[i - 1] + nrClen[i - 1];
			limit[i] = lastLimit + nrClen[i] - 1;
			base[i] = lastLimit - tmpBase[i];
		}

		const inorder = new Uint8Array(asize);
		for(var i=0; i<asize; i++){
			if(clen[i] !== 0)
				inorder[tmpBase[clen[i]]++] = i;
		}

		return {
			inorder,
			base,
			limit,
			minLen,
			maxLen
		};
	};

	const _decodeSymbol=function(stream, table, maxSym){
		var code = 0, bits = 0;

		while(true){
			if(bits===table.maxLen)
				throw new Error('secondary decoder invalid code');

			if(stream.curMask===0x100){
				if(stream.pos>=stream.end)
					throw new Error('secondary decoder end of input');
				stream.curByte = stream.input[stream.pos++];
				stream.curMask = 1;
			}

			bits++;
			code <<= 1;
			if(stream.curByte & stream.curMask)
				code |= 1;
			stream.curMask <<= 1;

			if(bits>=table.minLen && code<=table.limit[bits])
				break;
		}

		if(table.base[bits]<=code){
			var offset = code - table.base[bits];
			if(offset<=maxSym && offset<table.inorder.length)
				return table.inorder[offset];
		}
		throw new Error('secondary decoder invalid code');
	};

	// decode MTF + run-length (RUN_0/RUN_1 bijective base-2) encoded values
	const _decodeRunMtf=function(stream, table, mtfvals, elts, skipOffset, values){
		var n=0, rep=0, mtf=0, s=0;

		while(n<elts){
			// subsequent groups: zero code lengths are already known
			if(skipOffset!==0 && n>=skipOffset && values[n-skipOffset]===0){
				values[n++] = 0;
				continue;
			}

			if(rep!==0){
				values[n++] = mtfvals[0];
				rep--;
				continue;
			}

			if(mtf!==0){
				var sym = mtfvals[mtf];
				for(var k=mtf; k!==0; k--)
					mtfvals[k] = mtfvals[k - 1];
				mtfvals[0] = sym;
				values[n++] = sym;
				mtf = 0;
				continue;
			}

			mtf = _decodeSymbol(stream, table, TOTAL_CODES);
			if(mtf<=RUN_1){
				rep = (mtf + 1) << s;
				mtf = 0;
				s++;
			}else{
				mtf--;
				s = 0;
			}
		}

		if(rep!==0)
			throw new Error('secondary decoder invalid repeat code');
	};


	const COMMON_SECTION_DECODER={
		decodeSection:function(u8array, offset, length){
			const stream = {
				input:u8array,
				pos:offset,
				end:offset + length,
				curByte:0,
				curMask:0x100
			};

			// uncompressed size
			var outputSize = 0, b;
			do{
				if(stream.pos>=stream.end)
					throw new Error('secondary decoder end of input');
				b = u8array[stream.pos++];
				outputSize = (outputSize * 128) + (b & 0x7f);
			}while(b & 0x80);
			if(outputSize===0)
				throw new Error('secondary decoder invalid output size');

			const output = new Uint8Array(outputSize);

			var groups = XD3_decodeBits(stream, GROUP_BITS) + 1;
			var sectorSize = outputSize;
			if(groups>1)
				sectorSize = (XD3_decodeBits(stream, SECTORSZ_BITS) + 1) * SECTORSZ_MULT;
			const sectors = 1 + Math.floor((outputSize - 1) / sectorSize);

			// code lengths decoder
			var numCodes = XD3_decodeBits(stream, EXTRA_CODE_BITS) + EXTRA_12OFFSET;
			const clClen = new Uint8Array(TOTAL_CODES);
			for(var i=0; i<numCodes; i++)
				clClen[i] = XD3_decodeBits(stream, CLCLEN_BITS);
			const clTable = _buildDecoder(clClen, TOTAL_CODES, MAX_CLCLEN);
			const clMtf = Uint8Array.from(CLEN_MTF_INIT);

			// code lengths of each group
			const clen = new Uint8Array(ALPHABET_SIZE * groups);
			_decodeRunMtf(stream, clTable, clMtf, clen.length, ALPHABET_SIZE, clen);

			const tables = [];
			for(var gp=0; gp<groups; gp++)
				tables.push(_buildDecoder(clen.subarray(gp * ALPHABET_SIZE, (gp + 1) * ALPHABET_SIZE), ALPHABET_SIZE, MAX_CODELEN));

			// group selector of each sector
			var selGroup = null;
			if(groups>1){
				const selClen = new Uint8Array(groups + 1);
				const selMtf = new Uint8Array(groups + 2);
				for(var i=0; i<groups+1; i++) {
					selClen[i] = XD3_decodeBits(stream, GBCLEN_BITS);
					selMtf[i] = i;
				}
				const selTable = _buildDecoder(selClen, groups + 1, MAX_GBCLEN);
				selGroup = new Uint8Array(sectors);
				_decodeRunMtf(stream, selTable, selMtf, sectors, 0, selGroup);
			}

			// data
			var outPos = 0;
			for(var c=0; c<sectors; c++) {
				var table = tables[0];
				if(groups>1){
					if(selGroup[c] >= groups)
						throw new Error('secondary decoder invalid group');
					table = tables[selGroup[c]];
				}

				var n = Math.min(sectorSize, outputSize - outPos);
				while(n--)
					output[outPos++] = _decodeSymbol(stream, table, ALPHABET_SIZE);
			}

			if(stream.pos!==stream.end)
				throw new Error('secondary decoder finished with unused input');

			return output;
		}
	};

	return {
		id:0x01,
		name:'DJW static/multi-table Huffman',
		createSectionDecoders:function(){
			/* DJW can reuse the same decoder instance */
			return {
				data: COMMON_SECTION_DECODER,
				inst: COMMON_SECTION_DECODER,
				addr: COMMON_SECTION_DECODER
			};
		},
	}
}());

const XDELTA3_LZMA=(function(){
	/*
		based on LZMA SDK specification
		by Igor Pavlov (https://www.7-zip.org/sdk.html)
	*/

	const XZ_MAGIC=[0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00];
	const XZ_STREAM_HEADER_SIZE=12;

	const NUM_STATES=12;
	const POS_STATES_MAX=16;
	const END_POS_MODEL_INDEX=14;
	const NUM_FULL_DISTANCES=128;
	const MATCH_MIN_LEN=2;

	// length coder layout: choice, choice2, low[16][8], mid[16][8], high[256]
	const LEN_CHOICE=0;
	const LEN_CHOICE2=1;
	const LEN_LOW=2;
	const LEN_MID=LEN_LOW + POS_STATES_MAX*8;
	const LEN_HIGH=LEN_MID + POS_STATES_MAX*8;
	const LEN_PROBS_SIZE=LEN_HIGH + 256;



	function LZMADecoder(){
		this.headerParsed=false;
		this.history=new Uint8Array(0x10000);
		this.historyLength=0;
		this.dictStart=0; // history offset of the last dictionary reset
		this.setProps(0x5d);
		this.resetState();
	}
	LZMADecoder.prototype.setProps=function(props){
		var lc=props % 9;
		props=Math.floor(props / 9);
		var lp=props % 5;
		var pb=Math.floor(props / 5);
		if(pb>4 || lc+lp>4)
			throw new Error('secondary decoder invalid lzma properties');

		this.lc=lc;
		this.lp=lp;
		this.pb=pb;
		this.literalProbs=new Uint16Array(0x300 << (lc + lp));
	};
	LZMADecoder.prototype.resetState=function(){
		this.state=0;
		this.rep0=this.rep1=this.rep2=this.rep3=0;

		const newProbs=function(size){
			return new Uint16Array(size).fill(1024);
		};
		this.literalProbs.fill(1024);
		this.isMatch=newProbs(NUM_STATES * POS_STATES_MAX);
		this.isRep=newProbs(NUM_STATES);
		this.isRepG0=newProbs(NUM_STATES);
		this.isRepG1=newProbs(NUM_STATES);
		this.isRepG2=newProbs(NUM_STATES);
		this.isRep0Long=newProbs(NUM_STATES * POS_STATES_MAX);
		this.posSlot=newProbs(4 * 64);
		this.posSpecial=newProbs(1 + NUM_FULL_DISTANCES - END_POS_MODEL_INDEX);
		this.align=newProbs(16);
		this.lenProbs=newProbs(LEN_PROBS_SIZE);
		this.repLenProbs=newProbs(LEN_PROBS_SIZE);
	};
	LZMADecoder.prototype.ensureHistory=function(extra){
		var needed=this.historyLength + extra;
		if(needed>this.history.length){
			var bigger=new Uint8Array(Math.max(needed, this.history.length * 2));
			bigger.set(this.history.subarray(0, this.historyLength));
			this.history=bigger;
		}
	};
	LZMADecoder.prototype.initRangeDecoder=function(input, pos){
		if(input[pos]!==0)
			throw new Error('secondary decoder invalid lzma range coder');
		this.input=input;
		this.range=0xffffffff;
		this.code=((input[pos + 1] << 24) | (input[pos + 2] << 16) | (input[pos + 3] << 8) | input[pos + 4]) >>> 0;
		this.inputPos=pos + 5;
	};
	LZMADecoder.prototype.normalize=function(){
		if(this.range<0x1000000){
			this.range=(this.range << 8) >>> 0;
			this.code=((this.code << 8) | this.input[this.inputPos++]) >>> 0;
		}
	};
	LZMADecoder.prototype.decodeBit=function(probs, index){
		this.normalize();
		var p=probs[index];
		var bound=(this.range >>> 11) * p;
		if(this.code<bound){
			this.range=bound;
			probs[index]=p + ((2048 - p) >> 5);
			return 0;
		}
		this.range-=bound;
		this.code-=bound;
		probs[index]=p - (p >> 5);
		return 1;
	};
	LZMADecoder.prototype.decodeDirectBits=function(numBits){
		var result=0;
		while(numBits--){
			this.normalize();
			this.range=this.range >>> 1;
			if(this.code>=this.range){
				this.code-=this.range;
				result=result * 2 + 1;
			}else{
				result=result * 2;
			}
		}
		return result;
	};
	LZMADecoder.prototype.decodeBitTree=function(probs, offset, numBits){
		var m=1;
		for(var i=0; i<numBits; i++)
			m=(m << 1) + this.decodeBit(probs, offset + m);
		return m - (1 << numBits);
	};
	LZMADecoder.prototype.decodeReverseBitTree=function(probs, offset, numBits){
		var m=1, symbol=0;
		for(var i=0; i<numBits; i++){
			var bit=this.decodeBit(probs, offset + m);
			m=(m << 1) + bit;
			symbol|=bit << i;
		}
		return symbol;
	};
	LZMADecoder.prototype.decodeLength=function(probs, posState){
		if(this.decodeBit(probs, LEN_CHOICE)===0)
			return this.decodeBitTree(probs, LEN_LOW + posState * 8, 3);
		if(this.decodeBit(probs, LEN_CHOICE2)===0)
			return 8 + this.decodeBitTree(probs, LEN_MID + posState * 8, 3);
		return 16 + this.decodeBitTree(probs, LEN_HIGH, 8);
	};
	LZMADecoder.prototype.decodeDistance=function(len){
		var lenState=len<4 ? len : 3;
		var slot=this.decodeBitTree(this.posSlot, lenState * 64, 6);
		if(slot<4)
			return slot;

		var numDirectBits=(slot >> 1) - 1;
		var dist=(2 | (slot & 1)) * Math.pow(2, numDirectBits);
		if(slot<END_POS_MODEL_INDEX){
			dist+=this.decodeReverseBitTree(this.posSpecial, dist - slot, numDirectBits);
		}else{
			dist+=this.decodeDirectBits(numDirectBits - 4) * 16;
			dist+=this.decodeReverseBitTree(this.align, 0, 4);
		}
		return dist;
	};
	LZMADecoder.prototype.decodeChunk=function(input, inputPos, uncompressedSize){
		this.initRangeDecoder(input, inputPos);

		var hist=this.history;
		var pos=this.historyLength;
		var limit=pos + uncompressedSize;
		var dictStart=this.dictStart;
		var pbMask=(1 << this.pb) - 1;
		var lpMask=(1 << this.lp) - 1;
		var lc=this.lc;
		var state=this.state;
		var rep0=this.rep0, rep1=this.rep1, rep2=this.rep2, rep3=this.rep3;

		while(pos<limit){
			var dictPos=pos - dictStart;
			var posState=dictPos & pbMask;

			if(this.decodeBit(this.isMatch, (state << 4) + posState)===0){
				/* literal */
				var prevByte=dictPos>0 ? hist[pos - 1] : 0;
				var litBase=0x300 * (((dictPos & lpMask) << lc) + (prevByte >> (8 - lc)));
				var symbol=1;
				if(state>=7){
					var matchByte=hist[pos - rep0 - 1];
					do{
						var matchBit=(matchByte >> 7) & 1;
						matchByte<<=1;
						var bit=this.decodeBit(this.literalProbs, litBase + ((1 + matchBit) << 8) + symbol);
						symbol=(symbol << 1) | bit;
						if(matchBit!==bit)
							break;
					}while(symbol<0x100);
				}
				while(symbol<0x100)
					symbol=(symbol << 1) | this.decodeBit(this.literalProbs, litBase + symbol);

				hist[pos++]=symbol & 0xff;
				state=state<4 ? 0 : (state<10 ? state - 3 : state - 6);
				continue;
			}

			var len;
			if(this.decodeBit(this.isRep, state)===0){
				/* simple match */
				rep3=rep2;
				rep2=rep1;
				rep1=rep0;
				len=this.decodeLength(this.lenProbs, posState);
				state=state<7 ? 7 : 10;
				rep0=this.decodeDistance(len);
			}else{
				/* repeated match */
				if(dictPos===0)
					throw new Error('secondary decoder invalid lzma data');

				if(this.decodeBit(this.isRepG0, state)===0){
					if(this.decodeBit(this.isRep0Long, (state << 4) + posState)===0){
						/* short rep */
						if(rep0>=dictPos)
							throw new Error('secondary decoder invalid lzma distance');
						hist[pos]=hist[pos - rep0 - 1];
						pos++;
						state=state<7 ? 9 : 11;
						continue;
					}
				}else{
					var dist;
					if(this.decodeBit(this.isRepG1, state)===0){
						dist=rep1;
					}else{
						if(this.decodeBit(this.isRepG2, state)===0){
							dist=rep2;
						}else{
							dist=rep3;
							rep3=rep2;
						}
						rep2=rep1;
					}
					rep1=rep0;
					rep0=dist;
				}
				len=this.decodeLength(this.repLenProbs, posState);
				state=state<7 ? 8 : 11;
			}

			len+=MATCH_MIN_LEN;
			if(rep0>=dictPos || pos + len>limit)
				throw new Error('secondary decoder invalid lzma distance');
			for(var i=0; i<len; i++, pos++)
				hist[pos]=hist[pos - rep0 - 1];
		}

		this.state=state;
		this.rep0=rep0;
		this.rep1=rep1;
		this.rep2=rep2;
		this.rep3=rep3;
		this.historyLength=pos;
	};

	LZMADecoder.prototype.decodeSection=function(u8array, offset, length){
		var pos=offset;
		var end=offset + length;

		// uncompressed size
		var outputSize=0, b;
		do{
			if(pos>=end)
				throw new Error('secondary decoder end of input');
			b=u8array[pos++];
			outputSize=(outputSize * 128) + (b & 0x7f);
		}while(b & 0x80);
		if(outputSize===0)
			throw new Error('secondary decoder invalid output size');

		if(!this.headerParsed){
			// xz stream header + block header
			for(var i=0; i<XZ_MAGIC.length; i++){
				if(u8array[pos + i]!==XZ_MAGIC[i])
					throw new Error('secondary decoder invalid xz stream');
			}
			pos+=XZ_STREAM_HEADER_SIZE;
			pos+=(u8array[pos] + 1) * 4;
			this.headerParsed=true;
		}

		this.ensureHistory(outputSize);
		var startLength=this.historyLength;
		var targetLength=startLength + outputSize;

		while(this.historyLength<targetLength){
			if(pos>=end)
				throw new Error('secondary decoder end of input');

			var control=u8array[pos++];
			if(control===0 || (control>2 && control<0x80))
				throw new Error('secondary decoder invalid lzma2 chunk');

			if(control<0x80){
				/* uncompressed chunk */
				if(control===1)
					this.dictStart=this.historyLength;
				var size=((u8array[pos] << 8) | u8array[pos + 1]) + 1;
				pos+=2;
				if(this.historyLength + size>targetLength || pos + size>end)
					throw new Error('secondary decoder invalid lzma2 chunk');
				this.history.set(u8array.subarray(pos, pos + size), this.historyLength);
				this.historyLength+=size;
				pos+=size;
			}else{
				/* lzma chunk */
				var uncompressedSize=(((control & 0x1f) << 16) | (u8array[pos] << 8) | u8array[pos + 1]) + 1;
				var compressedSize=((u8array[pos + 2] << 8) | u8array[pos + 3]) + 1;
				pos+=4;
				var resetMode=(control >> 5) & 3;
				if(resetMode===3)
					this.dictStart=this.historyLength;
				if(resetMode>=2)
					this.setProps(u8array[pos++]);
				if(resetMode>=1)
					this.resetState();

				if(this.historyLength + uncompressedSize>targetLength || pos + compressedSize>end)
					throw new Error('secondary decoder invalid lzma2 chunk');
				this.decodeChunk(u8array, pos, uncompressedSize);
				pos+=compressedSize;
			}
		}

		return this.history.slice(startLength, targetLength);
	};

	return {
		id:0x02,
		name:'LZMA',
		createSectionDecoders:function(){
			return {
				data: new LZMADecoder(),
				inst: new LZMADecoder(),
				addr: new LZMADecoder()
			};
		}
	}
}());

const XDELTA_COMPATIBLE_SECONDARY_DECOMPRESSORS=[
	XDELTA3_DJW,
	XDELTA3_LZMA
];