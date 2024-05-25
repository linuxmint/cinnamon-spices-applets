import eslint from "@eslint/js";

import teslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";

export default teslint.config(
    eslint.configs.recommended,
    ...teslint.configs.recommended
)