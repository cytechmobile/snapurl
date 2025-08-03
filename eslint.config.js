import globals from 'globals';
import js from '@eslint/js';

export default [
	{
		ignores: ['**/dist/**', '**/coverage/**', 'coverage-reports/**'],
	},
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
];
