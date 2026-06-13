# Sistema de Gerenciamento Hortifruti

Sistema web para controle de estoque de hortifruti, com cadastro de produtos e usuários, registro de entradas e saídas, baixa de estoque por validade, PDV e relatórios gerenciais.

O projeto é dividido em dois módulos:

- `backend`: API REST em Flask, com SQLAlchemy, Flask-Migrate, JWT e validações com Marshmallow.
- `frontend`: aplicação Next.js com React e PrimeReact.

## Funcionalidades

- Autenticação de usuários com token JWT e validação no backend.
- Autorização por perfil, com gestão de usuários restrita a gerentes.
- Cadastro, listagem e atualização de usuários.
- Cadastro, consulta, atualização e inativação de produtos.
- Controle de estoque por camadas de entrada.
- Saídas por venda ou perda.
- Consumo de estoque por FEFO, priorizando os lotes com menor validade.
- Bloqueio de movimentações inválidas, como produto inativo, estoque insuficiente ou saída sobre lote vencido.
- Dashboard com indicadores operacionais.
- Tela de PDV para registrar vendas.
- Relatórios de produtos mais vendidos, movimentações, validade e resultado financeiro.
- Scripts para popular ou reiniciar a base de demonstração.
- Testes automatizados dos principais fluxos funcionais do backend.

## Tecnologias

### Backend

- Python
- Flask
- Flask-SQLAlchemy
- Flask-Migrate
- Flask-JWT-Extended
- Marshmallow
- bcrypt
- SQLite em desenvolvimento local
- Suporte a MySQL por meio da variável `DATABASE_URL`
- pytest

### Frontend

- Next.js
- React
- PrimeReact
- PrimeIcons

## Estrutura do projeto

```text
.
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── movimentacoes/
│   │   ├── produtos/
│   │   ├── relatorios/
│   │   ├── usuarios/
│   │   ├── models/
│   │   └── schemas/
│   ├── migrations/
│   ├── scripts/
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── context/
│       ├── services/
│       └── utils/
└── docs/
```

## Configuração do backend

Entre na pasta do backend:

```powershell
cd backend
```

Crie e ative o ambiente virtual:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Instale as dependências:

```powershell
pip install -r requirements.txt
```

Crie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

O arquivo `.env.example` já aponta para um banco SQLite local:

```env
DATABASE_URL=sqlite:///instance/hortifruti_dev.db
```

Garanta que o diretório do banco local exista:

```powershell
New-Item -ItemType Directory -Force instance
```

Execute as migrações:

```powershell
flask db upgrade
```

Para criar apenas o usuário administrador:

```powershell
python scripts\seed_admin.py
```

Para reiniciar a base com usuários padrão e estoque vazio:

```powershell
python scripts\reset_demo.py
```

Para carregar uma base demonstrativa com produtos, usuários e movimentações:

```powershell
python scripts\seed_showcase.py
```

Inicie a API:

```powershell
python run.py
```

A API ficará disponível em:

```text
http://127.0.0.1:5000/api
```

## Configuração do frontend

Em outro terminal, entre na pasta do frontend:

```powershell
cd frontend
```

Instale as dependências:

```powershell
npm install
```

Crie o arquivo de ambiente local:

```powershell
Copy-Item .env.example .env.local
```

Confirme se a URL da API está configurada assim:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000/api
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
```

Inicie o frontend:

```powershell
npm run dev
```

A aplicação ficará disponível em:

```text
http://localhost:3000
```

## Credenciais de demonstração

Ao usar `reset_demo.py` ou `seed_showcase.py`, as seguintes contas ficam disponíveis:

| E-mail | Senha | Perfil | Status |
| --- | --- | --- | --- |
| `admin@hortifruti.local` | `admin123` | Gerente | Ativo |
| `gerente@hortifruti.local` | `demo123` | Gerente | Ativo |
| `estoque@hortifruti.local` | `demo123` | Funcionário | Ativo |
| `caixa@hortifruti.local` | `demo123` | Funcionário | Ativo |
| `temporario@hortifruti.local` | `demo123` | Funcionário | Inativo |

Usuários com perfil de gerente acessam a gestão de usuários. Usuários com perfil de funcionário acessam as rotas operacionais, como dashboard, estoque, PDV e relatórios.

## Endpoints principais

Com exceção de `GET /api/health` e `POST /api/auth/login`, todos os endpoints
exigem o cabeçalho `Authorization: Bearer <token>`. As rotas de usuários também
exigem que o usuário autenticado tenha perfil de gerente.

| Recurso | Endpoint |
| --- | --- |
| Health check | `GET /api/health` |
| Login | `POST /api/auth/login` |
| Usuários | `GET /api/usuarios` |
| Criar usuário | `POST /api/usuarios` |
| Atualizar usuário | `PUT /api/usuarios/<id>` |
| Produtos | `GET /api/produtos` |
| Criar produto | `POST /api/produtos` |
| Consultar produto | `GET /api/produtos/<id>` |
| Atualizar produto | `PUT /api/produtos/<id>` |
| Inativar produto | `DELETE /api/produtos/<id>` |
| Camadas de estoque | `GET /api/produtos/<id>/camadas` |
| Entrada de estoque | `POST /api/movimentacoes/entrada` |
| Saída de estoque | `POST /api/movimentacoes/saida` |
| Histórico de movimentações | `GET /api/movimentacoes` |
| Mais vendidos | `GET /api/relatorios/mais-vendidos` |
| Financeiro | `GET /api/relatorios/financeiro` |
| Validade | `GET /api/relatorios/validade` |

## Testes

Os testes automatizados do backend cobrem autenticação, usuários, produtos, entradas, vendas, perdas, consumo FEFO, relatórios e bloqueios de regras inválidas.

Na raiz do projeto, execute a suíte com:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```

Também há uma validação funcional documentada em:

```text
docs/validacao-funcional-hortifruti.md
```

## Regras importantes do domínio

- O backend rejeita rotas protegidas sem JWT válido.
- Somente gerentes podem listar, criar ou atualizar usuários.
- O usuário responsável por uma movimentação é obtido do JWT, não do payload enviado pelo cliente.
- Cada entrada de estoque cria uma camada com quantidade, custo unitário, data de entrada e data de validade.
- Saídas por venda calculam receita, custo total e lucro bruto.
- Saídas por perda consomem estoque e registram custo, mas não geram receita.
- O consumo de estoque segue a regra FEFO, usando primeiro os lotes com menor data de validade.
- O sistema bloqueia saída maior que o estoque disponível.
- Produtos inativos não podem receber novas movimentações.
- Usuários inativos não devem operar movimentações.

## Documentação complementar

- `docs/validacao-funcional-hortifruti.md`: roteiro de validação funcional dos endpoints e regras de negócio.
- `docs/plano-refatoracao-solid.md`: análise técnica e plano de refatoração orientado a SOLID.
