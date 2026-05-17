# Plano de refatoracao SOLID do sistema Hortifruti

Data da analise: 2026-05-17.

Este documento registra um review tecnico e um plano completo de refatoracao orientada a SOLID para o projeto Hortifruti. O objetivo nao e mudar comportamento funcional, endpoints ou telas nesta etapa. O objetivo e criar um caminho seguro para reduzir acoplamento, separar responsabilidades e deixar as regras de negocio mais testaveis.

## Premissas

- Os endpoints HTTP atuais devem continuar aceitando os mesmos payloads e retornando respostas equivalentes.
- A regra de estoque FEFO, calculo de custo, receita, lucro e validade deve ser preservada.
- O banco, os modelos SQLAlchemy e as migracoes atuais continuam sendo a base persistente do sistema.
- A refatoracao deve ser incremental. Cada bloco precisa ter criterio de verificacao objetivo.
- SOLID deve ser aplicado onde reduz risco real. Interfaces, strategies e repositories so devem entrar quando houver ganho concreto.

## Fora de escopo inicial

- Criar funcionalidades novas.
- Alterar regras de permissao/autorizacao.
- Trocar Flask, SQLAlchemy, Marshmallow, Next.js ou PrimeReact.
- Migrar frontend para TypeScript.
- Reorganizar CSS ou layout visual sem necessidade direta da refatoracao.
- Implementar Clean Architecture completa com varias camadas abstratas.

## Resumo do estado atual

O backend Flask esta organizado por blueprints:

- `backend/app/auth/routes.py`
- `backend/app/usuarios/routes.py`
- `backend/app/produtos/routes.py`
- `backend/app/movimentacoes/routes.py`
- `backend/app/relatorios/routes.py`

Os modelos principais ficam em:

- `backend/app/models/usuario.py`
- `backend/app/models/produto.py`
- `backend/app/models/movimentacao.py`
- `backend/app/models/camada_estoque.py`
- `backend/app/models/consumo_saida.py`

O frontend Next.js esta organizado por paginas em `frontend/src/app`, componentes em `frontend/src/components`, contexto de autenticacao em `frontend/src/context` e chamadas HTTP em `frontend/src/services`.

Nao ha uma suite formal de testes automatizados no momento. Existe validacao funcional documentada em `docs/validacao-funcional-hortifruti.md` e uso de `app.test_client()` no script `backend/scripts/seed_showcase.py`.

## Review tecnico

### 1. Rotas de movimentacao concentram regra de negocio

Severidade: alta.

Arquivo principal: `backend/app/movimentacoes/routes.py`.

Evidencias:

- `_registrar_movimentacao` em `backend/app/movimentacoes/routes.py:166` mistura leitura de payload, validacao de usuario/produto, lock de banco, calculo de estoque, calculo financeiro, consumo FEFO, criacao de entidades, commit/rollback e montagem de resposta.
- `list_movimentacoes` em `backend/app/movimentacoes/routes.py:333` mistura parsing de query string, montagem de query SQL, filtros e serializacao.

Impacto:

- Dificulta testar a regra de estoque sem subir contexto HTTP.
- Aumenta risco de regressao em FEFO, arredondamento monetario e transacao.
- Deixa a rota muito sensivel a alteracoes pequenas.

Principios envolvidos:

- SRP: rota, regra de negocio e persistencia estao no mesmo lugar.
- DIP: a regra depende diretamente de `request`, `jsonify` e `db.session`.
- OCP: novos subtipos de saida tenderiam a aumentar condicionais dentro da mesma funcao.

### 2. Relatorios misturam HTTP, consulta, agregacao e serializacao

Severidade: alta.

Arquivo principal: `backend/app/relatorios/routes.py`.

Evidencias:

- `get_mais_vendidos` em `backend/app/relatorios/routes.py:90`.
- `get_financeiro` em `backend/app/relatorios/routes.py:161`.
- `get_validade` em `backend/app/relatorios/routes.py:223`.

Impacto:

- As consultas agregadas sao importantes para o produto, mas hoje ficam presas ao formato de rota Flask.
- Fica dificil testar periodos, datas invalidas e totais financeiros sem depender do endpoint inteiro.
- Parsing de argumentos de data e inteiros positivos aparece tambem em movimentacoes, gerando duplicacao.

Principios envolvidos:

