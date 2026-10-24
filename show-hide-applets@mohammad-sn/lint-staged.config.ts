import type { Configuration } from "lint-staged";

export default {
  "**/*.ts": ["pnpm lint", () => "pnpm typecheck", () => "pnpm test"],
  "**/*": ["oxfmt --no-error-on-unmatched-pattern", () => "pnpm knip"],
} satisfies Configuration;
