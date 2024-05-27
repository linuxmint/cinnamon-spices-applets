import eslint from "@eslint/js";

import teslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";

export default teslint.config(
    eslint.configs.recommended,
    ...teslint.configs.recommendedTypeChecked,
    ...teslint.configs.strict,
    {
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
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
                    "checkLoops": false
                }
            ],
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-ignore": "allow-with-description"
                }
            ],
            "@typescript-eslint/no-empty-interface": [
                "error",
                {
                    allowSingleExtends: true
                }
            ],
            "@typescript-eslint/no-empty-function": [
                "error",
                {
                    allow: [
                        "private-constructors",
                        "protected-constructors",
                        "decoratedFunctions",
                        "overrideMethods",
                    ]
                }
            ],
            "@typescript-eslint/explicit-module-boundary-types": [
                "error",
                {
                    allowHigherOrderFunctions: true,
                }
            ],
            "@typescript-eslint/no-misused-promises": [
                "error",
                {
                    "checksVoidReturn": false
                }
            ],

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
            "unicorn/error-message": "error",
            "unicorn/escape-case": "error",
            "unicorn/new-for-builtins": "error",
            "unicorn/no-array-push-push": "error",
            "unicorn/no-instanceof-array": "error",
            "unicorn/no-new-array": "error",
            "unicorn/no-static-only-class": "error",
            "unicorn/no-thenable": "error",
            "unicorn/no-this-assignment": "error",
            "unicorn/no-typeof-undefined": "error",
            "unicorn/no-unnecessary-await": "error",
            "unicorn/prefer-array-find": "error",
            "unicorn/prefer-array-flat-map": "error",
            "unicorn/prefer-array-flat": "error",
            "unicorn/prefer-math-trunc": "error",
            "unicorn/prefer-string-starts-ends-with": "error",
            "unicorn/prefer-string-trim-start-end": "error",
            "unicorn/prefer-reflect-apply": "error",
            "unicorn/prefer-string-slice": "error",
            "unicorn/no-array-method-this-argument": "error",

            "unicorn/prefer-at": "off",
            "unicorn/prefer-string-replace-all": "off",
            "unicorn/no-unreadable-array-destructuring": "off",
            "unicorn/consistent-function-scoping": "off",
            "unicorn/throw-new-error": "off",
            "no-restricted-syntax": [
                'error',
                {
                    // This is probably too restrictive, but whatever
                    selector: 'NewExpression[callee.name="Label"]',
                    message: 'Usage of imports.gi.St.Label is not allowed. Usage Label function from utils.',
                },
                {
                    // prevent usage of imports.gi.St.Label
                    selector: 'NewExpression[callee.property.name="Label"]',
                    message: 'Usage of imports.gi.St.Label is not allowed. Usage Label function from utils.',
                },
            ]
        }
    }
)