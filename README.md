# ![image](https://github.com/user-attachments/assets/3bc9203f-eda1-45a5-8393-817c9bf44481) Cinnamon Spices Applets

![Validate spices](https://github.com/linuxmint/cinnamon-spices-applets/workflows/Validate%20spices/badge.svg)

Welcome to the official repository for **Cinnamon Spices Applets**—customizable extensions for the Cinnamon desktop environment.

Users can explore, install, and manage applets via [Cinnamon Spices Website](https://cinnamon-spices.linuxmint.com) or through **Cinnamon > System Settings**.

---

## 🔹 Key Concepts

### 🏷️ UUID

Each spice (applet) has a unique identifier known as its **UUID**.

### 👤 Author

The GitHub username of a spice's creator is defined in the `info.json` file within each spice directory.

---

## 📁 Project Structure

A typical spice must adhere to the following structure:

```
UUID/
├── info.json
├── screenshot.png
├── README.md
└── files/
    └── UUID/
        ├── metadata.json
        ├── applet.js
        └── icon.png
```

### Directory Roles:

* `UUID/`: Top-level folder used by GitHub and the Cinnamon Spices website.
* `files/UUID/`: Contains the actual applet files used by Cinnamon.

**Important**: `files/` must contain only the UUID folder. Otherwise, the spice cannot be installed through Cinnamon's System Settings.

---

## ✅ Validation

Use the `validate-spice` script to verify applet structure and integrity:

```bash
./validate-spice UUID
```

---

## 💻 Development & Testing

To test an applet locally, use the `test-spice` script:

```bash
# Validate and install
./test-spice UUID

# Skip validation (not recommended)
./test-spice -s UUID

# Remove all local test applets
./test-spice -r
```

**Note**: Local applet copies use a `devtest-` prefix.

---

## 📄 Author Responsibilities

As a spice author, you may:

* Modify your own spices (while respecting structure and security guidelines).
* Accept/reject contributions.
* Transfer maintenance to another developer by updating `info.json`.

If inactive, the Linux Mint team may assume maintenance duties.

---

## 📅 Pull Request Workflow

### From Authors

If you're the spice's author:

* Changes must only affect your spices.
* Maintain proper structure and avoid malicious code.

### From Contributors

If you aren't the original author:

* PR is held until reviewed by the author.
* Bug fixes and translation updates may be merged earlier.
* If the author is inactive, the team may proceed with merging.

---

## ❌ Deletions

Spices may be removed due to:

* Lack of maintenance
* Critical bugs
* Redundancy (already existing in Cinnamon or better maintained by others)

---

## ➕ Adding New Applets

Submit a pull request with your new applet. The Cinnamon team will review and either approve or explain why it's declined.

---

## 🛠️ Reporting Issues / Making PRs

Refer to our [Contribution Guidelines](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md).

---

## 🌍 Translations

Use the `cinnamon-spices-makepot` script to update `.pot` files and test `.po` translations:

```bash
# Update translation template
./cinnamon-spices-makepot UUID

# Test translation locally
./cinnamon-spices-makepot UUID --install

# More help
./cinnamon-spices-makepot --help
```

### Translation Status

Stay updated with the latest translation progress:

* [Applet Translation Status Tables](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/README.md)

Tables update automatically with each commit to `master`.

---

## 🔄 JavaScript Feature Compatibility

Check [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript) for feature availability and refer to the table below to map Firefox versions (used in Cinnamon JS Engine) to Linux Mint releases.

<table><tr><th colspan="1">Mint<br/>Version</th><th colspan="1">Codename</th><th colspan="1">Release Date</th><th colspan="1">Cinnamon<br/>Version</th><th colspan="2">Firefox version<br/>(CJS JS engine)</th></tr>
<tr><td colspan="1">17</td><td colspan="1">Qiana</td><td colspan="1">31 May 14</td><td colspan="1">2.2.14</td><td colspan="1"></td></tr>
<tr><td colspan="1">17.1</td><td colspan="1">Rebecca</td><td colspan="1">29 Nov 14</td><td colspan="1">2.4.6</td><td colspan="1"></td></tr>
<tr><td colspan="1">17.2</td><td colspan="1">Rafaela</td><td colspan="1">30 Jun 15</td><td colspan="1">2.6.13</td><td colspan="1"></td></tr>
<tr><td colspan="1">17.3</td><td colspan="1">Rosa</td><td colspan="1">4 Dec 15</td><td colspan="1">2.8.7</td><td colspan="1"></td></tr>
<tr><td colspan="1">18</td><td colspan="1">Sarah</td><td colspan="1">30 Jun 16</td><td colspan="1">3.0.7</td><td colspan="1"></td></tr>
<tr><td colspan="1">18.1</td><td colspan="1">Serena</td><td colspan="1">16 Dec 16</td><td colspan="1">3.2.8</td><td colspan="1"></td></tr>
<tr><td colspan="1">18.2</td><td colspan="1">Sonya</td><td colspan="1">2 Jul 17</td><td colspan="1">3.4.4</td><td colspan="1"></td></tr>
<tr><td colspan="1">18.3</td><td colspan="1">Sylvia</td><td colspan="1">27 Nov 17</td><td colspan="1">3.6.7</td><td colspan="1"></td></tr>
<tr><td colspan="1">19</td><td colspan="1">Tara</td><td colspan="1">29 Jun 18</td><td colspan="1">3.8.8</td><td colspan="1" rowspan="5">52</td></tr>
<tr><td colspan="1">19.1</td><td colspan="1">Tessa</td><td colspan="1">19 Dec 18</td><td colspan="1">4.0.9</td></tr>
<tr><td colspan="1">19.2</td><td colspan="1">Tina</td><td colspan="1">2 Aug 19</td><td colspan="1">4.2.3</td></tr>
<tr><td colspan="1">19.3</td><td colspan="1">Tricia</td><td colspan="1">18 Dec 19</td><td colspan="1">4.4.8</td></tr>
<tr><td colspan="1">20</td><td colspan="1">Ulyana</td><td colspan="1">27 Jun 20</td><td colspan="1">4.6.7</td></tr>
<tr><td colspan="1">20.1</td><td colspan="1">Ulyssa</td><td colspan="1">8 Jan 21</td><td colspan="1">4.8.6</td><td colspan="1" rowspan="5">78</td></tr>
<tr><td colspan="1">20.2</td><td colspan="1">Uma</td><td colspan="1">8 Jul 21</td><td colspan="1">5.0.5</td></tr>
<tr><td colspan="1">20.3</td><td colspan="1">Una</td><td colspan="1">7 Jan 22</td><td colspan="1">5.2.7</td></tr>
<tr><td colspan="1">21</td><td colspan="1">Vanessa</td><td colspan="1">31 Jul 22</td><td colspan="1">5.4.12</td></tr>
<tr><td colspan="1">21.1</td><td colspan="1">Vera</td><td colspan="1">20 Dec 22</td><td colspan="1">5.6.8</td></tr>
<tr><td colspan="1">21.2</td><td colspan="1">Victoria</td><td colspan="1">16 Jul 23</td><td colspan="1">5.8.4</td><td colspan="1" rowspan="2">102</td></tr>
<tr><td colspan="1">21.3</td><td colspan="1">Virginia</td><td colspan="1">12 Jan 24</td><td colspan="1">6.0.4</td></tr>
<tr><td colspan="1">22</td><td colspan="1">Wilma</td><td colspan="1">25 Jul 24</td><td colspan="1">6.2.9</td><td colspan="1" rowspan="2">115</td></tr>
<tr><td colspan="1">22.1</td><td colspan="1">Xia</td><td colspan="1">16 Jan 25</td><td colspan="1">6.4.8</td>
</table>


* Mint 20.x supported until **Apr 2025**
* Mint 21.x supported until **May 2027**
* Mint 22.x supported until **Apr 2029**

---

> **Maintained by the Linux Mint team and open-source contributors worldwide.**

Happy hacking! 🚀
