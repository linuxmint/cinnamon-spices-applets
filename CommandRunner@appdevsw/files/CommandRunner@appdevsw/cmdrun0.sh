#!/bin/bash

mod=$(($1 % 2))

#if [ $mod -eq 0 ] ; then
  framecolor="red"
#else
#  framecolor="yellow"
#fi
icon="${2}/icon.png"

msg=" Undefined command"
msglen=${#msg}
mmod=$(($1 % $msglen))
l1=$((msglen-mmod))
txt=${msg:nmod:l1}
txt1=${msg:l1}
txt="$txt.$txt1"

xml=`cat <<EOF
<xml>
  <appsettings>
    <tooltip>CommandRunner
Go to the parameter form and enter the command/script to run</tooltip>
  </appsettings>
  <item>
    <type>box</type>
    <attr>
      <style>border: 1px;border-color:%framecolor;padding: 1px;background-color:brown</style> 
    </attr>    
    <item>
      <type>icon</type>
      <value>%icon</value> 
      <attr>
        <style>icon-size: 0.75em;</style> 
      </attr>
    </item>
    <item>
      <type>text</type>
      <value>%txt</value> 
      <attr>
        <style>font-size: 8pt</style> 
      </attr>
    </item>
    
  </item>
</xml>

EOF
`
xml=${xml/"%framecolor"/$framecolor}
xml=${xml/"%icon"/$icon}
xml=${xml/"%txt"/$txt}

echo "$xml"
