import eslint from "@eslint/js";

import teslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";

export default teslint.config(
    eslint.configs.recommended,
    ...teslint.configs.strict,
    {
        plugins: {
            unicorn
        },
        rules: {
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: 'type-imports',
                    disallowTypeAnnotations: true,
                    fixStyle: 'separate-type-imports',
                }
            ],
            "@typescript-eslint/no-import-type-side-effects": "error",
            "no-constant-condition": [
                "error",
                {
                    // allow `while(true)` loops and the like
                    "checkLoops": false
                }
            ],
            "@typescript-eslint/no-non-null-assertion": "warn",
            
            "unicorn/no-empty-file": "error",
            "unicorn/prefer-number-properties": "error",
            "unicorn/no-array-for-each": "error",
            "unicorn/prefer-string-replace-all": "off",
            "unicorn/no-nested-ternary": "error",

            // "unicorn/no-unreadable-iife": "warn",
            // "unicorn/prefer-modern-math-apis": "warn",
            // "unicorn/prefer-array-index-of": "warn",
            // "unicorn/prefer-array-some": "warn",
            // "unicorn/prefer-at": "warn",
            // "unicorn/prefer-date-now": "warn",
            // "unicorn/prefer-includes": "warn",
            // "unicorn/prefer-negative-index": "warn",
            // "unicorn/prefer-set-has": "warn",
            // "unicorn/prefer-set-size": "warn",
            // "unicorn/prefer-spread": "warn",
            // "unicorn/prefer-prototype-methods": "warn",
            // "unicorn/prefer-default-parameters": "warn",
            // "unicorn/no-useless-fallback-in-spread": "warn",
            // "unicorn/no-useless-length-check": "warn",
            // "unicorn/no-useless-promise-resolve-reject": "warn",
            // "unicorn/no-unreadable-array-destructuring": "warn",
            // "unicorn/prefer-optional-catch-binding": "warn",
            // "unicorn/prefer-object-from-entries": "warn",
            // "unicorn/prefer-native-coercion-functions": "warn",
            // "unicorn/prefer-logical-operator-over-ternary": "warn",
            // "unicorn/prefer-regexp-test": "warn",
            // // TODO: These need to be errors, but there are too many to fix right now
            // "unicorn/no-useless-spread": "warn",
            // "unicorn/custom-error-definition": "warn",
            // "unicorn/consistent-function-scoping": "warn",
            // "unicorn/better-regex": "warn",
            // "unicorn/error-message": "warn",
            // "unicorn/escape-case": "warn",
            // "unicorn/new-for-builtins": "warn",
            // "unicorn/no-array-push-push": "warn",
            // "unicorn/no-document-cookie": "warn",
            // "unicorn/no-instanceof-array": "warn",
            // "unicorn/no-new-array": "warn",
            // "unicorn/no-static-only-class": "warn",
            // "unicorn/no-thenable": "warn",
            // "unicorn/no-this-assignment": "warn",
            // "unicorn/no-typeof-undefined": "warn",
            // "unicorn/no-unnecessary-await": "warn",
            // "unicorn/prefer-array-find": "warn",
            // "unicorn/prefer-array-flat-map": "warn",
            // "unicorn/prefer-array-flat": "warn",
            // "unicorn/prefer-math-trunc": "warn",
            // "unicorn/prefer-add-event-listener": "warn",
            // "unicorn/prefer-string-starts-ends-with": "warn",
            // "unicorn/prefer-string-trim-start-end": "warn",
            // "unicorn/prefer-reflect-apply": "warn",
            // "unicorn/prefer-string-slice": "warn",
            // "unicorn/throw-new-error": "warn",
            // "unicorn/prefer-keyboard-event-key": "warn",
            // "unicorn/no-invalid-remove-event-listener": "warn",
            // "unicorn/no-array-method-this-argument": "warn",
        }
    }
)