- SRP: endpoints fazem parsing, query, regra de agregacao e serializacao.
- DIP: logica depende de request/global state.

### 3. Modelo Produto faz calculos de apresentacao com data atual implicita

Severidade: media.

Arquivo principal: `backend/app/models/produto.py`.

Evidencia:

- `to_dict` em `backend/app/models/produto.py:144` usa `date.today()` e calcula quantidade vencida, quantidade disponivel para venda, valores de estoque e proxima validade.

Impacto:

- O resultado muda conforme o dia, o que dificulta testes deterministas.
- O modelo SQLAlchemy passa a acumular persistencia, regra temporal e serializacao de API.
- Queries de produto podem disparar calculos baseados em relacionamentos, aumentando o custo sem ficar explicito na rota.

Principios envolvidos:

- SRP: entidade de persistencia tambem faz DTO de API e metrica de estoque.
- DIP: a regra depende diretamente do relogio do sistema.

### 4. Funcoes auxiliares de HTTP e query params estao duplicadas

Severidade: media.

Arquivos principais:

- `backend/app/produtos/routes.py`
- `backend/app/usuarios/routes.py`
- `backend/app/movimentacoes/routes.py`
- `backend/app/relatorios/routes.py`

Exemplos:

- `_json_error`.
- `_load_payload`.
- `_parse_optional_positive_int_arg`.
- `_parse_optional_date_arg`.

Impacto:

- Mudancas de formato de erro podem exigir edicao em varias rotas.
- Validacoes de query string podem divergir com o tempo.

Principios envolvidos:

- SRP: rotas carregam pequenas responsabilidades repetidas.
- DRY nao e SOLID, mas aqui a duplicacao aumenta risco de violar SRP.

### 5. Frontend possui paginas grandes com muitas responsabilidades

Severidade: media.

Arquivos principais:

- `frontend/src/app/(app)/estoque/page.js` com 567 linhas.
- `frontend/src/app/(app)/relatorios/page.js` com 439 linhas.
- `frontend/src/app/(app)/produtos/[id]/page.js` com 369 linhas.
- `frontend/src/app/(app)/usuarios/page.js` com 355 linhas.

Evidencias:

- `validarProdutoForm` em `frontend/src/app/(app)/estoque/page.js:86`.
- `validarMovimentacaoForm` em `frontend/src/app/(app)/estoque/page.js:106`.
- `PaginaEstoque` em `frontend/src/app/(app)/estoque/page.js:118`.
- `PaginaRelatorios` em `frontend/src/app/(app)/relatorios/page.js:62`.
- `PaginaDetalheProduto` em `frontend/src/app/(app)/produtos/[id]/page.js:69`.

Impacto:

- Componentes acumulam estado, chamadas API, validacao, formatacao e renderizacao.
- Reuso entre estoque e detalhe de produto tende a duplicar fluxo de movimentacao.
- Mudancas pequenas de UI podem afetar logica de dados.

Principios envolvidos:

- SRP: componente de pagina faz muitas coisas.
- DIP: paginas dependem diretamente de servicos concretos e de detalhes de armazenamento.

### 6. Service de produtos no frontend tambem resolve usuario autenticado

Severidade: baixa.

Arquivo principal: `frontend/src/services/produtosService.js`.

Evidencia:

- `incluirUsuarioAutenticado` em `frontend/src/services/produtosService.js:31` le `localStorage` para incluir `usuario_id` na movimentacao.

Impacto:

- O servico de produtos conhece detalhe de autenticacao.
- Dificulta testar chamadas de movimentacao sem mockar `localStorage`.

Principios envolvidos:

- SRP: service de produto/movimentacao tambem faz resolucao de identidade local.
- DIP: dependencia direta de browser storage.

### 7. Falta de testes automatizados aumenta risco da refatoracao

Severidade: alta.

Evidencia:

- Nao foi encontrado framework de teste formal no backend ou frontend, fora dependencias transitivas e uso pontual de `test_client` no script de seed.
- A validacao funcional esta bem documentada em `docs/validacao-funcional-hortifruti.md`, mas ainda nao esta expressa como suite automatizada independente.

Impacto:

- Refatorar SOLID sem testes cria risco alto de regressao silenciosa.
- As regras mais sensiveis, especialmente FEFO e calculo financeiro, precisam de testes de caracterizacao antes de mover codigo.

