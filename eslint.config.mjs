import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "commitlint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    // The launcher imports ../dist, which doesn't exist until `pnpm build`.
    // CI lints before it builds, so type-aware rules can't resolve it there.
    files: ["bin/**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  // Disable ESLint rules that conflict with Prettier (must be last).
  prettierConfig,
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "coverage/**",
    "tests/fixtures/**",
    "apps/**",
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
