import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import noOnlyTests from "eslint-plugin-no-only-tests"
import eslintComments from "eslint-plugin-eslint-comments"

export default [
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"coverage/**",
			"storybook-static/**",
			"test-results/**",
			"playwright-report/**",
		],
	},
	{
		files: ["**/*.{js,jsx,ts,tsx}"],
		languageOptions: {
			parser: tsParser,
			sourceType: "module",
			parserOptions: {
				project: [
					"./tsconfig.json",
					"./tsconfig.node.json",
					"./test/tsconfig.json",
					"./e2e/tsconfig.json",
					"./playground/tsconfig.json",
					"./.storybook/tsconfig.json",
				],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		linterOptions: {reportUnusedDisableDirectives: "off"},
		plugins: {
			"@typescript-eslint": tsPlugin,
			"no-only-tests": noOnlyTests,
			"eslint-comments": eslintComments,
		},
		rules: {
			/*
			forgot to remove/implement
			*/
			"no-console": "warn",
			"no-debugger": "warn",
			"prefer-const": "warn",
			"require-await": "warn",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_"},
			],
			"@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",
			"@typescript-eslint/no-unnecessary-condition": "warn",
			"@typescript-eslint/no-unnecessary-type-arguments": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-unnecessary-type-constraint": "warn",
			"@typescript-eslint/no-useless-empty-export": "warn",
			"@typescript-eslint/no-empty-function": "warn",
			"no-empty": "warn",
			"@typescript-eslint/no-unused-expressions": [
				"warn",
				{allowShortCircuit: true, allowTernary: true},
			],
			"eslint-comments/no-unused-disable": "warn",
			/*
			code style | readability
			*/
			"@typescript-eslint/explicit-function-return-type": [
				"warn",
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
					allowHigherOrderFunctions: true,
					allowDirectConstAssertionInArrowFunctions: true,
					allowConciseArrowFunctionExpressionsStartingWithVoid: true,
					allowIIFEs: true,
				},
			],
			/*
			prevent unexpected behavior
			*/
			"@typescript-eslint/no-restricted-types": "warn",
			"@typescript-eslint/no-empty-object-type": ["warn", {allowInterfaces: "always"}],
			"@typescript-eslint/no-unsafe-function-type": "warn",
			"@typescript-eslint/no-wrapper-object-types": "warn",
			"@typescript-eslint/switch-exhaustiveness-check": "warn",
			"no-fallthrough": ["warn", {allowEmptyCase: true}],
			/*
			tests
			*/
			"no-only-tests/no-only-tests": "warn",
		},
	},
]
