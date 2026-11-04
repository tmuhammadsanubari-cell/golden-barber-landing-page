import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', '.vercel/', 'design-reference/', 'install.ps1', 'playwright-report/', 'test-results/'] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
];
