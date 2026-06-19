# Handoff de reformulação do frontend

## Objetivo

Reformular integralmente a experiência visual do sistema Hortifruti sem alterar, na primeira etapa, as regras de negócio já validadas.

O frontend deve deixar de parecer um conjunto de cartões e tabelas independentes e passar a funcionar como um produto operacional coeso, com:

- melhor aproveitamento horizontal e vertical;
- hierarquia clara entre operação, alerta e análise;
- navegação desktop e mobile adequadas a cada contexto;
- componentes e estados consistentes;
- maior velocidade de leitura e execução das tarefas frequentes.

## Diagnóstico geral

O sistema possui boa cobertura funcional e uma estrutura de rotas simples, mas a interface atual não estabelece uma identidade forte nem prioriza bem o trabalho do usuário.

Os principais problemas não são apenas de cor ou espaçamento:

1. O cabeçalho global ocupa `64px` e exibe somente o nome "Hortifruti", sem título da página, contexto, ações ou informações úteis.
2. A barra lateral fixa usa `260px`, repete a marca e mantém muito espaço sem função.
3. Cada tela recria seu próprio cabeçalho, painel, cartões e formulários em CSS Modules, gerando repetição e pequenas inconsistências.
4. Quase todas as áreas usam o mesmo tratamento visual: fundo branco, borda, sombra e faixa verde superior. Isso reduz a hierarquia.
5. O dashboard distribui informações, mas não diferencia claramente o que exige ação do que é apenas indicador.
6. O PDV ocupa somente a parte superior da tela e deixa grande área vazia, enquanto a seleção de produto depende de um dropdown pouco adequado para operação rápida.
7. Estoque e relatórios concentram muita informação em tabelas extensas, com ações repetidas e leitura difícil.
8. No mobile, a barra lateral vira um bloco superior de aproximadamente `227px`, a navegação horizontal fica cortada e o botão "Sair" ganha destaque excessivo.
9. Há responsividade técnica, mas não existe uma experiência mobile desenhada para a prioridade das tarefas.
10. Loading, erro e vazio existem, porém loading ainda depende principalmente dos componentes do PrimeReact e não preserva a estrutura visual da página.

## Evidências da interface atual

Inspeção realizada em viewport desktop de aproximadamente `1280x720` e mobile de `390x844`.

| Antes | Depois | Por quê |
| --- | --- | --- |
| Cabeçalho global com apenas "Hortifruti" | Topbar com título, contexto, ação principal e usuário | Recupera espaço e elimina o segundo cabeçalho solto dentro de cada página |
| Sidebar fixa de `260px` | Sidebar compacta de `224px`, recolhível, ou rail de `72px` | Amplia a área útil sem prejudicar a navegação |
| Mobile com sidebar empilhada e menu cortado | Topbar compacta + navegação inferior ou drawer | Mantém conteúdo e ação principal acima da dobra |
| Cartões brancos com o mesmo peso visual | Superfícies neutras e destaque reservado a alertas e ações | Cria hierarquia e reduz ruído |
| Faixa verde superior em quase todo painel | Cor semântica aplicada somente onde informa estado | Evita decoração repetitiva sem significado |
| PDV baseado em dropdown | Busca de produto em foco, resultados rápidos e resumo fixo | Reduz passos na operação mais repetitiva |
| Ações completas repetidas em cada linha do estoque | Ação principal direta + menu secundário | Reduz largura e melhora a leitura da tabela |
| Seis métricas financeiras com o mesmo peso | KPIs principais, comparativos e detalhes em níveis distintos | Facilita entender resultado e risco |
| Loading com conteúdo desaparecendo ou `--` | Skeleton com o mesmo formato do conteúdo final | Reduz mudança brusca e melhora percepção de velocidade |
| Hover simples sem feedback de pressão | Estados `hover`, `focus-visible` e `active` consistentes | Faz controles parecerem responsivos e acessíveis |

## Acertos estruturais a preservar

- Separação clara entre área autenticada e login.
- Rotas curtas e compreensíveis.
- Controle de acesso da tela de usuários por perfil.
- Uso de componentes prontos para tabela, diálogo, formulário e feedback.
- Estados vazios já tratados em todas as áreas principais.
- Ações de entrada e saída reutilizam o mesmo modal.
- Dados financeiros, validade, estoque e movimentações já estão disponíveis.
- Regras FEFO e restrições de estoque permanecem responsabilidade do backend.
- Identidade cromática verde é coerente com o domínio e deve ser refinada, não descartada.

