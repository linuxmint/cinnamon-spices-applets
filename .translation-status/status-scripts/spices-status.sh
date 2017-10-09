#!/bin/bash

# TABLE HEADER
function create_table_header {
_Spices=$1
_spicesUUID=$2
_README=$3
cat > $_README << EOL
<h1>Translation status</h1>
<p><a href="../../README.md">$_Spices</a> &#187; <b>$_spicesUUID</b></p>

<table>
  <thead>
    <tr>
      <th>
        <a href="#" id="language">Language</a>
      </th>
      <th>
        <a href="#" id="idpo">ID.po</a>
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
_untranslatedNumber=$4
_README=$5
cat >> $_README << EOL
    <tr>
      <td class="language" data-value="$_languageNAME">
        <a href="../../language-status/$_languageID.md">$_languageNAME</a>
      </td>
      <td class="idpo" data-value="$_languageID">
        <a href="po/$_languageID.po">$_languageID.po</a>
      </td>
      <td class="status" data-value="$_progress">
        <img src="http://progressed.io/bar/$_progress" alt="$_progress%" />
      </td>
EOL
if [ $_untranslatedNumber == "0" ]; then
cat >> $_README << EOL
      <td class="untranslated" data-value="0">
        0
      </td>
    </tr>
EOL
else
cat >> $_README << EOL
      <td class="untranslated" data-value="$_untranslatedNumber">
        <a href="untranslated-po/$_languageID.md">$_untranslatedNumber</a>
      </td>
    </tr>
EOL
fi
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

# known language IDs and language names
knownLanguageIDs=status-scripts/Language-IDs.txt

# (Current) Directory, where the translations stati are stored
transStatusDir=${PWD##*/}

# create directory for spices status
spicesStatusDir=$spices-status
mkdir -p $spicesStatusDir
spicesStatusDir=$transStatusDir/$spicesStatusDir

# Directories for temporary files
TMPpoDirectories=po-directories.tmp
TMPuuidOfTranslatableSpices=uuid-of-translatable-$spices.tmp
TMPpoFiles=po-files.tmp

# Markdown file, where the table with the translation status is stored
README=README.md
READMEtmp=README.tmp

# go to parent directory
cd ..

# create a list of all translatable spicess
find . -not -path "./$spicesStatusDir*" -type d -name "po" | sort | cut -f2 -d '/' > $spicesStatusDir/$TMPuuidOfTranslatableSpices
# and a list with paths to those po directories
find . -not -path "./$spicesStatusDir*" -type d -name "po" | sort > $spicesStatusDir/$TMPpoDirectories

# create directories for every translatable spices in $spicesStatusDir and copy .po and .pot files to these directories
while read -r poDirs && read -r spicesUUID <&3;
do
    #echo -e "$poDirs -> $spicesUUID"
    mkdir -p $spicesStatusDir/$spicesUUID/po
    cp $poDirs/*.pot $spicesStatusDir/$spicesUUID/po
    cp $poDirs/*.po $spicesStatusDir/$spicesUUID/po
done < $spicesStatusDir/$TMPpoDirectories 3<$spicesStatusDir/$TMPuuidOfTranslatableSpices


# create README file with translation status table for every spices
cd $spicesStatusDir

while read spicesUUID
do
    # create list with languageIDs, to which this spices was already translated to
    cd $spicesUUID
    find ./po -type f -name "*.po" | sort | cut -f3 -d '/' > $TMPpoFiles

    # create folder for untranslated Strings
    untranslatedPO=untranslated-po
    mkdir -p $untranslatedPO

    # create folder for unfuzzy Strings
    unfuzzyPO=unfuzzy-po
    mkdir -p $unfuzzyPO

    # create HEADER in README file: title and markdown table
    create_table_header "$Spices" "$spicesUUID" $README

    echo "Updating $spicesUUID.........."

    # fill table with translations status infos
    while read languagePoFile
    do
        # update po file from pot file
        msgmerge --silent --no-fuzzy-matching --update --backup=off po/$languagePoFile po/*.pot

        # remove fuzzy Strings (i.e. count fuzzy translated strings as untranslated) (NOTE: fails in LM <= 17.3)
        msgattrib --clear-fuzzy --empty po/$languagePoFile -o $unfuzzyPO/$languagePoFile

        # extract untranslated Strings
        msgattrib --untranslated $unfuzzyPO/$languagePoFile -o $untranslatedPO/$languagePoFile

        # get language name from ID
        languageID=$(echo $languagePoFile | cut -f1 -d '.')
        languageNAME=$(grep "$languageID:" ../../$knownLanguageIDs | cut -f2 -d ':')

        ##### Check for UNKNOWN language IDs
        if [ "$languageNAME" == "" ]
        then
            languageNAME="UNKNOWN"
            unknownLanguageIDs="$unknownLanguageIDs"$'\n'"$spicesUUID: $languageID"
        fi

        # if no untranslated String exist
        if [ ! -f $untranslatedPO/$languagePoFile ]; then
            create_table_entry "$languageNAME" "$languageID" "100" "0" $README
        else
            # count untranslated Strings
            untranslatedNumber=$(grep "^msgid " $untranslatedPO/$languagePoFile | wc -l)
            untranslatedNumber=$[$untranslatedNumber-1]
            # count translated String
            translatedNumber=$(grep "^msgid " po/$languagePoFile | wc -l)
            translatedNumber=$[$translatedNumber-1]
            # calculate percentage
            percentage=`echo "scale=2; ($translatedNumber - $untranslatedNumber) * 100 / $translatedNumber" | bc`
            percentage=$(python -c "zahl=round($percentage); print zahl" | cut -f1 -d '.')
            # fill table with calculated infos
            create_table_entry "$languageNAME" "$languageID" "$percentage" "$untranslatedNumber" $README
        fi
    done < $TMPpoFiles

    close_table $README

    # remove tmp files and directories
    rm -r $unfuzzyPO
    rm *.tmp

    cd ..
done < $TMPuuidOfTranslatableSpices

##### print UNKNOWN language IDs
echo ""
if [ "$unknownLanguageIDs" == "" ]
then
    echo "UNKNOWN Language IDs: NONE"
else
    echo "UNKNOWN Language IDs: $unknownLanguageIDs"
    echo ""
    echo "UNKNOWN Language IDs: $unknownLanguageIDs" > ../UNKNOWN-Language-IDs.txt
fi

# remove tmp files
rm *.tmp