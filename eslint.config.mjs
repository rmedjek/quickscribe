import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // base Next.js config
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Override for postcss.config.js
  {
    files: ["postcss.config.js"],
    languageOptions: {
      sourceType: "commonjs", // Mark it as CommonJS
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