## Princípios da nova interface

### 1. Operação primeiro

O produto deve privilegiar as tarefas diárias:

- localizar produto;
- registrar entrada;
- registrar venda;
- registrar perda;
- identificar estoque vencido ou baixo;
- consultar resultado.

### 2. Densidade controlada

Mais conteúdo útil por tela, sem comprimir indiscriminadamente:

- espaço vertical base de `4px`;
- controles com altura entre `36px` e `40px` no desktop;
- cards de KPI entre `88px` e `104px`;
- painéis sem padding duplicado;
- tabelas com linhas de `48px` a `56px`;
- conteúdo principal com largura fluida e máximo entre `1440px` e `1600px`.

### 3. Cor com significado

- Verde: ação principal, saúde e resultado positivo.
- Âmbar: atenção e vencimento próximo.
- Vermelho: vencido, perda, bloqueio ou risco crítico.
- Cinza: informação neutra, inatividade e estrutura.

Não usar verde apenas para decorar todas as superfícies.

### 4. Hierarquia tipográfica

- Título de página: `28px` a `32px`, peso 650-700.
- Título de seção: `18px` a `20px`.
- KPI: `24px` a `32px`.
- Corpo: `14px` a `15px`.
- Metadado: `12px` a `13px`.

Manter uma única família tipográfica e reduzir o uso de negrito em textos secundários.

### 5. Movimento discreto

- Sem animação em navegação e ações usadas dezenas de vezes ao dia.
- Feedback de pressão em botões: `transform: scale(0.98)` por `120-160ms`.
- Diálogos, menus e toasts: entrada de `160-220ms` com `ease-out`.
- Animar somente `transform` e `opacity`.
- Respeitar `prefers-reduced-motion`.

## Arquitetura visual sugerida

### Shell desktop

- Sidebar com marca compacta, navegação, perfil e saída no rodapé.
- Topbar da página com breadcrumb opcional, título e ação principal.
- Conteúdo fluido, sem um segundo cabeçalho interno.
- Sidebar recolhível para ampliar tabelas e relatórios.

### Shell mobile

- Topbar de `56px` com marca/título e botão de menu.
- Navegação principal em drawer; considerar barra inferior para Painel, Estoque e PDV.
- Ações principais fixadas na área inferior somente quando isso ajudar a tarefa, como confirmar venda.
- Tabelas transformadas em lista de cartões ou visualização com colunas prioritárias.

### Componentes-base

Criar componentes pequenos, sem introduzir um design system excessivo:

- `AppShell`
- `PageHeader`
- `SectionCard`
- `MetricCard`
- `StatusBadge`
- `FilterBar`
- `DataState` para loading, vazio e erro
- `ResponsiveDataView`
- `ConfirmAction`

O PrimeReact pode continuar sendo usado. A reformulação não exige troca de biblioteca.

## Mapa final de rotas sugerido

| Rota | Papel | Observação |
| --- | --- | --- |
| `/login` | Autenticação | Manter |
| `/dashboard` | Visão operacional e alertas | Manter |
| `/estoque` | Lista, filtros e movimentação rápida | Manter |
| `/produtos/[id]` | Detalhe, lotes e histórico | Manter |
| `/pdv` | Registro rápido de venda | Manter |
| `/relatorios` | Análise e exportação | Manter |
| `/usuarios` | Gestão de acesso | Manter, somente gerente |
| `/produtos` | Redirecionamento legado | Manter temporariamente e remover quando não houver referências externas |

Não há necessidade imediata de novas rotas. Entrada, saída, cadastro e edição podem continuar em diálogos ou drawers.

## Blueprint por tela

### Login

Direção:

- composição em duas colunas no desktop;
- lado visual com marca, mensagem curta e textura/ilustração sutil do domínio;
- formulário compacto no lado funcional;
- em mobile, exibir somente marca e formulário.

Evitar uma tela inteira de gradiente com um cartão pequeno flutuando no centro.

### Dashboard