## Leitura SOLID aplicada ao projeto

### SRP - Single Responsibility Principle

Maior prioridade do projeto.

Aplicacao desejada:

- Rotas Flask cuidam de HTTP: receber payload/filtros, chamar caso de uso, devolver resposta.
- Services cuidam de regra de negocio e coordenacao transacional.
- Query builders ou services de relatorio cuidam de agregacoes.
- Serializers cuidam de transformar modelos em respostas.
- Componentes React cuidam de interface, enquanto hooks/helpers cuidam de carregamento, validacao e formatacao quando houver reuso real.

### OCP - Open/Closed Principle

Prioridade moderada.

Aplicacao desejada:

- Separar entrada e saida de estoque em metodos claros.
- Evitar criar uma Strategy para cada subtipo agora, porque existem poucos subtipos.
- Reavaliar Strategy apenas se surgirem novos subtipos com regras diferentes, como devolucao, ajuste, transferencia ou promocao.

### LSP - Liskov Substitution Principle

Prioridade baixa neste momento.

Aplicacao desejada:

- Nao criar hierarquias de classes sem necessidade.
- Se futuramente houver interfaces de repositorio ou calculadores, garantir que implementacoes substitutas respeitem o mesmo contrato de erros, transacao e retorno.

### ISP - Interface Segregation Principle

Prioridade baixa neste momento.

Aplicacao desejada:

- Evitar interfaces grandes como `SistemaEstoqueRepository` com metodos de produto, usuario, estoque e relatorio juntos.
- Se repositorios forem criados, manter contratos pequenos e por caso de uso.
- No frontend, evitar hooks gigantes que devolvem estado e acoes de telas inteiras sem necessidade.

### DIP - Dependency Inversion Principle

Prioridade alta para backend, moderada para frontend.

Aplicacao desejada:

- Services recebem `session` como dependencia ou usam uma funcao de fabrica controlada pela rota.
- Logica sensivel a data recebe `data_referencia` quando necessario.
- Funcoes puras de calculo recebem dados e devolvem resultado sem depender de Flask, request, jsonify ou localStorage.
- No frontend, helpers de autenticacao devem ser separados dos services de dominio.

## Arquitetura alvo pragmatica

Nao e necessario criar uma arquitetura com muitas pastas abstratas. A sugestao e manter a organizacao por modulo funcional e adicionar services locais.

Estrutura backend sugerida:

```text
backend/app/
  shared/
    http.py
    query_params.py
    money.py
  produtos/
    routes.py
    service.py
  usuarios/
    routes.py
    service.py
  movimentacoes/
    routes.py
    service.py
    serializers.py
  relatorios/
    routes.py
    service.py
  serializers/
    produto.py
    usuario.py
```

Observacoes:

- `shared/http.py`: respostas de erro e carga de payload JSON, se isso reduzir duplicacao sem esconder demais o Flask.
- `shared/query_params.py`: parse de inteiro positivo, data ISO e enum.
- `shared/money.py`: arredondamento monetario com `Decimal("0.01")`.
- Services recebem `db.session` ou usam uma dependencia clara passada pela rota.
- Serializers podem ser adicionados aos poucos. Nao e necessario remover todos os `to_dict` no primeiro bloco.

Estrutura frontend sugerida:

```text
frontend/src/
  services/
    api.js
    authStorage.js
    produtosService.js
    movimentacoesService.js
    relatoriosService.js
    usuariosService.js
  utils/
    formatters.js
    validators.js
  hooks/
    useProdutos.js
    useMovimentacaoForm.js
    useRelatorios.js
  components/
    ProdutoForm.js
    MovimentacaoDialog.js
```

Observacoes:

- Esta estrutura deve ser criada somente quando a fase frontend comecar.
- Evitar mover tudo de uma vez. Primeiro extrair o que ja e duplicado entre estoque e detalhe de produto.

## Plano de refatoracao por fases

### Fase 0 - Base de seguranca antes da refatoracao

Objetivo:

Criar testes de caracterizacao para proteger o comportamento existente.

Escopo:

- Adicionar uma configuracao minima de testes no backend com `pytest`.
- Criar fixtures para app Flask e banco SQLite temporario.
- Automatizar os fluxos mais criticos documentados em `docs/validacao-funcional-hortifruti.md`.

