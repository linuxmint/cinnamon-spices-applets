#!/bin/bash

# TABLE HEADER
function create_table_header {
_Spices=$1
_languageNAME=$2
_languageID=$3
_numberOfTranslatableSpices=$4
_file=$5
cat > $_file << EOL
<h1>Translatable templates</h1>
<p>
  <a href="../README.md">$_Spices</a> &#187; <b>$_languageNAME ($_languageID)</b>
  </br><b><sub>1 &#8594; $_numberOfTranslatableSpices templates</sub></b>
</p>

<table>
  <thead>
    <tr>
      <th>
        <a href="#" id="uuid">UUID</a>
      </th>
      <th>
        <a href="#" id="length">Length</a>
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
_spicesStatusREADME=$1
_spicesUUID=$2
_translatableLength=$3
_printLength=$4
_progress=$5
_untranslated=$6
_printUntranslated=$7
_file=$8
cat >> $_file << EOL
    <tr>
      <td class="uuid" data-value="$_spicesUUID">
        <a href="$_spicesStatusREADME">$_spicesUUID</a>
      </td>
      <td class="length" data-value="$_translatableLength">
        $_printLength
      </td>
      <td class="status" data-value="$_progress">
        <img src="http://progressed.io/bar/$_progress" alt="$_progress%" />
      </td>
      <td class="untranslated" data-value="$_untranslated">
        $_printUntranslated
      </td>
    </tr>
EOL
}

# TABLE OVERALL
function create_overall_entry {
_lastUpdateDate=$(date -u +"%Y-%m-%d, %H:%M UTC")
_overall=$1
_translatableSum=$2
_progress=$3
_untranslatedSum=$4
_file=$5
cat >> $_file << EOL
  </tbody>
  <tfoot>
    <tr>
      <td class="uuid" data-overall="$_overall">
        <b>$_overall</b>
      </td>
      <td class="length" data-overall="$_translatableSum">
        <b>$_translatableSum</b>
      </td>
      <td class="status" data-overall="$_progress">
        <img src="http://progressed.io/bar/$_progress" alt="$_progress%" />
      </td>
      <td class="untranslated" data-overall="$_untranslatedSum">
        <b>$_untranslatedSum</b>
      </td>
    </tr>
  </tfoot>
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

# check if spices-status directory exists
if [ ! -d $spices-status ]; then
    echo "" >> ScriptPROBLEMS.txt
    echo "Execute $spices-status.sh first" >> ScriptPROBLEMS.txt
    exit
fi

# directory where to store the language stati
languageStatusDir=language-status
mkdir -p $languageStatusDir

# load UUIDs of translatable spices in tmp file
spicesStatusDir=$spices-status
TMPuuidOfTranslatableSpices=uuid-of-translatable-$spices.tmp
ls $spicesStatusDir > $TMPuuidOfTranslatableSpices

# get number of translatable templates
numberOfTranslatableSpices=$(ls $spicesStatusDir | wc -l)

# filename where the translation status of spices is stored
spicesStatusREADME=README.md

# known language IDs and language names
knownLanguageIDs=status-scripts/Language-IDs.txt

echo "Create translation status for:"
while read languageIDName
do

    languageID=$(echo $languageIDName | cut -f1 -d ':')
    languageNAME=$(echo $languageIDName | cut -f2 -d ':')

    echo "...$languageNAME ($languageID)"

    # create table HEADER for each language
    create_table_header "$Spices" "$languageNAME" "$languageID" "$numberOfTranslatableSpices" $languageStatusDir/$languageID.md

    untranslatedSum=0
    translatableSum=0
    while read spicesUUID
    do
        # look in spicesStatusREADME file for number of untranslated Strings
        untranslated=$(grep -A5 "$languageID.po" $spicesStatusDir/$spicesUUID/$spicesStatusREADME | grep -o "\"untranslated\" data-value.*" | cut -d "\"" -f 4)

        # count number of translatable Strings
        translatableLength=$(grep "^msgid " $spicesStatusDir/$spicesUUID/po/*.pot | wc -l)
        translatableLength=$[$translatableLength-1]
        translatableSum=$[$translatableSum+$translatableLength]

        # if language does not exists in spicesStatusREADME, it is not translated at all
        if [ "$untranslated" == "" ]; then
            untranslated=$translatableLength
        fi

        # Sum of untranslated Strings
        untranslatedSum=$[$untranslatedSum + $untranslated]

        # calculate percentage translated
        percentageTranslated=`echo "scale=2; ($translatableLength - $untranslated) * 100 / $translatableLength" | bc`
        percentageTranslated=$(python -c "zahl=round($percentageTranslated); print zahl" | cut -f1 -d '.')

        # link length to po file if exists
        poFile=$spicesStatusDir/$spicesUUID/po/$languageID.po
        if [ -f $poFile ]; then
            printLength="<a href=\"../$poFile\">$translatableLength</a>"
        else
            printLength="$translatableLength"
        fi

        # link untranslated to untranslated-po file if exists
        poUntranslatedFile=$spicesStatusDir/$spicesUUID/untranslated-po/$languageID.md
        if [ -f $poUntranslatedFile ]; then
            printUntranslated="<a href=\"../$poUntranslatedFile\">$untranslated</a>"
        else
            printUntranslated="$untranslated"
        fi

        # write calculated infos in markdown table
        create_table_entry "../$spicesStatusDir/$spicesUUID/$spicesStatusREADME" "$spicesUUID" "$translatableLength" "$printLength" "$percentageTranslated" "$untranslated" "$printUntranslated" $languageStatusDir/$languageID.md
    done < $TMPuuidOfTranslatableSpices

    # calculate percentage translated
    percentageTranslatedSum=`echo "scale=2; ($translatableSum - $untranslatedSum) * 100 / $translatableSum" | bc`
    percentageTranslatedSum=$(python -c "zahl=round($percentageTranslatedSum); print zahl" | cut -f1 -d '.')

    # Overall Statistics and closing table
    create_overall_entry "Overall statistics:" "$translatableSum" "$percentageTranslatedSum" "$untranslatedSum" $languageStatusDir/$languageID.md

done < $knownLanguageIDs


rm $TMPuuidOfTranslatableSpices