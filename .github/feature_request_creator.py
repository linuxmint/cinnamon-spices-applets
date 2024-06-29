#!/usr/bin/python3
'''
Generate 02_feature_request.yml based on repository files
'''

import os
import json
import yaml

dirs_blacklist = ['.git', '.github']

repo_folder = os.path.realpath(os.path.abspath(os.path.join(
                  os.path.normpath(os.path.join(os.getcwd(), *(['..'] * 1))))))

HEADER = '''# DO NOT EDIT THIS FILE MANUALLY.
# Execute the script called feature_request_creator.py to generate it.

---
'''

FEATURE_RQ = {'name': '🚀 Applet Feature Request',
              'description': "If you have a feature request for an existing Applet 💡",
              'title': 'Applet Feature Request',
              'labels': ['FEATURE REQUEST'],
              'body': [{'type': 'markdown',
                        'attributes': {'value': 'Thanks for taking the time to fill out this feature request!'}},
                       {'type': 'dropdown', 'id': 'applet',
                        'attributes': {'default': 0,
                                       'label': 'Applet name and maintainer',
                                       'options': []},
                        'validations': {'required': True}},
                       {'type': 'textarea', 'id': 'feature-request',
                        'attributes': {'description': 'Add as many details as possible!',
                                       'label': 'What would you like to see?',
                                       'placeholder': 'Tell the author what you want to see!'},
                        'validations': {'required': True}},
                       {'type': 'markdown',
                        'attributes': {'value': "*By submitting this feature request, you agree to behave respectfully and in a mature manner. If in doubt, refer to the [Golden Rule](https://en.wikipedia.org/wiki/Golden_Rule) and [Github's Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).*"}}]}


def main():
    """
    List the repository directories and retrieve author information.
    """
    xlets_and_authors = []

    try:
        for name in os.listdir(repo_folder):
            if name in dirs_blacklist:
                continue

            info_file_path = os.path.join(repo_folder, name, 'info.json')

            if os.path.isfile(info_file_path):
                with open(info_file_path, 'r', encoding='utf-8') as info:
                    file_data = json.load(info)

                author_value = file_data.get('author', 'none')
                author = '' if author_value == 'none' else f' @{author_value}'

                xlets_and_authors.append(f'{name}{author}')
    finally:
        xlets_and_authors.append('')
        dropdown_list = sorted(sorted(xlets_and_authors), key=str.casefold)
        with open(os.path.join(repo_folder, '.github', 'ISSUE_TEMPLATE',
                               '02_feature_request.yml'), 'w',
                  encoding='utf-8') as feature_request_yaml:
            FEATURE_RQ['body'][1]['attributes']['options'] = dropdown_list

            feature_request_yaml.write(HEADER)
            yaml.dump(FEATURE_RQ, feature_request_yaml)


if __name__ == '__main__':
    main()