Testes minimos:

- Health check retorna 200.
- Login valido e login invalido.
- Criar usuario e bloquear email duplicado.
- Criar produto e bloquear produto duplicado por nome/categoria.
- Registrar entrada e conferir produto, movimentacao e camada.
- Registrar venda e conferir FEFO, consumo, receita, custo e lucro.
- Bloquear saida maior que estoque.
- Registrar perda sem receita.
- Relatorio financeiro reflete venda, perda e estoque restante.
- Relatorio de validade respeita dias de alerta.
- Produto inativo bloqueia nova movimentacao.

Arquivos provaveis:

- `backend/tests/conftest.py`
- `backend/tests/test_fluxo_funcional.py`
- `backend/requirements.txt`

Verificacao:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Criterio de conclusao:

- Testes passam antes de qualquer extracao de service.
- Nenhum endpoint mudou.

### Fase 1 - Utilitarios compartilhados pequenos

Objetivo:

Remover duplicacoes de baixo risco e preparar rotas para ficarem mais finas.

Escopo:

- Extrair `_json_error`.
- Extrair carga de payload JSON validado por schema.
- Extrair parsers de query string: inteiro positivo, data ISO e enum.
- Extrair arredondamento monetario, se continuar usado em mais de um lugar.

Arquivos provaveis:

- `backend/app/shared/http.py`
- `backend/app/shared/query_params.py`
- `backend/app/shared/money.py`
- Rotas que usam essas funcoes.

Principios:

- SRP.
- DIP leve, porque as funcoes deixam de depender implicitamente de cada rota.

Verificacao:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Risco:

- Baixo. A maior atencao e manter o mesmo formato de erro.

### Fase 2 - Service de usuarios e produtos

Objetivo:

Comecar por casos de uso simples para validar o padrao antes de mexer em movimentacoes.

Escopo usuarios:

- Criar usuario.
- Atualizar perfil/status.
- Tratar conflito de email duplicado.
- Manter rota responsavel apenas por HTTP.

Escopo produtos:

- Listar produto.
- Buscar produto.
- Listar camadas abertas.
- Criar produto.
- Atualizar produto.
- Inativar produto.
- Tratar conflito de nome/categoria duplicado.

Arquivos provaveis:

- `backend/app/usuarios/service.py`
- `backend/app/produtos/service.py`
- `backend/app/usuarios/routes.py`
- `backend/app/produtos/routes.py`

Principios:

- SRP: rotas deixam de coordenar persistencia diretamente.
- DIP: services recebem sessao ou encapsulam operacoes de banco em ponto unico.

Verificacao:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Risco:

- Medio-baixo. Ha menos regra complexa que em movimentacoes, mas conflitos de integridade devem manter status 409.

### Fase 3 - Service de movimentacoes

Objetivo:

Separar a regra central de estoque da camada HTTP.

Escopo:

- Criar `MovimentacaoService`.
- Separar `registrar_entrada`.
- Separar `registrar_saida`.
- Manter uma funcao interna clara para selecionar camadas FEFO.
- Manter calculo monetario com `Decimal` e arredondamento atual.
- Manter commit/rollback controlado e previsivel.
- Retornar um resultado de aplicacao que a rota transforma em JSON.

Arquivos provaveis:

- `backend/app/movimentacoes/service.py`
- `backend/app/movimentacoes/routes.py`
- `backend/app/movimentacoes/serializers.py`, se a serializacao ficar grande.

Desenho sugerido:

```python
class MovimentacaoService:
    def __init__(self, session, hoje_provider=date.today):
        self.session = session
        self.hoje_provider = hoje_provider

    def registrar_entrada(self, data):
        ...

    def registrar_saida(self, data):
        ...
```

Erros de dominio:

- Criar excecoes simples, como `DomainError(message, status_code)`, apenas se isso deixar as rotas mais limpas.
- Alternativa mais simples: service retorna objeto de resultado com sucesso/erro. Escolher uma abordagem e manter consistencia.

Principios:

- SRP: regra de negocio sai da rota.
- DIP: service recebe `session` e provider de data.
- OCP moderado: entrada e saida ficam separadas, reduzindo condicionais.

Verificacao:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Casos obrigatorios:

