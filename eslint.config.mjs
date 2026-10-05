import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    // Non-app code: one-off debug scripts, scratch dirs, and generated files.
    // (Legacy `next lint` only scanned app/pages/components/lib, so these were never linted.)
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "scratch/**",
      "brain/**",
      "tmp/**",
      "scripts/**",
      "supabase/schema.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Carry-overs from the legacy .eslintrc.json
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],
      // Known-violation backlog, downgraded to warnings until the tracked cleanup
      // refactors land. These rules are new in eslint-plugin-react-hooks v7
      // (React Compiler lint suite) plus the legacy JSX-entity rule; each has
      // dozens-to-hundreds of pre-existing violations across the codebase that
      // need deliberate refactors (e.g. Structural3DViewer hook ordering).
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/error-boundaries": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
];

export default eslintConfig;