Estrutura:

1. Saudação/contexto do dia e ação rápida.
2. Faixa de KPIs: vendas do dia, receita, estoque em risco e perdas.
3. Bloco prioritário "Precisa de atenção" com estoque baixo, vencidos e próximos do vencimento.
4. Atividade recente.
5. Atalhos operacionais.

O dashboard deve responder primeiro: "o que preciso resolver agora?".

### Estoque

Estrutura:

1. Cabeçalho com título, quantidade de produtos e botão "Novo produto".
2. Filtros compactos na mesma superfície da tabela.
3. Resumo por status em chips ou cards baixos e clicáveis.
4. Tabela desktop com colunas prioritárias.
5. Lista mobile com nome, saldo, validade, status e ação principal.

Mudanças importantes:

- reduzir ações visíveis por linha;
- tornar status clicável para aplicar filtro;
- separar saldo disponível de saldo vencido sem empilhar texto excessivo;
- usar drawer lateral para entrada/saída em desktop e tela cheia no mobile.

### Detalhe do produto

Estrutura:

1. Breadcrumb e título com status.
2. Resumo principal de saldo, validade e valor.
3. Ações "Entrada", "Venda/saída" e menu secundário.
4. Abas: `Visão geral`, `Lotes`, `Movimentações`.

A divisão em abas reduz o comprimento da página sem esconder dados essenciais.

### PDV

Estrutura desktop:

1. Busca de produto em foco, com atalho para limpar.
2. Lista de resultados ou produtos recentes/frequentes.
3. Painel lateral de venda com quantidade, preço, estoque e total.
4. Histórico curto da sessão abaixo ou em painel recolhível.

Estrutura mobile:

1. Busca.
2. Produto selecionado.
3. Quantidade.
4. Resumo.
5. Botão "Confirmar venda" fixo na base.

O dropdown atual deve ser substituído por uma experiência de busca e seleção mais rápida.

### Relatórios

Estrutura:

1. Filtros em barra recolhível, com período em destaque.
2. KPIs principais: receita, lucro, perdas e valor de estoque.
3. Visualização financeira.
4. Validade e produtos mais vendidos.
5. Tabela detalhada e exportação.

Os seis cards atuais não devem ter o mesmo peso. Custo e estoque à venda podem ficar como métricas secundárias.

### Usuários

Estrutura:

1. Cabeçalho com total e ação "Novo usuário".
2. Filtros por nome, perfil e status.
3. Tabela compacta.
4. Edição em drawer ou diálogo.

Adicionar feedback visual claro para o próprio usuário e para usuários inativos.

## Dados mínimos, BFF e cobertura

| Tela | Dados mínimos | Dependência atual | Cobertura |
| --- | --- | --- | --- |
| Login | e-mail, senha, usuário autenticado | `POST /auth/login` | Completa |
| Dashboard | produtos, movimentações recentes, vendas do dia, financeiro, validade | 5 requisições paralelas | Completa, mas agregação seria desejável |
| Estoque | produtos com saldo, validade, valor e status | `GET /produtos` | Completa |
| Detalhe | produto, camadas abertas e movimentações | 3 requisições paralelas | Completa |
| PDV | produtos ativos, preço e saldo disponível | `GET /produtos`, `POST /movimentacoes/saida` | Completa |
| Relatórios | produtos, ranking, financeiro, validade e histórico | 5 requisições paralelas | Completa |
| Usuários | lista, criação e atualização de perfil/status | endpoints de usuários | Completa |

### Dependências de BFF recomendadas

Não são bloqueadoras para iniciar a reformulação visual.

Prioridade posterior:

1. `GET /dashboard/resumo`: agregar KPIs, alertas e atividade recente.
2. Paginação e filtros no backend para produtos e movimentações.
3. Busca de produtos por termo para o PDV quando o catálogo crescer.
4. Séries temporais financeiras para gráficos reais por dia/semana/mês.
5. Endpoint de atualização/inativação de produto exposto no serviço do frontend.

### Lacunas de dados

- O gráfico financeiro atual compara totais, mas não possui série temporal.
- O PDV não possui produtos favoritos, recentes persistidos ou busca remota.
- Não há comparação com período anterior nos KPIs.
- A interface de detalhe não expõe atualização ou inativação do produto, apesar de o backend suportar.
- A lista de movimentações usa limite, mas não possui paginação real controlada pelo servidor.

