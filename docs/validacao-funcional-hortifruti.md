# Validação funcional do sistema Hortifruti

Este documento descreve como validar, a partir do código, as 26 funcionalidades verificadas no sistema Hortifruti. O foco é registrar o funcionamento real da aplicação, indicando quais entradas são enviadas, quais regras o backend executa e quais registros são gravados ou consultados no banco.

## Base técnica

O backend é uma API Flask registrada em `backend/app/__init__.py`. As rotas principais são:

- Autenticação: `backend/app/auth/routes.py`
- Usuários: `backend/app/usuarios/routes.py`
- Produtos: `backend/app/produtos/routes.py`
- Movimentações de estoque: `backend/app/movimentacoes/routes.py`
- Relatórios: `backend/app/relatorios/routes.py`

As tabelas principais ficam nos modelos:

- `usuarios`: `backend/app/models/usuario.py`
- `produtos`: `backend/app/models/produto.py`
- `movimentacoes`: `backend/app/models/movimentacao.py`
- `camadas_estoque`: `backend/app/models/camada_estoque.py`
- `consumos_saida`: `backend/app/models/consumo_saida.py`

Os dados de teste podem ser reiniciados com:

```powershell
.\backend\.venv\Scripts\python.exe backend\scripts\reset_demo.py
```

Esse script limpa `consumos_saida`, `camadas_estoque`, `movimentacoes`, `produtos` e `usuarios`, depois recria os usuários padrão:

- `admin@hortifruti.local / admin123` como gerente ativo
- `gerente@hortifruti.local / demo123` como gerente ativo
- `estoque@hortifruti.local / demo123` como funcionário ativo
- `caixa@hortifruti.local / demo123` como funcionário ativo
- `temporario@hortifruti.local / demo123` como funcionário inativo

## Registros de teste usados na rodada

Para as operações de escrita, use os seguintes dados:

Usuário de validação:

```json
{
  "nome": "Usuário Validação",
  "email": "validacao.funcional@hortifruti.local",
  "senha": "teste123",
  "perfil": "funcionario",
  "ativo": true
}
```

Produto de validação:

```json
{
  "nome": "Produto Validação Funcional",
  "categoria": "legume",
  "unidade_medida": "kg",
  "estoque_minimo": "5.000",
  "preco_venda_padrao": "10.00",
  "validade_dias_padrao": 10
}
```

Entrada de estoque:

```json
{
  "produto_id": "<id do produto criado>",
  "data": "2026-05-17",
  "quantidade": "20.000",
  "custo_unitario": "4.00",
  "observacao": "validação entrada"
}
```

Saída por venda:

```json
{
  "produto_id": "<id do produto criado>",
  "data": "2026-05-18",
  "quantidade": "5.000",
  "subtipo": "venda",
  "preco_unitario_venda": "12.50",
  "observacao": "validação venda"
}
```

Saída por perda:

```json
{
  "produto_id": "<id do produto criado>",
  "data": "2026-05-19",
  "quantidade": "2.000",
  "subtipo": "perda",
  "observacao": "validação perda"
}
```

## Como cada funcionalidade funciona

### 1. Health check da API

- Endpoint: `GET /api/health`
- Código: `backend/app/__init__.py`
- O que faz: retorna um JSON simples indicando que o backend está online.
- Entrada: nenhuma.
- Resultado esperado: HTTP `200` com `{"service": "hortifruti-backend", "status": "ok"}`.
- Banco: não acessa nem altera registros.

### 2. Login válido

- Endpoint: `POST /api/auth/login`
- Código: `backend/app/auth/routes.py`
- O que faz: recebe `email` e `senha`, normaliza o e-mail, busca o usuário em `usuarios`, confere se está ativo e valida a senha com `bcrypt.checkpw`.
- Entrada de teste: `admin@hortifruti.local / admin123`.
- Resultado esperado: HTTP `200`, token JWT e dados do usuário.
- Banco: consulta `usuarios`; não grava registros.

### 3. Login com senha inválida

- Endpoint: `POST /api/auth/login`
- Código: `backend/app/auth/routes.py`
- O que faz: executa o mesmo fluxo do login válido, mas retorna erro se a senha não bater com o hash salvo.
- Entrada de teste: `admin@hortifruti.local / errada`.
- Resultado esperado: HTTP `401` com `Credenciais invalidas.`
- Banco: consulta `usuarios`; não grava registros.

### 4. Listar usuários

- Endpoint: `GET /api/usuarios`
- Código: `backend/app/usuarios/routes.py`
- O que faz: busca todos os usuários ordenados por nome e id.
- Entrada: nenhuma.
- Resultado esperado: HTTP `200` com os 5 usuários padrão após `reset_demo.py`.
- Banco: consulta `usuarios`.

