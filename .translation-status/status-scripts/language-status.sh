#!/bin/bash

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
    # create HEADER in markdown table for each language
    echo "# Translatable templates" > $languageStatusDir/$languageID.md
    echo "[$Spices](../README.md) &#187; **$languageNAME ($languageID)**" >> $languageStatusDir/$languageID.md
    echo "<br><sub>**1 &#8594; $numberOfTranslatableSpices templates**</sub>" >> $languageStatusDir/$languageID.md
    echo "" >> $languageStatusDir/$languageID.md
    echo "$Spices UUID | Length | Status | Untranslated" >> $languageStatusDir/$languageID.md
    echo "------------|:------:|:------:|:-----------:" >> $languageStatusDir/$languageID.md

    untranslatedSum=0
    translatableSum=0
    while read spicesUUID
    do
        # look in spicesStatusREADME file for number of untranslated Strings
        untranslated=$(grep "$languageID.po" $spicesStatusDir/$spicesUUID/$spicesStatusREADME | cut -f4 -d '|' | cut -f2 -d '[' | cut -f1 -d ']')
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
            printLength="[$translatableLength](../$poFile)"
        else
            printLength="$translatableLength"
        fi

        # link untranslated to untranslated-po file if exists
        poUntranslatedFile=$spicesStatusDir/$spicesUUID/untranslated-po/$languageID.md
        if [ -f $poUntranslatedFile ]; then
            printUntranslated="[$untranslated](../$poUntranslatedFile)"
        else
            printUntranslated="$untranslated"
        fi

        # write calculated infos in markdown table
        echo "[$spicesUUID](../$spicesStatusDir/$spicesUUID/$spicesStatusREADME) | $printLength | ![$percentageTranslated%](http://progressed.io/bar/$percentageTranslated) | $printUntranslated" >> $languageStatusDir/$languageID.md
    done < $TMPuuidOfTranslatableSpices

    # calculate percentage translated
    percentageTranslatedSum=`echo "scale=2; ($translatableSum - $untranslatedSum) * 100 / $translatableSum" | bc`
    percentageTranslatedSum=$(python -c "zahl=round($percentageTranslatedSum); print zahl" | cut -f1 -d '.')

    # Overall Statistics at the end of markdown table
    echo "**Overall statistics:** | **$translatableSum** | ![$percentageTranslatedSum%](http://progressed.io/bar/$percentageTranslatedSum) | **$untranslatedSum**" >> $languageStatusDir/$languageID.md

    # 'Last updated' date at the bottom of the table
    lastUpdateDate=$(date -u +"%Y-%m-%d, %H:%M UTC")
    echo "" >> $languageStatusDir/$languageID.md
    echo "<sup>This translation status table was last updated on $lastUpdateDate.</sup>" >> $languageStatusDir/$languageID.md

done < $knownLanguageIDs


rm $TMPuuidOfTranslatableSpices

#echo ""
#echo "THE END: Please press any button!"
#read waiting
