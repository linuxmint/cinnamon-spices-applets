import sharedConfig from "@s-h-a-d-o-w/oxlint-config/lint.js";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [sharedConfig],
  ignorePatterns: ["files/**"],
  globals: {
    global: "readonly",
    imports: "readonly",
  },
  rules: {
    "unicorn/no-null": "off",
    "typescript/no-deprecated": "off",
    "typescript/no-explicit-any": "off",

    // Mock files legitimately declare several small stub classes.
    "max-classes-per-file": "off",

    // Caused by `any` - which we need because there aren't types for everything and I (mostly) didn't want to create partial, speculative types based on debug info at runtime.
    "typescript/no-unsafe-argument": "off",
    "typescript/no-unsafe-assignment": "off",
    "typescript/no-unsafe-call": "off",
    "typescript/no-unsafe-declaration-merging": "off",
    "typescript/no-unsafe-function-type": "off",
    "typescript/no-unsafe-member-access": "off",
    "typescript/no-unsafe-return": "off",
    "typescript/no-unsafe-unary-minus": "off",

    // JS engine in Cinnamon doesn't support these:
    "unicorn/no-array-reverse": "off",
    "unicorn/prefer-structured-clone": "off",
  },
});
