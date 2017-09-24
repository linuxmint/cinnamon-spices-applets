#!/bin/bash

# TABLE HEADER
function create_table_header {
_Spices=$1
_README=$2
cat > $_README << EOL
<h1>Translation status by language</h1>
<p><b>$_Spices</b></p>

<table>
  <thead>
    <tr>
      <th>
        <a href="#" id="language">Language</a>
      </th>
      <th>
        <a href="#" id="languageid">ID</a>
      </th>
      <th>
        <a href="#" id="status">Status</a>
      </th>
      <th>
        <a href="#" id="untranslated">Untranslated</a>
      </th>
    </tr>
  </thead>
  <tbody>
EOL
}

# TABLE ENTRY
function create_table_entry {
_languageNAME=$1
_languageID=$2
_progress=$3
_untranslated=$4
_README=$5
cat >> $_README << EOL
    <tr>
      <td class="language" data-value="$_languageNAME">
        <a href="language-status/$_languageID.md">$_languageNAME</a>
      </td>
      <td class="languageid" data-value="$_languageID">
        $_languageID
      </td>
      <td class="status" data-value="$_progress">
        <img src="http://progressed.io/bar/$_progress" alt="$_progress%" />
      </td>
      <td class="untranslated" data-value="$_untranslated">
        $_untranslated
      </td>
    </tr>
EOL
}

# TABLE CLOSE
function close_table {
_lastUpdateDate=$(date -u +"%Y-%m-%d, %H:%M UTC")
_README=$1
cat >> $_README << EOL
  </tbody>
</table>

<p><sup>This translation status table was last updated on $_lastUpdateDate.</sup></p>
EOL
}

#################### main (script starts here) ####################

cd ..

# Which spices? Get spices name
parentDirName=$(basename -- "$(dirname -- "$(pwd)")")
spices=$(echo "$parentDirName" | cut -f3 -d '-')
Spices=( $spices )
Spices="${Spices[@]^}" # first letter uppercase

# directory where the language stati are stored
languageStatusDir=language-status

# check if language-status directory exists
if [ ! -d $languageStatusDir ]; then
    echo "" >> ScriptPROBLEMS.txt
    echo "Execute language-status.sh first" >> ScriptPROBLEMS.txt
    exit
fi


# known language IDs and language names
knownLanguageIDs=status-scripts/Language-IDs.txt
# sort language IDs by Name and save in a tmp file
TMPsortedLanguageIDs=sorted-Language-IDs.tmp
sort -t\: -k2 $knownLanguageIDs > $TMPsortedLanguageIDs

# file where to store the translation status
README=README.md

# create HEADER of markdown table
create_table_header "$Spices" $README

while read languageIDName
do
    # get known language IDs and names
    languageID=$(echo $languageIDName | cut -f1 -d ':')
    languageNAME=$(echo $languageIDName | cut -f2 -d ':')

    progress=$(grep -A8 "Overall statistics:" $languageStatusDir/$languageID.md | grep -o "\"status\" data-overall.*" | cut -d "\"" -f 4)
    translated=$(grep -A8 "Overall statistics:" $languageStatusDir/$languageID.md | grep -o "\"length\" data-overall.*" | cut -d "\"" -f 4)
    untranslated=$(grep -A8 "Overall statistics:" $languageStatusDir/$languageID.md | grep -o "\"untranslated\" data-overall.*" | cut -d "\"" -f 4)


    if [ $translated != $untranslated ]; then
        create_table_entry "$languageNAME" "$languageID" "$progress" "$untranslated" $README
    fi

done < $TMPsortedLanguageIDs

close_table $README

# remove tmp files
rm $TMPsortedLanguageIDs

echo ""
echo "THE END!"