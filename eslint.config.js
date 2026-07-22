import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default [
    // Global ignores
    {
        ignores: ["node_modules/**", "dist/**", "coverage/**", ".yarn/**", "**/*.config.ts", "**/*.config.js"],
    },
    // Base configuration for all source files
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2020,
                ecmaFeatures: { jsx: true },
                project: "./tsconfig.app.json",
                tsconfigRootDir: __dirname,
            },
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
            sonarjs: sonarjs,
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            // ESLint recommended rules
            ...js.configs.recommended.rules,

            // TypeScript ESLint recommended rules
            ...tseslint.configs["eslint-recommended"].rules,
            ...tseslint.configs.recommended.rules,

            // SonarJS recommended rules
            ...sonarjs.configs.recommended.rules,

            // React Hooks rules
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

            // Custom rules
            "no-console": "warn",
            "no-debugger": "warn",
            curly: "warn",
            eqeqeq: "warn",
            "consistent-return": "warn",
            "preserve-caught-error": "off",
            "prefer-template": "warn",
            "prefer-const": "error",
            "no-duplicate-imports": "warn",
            "no-var": "error",
            "sonarjs/todo-tag": "off",
            "sonarjs/deprecation": "warn",
            "sonarjs/prefer-immediate-return": "warn",
            "sonarjs/cognitive-complexity": "warn",
            "sonarjs/no-commented-code": "warn",
            "sonarjs/no-duplicate-string": "warn",
            "sonarjs/no-unused-vars": "off",
            "@typescript-eslint/prefer-optional-chain": "warn",
            "@typescript-eslint/no-unnecessary-type-assertion": "warn",
            "@typescript-eslint/return-await": "warn",
            "@typescript-eslint/no-inferrable-types": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    varsIgnorePattern: "^_",
                    argsIgnorePattern: "^_",
                },
            ],
        },
    },

    // Test files configuration
    {
        files: ["**/tests/**/*.test.{j,t}s?(x)"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2020,
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.jest,
            },
        },
    },
];
