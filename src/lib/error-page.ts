export function renderErrorPage(nonce?: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>A página não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style${nonce ? ` nonce="${nonce}"` : ""}>
      body { font: 15px/1.5 Inter, system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #001f3f; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #52627a; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #0074d9; color: #fff; }
      .secondary { background: #fff; color: #001f3f; border-color: #c3cfdd; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>A página não carregou</h1>
      <p>Algo falhou do nosso lado. Tente de novo ou volte ao início.</p>
      <div class="actions">
        <a class="primary" href="">Tentar de novo</a>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}
