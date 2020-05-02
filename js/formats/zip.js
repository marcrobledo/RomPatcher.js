/* ZIP module for Rom Patcher JS v20190531 - Marc Robledo 2016-2019 - http://www.marcrobledo.com/license */
const ZIP_MAGIC='\x50\x4b\x03\x04';

function parseZIPFile(zipFile, unzipEntryName){
	var regex=(zipFile===patchFile)? /\.(ips|ups|bps|aps|rup|ppf|xdelta)$/i : /\.(\w+)$/i;
	setMessage('apply', _('unzipping'), 'loading');

	var arrayBuffer=zipFile._u8array.buffer;
	zip.createReader(
		new zip.BlobReader(new Blob([arrayBuffer])),
		function(zipReader){
			zipReader.getEntries(function(zipEntries){
				var zippedFiles=[];
				for(var i=0; i<zipEntries.length; i++){
					if(typeof unzipEntryName==='string' && unzipEntryName === zipEntries[i].filename){
						zippedFiles=[zipEntries[i]];
						break;
					}else if(regex.test(zipEntries[i].filename)){
						zippedFiles.push(zipEntries[i]);
					}
				}

				if(zippedFiles.length>1){
					var zipOverlay=document.createElement('div');
					zipOverlay.className='zip-overlay';
					var zipDialog=document.createElement('div');
					zipDialog.className='zip-dialog';
					var zipList=document.createElement('ul');
					zipList.className='zipped-files'
					for(var i=0; i<zippedFiles.length; i++){
						var li=document.createElement('li');
						li.zipEntry=zippedFiles[i];
						li.zipEntry.originalZipFile=zipFile;
						li.innerHTML=zippedFiles[i].filename;
						addEvent(li, 'click', _evtClickZipEntry);
						zipList.appendChild(li);
					}
					zipDialog.innerHTML=_('patch_file');
					zipDialog.appendChild(zipList);
					zipOverlay.appendChild(zipDialog);
					document.body.appendChild(zipOverlay);
				}else if(zippedFiles.length===1){
					zippedFiles[0].originalZipFile=zipFile;
					unzipEntry(zippedFiles[0]);
				}else{
					if(zipFile===romFile){
						romFile=null;
					}else{
						patchFile=null;
					}
				}
				setTabApplyEnabled(true);
			});
		},
		function(zipReader){
			setTabApplyEnabled(true);
			setMessage('apply', _('error_unzipping'), 'error');
		}
	);
}

function unzipEntry(zipEntry){
	zipEntry.getData(new zip.BlobWriter(), function(blob){
		var fileReader=new FileReader();
		fileReader.onload=function(){
			var unzippedFile=new MarcFile(this.result);
			unzippedFile.fileName=zipEntry.filename;
			if(zipEntry.originalZipFile===romFile){
				romFile=unzippedFile;
				_parseROM();
			}else if(zipEntry.originalZipFile===patchFile){
				patchFile=unzippedFile;
				_readPatchFile();
			}
		};
		fileReader.readAsArrayBuffer(blob);
	});
}

function _evtClickZipEntry(evt){
	document.body.removeChild(this.parentElement.parentElement.parentElement);
	unzipEntry(this.zipEntry);
}