#!/bin/bash

# memory usage monitor. Xml message with a box recursion.
#if swap is not used, an icon is displayed instead of a text

result=`free -m | grep 'Mem\|Swap'`
while read line; do
    if [[ $line == Mem* ]]; then
      total=`echo $line | awk '{print $2}'`
      used=`echo $line | awk '{print $3}'`
      buffers=`echo $line | awk '{print $6}'`
      cache=`echo $line | awk '{print $7}'`
    else
      swapused=`echo $line | awk '{print $3}'`
    fi
done <<< "$result"

realused=`expr $used - $cache - $buffers`
noswapicon="/usr/share/icons/Mint-X/emblems/48/emblem-noread.png";
#noswapicon="system-run";

boxstyle="border: 2px;border-color: red;padding: 1px"
subboxstyle="border: 1px;border-color: green;padding: 1px;"
memlabelstyle="font-size: 6pt;font-weight: bold;text-align: center;color:orange;"
memtextstyle="font-size: 8pt;font-weight: bold;text-align: center;"

#align: start 0, middle 1 , end 2
#fill : 0 or empty - false, 1 or not empty - true
xyfillroot="  <xfill>1</xfill> <yfill>0</yfill> <xalign>1</xalign><yalign>1</yalign>"
xyfillbox="   <xfill>1</xfill> <yfill>1</yfill> <xalign>1</xalign><yalign>1</yalign>"
xyfilllabel=" <xfill>1</xfill> <yfill>1</yfill> <xalign>1</xalign><yalign>1</yalign>"
xyfilltext="  <xfill>1</xfill> <yfill>1</yfill> <xalign>1</xalign><yalign>1</yalign>"



function createItem {
 funxml=`cat <<EOF
  <item>
   <type>$1</type>
   <value>$2</value>
   <attr>
    <style>$3</style>
    $4
   </attr>
  </item>
EOF
`
echo "$funxml"
}



function createSubbox {
funxml=`cat <<EOF
<item>
  <type>box</type>
  
  <attr>
   <style>$subboxstyle</style>
   <vertical>X</vertical>
   $xyfillbox"
  </attr>
EOF
`

funxml="$funxml$1"
funxml="$funxml$2"
funxml="$funxml</item>"

echo "$funxml"
}

xmlbox1label=$(createItem "text" "Mem"       "$memlabelstyle" "$xyfilllabel" )
xmlbox1text=$(createItem  "text" "$used"     "$memtextstyle"  "$xyfilltext"  )

xmlbox2label=$(createItem "text" "Mem-BC"    "$memlabelstyle" "$xyfilllabel" )
xmlbox2text=$(createItem  "text" "$realused" "$memtextstyle"  "$xyfilltext"  )

#if swap is not used, an icon is displayed instead of a text
xmlbox3label=$(createItem "text" "Swap"      "$memlabelstyle" "$xyfilllabel" )
if [[  "$swapused" == "0" ]]; then
xmlbox3text=$(createItem  "icon" "$noswapicon" "icon-size: 0.30em;" "$xyfilltext" )
else
xmlbox3text=$(createItem  "text" "$swapused" "$memtextstyle" "$xyfilltext" )
fi


xmlbox1=$(createSubbox "$xmlbox1label"    "$xmlbox1text")
xmlbox2=$(createSubbox "$xmlbox2label"    "$xmlbox2text")
xmlbox3=$(createSubbox "$xmlbox3label"    "$xmlbox3text")


xml=`cat <<EOF
<xml>
 <appsettings>
  <tooltip>Memory usage</tooltip>
  <clickaction>gnome-system-monitor</clickaction>
 </appsettings>

 <item>
  <type>box</type>
  <attr>
   <style>$boxstyle</style>
   <vertical></vertical>
   $xyfillroot"
  </attr>
  $xmlbox1
  $xmlbox2
  $xmlbox3
 </item>
</xml>
EOF
`

echo $xml