### 5. Criar usuário

- Endpoint: `POST /api/usuarios`
- Código: `backend/app/usuarios/routes.py`
- Schema: `backend/app/schemas/usuario.py`
- O que faz: valida nome, e-mail, senha, perfil e status; gera `senha_hash` com bcrypt; insere o usuário.
- Entrada de teste: usuário `validacao.funcional@hortifruti.local`.
- Resultado esperado: HTTP `201` com o usuário criado.
- Banco: insere em `usuarios` com `perfil=funcionario` e `ativo=true`.

### 6. Atualizar perfil/status de usuário

- Endpoint: `PUT /api/usuarios/<id>`
- Código: `backend/app/usuarios/routes.py`
- Schema: `UsuarioUpdateSchema`
- O que faz: busca o usuário pelo id e permite alterar somente `perfil` e `ativo`.
- Entrada de teste:

```json
{
  "perfil": "gerente",
  "ativo": false
}
```

- Resultado esperado: HTTP `200`; o usuário passa a `perfil=gerente` e `ativo=false`.
- Banco: atualiza a linha correspondente em `usuarios`.

### 7. Bloquear e-mail duplicado

- Endpoint: `POST /api/usuarios`
- Código: `backend/app/usuarios/routes.py`
- O que faz: tenta inserir um e-mail já existente. Como `Usuario.email` é único, o banco gera `IntegrityError`, capturado pelo backend.
- Entrada de teste: criar outro usuário com `validacao.funcional@hortifruti.local`.
- Resultado esperado: HTTP `409` com mensagem de e-mail duplicado.
- Banco: não deve inserir nova linha.

### 8. Listar produtos

- Endpoint: `GET /api/produtos`
- Código: `backend/app/produtos/routes.py`
- O que faz: busca todos os produtos ordenados por nome e id.
- Entrada: nenhuma.
- Resultado esperado após `reset_demo.py`: HTTP `200` com lista vazia.
- Banco: consulta `produtos`.

### 9. Criar produto

- Endpoint: `POST /api/produtos`
- Código: `backend/app/produtos/routes.py`
- Schema: `backend/app/schemas/produto.py`
- O que faz: valida nome, categoria, unidade, estoque mínimo, preço padrão e validade padrão; cria produto ativo.
- Entrada de teste: `Produto Validação Funcional`.
- Resultado esperado: HTTP `201`, produto com `quantidade_atual=0` e `ativo=true`.
- Banco: insere em `produtos`.

### 10. Consultar produto por ID

- Endpoint: `GET /api/produtos/<id>`
- Código: `backend/app/produtos/routes.py`
- O que faz: usa `Produto.query.get_or_404` para carregar o produto.
- Entrada: id do produto criado.
- Resultado esperado: HTTP `200` com os dados do produto.
- Banco: consulta `produtos`.

### 11. Atualizar produto

- Endpoint: `PUT /api/produtos/<id>`
- Código: `backend/app/produtos/routes.py`
- Schema: `ProdutoUpdateSchema`
- O que faz: permite alterar dados do produto, desde que pelo menos um campo seja informado.
- Entrada de teste:

```json
{
  "estoque_minimo": "7.000",
  "preco_venda_padrao": "12.50",
  "validade_dias_padrao": 12
}
```

- Resultado esperado: HTTP `200`, produto com preço padrão `12.50` e validade padrão `12`.
- Banco: atualiza a linha em `produtos`.

### 12. Bloquear produto duplicado por nome e categoria

- Endpoint: `POST /api/produtos`
- Código: `backend/app/produtos/routes.py`
- O que faz: tenta inserir produto com mesmo `nome` e `categoria`. O modelo `Produto` possui `UniqueConstraint("nome", "categoria")`.
- Entrada de teste: criar novamente `Produto Validação Funcional` com categoria `legume`.
- Resultado esperado: HTTP `409`.
- Banco: não deve inserir nova linha.

### 13. Registrar entrada de estoque

- Endpoint: `POST /api/movimentacoes/entrada`
- Código: `backend/app/movimentacoes/routes.py`
- Schema: `backend/app/schemas/movimentacao.py`
- O que faz: valida produto ativo, usuário ativo ou cria operador padrão, exige `custo_unitario > 0`, soma a quantidade ao produto e cria uma movimentação do tipo `entrada`.
- Entrada de teste: entrada de `20.000 kg` a custo unitário `4.00`.
- Resultado esperado: HTTP `201`; `produtos.quantidade_atual` passa de `0` para `20.000`.
- Banco:
  - insere em `movimentacoes` com `tipo=entrada`, `subtipo=compra`, `quantidade=20.000`, `custo_unitario=4.00`, `custo_total=80.00`;
  - insere em `camadas_estoque` com `quantidade_inicial=20.000`, `quantidade_disponivel=20.000`, `data_entrada=2026-05-17` e `data_validade=2026-05-29`, porque o produto foi atualizado para `validade_dias_padrao=12`.

