
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        React: "readonly",
      },
      parserOptions: {
        project: "./tsconfig.app.json",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Specific configuration for Supabase Edge Functions
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.deno,
        Deno: "readonly",
      },
      parserOptions: {
        project: "./supabase/functions/tsconfig.json",
      },
    },
    rules: {
      // Deno-specific rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Allow imports with .ts extension (required for Deno)
      "import/extensions": "off",
      // Less strict rules for Edge Functions
      "@typescript-eslint/no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  }
);