Não desenhar tendências, percentuais de crescimento ou previsões até esses dados existirem.

## Estados obrigatórios

Cada tela deve prever:

- loading estrutural com skeleton;
- vazio inicial;
- vazio causado por filtros;
- erro recuperável com ação "Tentar novamente";
- sucesso após escrita;
- ação desabilitada com motivo claro;
- confirmação para ações destrutivas;
- conteúdo parcial quando uma requisição secundária falhar.

No dashboard e relatórios, uma falha em um bloco não deve necessariamente ocultar todos os demais.

## Ordem recomendada de implementação

### Bloco 1: fundação visual

- tokens globais;
- tipografia;
- cores semânticas;
- espaçamento;
- estados de foco;
- botões e campos;
- shell desktop/mobile;
- componentes de página.

Verificação: login e páginas autenticadas usam a mesma estrutura sem regressão de navegação.

### Bloco 2: estoque e detalhe

- nova tabela/lista responsiva;
- filtros;
- status;
- drawer de movimentação;
- detalhe em abas.

Verificação: cadastro, entrada, saída, filtros e consulta de lote continuam funcionando.

### Bloco 3: PDV

- busca rápida;
- resumo persistente;
- confirmação;
- histórico da sessão;
- fluxo mobile.

Verificação: venda válida, estoque insuficiente, estoque vencido e limpeza do formulário.

### Bloco 4: dashboard

- nova hierarquia;
- alertas acionáveis;
- atividade recente;
- atalhos.

Verificação: todos os indicadores batem com os dados atuais.

### Bloco 5: relatórios

- filtros;
- hierarquia dos KPIs;
- gráficos;
- tabelas;
- exportação.

Verificação: filtros, CSV e impressão/PDF continuam corretos.

### Bloco 6: usuários e polimento

- lista e formulários;
- estados de permissão;
- loading, vazio e erro;
- acessibilidade;
- revisão mobile;
- motion discreto.

Verificação: gerente mantém acesso e funcionário continua redirecionado.

## Critérios de aceite visual

- Em `1280px`, o conteúdo útil começa até aproximadamente `80px` abaixo do topo.
- Nenhuma tela desktop relevante deixa mais da metade da primeira dobra sem conteúdo útil.
- A ação principal de cada página é identificável em menos de três segundos.
- Em `390px`, o conteúdo começa sem uma navegação empilhada ocupando mais de `64px`.
- Não existe rolagem horizontal na página.
- Tabelas mobile não dependem de arrastar uma tabela larga para entender o registro.
- Cores de alerta mantêm contraste acessível e não são o único indicador de estado.
- Todos os controles possuem `focus-visible`.
- Componentes interativos têm estados `hover`, `active`, `disabled` e loading.
- O layout funciona com textos maiores e nomes de produto longos.
- Skeletons preservam a geometria aproximada do conteúdo final.
- A interface permanece utilizável com `prefers-reduced-motion`.

## Restrições e decisões seguras

- Não trocar Next.js, React ou PrimeReact durante a reformulação.
- Não misturar reforma visual com refatoração ampla do backend.
- Não criar gráficos de tendência sem dados temporais reais.
- Não remover rotas ou fluxos antes de confirmar referências.
- Não aplicar animações longas em ações operacionais.
- Não criar um design system genérico além dos componentes realmente usados pelo produto.

## Próximos refinamentos seguros

1. Produzir wireframes de baixa fidelidade para shell, estoque, PDV e dashboard.
2. Fechar tokens visuais e dois estados de densidade: desktop e touch.
3. Prototipar primeiro o shell e a tela de estoque com dados reais.
4. Validar o fluxo de PDV em desktop e celular antes de aplicar o padrão às telas restantes.
5. Só então detalhar animações, ilustrações e acabamento.

## Definição de pronto da reformulação

A reformulação estará concluída quando todas as rotas atuais usarem o novo shell e os novos componentes, os fluxos funcionais existentes continuarem válidos, os estados de loading/vazio/erro estiverem cobertos e a experiência mobile não for apenas uma versão empilhada do desktop.
