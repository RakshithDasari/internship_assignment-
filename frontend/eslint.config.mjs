import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  { ignores: [".next/", "node_modules/"] },
  {
    rules: {
      // Only relevant to the legacy pages/ router; this app uses app/.
      "@next/next/no-html-link-for-pages": "off",
      // Images here are API results and live base64 frames, which next/image can't optimise.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
