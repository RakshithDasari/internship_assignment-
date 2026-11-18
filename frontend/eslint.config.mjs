import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  { ignores: [".next/", "node_modules/"] },
  // Only relevant to the legacy pages/ router; this app uses app/.
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
];

export default config;
