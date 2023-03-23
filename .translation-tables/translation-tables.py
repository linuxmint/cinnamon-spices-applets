#!/usr/bin/python3
"""
This script copies the translation files (`.po`) to `./translation-tables/po` and updates them
against the corresponding translation template (`.pot`) via msgmerge and gets the untranslated
strings via msgattrib.

Translation infos are stored in a matrix (dictionary):

                        | length | fr | es | zh_CN | ...
force-quit@cinnamon.org |      3 |  3 |  3 |     0 | ...
weather@mockturtl       |    109 |  4 | 12 |     0 | ...
sticky@scollins         |     46 | 46 |  1 |     0 | ...
.......

where length means the number of translatable strings in the `.pot` file and the other entries are
the number of untranslated strings in the locale `.po` file.

The information in the matrix is used to generate 3 types of translation status tables:
1. README.md
2. UUID.md
3. LOCALE.md
which are stored in `./translation-tables/tables`.
"""

import os
import collections
import shutil
import urllib.parse
import sys

REPO_FOLDER = os.path.realpath(os.path.abspath(os.path.join(
    os.path.normpath(os.path.join(os.getcwd(), *([".."] * 1))))))
REPO_NAME = os.path.basename(REPO_FOLDER)
SPICES_TYPE = REPO_NAME.split('-')[-1]
SPICES_REPO_URL = "https://github.com/linuxmint/cinnamon-spices-" + SPICES_TYPE + "/blob/master/"
SPICES_TYPE = SPICES_TYPE.title()


def terminal_progressbar_update(count, total):
    """ Show progressbar in terminal: https://gist.github.com/vladignatyev/06860ec2040cb497f0f3 """
    bar_len = 60
    filled_len = int(round(bar_len * count / float(total)))

    percents = round(100.0 * count / float(total), 1)
    terminal_bar = '=' * filled_len + ' ' * (bar_len - filled_len)

    if count != total:
        sys.stdout.write('[%s] %s%s\r' % (terminal_bar, percents, '%'))
        sys.stdout.flush()
    else:
        sys.stdout.write('[%s] %s%s\n' % (terminal_bar, percents, '%'))
        sys.stdout.flush()

def get_table_head(class2name):
    """ Opens HTML table tag, adds table head and opens table body tag. """
    table_head = '<table>\n'
    table_head += '  <thead>\n'
    table_head += '    <tr>\n'
    for class_id in class2name:
        table_head += '      <th>\n'
        table_head += '        <a href="#" id="' + class_id + '">' + class2name[class_id] + '</a>\n'
        table_head += '      </th>\n'
    table_head += '    </tr>\n'
    table_head += '  </thead>\n'
    table_head += '  <tbody>\n'
    return table_head

def get_table_content(class2value):
    """ Creates a HTML table row. """
    table_content = '    <tr>\n'
    for class_id in class2value:
        table_content += ('      <td class="' + class_id
                          + '" data-value="' + class2value[class_id][0] + '">\n')
        table_content += '        ' + class2value[class_id][1] + '\n'
        table_content += '      </td>\n'
    table_content += '    </tr>\n'
    return table_content

def get_table_body_close():
    """ Closes HTML body tag. """
    table_body_ending = '  </tbody>\n'
    return table_body_ending

def get_table_close():
    """ Closes HTML table tag. """
    table_ending = '</table>\n\n'
    return table_ending

def str2html_href(link, text):
    """ Creates a HTML code snippet with href link. """
    return '<a href="' + link + '">' + text + '</a>'

def value2html_progress_image(percentage):
    """ Creates a HTML code snippet, which links to a progress bar image to a given percentage. """
    return '<img src="https://progress-bar.dev/' + percentage + '" alt="' + percentage + '%" />'

def progress(untranslated, translated):
    """ Calculates percentage for translation progress. """
    return str(int(round(100 * float(translated - untranslated)/float(translated))))


def populate_id2name():
    """ Reads LINGUAS file and creates an array locale_id->country_name."""
    with open(os.path.join(REPO_FOLDER, ".translation-tables", "LINGUAS"), "r") as linguas_file:
        for linguas_id_line in linguas_file:
            lang_id = linguas_id_line.split(':')[0]
            lang_name = linguas_id_line.split(':')[1].rstrip()
            ID2NAME[lang_id] = lang_name

