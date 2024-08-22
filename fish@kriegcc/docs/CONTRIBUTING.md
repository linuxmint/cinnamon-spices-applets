# Contributing to Fish Applet for Cinnamon Desktop

Thanks for your interest in contributing to this project!
Here are a few ways you can help:

- [Providing feedback](#providing-feedback)
- [Reporting issues](#reporting-bugs)
- [Translating](#translating)
- [Development](#development)

Before you start, please take a moment to read through the guidelines for the respective part.
Is anything missing? How about contributing by editing this document.

## Providing Feedback

Feel free share your feedback, opinions, and ideas about this applet in the comment section on the [Applet's web page](https://cinnamon-spices.linuxmint.com/applets/view/).
You need a GitHub account to be able to comment.
If you are facing a problem with the applet, please preferentially [create a bug report](#reporting-bugs) instead.

## Reporting Bugs

Please open an issue on GitHub.
Since this applet is part of Linux Mint's `cinnamon-spices-applets` repository, it's important to follow their guidelines for this process.

See: [Cinnamon Spices Applet - CONTRIBUTIONS.md](../../.github/CONTRIBUTING.md)

Make sure that the applet name (spice name) is in the title when opening a new issue.
Follow the provided template for the description and give as much information as possible about the issue.

## Translating

Are you a native English speaker? Great! If you notice anything that sounds weird or is grammatically incorrect, please give feedback or directly fix it in the codebase and create a pull request (see: [Development](#development)).

Do you speak another language and would like to help translate this applet? Fantastic! A `.pot` template file is supplied with this applet. Please refer to the [Translation](./TRANSLATION.md) guide for further instructions.

**Please note:** The fish's messages (Wanda's wisdoms) cannot be translated. They are just the output of the specified command in the settings, which is run when Wanda speaks (by default `fortune`). `fortune` is not localized.

## Development

Would you like to participate in coding, fixing bugs, addressing TODOs, or writing new features? Awesome!

A brief developer guide with instructions on how to set up and build this project can be found here: [Development](./DEVELOPMENT.md).

The primary language used for this applet is [TypeScript](https://www.typescriptlang.org).
