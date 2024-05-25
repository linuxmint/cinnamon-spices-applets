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
            "unicorn/no-unreadable-iife": "error",
            "unicorn/no-nested-ternary": "error",
            "unicorn/prefer-modern-math-apis": "error",
            "unicorn/prefer-array-index-of": "error",
            "unicorn/prefer-array-some": "error",
            "unicorn/prefer-date-now": "error",
            "unicorn/prefer-includes": "error",
            "unicorn/prefer-negative-index": "error",
            "unicorn/prefer-set-has": "error",
            "unicorn/prefer-set-size": "error",
            "unicorn/prefer-spread": "error",
            "unicorn/prefer-prototype-methods": "error",
            "unicorn/prefer-default-parameters": "error",
            "unicorn/no-useless-fallback-in-spread": "error",
            "unicorn/no-useless-length-check": "error",
            "unicorn/no-useless-promise-resolve-reject": "error",
            "unicorn/prefer-optional-catch-binding": "error",
            "unicorn/prefer-object-from-entries": "error",
            "unicorn/prefer-native-coercion-functions": "error",
            "unicorn/prefer-logical-operator-over-ternary": "error",
            "unicorn/prefer-regexp-test": "error",
            "unicorn/no-useless-spread": "error",
            "unicorn/custom-error-definition": "error",
            "unicorn/better-regex": "error",
            
            "unicorn/prefer-at": "off",
            "unicorn/prefer-string-replace-all": "off",
            "unicorn/no-unreadable-array-destructuring": "off",
            "unicorn/consistent-function-scoping": "off",
            // // TODO: These need to be errors, but there are too many to fix right now
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