import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths"

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: {
      noRelativeImportPaths,
    },
    rules: {
      // Allow to use underscore for unused variables to avoid the warnings.
      // Useful for function arguments which are unused but cannot be removed (e.g. method overrides)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
        },
      ],
      // interface vs type at definitions
      // personal preference is to use type, but we can just disable this rule ..
      "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
      // Preferably use absolute paths over relative. This helps when moving a file to a different folder.
      // see: https://github.com/MelvinVermeer/eslint-plugin-no-relative-import-paths
      "noRelativeImportPaths/no-relative-import-paths": ["warn", { allowSameFolder: true, rootDir: "src", prefix: "" }],
    },
  },
  // Ignores need to be in a separate object!
  // See: https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
  // https://github.com/eslint/eslint/issues/17400
  {
    ignores: ["files/**", "node_modules/**", "scripts/**", "temp/**", "src/types/ci-types-additions/**"],
  },
  // should be last to override eslint rules
  eslintConfigPrettier,
)