### 14. Listar camadas de estoque do produto

- Endpoint: `GET /api/produtos/<id>/camadas`
- Código: `backend/app/produtos/routes.py`
- O que faz: lista apenas camadas com `quantidade_disponivel > 0`, ordenadas por validade, data de entrada e id.
- Entrada: id do produto criado.
- Resultado esperado: HTTP `200` com uma camada aberta de `20.000`.
- Banco: consulta `camadas_estoque`.

### 15. Registrar saída por venda com FEFO

- Endpoint: `POST /api/movimentacoes/saida`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: valida produto e usuário ativos, exige `subtipo`, seleciona camadas em ordem FEFO pela menor `data_validade`, consome a quantidade, calcula custo, receita e lucro.
- Entrada de teste: venda de `5.000 kg` a `12.50`.
- Resultado esperado: HTTP `201`; estoque do produto passa de `20.000` para `15.000`.
- Banco:
  - insere em `movimentacoes` com `tipo=saida`, `subtipo=venda`, `quantidade=5.000`, `preco_unitario_venda=12.50`, `receita_total=62.50`, `custo_total=20.00`, `lucro_bruto=42.50`;
  - atualiza `camadas_estoque.quantidade_disponivel` de `20.000` para `15.000`;
  - insere em `consumos_saida` indicando que `5.000` foram consumidos da camada.

### 16. Bloquear saída maior que o estoque

- Endpoint: `POST /api/movimentacoes/saida`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: calcula `nova_quantidade = produto.quantidade_atual - quantidade`; se ficar negativa, retorna erro.
- Entrada de teste: saída de `100.000 kg` quando existem apenas `15.000`.
- Resultado esperado: HTTP `409` com mensagem de estoque insuficiente.
- Banco: nenhuma movimentação e nenhum consumo devem ser gravados.

### 17. Registrar perda

- Endpoint: `POST /api/movimentacoes/saida`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: para `subtipo=perda`, também consome camadas FEFO, mas não calcula receita nem lucro de venda.
- Entrada de teste: perda de `2.000 kg`.
- Resultado esperado: HTTP `201`; estoque passa de `15.000` para `13.000`; `receita_total` fica nula.
- Banco:
  - insere em `movimentacoes` com `tipo=saida`, `subtipo=perda`, `quantidade=2.000`, `custo_total=8.00`;
  - atualiza a camada de `15.000` para `13.000`;
  - insere consumo em `consumos_saida`.

### 18. Histórico por produto

- Endpoint: `GET /api/movimentacoes?produto_id=<id>`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: monta consulta com join entre `movimentacoes`, `produtos` e `usuarios`, filtrando pelo produto.
- Entrada: id do produto criado.
- Resultado esperado: HTTP `200` com as 3 movimentações criadas: entrada, venda e perda.
- Banco: consulta `movimentacoes`, `produtos` e `usuarios`.

### 19. Histórico com limite

- Endpoint: `GET /api/movimentacoes?limite=1`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: valida que `limite` é inteiro positivo e aplica `.limit(limite)` na consulta.
- Entrada: `limite=1`.
- Resultado esperado: HTTP `200` com exatamente 1 item.
- Banco: consulta limitada em `movimentacoes`.

### 20. Validar filtro de limite inválido

- Endpoint: `GET /api/movimentacoes?limite=abc`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: `_parse_optional_positive_int_arg` tenta converter para inteiro; se falhar, retorna erro de validação.
- Entrada: `limite=abc`.
- Resultado esperado: HTTP `400`.
- Banco: não executa consulta principal.

### 21. Relatório de mais vendidos

- Endpoint: `GET /api/relatorios/mais-vendidos?limite=5`
- Código: `backend/app/relatorios/routes.py`
- O que faz: agrupa movimentações de `tipo=saida` e `subtipo=venda`, somando quantidade, receita e lucro por produto.
- Entrada: `limite=5`.
- Resultado esperado: HTTP `200` com o produto vendido na rodada.
- Banco: consulta agregada em `movimentacoes` com join em `produtos`.

### 22. Relatório financeiro

