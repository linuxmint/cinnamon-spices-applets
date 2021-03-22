## Dev bar for Cinnamon. 

Gnome version of the DevBar originally made for mac https://github.com/boxed/DevBar.
See mac version readme for more information.

## What is it

The DevBar is a tool to overview your development workflow. 
What is displayed is up to you, but some examples are:
 - Pull requests waiting for review
 - Pull requests that need additional work
 - Crashes in an environment
 - Support messages that need attention

This can be achieved by assigning the url in the settings window to an endpoint which produces JSON as:

```
{
    "data": {
      "needs_work": [
        {
            "title": "PR to fix issue",
            "url": "https://github.com/linuxmint/cinnamon-spices-applets/pull/3692"
          }
      ],
      "waiting_for_review": [
        {
          "title": "PR to review",
          "url": "https://github.com/linuxmint/cinnamon-spices-applets/pull/3692"
        }
      ],
      "prod_crash": [
        {
          "title": "Fix this crash",
          "url": "https://google.com"
        }
      ]
    },
    "metadata": {
      "display": {
        "needs_work": {
          "priority": 10,
          "symbol": "👎",
          "title": "👎 Needs work"
        },
        "other_problems": {
          "priority": 10,
          "symbol": "😟",
          "title": "😟 Other problems"
        },
        "waiting_for_review": {
          "priority": 10,
          "symbol": "🕐",
          "title": "🕐 Waiting for review"
        },
        "devtest": {
          "priority": 10,
          "symbol": "🧪",
          "title": "🧪 Can be tested by developers"
        },
        "ready_to_merge": {
          "priority": 10,
          "symbol": "🎉",
          "title": "🎉 Ready to merge"
        },
        "workflow_problem": {
          "priority": 10,
          "symbol": "🤨",
          "title": "🤨 Workflow problem: should be 4EYE or ready for test"
        },
        "wip": {
          "priority": 11,
          "symbol": "🚧",
          "title": "🚧 Work in progress"
        },
        "prod_crash": {
          "priority": 0,
          "symbol": "💥",
          "title": "💥 Prod crash"
        }
      }
    }
  }
```
 One such example can be found at [here](https://raw.githubusercontent.com/ludvigbostrom/DevBarGnome/master/example.json?). 

### Setup
Right click on applet -> "configure" to setup which url and refresh intervals.

There is also an option to append the username to the url. This will enable you to configure your backend to be user specific.