def check_hidden_dirs():
    """
    Creates hidden dirs `po` and `tables` if they don't exist,
    else removes deleted spices in those dirs.
    """

    if not os.path.isdir(TABLES_DIR):
        os.makedirs(TABLES_DIR)

    #% remove tables for deleted spices
    if os.path.isdir(HIDDEN_PO_DIR):
        for uuid in os.listdir(HIDDEN_PO_DIR):
            if not os.path.isdir(os.path.join(REPO_FOLDER, uuid)):
                shutil.rmtree(os.path.join(HIDDEN_PO_DIR, uuid))
                if os.path.isfile(os.path.join(TABLES_DIR, uuid + '.md')):
                    os.remove(os.path.join(TABLES_DIR, uuid + '.md'))
    else:
        os.makedirs(HIDDEN_PO_DIR)

def populate_translation_matrix():
    """ POPULATE TRANSLATION MATRIX """

    #% Progressbar for Terminal
    prog_total = len([uuid for uuid in os.listdir(REPO_FOLDER)])
    prog_iter = 0

    #% for UUID
    for uuid in os.listdir(REPO_FOLDER):
        #% show progressbar in terminal
        if len(sys.argv) != 2 or sys.argv[1] != "--quiet":
            prog_iter += 1
            terminal_progressbar_update(prog_iter, prog_total)

        #% ignore files and hidden dirs
        if uuid.startswith('.') or not os.path.isdir(os.path.join(REPO_FOLDER, uuid)):
            continue

        #% ignore spices without po dir
        spices_po_dir = os.path.join(REPO_FOLDER, uuid, "files", uuid, "po")
        if not os.path.isdir(spices_po_dir):
            continue

        #% get pot file directory
        pot_file_path = None
        for file in os.listdir(spices_po_dir):
            if file.endswith(".pot"):
                pot_file_path = os.path.join(spices_po_dir, file)

        if pot_file_path == None:
            print("No potfile found for %s, skipping it." % uuid)
            continue

        #% count number of translatable Strings in pot file
        pot_length = int(os.popen('grep "^msgid " ' + pot_file_path + ' | wc -l').read()) - 1
        TRANSLATION_UUID_MATRIX[uuid]["length"] = pot_length
        TRANSLATION_LANG_MATRIX["length"][uuid] = pot_length
        #% init translation matrix
        for known_id in ID2NAME:
            TRANSLATION_UUID_MATRIX[uuid][known_id] = pot_length
            TRANSLATION_LANG_MATRIX[known_id][uuid] = pot_length

        #% # create uuid dir in HIDDEN_PO_DIR
        updated_spices_po_dir = os.path.join(HIDDEN_PO_DIR, uuid)
        try:
            os.makedirs(updated_spices_po_dir)
        except OSError:
            pass
        #% # creating po files in hidden po dir
        for po_file in os.listdir(spices_po_dir):
            if po_file.endswith('.po'):
                current_id = po_file.split('.')[0]
                if current_id in ID2NAME:
                    po_file_path = os.path.join(spices_po_dir, po_file)
                    updated_po_file_path = os.path.join(updated_spices_po_dir, po_file)
                    untranslated_po_file_path = os.path.join(updated_spices_po_dir, '_' + po_file)
                    try:
                        os.remove(untranslated_po_file_path)
                    except OSError:
                        pass
                    #% copy po files to HIDDEN_PO_DIR
                    shutil.copyfile(po_file_path, updated_po_file_path)
                    #% update po from pot
                    os.system('msgmerge --silent --update --backup=none ' + updated_po_file_path
                              + ' ' + pot_file_path)
                    # remove fuzzy and extract untranslated
                    os.system('msgattrib --clear-fuzzy --empty ' + updated_po_file_path
                              + ' | msgattrib --untranslated --output-file='
                              + untranslated_po_file_path)

                    #% if no untranslated exist
                    if not os.path.exists(untranslated_po_file_path):
                        TRANSLATION_UUID_MATRIX[uuid][current_id] = 0
                        TRANSLATION_LANG_MATRIX[current_id][uuid] = 0
                    else:
                        # count untranslated Strings
                        untranslated_length = int(os.popen('grep "^msgid " '
                                                           + untranslated_po_file_path
                                                           + ' | wc -l').read()) - 1
                        TRANSLATION_UUID_MATRIX[uuid][current_id] = untranslated_length
                        TRANSLATION_LANG_MATRIX[current_id][uuid] = untranslated_length

                else:
                    print("Unknown locale: " + uuid + "/po/" + po_file)


