const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-plugin-prettier");

module.exports = [
  {
    ignores: ["jest.config.js", "commitlint.config.js", ".eslintrc.js"]
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json"
      },
      globals: {
        ...eslint.configs.recommended.globals,
        process: "readonly",
        console: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended[0].rules,
      "prettier/prettier": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  }
];
