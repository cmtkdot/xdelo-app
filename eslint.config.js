{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:jsx-a11y/recommended",
    "plugin:prettier/recommended"
  ],
  "plugins": [
    "react",
    "react-hooks",
    "@typescript-eslint",
    "import",
    "jsx-a11y",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "prettier/prettier": ["error", {}, { "usePrettierrc": true }]
  }
}