#!/bin/bash

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
echo "# Translation status by language" > $README
echo "**$Spices**" >> $README
echo "" >> $README
echo "Language | ID | Status | Untranslated" >> $README
echo "---------|:--:|:------:|:-----------:" >> $README

while read languageIDName
do
    # get known language IDs and names
    languageID=$(echo $languageIDName | cut -f1 -d ':')
    languageNAME=$(echo $languageIDName | cut -f2 -d ':')

    languageStatistic=$(grep "Overall statistics:" $languageStatusDir/$languageID.md)
    # remove stars *
    languageStatistic=$(echo "${languageStatistic//\*}")
    percentageAndUntranslatedStatistic=$(echo "$languageStatistic" | cut -f3,4 -d '|')

    # do not show languages, which haven't been translated at all
    translatedNumber=$(echo "$languageStatistic" | cut -f2 -d '|')
    untranslatedNumber=$(echo "$languageStatistic" | cut -f4 -d '|')

    if [ $translatedNumber != $untranslatedNumber ]; then
        echo "[$languageNAME]($languageStatusDir/$languageID.md) | $languageID | $percentageAndUntranslatedStatistic" >> $README
    fi

done < $TMPsortedLanguageIDs

# add 'last edited' date
lastUpdateDate=$(date -u +"%Y-%m-%d, %H:%M UTC")
echo "" >> $README
echo "<sup>This translation status table was last updated on $lastUpdateDate.</sup>" >> $README

# remove tmp files
rm $TMPsortedLanguageIDs

echo ""
echo "THE END!"
#read waiting