def create_uuid_tables():
    """ CREATE UUID.md TRANSLATION TABLES """
    #% TABLE: UUID.md
    for uuid in TRANSLATION_LANG_MATRIX["length"]:
        with open(os.path.join(TABLES_DIR, uuid + '.md'), "w") as uuid_table_file:
            #% TABLE HEAD
            thead_class2name = collections.OrderedDict()
            thead_class2name["language"] = "Language"
            thead_class2name["idpo"] = "ID.po"
            thead_class2name["status"] = "Status"
            thead_class2name["untranslated"] = "Untranslated"
            uuid_table_file.write(get_table_head(thead_class2name))

            uuid_pot_length = TRANSLATION_UUID_MATRIX[uuid]["length"]
            for locale in sorted(ID2NAME):
                if not os.path.isfile(os.path.join(HIDDEN_PO_DIR, uuid, locale + '.po')):
                    continue
                # TABLE CONTENT
                tdata_class2value = collections.OrderedDict()

                tdata_value = ID2NAME[locale]
                tdata_content = str2html_href(locale + '.md', tdata_value)
                tdata_class2value["language"] = [tdata_value, tdata_content]

                tdata_value = locale
                github_po_link = (SPICES_REPO_URL + urllib.parse.quote(uuid) + '/files/'
                                  + urllib.parse.quote(uuid) + '/po/' + locale + '.po')
                tdata_content = str2html_href(github_po_link, tdata_value + '.po')
                tdata_class2value["idpo"] = [tdata_value, tdata_content]

                untranslated_length = TRANSLATION_UUID_MATRIX[uuid][locale]
                tdata_value = progress(untranslated_length, uuid_pot_length)
                tdata_content = value2html_progress_image(tdata_value)
                tdata_class2value["status"] = [tdata_value, tdata_content]

                tdata_value = str(untranslated_length)
                if tdata_value == "0":
                    tdata_content = tdata_value
                else:
                    tdata_content = str2html_href('../po/' + uuid + '/_' + locale + '.po',
                                                  tdata_value)
                tdata_class2value["untranslated"] = [tdata_value, tdata_content]

                uuid_table_file.write(get_table_content(tdata_class2value))

            uuid_table_file.write(get_table_body_close())
            uuid_table_file.write(get_table_close())
        uuid_table_file.close()


