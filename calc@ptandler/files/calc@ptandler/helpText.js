
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
    "- <kbd>Calculator</kbd> or <kbd>Ctrl</kbd>+<kbd>Super</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd> - Show / hide Mini-Calc\n" +
    "\n" +
    "Keyboard Shortcuts in input field:\n" +
    "\n" +
    "- <kbd>Ctrl</kbd>-<kbd>Shift</kbd>-<kbd>Del</kbd> - Clear expression history\n" +
    "- <kbd>Ctrl</kbd>-<kbd>h</kbd> - Show / hide history submenu\n" +
    "- <kbd>Ctrl</kbd>-<kbd>?</kbd> or <kbd>F1</kbd> - Show help dialog\n";
