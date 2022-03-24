/* ZIP module for Rom Patcher JS v20220319 - Marc Robledo 2016-2022 - http://www.marcrobledo.com/license */

const ZIP_MAGIC='\x50\x4b\x03\x04';

var ZIPManager=(function(){
	const FILTER_PATCHES=/\.(ips|ups|bps|aps|rup|ppf|mod|xdelta)$/i;
	//const FILTER_ROMS=/(?<!\.(txt|diz|rtf|docx?|xlsx?|html?|pdf|jpe?g|gif|png|bmp|webp|zip|rar|7z))$/i; //negative lookbehind is not compatible with Safari https://stackoverflow.com/a/51568859
	const FILTER_NON_ROMS=/(\.(txt|diz|rtf|docx?|xlsx?|html?|pdf|jpe?g|gif|png|bmp|webp|zip|rar|7z))$/i;

	var _unzipEntry=function(zippedEntry, dest, dest2, parse){
		zippedEntry.getData(new zip.BlobWriter(), function(blob){
			var fileReader=new FileReader();
			fileReader.onload=function(){
				var unzippedFile=new MarcFile(this.result);
				unzippedFile.fileName=zippedEntry.filename;

				if(dest.patches){
					dest.patches[dest2].fetchedFile=unzippedFile;
					if(parse)
						parseCustomPatch(dest.patches[dest2]);
				}if(dest===romFile){
					romFile=unzippedFile;
					_parseROM();
				}else if(dest===patchFile){
					patchFile=unzippedFile;
					_readPatchFile();
				}
			};
			fileReader.readAsArrayBuffer(blob);
		});
	};

	return{
		parseFile:function(sourceFile, compressedFileIndex){
			setMessage('apply', _('unzipping'), 'loading');

			var arrayBuffer=sourceFile._u8array.buffer;
			zip.createReader(
				new zip.BlobReader(new Blob([arrayBuffer])),
				/* success */
				function(zipReader){
					zipReader.getEntries(function(zipEntries){
						var filteredEntries=[];
						for(var i=0; i<zipEntries.length; i++){
							if(
								(
									(sourceFile===romFile && !FILTER_NON_ROMS.test(zipEntries[i].filename) && !FILTER_PATCHES.test(zipEntries[i].filename)) ||
									(sourceFile!==romFile && FILTER_PATCHES.test(zipEntries[i].filename))
								) && !zipEntries[i].directory
							){
								filteredEntries.push(zipEntries[i]);
							}
						}



						var customPatch=false;
						if(isCustomPatcherEnabled()){
							for(var i=0; i<CUSTOM_PATCHER.length && !customPatch; i++){
								if(CUSTOM_PATCHER[i].fetchedFile===sourceFile)
									customPatch=CUSTOM_PATCHER[i];
							}
						}

						if(customPatch){
							if(customPatch.patches){
								for(var i=0; i<customPatch.patches.length; i++){
									for(var j=0; j<filteredEntries.length; j++){
										if(customPatch.patches[i].file===filteredEntries[j].filename){
											_unzipEntry(filteredEntries[j], customPatch, i, i===compressedFileIndex);
											break;
										}
									}
								}
							}else{
								var nextOption;
								var customPatchIndex=CUSTOM_PATCHER.indexOf(customPatch);
								customPatch.patches=[];
								for(var i=0; i<filteredEntries.length; i++){
									customPatch.patches.push({
										file:filteredEntries[i].filename,
										fetchedFile:false,
										name:customPatch.name + ' - ' + filteredEntries[i].filename,
										crc:customPatch.crc
									});
									
									
									var option;
									if(i===0){
										option=customPatch.selectOption;
										nextOption=option.nextSibling;
									}else{
										option=document.createElement('option');
										if(nextOption)
											el('input-file-patch').insertBefore(option, nextOption);
										else
											el('input-file-patch').appendChild(option);
									}
									option.value=customPatchIndex+','+i;
									option.innerHTML=customPatch.patches[i].name;
									nextOption=option.nextSibling;
									_unzipEntry(filteredEntries[i], customPatch, i, i===0);
								}
							}


							setTabApplyEnabled(false);
						}else{
							var _evtClickDialogEntry=function(evt){
								UI.hideDialog('zip');
								_unzipEntry(this.zipEntry, sourceFile);
							}

							if(filteredEntries.length>1){
								document.getElementById('zip-dialog-message').innerHTML=_(sourceFile===romFile?'rom_file':'patch_file');

								var zipList=document.getElementById('zip-dialog-file-list');
								zipList.innerHTML='';
								for(var i=0; i<filteredEntries.length; i++){
									var li=document.createElement('li');
									li.zipEntry=filteredEntries[i];
									li.innerHTML=filteredEntries[i].filename;
									addEvent(li, 'click', _evtClickDialogEntry);
									zipList.appendChild(li);
								}

								UI.showDialog('zip');
							}else if(filteredEntries.length===1){
								_unzipEntry(filteredEntries[0], sourceFile);
							}else{
								if(sourceFile===romFile){
									romFile=null;
									setMessage('apply', _('no_valid_file_found'), 'error');
								}else if(sourceFile===patchFile){
									patchFile=null;
									setMessage('apply', _('error_invalid_patch'), 'error');
								}
							}

							setTabApplyEnabled(true);
						}
					});
				},
				/* failed */
				function(zipReader){
					setTabApplyEnabled(true);
					setMessage('apply', _('error_unzipping'), 'error');
				}
			);
		}
	}
})();