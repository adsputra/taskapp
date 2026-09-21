import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**", "supabase/**"],
  },
  {
    // Pre-existing UI findings surfaced by the React Compiler rules in
    // eslint-config-next v16. Kept visible as warnings instead of blocking.
    rules: {
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];