def create_readme_locale_tables():
    """ CREATE README.md AND LOCALE.md TRANSLATION TABLES """
    #% README TABLE: README.md
    with open(os.path.join(TABLES_DIR, 'README.md'), "w") as language_table_file:
        #% README TABLE HEAD
        reamde_thead_class2name = collections.OrderedDict()
        reamde_thead_class2name["language"] = "Language"
        reamde_thead_class2name["localeid"] = "ID"
        reamde_thead_class2name["status"] = "Status"
        reamde_thead_class2name["untranslated"] = "Untranslated"
        language_table_file.write(get_table_head(reamde_thead_class2name))

        #% LOCALE TABLE: LOCALE.md
        for locale in sorted(ID2NAME):
            length_sum = 0
            untranslated_sum = 0
            locale_table_file_path = os.path.join(TABLES_DIR, locale + '.md')
            with open(locale_table_file_path, "w") as locale_table_file:
                #% LOCALE TABLE HEAD
                thead_class2name = collections.OrderedDict()
                thead_class2name["uuid"] = "UUID"
                thead_class2name["length"] = "Length"
                thead_class2name["status"] = "Status"
                thead_class2name["untranslated"] = "Untranslated"
                locale_table_file.write(get_table_head(thead_class2name))
                for uuid in sorted(TRANSLATION_LANG_MATRIX[locale]):
                    # LOCALE TABLE CONTENT
                    tdata_class2value = collections.OrderedDict()

                    uuid_pot_length = TRANSLATION_UUID_MATRIX[uuid]["length"]
                    length_sum += uuid_pot_length
                    untranslated_length = TRANSLATION_UUID_MATRIX[uuid][locale]
                    untranslated_sum += untranslated_length


                    tdata_value = uuid
                    tdata_content = str2html_href(uuid + '.md', tdata_value)
                    tdata_class2value["uuid"] = [tdata_value, tdata_content]

                    tdata_value = str(uuid_pot_length)
                    if untranslated_length == uuid_pot_length:
                        tdata_content = tdata_value
                    else:
                        github_po_link = (SPICES_REPO_URL + urllib.parse.quote(uuid) + '/files/'
                                          + urllib.parse.quote(uuid) + '/po/' + locale + '.po')
                        tdata_content = str2html_href(github_po_link, tdata_value)
                    tdata_class2value["length"] = [tdata_value, tdata_content]

                    tdata_value = progress(untranslated_length, uuid_pot_length)
                    tdata_content = value2html_progress_image(tdata_value)
                    tdata_class2value["status"] = [tdata_value, tdata_content]

                    tdata_value = str(untranslated_length)
                    if untranslated_length == 0 or untranslated_length == uuid_pot_length:
                        tdata_content = tdata_value
                    else:
                        tdata_content = str2html_href('../po/' + uuid + '/_' + locale + '.po',
                                                      tdata_value)
                    tdata_class2value["untranslated"] = [tdata_value, tdata_content]

                    locale_table_file.write(get_table_content(tdata_class2value))

                # README TABLE CONTENT
                readme_tdata_class2value = collections.OrderedDict()

                readme_tdata_value = ID2NAME[locale]
                readme_tdata_cont = str2html_href(locale + '.md', readme_tdata_value)
                readme_tdata_class2value["language"] = [readme_tdata_value, readme_tdata_cont]

                readme_tdata_value = locale
                readme_tdata_cont = readme_tdata_value
                readme_tdata_class2value["localeid"] = [readme_tdata_value, readme_tdata_cont]

                # LOCALE TABLE FOOT
                locale_table_file.write('  <tfoot>\n')

                tdata_value = 'Overall statistics:'
                tdata_content = '<b>' + tdata_value + '</b>'
                tdata_class2value["uuid"] = [tdata_value, tdata_content]

                tdata_value = str(length_sum)
                tdata_content = '<b>' + tdata_value + '</b>'
                tdata_class2value["length"] = [tdata_value, tdata_content]

                tdata_value = progress(untranslated_sum, length_sum)
                tdata_content = value2html_progress_image(tdata_value)
                tdata_class2value["status"] = [tdata_value, tdata_content]
                readme_tdata_class2value["status"] = [tdata_value, tdata_content]

                tdata_value = str(untranslated_sum)
                tdata_content = '<b>' + tdata_value + '</b>'
                tdata_class2value["untranslated"] = [tdata_value, tdata_content]
                readme_tdata_class2value["untranslated"] = [tdata_value, tdata_value]

                locale_table_file.write(get_table_content(tdata_class2value))
                locale_table_file.write('  </tfoot>\n')
                locale_table_file.write(get_table_close())

            locale_table_file.close()


            #% write README TABLE content (but only if translations for locale exists)
            if length_sum == untranslated_sum:
                try:
                    os.remove(locale_table_file_path)
                except OSError:
                    pass
            else:
                language_table_file.write(get_table_content(readme_tdata_class2value))

        #% README TABLE close
        language_table_file.write(get_table_body_close())
        language_table_file.write(get_table_close())
    language_table_file.close()



if __name__ == "__main__":
    #% get known lang_id and lang_name from LINGUAS
    ID2NAME = {}
    populate_id2name()

    #% create directories to store updated po files and tables
    HIDDEN_PO_DIR = os.path.join(REPO_FOLDER, ".translation-tables", "po")
    TABLES_DIR = os.path.join(REPO_FOLDER, ".translation-tables", "tables")
    check_hidden_dirs()

    #% store translation info in matrix/dict
    TRANSLATION_UUID_MATRIX = collections.defaultdict(dict) # [UUID][ID]
    TRANSLATION_LANG_MATRIX = collections.defaultdict(dict) # [ID][UUID]
    populate_translation_matrix()

    #% write/update the translation tables
    create_uuid_tables()
    create_readme_locale_tables()