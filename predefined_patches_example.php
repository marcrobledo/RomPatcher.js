<?php
/*
	this template code should build a valid PREDEFINED_PATCHES object structure for Rom Patcher JS
	it's intended for sites that host multiple patches (like www.romhacking.net)

	note: this has not been tested!
*/


if(isset($_GET["patch"])){
	$patchFile=$_GET["patch"];
	if(isset($_GET["compressed"])){
		$patchFile.="#".$_GET["compressed"];
	}
	if(isset($_GET["name"])){
		$patchName=addslashes($_GET["name"]);
	}else{
		$patchName=$_GET["patch"];
	}
	
	echo "var PREDEFINED_PATCHES=[";
	echo "{patch:'".$patchFile."',name:'".$patchName."'";
	if(isset($_GET["crc"]) && preg_match("/^[0-9a-f]{1,8}$/i", $_GET["crc"])){
		echo ", crc:0x".$_GET["crc"];
	}
	echo "}";
	echo "];";
}
?>
