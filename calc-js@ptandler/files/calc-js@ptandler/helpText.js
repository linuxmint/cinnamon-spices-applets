
const helpText = "Help: Some Example Expressions\n" +
    "\n" +
    "- `1 + 2` = `3`\n" +
    "- `(1 + 2) * (3 + 4)` = `21`\n" +
    "- All functions defined in the JavaScript `Math` object are included\n" +
    "  (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math), e.g.:\n" +
    "    - `min(1,2)` = `1`\n" +
    "    - `max(1,2)` = `2`\n" +
    "    - `sqrt(16)` = `4`\n" +
    "    - `abs(-1)` = `1`\n" +
    "    - The **trigonometric functions** `sin(), cos(), tan(), asin(), acos(), atan(), and atan2()` expect (and return) angles in radians.\n" +
    "        - Helper functions: `degToRad(180)` = approx. `3.14`, `radToDeg(PI)` = `180`\n" +
    "    - `random()` returns a pseudo-random number between 0 and 1.\n" +
    "    - Euler's constant: `E` = approx. `2.718`\n" +
    "    - `PI` = approx. `3.14159`\n" +
    "- You can use decimal, hex, octal, or binary number constants, as provided by JavaScript: 17 === 0x11 === 021 === 0b10001\n" +
    "  - Helper functions to convert a number to a hex / oct / bin _string_: `toHex(num)`, `toOct(num)`, `toBin(num)`,\n" +
    "    e.g. `toHex(17)` = `\"0x11\"`, `toOct(0x11)` = `\"021\"`, `toBin(021)` = `\"0b10001\"`  \n" +
    "  - Helper functions to convert a hex / oct / bin _string_ to a number: `fromHex(str)`, `fromOct(str)`, `fromBin(str)`  \n" +
    "    Note that the strings may (but don't need to) start with `0x` / `0` / `0b`    \n" +
    "    e.g. `fromHex(\"0x11\")` = `17`, `fromHex(\"11\")` = `17`,  `fromOct(\"021\")` = `17`, `fromBin(\"0b10001\")` = `17`,  \n" +
    "    the argument is converted to a string before: `fromHex(\"11\")` = `17` _this might be confusing!_ \n" +
    "    For example `fromOct(021)` = `15` because `021` is converted by JS to the number `17` and this is interpreted as the string `\"017\"` (and oct `017` == `15`). \n" +
    "- You can define **variables**; this expression will return the assigned value. The variables will keep their value until the desklet is restarted:\n" +
    "    - `a=2` = `2`\n" +
    "- You can use the **comma `,` operator** to evaluate several expressions and return just the value of the last one. Can be used to define variables:\n" +
    "    - `a=2, b=3, a*b`\n" +
    "- For conditional expression you can use the JS `? :` operator, e.g. `1 < 2 ? \"that's true\" : \"no, wrong\"`\n" +
    "- You can define **functions**:\n" +
    "    - `fib = (n) => n <= 0 ? 0 : (n <= 1 ? 1 : (fib(n - 1) + fib(n - 2))), fib(7)` = `13`\n" +
    "      CAUTION: Be careful with recursive functions, I'm not sure if there is a timeout for the evaluation of the expression and if it's quite long.\n" +
    "               So you can crash your desktop if evaluation hangs ... believe me, I tried ;-)\n" +
    "- You can use all **builtin JavaScript** functions and global objects (available in GJS / CJS), such as `JSON.stringify`\n" +
    "\n" +
    "Global Keyboard Shortcut:\n" +
    "\n" +
    "- Calculator key or Ctrl+Super+Alt+C - Show / hide Mini-Calc\n" +
    "\n" +
    "Keyboard Shortcuts in input field:\n" +
    "\n" +
    "- Ctrl-Shift-Del - Clear expression history\n" +
    "- Ctrl-h - Show / hide history submenu\n" +
    "- Ctrl-? or F1 - Show help dialog\n";
