import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const SERVER_ONLY = {
  name: "server-only",
  message:
    "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
};

const DOMAIN_ISOLATION = {
  group: [
    "**/api/*",
    "**/api/**",
    "**/hooks/*",
    "**/hooks/**",
    "**/ui/*",
    "**/ui/**",
    "@/integrations/**",
    "@/routes/**",
    "@/server/**",
    "@supabase/*",
  ],
  message:
    "a camada `domain` é pura e não importa nada de fora. Query e I/O vivem em `api/` e `hooks/`.",
};

const CASH_VIEWS = {
  group: [
    "**/financial/domain/fiscal",
    "**/financial/domain/fiscal.*",
    "**/financial/domain/receita",
    "**/financial/domain/receita.*",
    "**/contracts/domain/shares",
    "**/contracts/domain/shares.*",
    "../fiscal",
    "../receita",
    "../shares",
    "./fiscal",
    "./receita",
    "./shares",
  ],
  message:
    "estes módulos mensalizam TCV (total_value / billing_months) em contexto de CAIXA ou de CUSTO. Nenhum deles pode ser importado por domain/mrr.ts ou domain/tcv.ts — MRR é fluxo, TCV é estoque, e misturar os dois é o erro mais caro do sistema.",
};

const THROW_CRU = {
  selector: "ThrowStatement > :not(NewExpression):not(CallExpression[callee.name='erroDoBanco'])",
  message:
    "Num repositório, só se lança `new Error(...)` / `new PostgrestError(...)` com mensagem própria, ou `erroDoBanco(error)`. Repropagar o erro do Supabase de qualquer outra forma (cru, com `as`, com `!`, num ternário) devolve o objeto puro do `JSON.parse(body)`, que não é `Error`, e a mensagem do banco morre no `erro instanceof Error ? ... : ...` da tela. Ver src/shared/lib/erro-do-banco.ts.",
};

const NEW_ERROR_MESSAGE = {
  selector:
    "ThrowStatement > NewExpression[callee.name='Error'] MemberExpression[property.name='message']",
  message:
    "`new Error(error.message)` descarta `error.code`, e é o code que `ehFaltaDePermissao` lê para não retentar uma recusa de permissão (42501, de RLS ou de portão de papel em RPC, via `SEM_RETENTATIVA_EM_RECUSA`). Também apaga a diferença entre o banco ter respondido e a resposta não ter chegado. Use `throw erroDoBanco(error)`, que decide pelos dois casos num lugar só. Ver src/shared/lib/erro-do-banco.test.ts.",
};

const WRITE_SEM_SELECT = {
  selector:
    "CallExpression:not(MemberExpression > CallExpression)" +
    ":has(CallExpression[callee.property.name='from'])" +
    ":has(CallExpression[callee.property.name='update'], CallExpression[callee.property.name='delete'])" +
    ":not(:has(CallExpression[callee.property.name='select']))",
  message:
    'UPDATE/DELETE sem `.select(...)`: recusa de RLS devolve 204 com zero linha, não erro, e a tela diria que gravou. Encadeie `.select("id")` e confira `(data ?? []).length === 0` com mensagem que diz o que a pessoa pode fazer.',
};

const crossTypeImport = (forbidden, self) => ({
  group: [`**/${forbidden}`, `**/${forbidden}.*`, `./${forbidden}`, `../${forbidden}`],
  message: `domain/${self}.ts não pode importar de ${forbidden}.ts. São duas dimensões independentes; um card de ${self.toUpperCase()} alimentado por valor derivado de ${forbidden.toUpperCase()} é proibido.`,
});

const restrictedImports = (...patterns) => [
  "error",
  patterns.length > 0 ? { paths: [SERVER_ONLY], patterns } : { paths: [SERVER_ONLY] },
];

const TRAVESSAO = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`);

const SEM_TRAVESSAO = {
  meta: {
    type: "problem",
    messages: {
      travessao:
        "texto do CRM sem travessão nem meia-risca. Use vírgula, dois-pontos, ponto ou parênteses; intervalo com 'a'; célula sem valor com '-'.",
    },
  },
  create(context) {
    const checa = (node, texto) => {
      if (typeof texto === "string" && TRAVESSAO.test(texto)) {
        context.report({ node, messageId: "travessao" });
      }
    };
    return {
      Literal: (node) => checa(node, node.value),
      TemplateElement: (node) => checa(node, node.value.cooked ?? node.value.raw),
      JSXText: (node) => checa(node, node.value),
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".demo",
      "src/routeTree.gen.ts",
      "src/shared/types/database.types.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": restrictedImports(),
      "@typescript-eslint/no-explicit-any": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/routes/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports(DOMAIN_ISOLATION),
    },
  },
  {
    files: ["src/modules/*/domain/mrr.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports(
        DOMAIN_ISOLATION,
        CASH_VIEWS,
        crossTypeImport("tcv", "mrr"),
      ),
    },
  },
  {
    files: ["src/modules/*/domain/tcv.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports(
        DOMAIN_ISOLATION,
        CASH_VIEWS,
        crossTypeImport("mrr", "tcv"),
      ),
    },
  },
  {
    files: ["src/routes/**/*.{ts,tsx}"],
    ignores: [
      "src/routes/api/**",
      "src/routes/__root.tsx",
      "src/routes/_authenticated.tsx",
      "src/routes/auth.tsx",
      "src/routes/nova-senha.tsx",
    ],
    rules: {
      "no-restricted-imports": restrictedImports({
        group: ["@/integrations/supabase/client*", "**/integrations/supabase/client*"],
        message:
          "a rota é fina e não fala com o Supabase. Query e I/O vivem em `modules/<dominio>/api/` e chegam à tela por um hook. Rota que precisa de sessão usa `papel`/`sessao` de `server/`.",
      }),
    },
  },
  {
    files: [
      "src/routes/api/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/integrations/supabase/**/*.{ts,tsx}",
      "src/modules/*/api/**/*.{ts,tsx}",
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["src/routes/**/*.{ts,tsx}"],
    ignores: ["src/routes/api/**"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    },
  },
  {
    files: ["src/modules/*/api/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    ignores: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**"],
    rules: {
      "no-restricted-syntax": ["error", THROW_CRU, WRITE_SEM_SELECT],
    },
  },
  {
    files: ["src/modules/*/api/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    ignores: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**", "src/modules/ai/api/**"],
    rules: {
      "no-restricted-syntax": ["error", THROW_CRU, NEW_ERROR_MESSAGE, WRITE_SEM_SELECT],
    },
  },
  eslintPluginPrettier,
  {
    files: [
      "src/routes/api/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/integrations/supabase/**/*.{ts,tsx}",
      "src/start.ts",
      "src/server.ts",
    ],
    ignores: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/segredos.server.ts",
      "src/modules/*/api/**",
      "src/hooks/**",
      "**/*.{test,spec}.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^(GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)$/]",
          message:
            'Segredo so e lido em src/lib/segredos.server.ts: `const { segredo } = await import("@/lib/segredos.server")` dentro do handler.',
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.{test,spec}.{ts,tsx}"],
    plugins: { crm: { rules: { "sem-travessao": SEM_TRAVESSAO } } },
    rules: {
      "crm/sem-travessao": "error",
    },
  },
);
