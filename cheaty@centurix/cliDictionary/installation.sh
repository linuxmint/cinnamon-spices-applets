#!/bin/bash

#Set installation dirs 

zDictScriptDir=~/bin
zDictCompletionDir=/etc/bash_completion.d

cp dictionary $zDictScriptDir 
cp dictionary_autocomplete $zDictCompletionDir

. "$zDictScriptDir/dictionary"
. "$zDictCompletionDir/dictionary_autocomplete" 

#Add sourcing to bashrc if you like to use it
