#!/bin/bash

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



##### variable to store UNKOWN language IDs
#unknownLanguageIDs=""

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
    echo "# Translation status" > $README
    echo "[$Spices](../../README.md) &#187; **$spicesUUID**" >> $README
    echo "" >> $README
    echo "Language | ID.po | Status | Untranslated" >> $README
    echo "---------|:--:|:------:|:-----------:" >> $README
    numberOfLinesInHEADER=$(wc -l README.md | cut -f1 -d " ")

    echo "Updating $spicesUUID.........."

    # fill table with translations status infos
    while read languagePoFile
    do
        # update po file from pot file
        msgmerge --silent --no-fuzzy-matching --update --backup=off po/$languagePoFile po/*.pot

        # remove fuzzy Strings (i.e. count fuzzy translated strings as untranslated) (NOTE: fails in LM <= 17.3)
        #!msgattrib --clear-fuzzy --empty po/$languagePoFile -o $unfuzzyPO/$languagePoFile

        # extract untranslated Strings
        if [ "$(ls -A $unfuzzyPO)" ]; then # check if last command failed, i.e. if $unfuzzyPO is empty
            msgattrib --untranslated $unfuzzyPO/$languagePoFile -o $untranslatedPO/$languagePoFile
        else # this is a backup if this script is used with LM <= 17.3 (fuzzy strings count as translated)
            msgattrib --untranslated po/$languagePoFile -o $untranslatedPO/$languagePoFile
        fi

        # get language name from ID
        languageID=$(echo $languagePoFile | cut -f1 -d '.')
        languageNAME=$(grep "$languageID:" ../../$knownLanguageIDs | cut -f2 -d ':')

        ##### Check for UNKOWN language IDs
        if [ "$languageNAME" == "" ]
        then
            languageNAME="UNKNOWN"
            unknownLanguageIDs="$unknownLanguageIDs"$'\n'"$spicesUUID: $languageID"
        fi

        # if no untranslated String exist
        if [ ! -f $untranslatedPO/$languagePoFile ]; then
            echo "[$languageNAME](../../language-status/$languageID.md) | [$languageID.po](po/$languageID.po) | ![100%](http://progressed.io/bar/100) | 0" >> $README
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
            echo "[$languageNAME](../../language-status/$languageID.md) | [$languageID.po](po/$languageID.po) | ![$percentage%](http://progressed.io/bar/$percentage) | [$untranslatedNumber]($untranslatedPO/$languageID.md)" >> $README
        fi
    done < $TMPpoFiles


    # sort README but not the HEADER of the README
    numberOfLinesInHEADERplus1=$[$numberOfLinesInHEADER+1]
    (head -n $numberOfLinesInHEADER $README && tail -n +$numberOfLinesInHEADERplus1 $README | sort) > $READMEtmp
    mv $READMEtmp $README

    # add 'last edited' date
    lastUpdateDate=$(date -u +"%Y-%m-%d, %H:%M UTC")
    echo "" >> $README
    echo "<sup>This translation status table was last updated on $lastUpdateDate.</sup>" >> $README

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

#echo ""
#echo "THE END: Please press any button!"
#read waiting