- Endpoint: `GET /api/relatorios/financeiro`
- Código: `backend/app/relatorios/routes.py`
- O que faz: soma receita, custo e lucro das vendas; soma custo e quantidade de perdas; calcula valor do estoque aberto por custo e por venda.
- Entrada: nenhuma.
- Resultado esperado após a rodada:
  - receita total considera a venda de `5.000 * 12.50 = 62.50`;
  - lucro bruto considera `62.50 - 20.00 = 42.50`;
  - perdas incluem custo de `2.000 * 4.00 = 8.00`;
  - estoque restante em custo considera `13.000 * 4.00 = 52.00`.
- Banco: consultas agregadas em `movimentacoes` e `camadas_estoque`.

### 23. Relatório de validade

- Endpoint: `GET /api/relatorios/validade?dias=30`
- Código: `backend/app/relatorios/routes.py`
- O que faz: calcula camadas vencidas e próximas do vencimento entre a data atual e `hoje + dias`.
- Entrada: `dias=30`.
- Resultado esperado: HTTP `200` com campos `vencidos`, `proximos_vencimento`, `total_vencido_custo` e `total_em_risco_custo`.
- Banco: consulta `camadas_estoque` com join em `produtos`.

### 24. Validar data inválida no relatório

- Endpoint: `GET /api/relatorios/financeiro?data_inicial=2026-99-99`
- Código: `backend/app/relatorios/routes.py`
- O que faz: `_parse_optional_date_arg` usa `date.fromisoformat`; se o formato ou valor for inválido, retorna erro.
- Entrada: `data_inicial=2026-99-99`.
- Resultado esperado: HTTP `400`.
- Banco: não executa as consultas agregadas.

### 25. Inativar produto

- Endpoint: `DELETE /api/produtos/<id>`
- Código: `backend/app/produtos/routes.py`
- O que faz: não apaga fisicamente o produto; faz exclusão lógica definindo `ativo=false`.
- Entrada: id do produto criado.
- Resultado esperado: HTTP `200` com `ativo=false`.
- Banco: atualiza `produtos.ativo` para falso.

### 26. Bloquear movimentação em produto inativo

- Endpoint: `POST /api/movimentacoes/entrada`
- Código: `backend/app/movimentacoes/routes.py`
- O que faz: antes de registrar movimentação, verifica `if not produto.ativo`; se estiver inativo, retorna conflito.
- Entrada de teste: nova entrada para o produto inativado.
- Resultado esperado: HTTP `409` com mensagem de produto inativo.
- Banco: nenhuma nova movimentação ou camada deve ser criada.

## Fluxo resumido de validação

1. Rodar `reset_demo.py` e confirmar que os produtos foram limpos e os usuários padrão existem.
2. Fazer login com `admin@hortifruti.local / admin123`.
3. Criar o usuário de validação e conferir a linha em `usuarios`.
4. Criar o produto de validação e conferir `quantidade_atual=0`.
5. Registrar a entrada e conferir:
   - `produtos.quantidade_atual=20.000`;
   - uma linha em `movimentacoes`;
   - uma linha em `camadas_estoque`.
6. Registrar a venda e conferir:
   - `produtos.quantidade_atual=15.000`;
   - `movimentacoes.receita_total=62.50`;
   - `movimentacoes.lucro_bruto=42.50`;
   - uma linha em `consumos_saida`.
7. Registrar a perda e conferir:
   - `produtos.quantidade_atual=13.000`;
   - `movimentacoes.subtipo=perda`;
   - `receita_total` nulo.
8. Abrir histórico e relatórios para confirmar que os dados gravados aparecem nas consultas.
9. Executar uma validação negativa: saída maior que estoque ou produto inativo.

## Consultas SQL de verificação

Se estiver usando SQLite local, o arquivo do banco fica em `backend/instance/hortifruti_dev.db`. As consultas abaixo ajudam a conferir os registros gravados:

```sql
select id, nome, email, perfil, ativo from usuarios order by id;
select id, nome, categoria, unidade_medida, quantidade_atual, preco_venda_padrao, validade_dias_padrao, ativo from produtos order by id;
select id, produto_id, usuario_id, tipo, subtipo, quantidade, custo_unitario, preco_unitario_venda, receita_total, custo_total, lucro_bruto, data from movimentacoes order by id;
select id, produto_id, movimentacao_entrada_id, quantidade_inicial, quantidade_disponivel, custo_unitario, data_entrada, data_validade from camadas_estoque order by id;
select id, movimentacao_saida_id, camada_estoque_id, quantidade_consumida, custo_unitario, custo_total from consumos_saida order by id;
```

## Resultado da rodada automatizada

A rodada executada via API cobriu as 26 operações acima e retornou:

```text
RESUMO: total=26; ok=26; falhas=0
```

Depois da rodada, o banco foi reiniciado novamente com `reset_demo.py` para remover os registros temporários criados durante a validação automatizada.
