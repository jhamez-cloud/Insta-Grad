import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "components/SwipeRow.tsx",
      "components/ui/Folder.tsx",
      "components/ui/Lightfall.tsx",
      "components/ui/PromptBar.tsx",
      "components/ui/Stepper.tsx",
      "components/ui/ThoughtLine.tsx",
    ],
    rules: {
      // Owner-supplied animation internals retain their ref-based event model.
      "@next/next/no-img-element": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