- Entrada cria camada com validade correta.
- Venda consome camada em FEFO.
- Venda ignora camada vencida.
- Perda pode consumir vencida quando regra atual permitir.
- Estoque insuficiente retorna 409 sem gravar movimentacao.
- Produto inativo retorna 409.
- Usuario inativo retorna 409.

Risco:

- Alto. Esta fase toca a regra mais importante do sistema.

Mitigacao:

- Fazer em um bloco isolado.
- Rodar testes antes e depois.
- Comparar respostas JSON dos endpoints principais.

### Fase 4 - Service de relatorios

Objetivo:

Separar agregacoes de relatorio da camada HTTP e tornar periodos mais testaveis.

Escopo:

- Criar `RelatorioService`.
- Mover queries de mais vendidos, financeiro e validade para o service.
- Receber `data_referencia` no relatorio de validade e no calculo de estoque por venda.
- Manter rotas apenas com parsing de filtros e serializacao.

Arquivos provaveis:

- `backend/app/relatorios/service.py`
- `backend/app/relatorios/routes.py`

Principios:

- SRP.
- DIP, por dependencia explicita de sessao e data de referencia.

Verificacao:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Casos obrigatorios:

- Mais vendidos respeita limite e periodo.
- Financeiro soma receita, custo, lucro e perdas.
- Validade separa vencidos e proximos vencimentos.
- Data invalida retorna 400 antes da query principal.

Risco:

- Medio. As queries agregadas podem mudar resultado por detalhes de `coalesce`, filtros ou join.

### Fase 5 - Serializacao e metricas de produto

Objetivo:

Reduzir responsabilidade do modelo `Produto`.

Escopo:

- Criar serializer de produto que recebe `reference_date`.
- Mover calculos de estoque derivados para helper/service quando fizer sentido.
- Manter `to_dict` temporariamente como compatibilidade ou substituir chamadas aos poucos.

Arquivos provaveis:

- `backend/app/serializers/produto.py`
- `backend/app/models/produto.py`
- Rotas/services que retornam produto.

Principios:

- SRP: modelo persiste dados, serializer monta resposta.
- DIP: calculo deixa de depender diretamente de `date.today()`.

Verificacao:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Risco:

- Medio. Pode alterar campos derivados exibidos no frontend.

### Fase 6 - Frontend: extracoes pequenas e com reuso real

Objetivo:

Reduzir tamanho e acoplamento das paginas sem mudar layout.

Escopo inicial:

- Extrair formatadores repetidos para `frontend/src/utils/formatters.js`.
- Extrair validadores de produto/movimentacao para `frontend/src/utils/validators.js`.
- Separar `movimentacoesService.js` de `produtosService.js`.
- Mover leitura de usuario autenticado para `authStorage.js` ou para o contexto de autenticacao.

Escopo posterior:

- Extrair `MovimentacaoDialog` compartilhado entre estoque e detalhe do produto.
- Extrair `ProdutoForm` se a edicao/cadastro crescer.
- Criar hooks apenas para fluxos com estado repetido, como `useRelatorios` ou `useProdutos`.

Arquivos provaveis:

- `frontend/src/services/produtosService.js`
- `frontend/src/services/movimentacoesService.js`
- `frontend/src/services/authStorage.js`
- `frontend/src/utils/formatters.js`
- `frontend/src/utils/validators.js`
- `frontend/src/app/(app)/estoque/page.js`
- `frontend/src/app/(app)/produtos/[id]/page.js`
- `frontend/src/app/(app)/relatorios/page.js`

Principios:

- SRP.
- DIP moderado: paginas passam a depender de helpers mais estreitos.
- ISP: evitar hooks genericos demais.

Verificacao:

```powershell
cd frontend
npm run build
```

Se houver testes frontend no futuro:

```powershell
npm test
```

Risco:

- Medio. Mesmo sem mudar regra, mover componentes pode quebrar estado de modal, filtros ou carregamento.

### Fase 7 - Repositorios ou interfaces, apenas se necessario

Objetivo:

Avaliar se o projeto realmente precisa abstrair acesso a dados.

Quando faz sentido:

- Se os services ficarem dificeis de testar por dependerem muito de SQLAlchemy.
- Se houver necessidade de substituir banco ou criar implementacoes fake.
- Se queries comecarem a ser reaproveitadas por muitos services.

Quando nao faz sentido:

