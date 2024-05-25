import eslint from "@eslint/js";

import teslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";

export default teslint.config(
    eslint.configs.recommended,
    ...teslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: 'type-imports',
                    disallowTypeAnnotations: true,
                    fixStyle: 'separate-type-imports',
                }
            ],
            "@typescript-eslint/no-import-type-side-effects": "error"
        }
    }
)