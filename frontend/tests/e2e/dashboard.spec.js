const { expect, test } = require("@playwright/test");

const usuario = {
  id: 1,
  nome: "Admin Demo",
  email: "admin@hortifruti.local",
  perfil: "gerente",
  ativo: true
};

const dashboard = {
  periodo_analise: {
    data_inicial: "2026-05-24",
    data_final: "2026-06-22",
    dias_periodo: 30,
    dias_previsao: 7,
    dias_validade: 3
  },
  saude_operacional: {
    score: 54,
    classificacao: "atencao",
    mensagem: "Operacao em atencao: validade concentra o maior risco gerencial.",
    pilares: {
      validade: { score: 40, peso: 0.35, fatores: { vencidos: 5 } },
      estoque: { score: 70, peso: 0.25, fatores: { compras_prioritarias: 3 } },
      financeiro: { score: 55, peso: 0.25, fatores: { perdas_sobre_receita_percentual: 8 } },
      giro: { score: 60, peso: 0.15, fatores: { percentual_parados_relevantes: 20 } }
    }
  },
  kpis: {
    receita_total: 1000,
    lucro_bruto_total: 420,
    margem_lucro_percentual: 42,
    valor_estoque_custo: 750,
    valor_estoque_venda: 1300,
    perdas_total_custo: 2626.12,
    alertas_total: 8,
    alertas_criticos: 5,
    produtos_vencidos: 5,
    produtos_proximos_vencimento: 2,
    produtos_estoque_baixo: 3,
    produtos_parados: 4,
    total_alertas: 8
  },
  comparativo_periodo: {
    periodo_anterior: {
      data_inicial: "2026-04-24",
      data_final: "2026-05-23",
      dias_periodo: 30
    },
    indicadores: {
      receita_total: {
        atual: 1000,
        anterior: 800,
        variacao_absoluta: 200,
        variacao_percentual: 25,
        base_relevante: true,
        impacto: "positivo"
      },
      lucro_bruto_total: {
        atual: 420,
        anterior: 350,
        variacao_absoluta: 70,
        variacao_percentual: 20,
        base_relevante: true,
        impacto: "positivo"
      },
      margem_lucro_percentual: {
        atual: 42,
        anterior: 37,
        variacao_pontos_percentuais: 5,
        impacto: "positivo"
      },
      perdas_total_custo: {
        atual: 2626.12,
        anterior: 3,
        variacao_absoluta: 2623.12,
        variacao_percentual: null,
        base_relevante: false,
        impacto: "negativo"
      }
    }
  },
  resumo_executivo: [
    {
      tipo: "saude",
      prioridade: "media",
      mensagem: "Saude operacional em atencao."
    }
  ],
  prioridades_hoje: [
    {
      tipo: "validade_vencida",
      prioridade: "critica",
      produto_id: 15,
      produto_nome: "Banana Nanica",
      causa: "Lote vencido.",
      acao_sugerida: "Retirar do estoque.",
      impacto_estimado: "Evita perda de venda.",
      pontuacao: 95,
      metricas: { categoria: "fruta" }
    }
  ],
  sugestoes_reposicao: [
    {
      produto_id: 15,
      produto_nome: "Banana Nanica",
      prioridade: "alta",
      unidade_medida: "kg",
      quantidade_sugerida: 12.5,
      media_venda_diaria: 4.2,
      dias_cobertura: 1.5
    }
  ],
  risco_validade: {
    vencidos: [],
    proximos_vencimento: [],
    valor_em_risco: 0,
    acao_geral_sugerida: "Sem acao emergencial de validade."
  },
  produtos_parados: [],
  analise_margem: [],
  analise_perdas: [],
  mais_vendidos: [],
  series_graficos: {
    vendas_por_dia: [],
    perdas_por_tipo: [],
    top_produtos: [],
    alertas_por_tipo: []
  }
};

const produto = {
  id: 15,
  nome: "Banana Nanica",
  categoria: "fruta",
  unidade_medida: "kg",
  estoque_minimo: 5,
  preco_venda_padrao: 8.5,
  validade_dias_padrao: 7,
  quantidade_atual: 18,
  quantidade_disponivel_venda: 18,
  quantidade_vencida: 0,
  proxima_validade: "2026-06-29",
  valor_estoque_custo: 70,
  valor_estoque_venda: 153,
  ativo: true
};

const jsonHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "content-type": "application/json"
};

async function mockApi(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: jsonHeaders, body: "" });
      return;
    }

    if (path === "/auth/login") {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ token: "token-e2e", usuario })
      });
      return;
    }

    if (path === "/relatorios/dashboard-inteligente") {
      await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify(dashboard) });
      return;
    }

    if (path === "/produtos/15") {
      await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify(produto) });
      return;
    }

    if (path === "/produtos/15/camadas" || path === "/movimentacoes") {
      await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify([]) });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: jsonHeaders,
      body: JSON.stringify({ error: `Mock nao configurado para ${path}` })
    });
  });
}

test("login, comparativo do dashboard e detalhe do produto priorizado", async ({ page }) => {
  await mockApi(page);

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
  await page.getByLabel("Email").fill("admin@hortifruti.local");
  await page.getByLabel("Senha").fill("admin123");

  const dadosLogin = await page.evaluate(async () => {
    const resposta = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.querySelector("#login-email").value,
        senha: document.querySelector("#login-senha").value
      })
    });

    return resposta.json();
  });

  await page.evaluate(({ token, usuario: usuarioLogado }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
  }, dadosLogin);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBe("token-e2e");
  await expect(page.getByRole("heading", { name: /Dashboard Orientado/i })).toBeVisible();
  await expect(page.getByText("+25,0% vs período anterior")).toBeVisible();
  await expect(page.getByText("+20,0% vs período anterior")).toBeVisible();
  await expect(page.getByText("+5,0 p.p. vs período anterior")).toBeVisible();
  await expect(page.getByText(/\+R\$\s*2\.623,12 vs período anterior/)).toBeVisible();
  await expect(
    page.getByText("Comparado com o período anterior: 24/04/2026 a 23/05/2026")
  ).toBeVisible();

  await page.getByRole("link", { name: /Abrir detalhes de Banana Nanica/i }).click();

  await expect(page).toHaveURL(/\/produtos\/15$/);
  await expect(page.getByRole("heading", { name: "Banana Nanica" })).toBeVisible();
});