- Se a unica implementacao for SQLAlchemy e os testes com SQLite cobrirem bem os casos.
- Se criar repositorios apenas mover uma linha de `Produto.query` para outro arquivo sem reduzir complexidade.

Principios:

- DIP e ISP, mas somente com ganho real.

Verificacao:

- Tests de service devem ficar mais simples, nao mais complexos.

## Ordem recomendada

1. Fase 0: testes de caracterizacao.
2. Fase 1: utilitarios compartilhados pequenos.
3. Fase 2: usuarios e produtos.
4. Fase 3: movimentacoes.
5. Fase 4: relatorios.
6. Fase 5: serializacao e metricas de produto.
7. Fase 6: frontend.
8. Fase 7: repositorios/interfaces, se a dor aparecer.

## Criterios de sucesso

Backend:

- `pytest backend/tests` passa.
- Os 26 cenarios de `docs/validacao-funcional-hortifruti.md` continuam cobertos.
- Endpoints, status codes e campos JSON permanecem equivalentes.
- Rotas deixam de conter regra longa de dominio.
- Services podem ser testados sem depender diretamente de `request` e `jsonify`.
- Datas sensiveis podem ser controladas em testes.

Frontend:

- `npm run build` passa.
- Telas de estoque, detalhe do produto, PDV, dashboard, usuarios e relatorios continuam acessando os mesmos services.
- Validadores e formatadores repetidos passam a ter ponto unico.
- Paginas reduzem responsabilidades sem alterar experiencia visual.

Codigo:

- Cada fase deve gerar diff pequeno e revisavel.
- Cada arquivo alterado deve estar ligado diretamente ao objetivo da fase.
- Nao remover codigo morto preexistente que nao seja consequencia direta da fase.

## Riscos principais

### FEFO e transacao

Risco:

- Alterar ordem de consumo de camadas ou pontos de `flush`/`commit`.

Mitigacao:

- Testes especificos para multiplas camadas com validades diferentes.
- Conferir `quantidade_disponivel`, `consumos_saida` e `movimentacoes`.

### Decimal e arredondamento

Risco:

- Trocar sem querer `Decimal` por `float` em calculos financeiros.

Mitigacao:

- Manter calculos em `Decimal`.
- Testar custo total, receita total e lucro bruto.

### Data atual implicita

Risco:

- Testes ficarem instaveis por dependerem de `date.today()`.

Mitigacao:

- Injetar `data_referencia` nos services/serializers.

### Formato de erro

Risco:

- Refatoracao mudar de `{"error": ...}` para outro formato sem querer.

Mitigacao:

- Testes de status code e corpo de erro nos casos negativos.

### Frontend com estado de modal

Risco:

- Extracoes quebrarem abertura/fechamento de dialogs ou reset de formulario.

Mitigacao:

- Refatorar um fluxo por vez.
- Validar manualmente estoque e detalhe do produto apos cada extracao.

## Antipadroes a evitar

- Criar interfaces abstratas para tudo antes de haver mais de uma implementacao.
- Criar uma camada repository que apenas repete chamadas SQLAlchemy sem simplificar testes.
- Separar arquivos por principio SOLID em vez de separar por responsabilidade real.
- Refatorar backend e frontend no mesmo commit/bloco.
- Reformatar arquivos inteiros junto com mudancas estruturais.
- Mudar nomes de campos JSON durante refatoracao.
- Mudar regras de negocio enquanto move codigo.

## Checklist por bloco de execucao

Antes:

- Rodar testes existentes ou validacao funcional disponivel.
- Identificar exatamente quais endpoints/telas o bloco toca.
- Definir criterio de sucesso do bloco.

Durante:

- Mover uma responsabilidade por vez.
- Manter nomes e contratos publicos sempre que possivel.
- Evitar melhorar codigo vizinho sem relacao direta.

Depois:

- Rodar testes automatizados do bloco.
- Conferir `git diff` para garantir que o escopo ficou restrito.
- Registrar riscos residuais se algum teste nao puder ser executado.

## Primeiro bloco sugerido

O primeiro bloco deve ser a Fase 0.

Entrega esperada:

- Suite minima de testes backend.
- Cobertura automatizada dos fluxos principais de usuario, produto, movimentacao e relatorio.
- Nenhuma alteracao funcional.

Com essa base, a refatoracao SOLID pode avancar sem depender de verificacao manual a cada mudanca estrutural.
