# Roteirizador de Fretes com IA — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web público que roteiriza pedidos fictícios com Claude a partir de uma spec de regras, valida o resultado em código, guarda o histórico no MockAPI e mostra um dashboard com comparação explicada por IA.

**Architecture:** Front estático (HTML + Bootstrap + JS puro + Chart.js) em `public/`; funções serverless em `api/` no formato Web (`export async function POST(request) → Response`); lógica pura em `lib/` (ES modules) testada com `node --test`. Um `dev-server.js` local roteia `/api/*` para os mesmos handlers, sem precisar de login na Vercel.

**Tech Stack:** Node.js 20+ (ES modules), `@anthropic-ai/sdk`, Bootstrap 5 e Chart.js 4 via CDN, `marked` via CDN (renderizar a spec), MockAPI, Vercel, GitHub.

**Spec:** `docs/specs/2026-11-17-roteirizador-fretes-design.md`

## Global Constraints
- Dados 100% fictícios; nenhum nome, valor ou regra real da JDE. A página do caso usa só percentuais: ~10% de saving/mês, −20h/mês, rotas SP→RJ e SP→RS.
- Só tecnologias que Frederico conhece no front (HTML, CSS, Bootstrap, JS puro). Sem TypeScript, sem framework, sem etapa de build.
- Modelo `claude-opus-5-5`, `output_config.effort: "medium"`, saída estruturada `output_config.format: {type: "json_schema", schema}`, `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`, via `client.beta.messages.create`. Checar `stop_reason === "refusal"` antes de ler o conteúdo.
- O navegador nunca chama o Claude nem o MockAPI; só as funções em `api/`. Segredos em variáveis de ambiente: `ANTHROPIC_API_KEY`, `MOCKAPI_URL`.
- Limite de 60 pedidos por roteirização.
- A demo nunca quebra: sem chave, sem créditos, limite atingido ou erro do Claude → resultados pré-gerados nos cenários prontos; MockAPI fora → `data/historico.json`.
- Textos da interface em português do Brasil.
- Commits sem linha de coautoria.

## Review Focus
1. **CSV exportado do Excel em pt-BR** usa `;` como separador, vírgula decimal (`1250,5`) e pode ter BOM → o parser aceita `,` ou `;`, vírgula decimal e remove o BOM (teste na Task 4).
2. **Claude devolve `pedido_id` inexistente, repetido ou esquecido** → o validador gera violações, sem quebrar (teste na Task 3).
3. **Cidade do CSV fora da tabela de distâncias** → erro na linha, antes de enviar (teste na Task 4).
4. **Clique duplo em "Roteirizar" ou espera longa (60 pedidos)** → botão desabilitado com spinner até a resposta; função com `maxDuration` de 300s (Tasks 7 e 8).
5. **Pedido maior que a Carreta, ou com restrição que nenhum veículo atende** → fica fora do custo de referência e aparece como não alocável; a referência não gera NaN (teste na Task 3).

---

## Estrutura de arquivos
```
api/roteirizar.js   api/historico.js   api/comparar.js   api/spec.js
lib/dados.js        lib/gerador.js     lib/custo.js      lib/validador.js
lib/registro.js     lib/claude.js      lib/mockapi.js    lib/rateLimit.js
public/index.html   public/dashboard.html  public/spec.html  public/caso.html
public/css/estilo.css  public/js/csv.js  public/js/app.js  public/js/dashboard.js
public/modelo-pedidos.csv
data/frota.json  data/distancias.json  data/parametros.json
data/cenarios/cenario-{1,2,3}.json   data/semanas/semana-{01..12}.json
data/resultados/cenario-{1,2,3}.json data/historico.json  data/comparacoes.json
spec/regras.md
scripts/gerar-cenarios.js  scripts/gerar-historico.js
tests/*.test.js   dev-server.js   vercel.json   package.json   README.md
```

## Formatos compartilhados (usados por várias tasks)
- **Pedido:** `{id: "P001", cliente: string, cidade: string, uf: "RJ"|"RS", peso_kg: number, paletes: integer, janela_inicio: "YYYY-MM-DDTHH:MM", janela_fim: "YYYY-MM-DDTHH:MM", restricao_veiculo: "" | "VUC" | "Toco" | "Truck" | "Carreta"}`. `restricao_veiculo` = maior veículo aceito pelo cliente; `""` = sem restrição.
- **Veículo (`data/frota.json`):** `{tipo, capacidade_kg, capacidade_paletes, custo_fixo, custo_km}`, em ordem crescente de tamanho.
- **Chave de cidade:** `` `${cidade}-${uf}` ``, ex. `"Niterói-RJ"`; `data/distancias.json` mapeia chave → km a partir de Cajamar/SP.
- **Resultado do Claude:** `{rotas: [{veiculo, uf, paradas: [{pedido_id, cidade}], justificativa}], nao_alocados: [{pedido_id, motivo}], resumo}`.
- **Registro (histórico):** `{id?, data, rotulo, origem: "cenario"|"csv"|"historico", n_pedidos, n_rotas, custo_total, custo_referencia, saving_pct, custo_por_palete, ocupacao_media, mix_veiculos: {VUC, Toco, Truck, Carreta}, n_violacoes, violacoes, rotas, nao_alocados, resumo}`.

---

### Task 1: Setup do projeto, spec de regras com Frederico e dados base

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `vercel.json`, `spec/regras.md`, `data/frota.json`, `data/distancias.json`, `data/parametros.json`, `lib/dados.js`
- Test: `tests/dados.test.js`

**Interfaces:**
- Produces: `carregarDados() → {frota, distancias, parametros, spec}` (síncrono; JSON via `import ... with {type: "json"}`, spec via `readFileSync`); `parametros = {max_paradas, km_por_parada_extra, max_pedidos}`.

- [ ] **Step 1: Pré-requisitos.** Confirmar `node -v` ≥ 20. Se faltar, pedir a Frederico: `winget install OpenJS.NodeJS.LTS` e reabrir o terminal.
- [ ] **Step 2: Setup.** `git init`; `package.json` com `"type": "module"`, scripts `"dev": "node --env-file-if-exists=.env dev-server.js"`, `"test": "node --test tests/"`; `npm install @anthropic-ai/sdk`. `.gitignore`: `node_modules`, `.env`, `.vercel`. `.env.example` com `ANTHROPIC_API_KEY=` e `MOCKAPI_URL=`. `vercel.json`: `{"functions": {"api/*.js": {"maxDuration": 300, "includeFiles": "{data,spec}/**"}}}`.
- [ ] **Step 3: Sessão da spec (interativa).** Frederico descreve as regras com as próprias palavras. Claude organiza em `spec/regras.md` com as seções: *Objetivo* · *Dados de entrada* · *Regras obrigatórias* (R1…Rn; cada uma com "como verificar") · *Preferências* (o que otimizar quando houver empate) · *Formato da resposta*. Frederico revisa até aprovar. Valores numéricos citados (máx. de paradas, km por parada extra) vão para `data/parametros.json`; `max_pedidos: 60`.
- [ ] **Step 4: Dados fictícios.** `frota.json` (ponto de partida, ajustar se a spec disser outra coisa): VUC 3000 kg/8 pal/R$350 fixo/R$2,20 km · Toco 6000/12/500/3,00 · Truck 12000/18/700/3,80 · Carreta 27000/28/1100/5,20. `distancias.json`: RJ — Rio de Janeiro 430, Niterói 445, Petrópolis 480, Volta Redonda 330, Resende 300; RS — Porto Alegre 1130, Canoas 1115, Caxias do Sul 1050, Santa Maria 1270, Pelotas 1380.
- [ ] **Step 5: Teste.** `tests/dados.test.js`: `carregarDados()` retorna 4 veículos em ordem crescente de `capacidade_kg`; 10 cidades; `parametros.max_pedidos === 60`; `spec` contém `"R1"`.
- [ ] **Step 6:** `npm test` → PASS.
- [ ] **Step 7: Commit** `chore: setup do projeto, spec de regras e dados fictícios`.

### Task 2: Gerador de pedidos e cenários

**Files:**
- Create: `lib/gerador.js`, `scripts/gerar-cenarios.js`, `data/cenarios/*.json`, `data/semanas/*.json`, `public/modelo-pedidos.csv`
- Test: `tests/gerador.test.js`

**Interfaces:**
- Consumes: `carregarDados()`.
- Produces: `gerarPedidos({seed, n, data, pctRJ, pctRestricaoVUC, pesoMedioKg}, distancias) → Pedido[]`, determinístico por `seed` (PRNG mulberry32). IDs `P001…`.

- [ ] **Step 1: Teste.** Mesma seed → mesmo array (`deepStrictEqual`); seeds diferentes → arrays diferentes; `n: 20` → 20 pedidos, todas as cidades presentes em `distancias`, `peso_kg > 0`, `paletes ≥ 1`, `janela_inicio < janela_fim`.
- [ ] **Step 2:** `npm test` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `gerarPedidos`.** Janelas dentro do dia `data` (entre 07:00 e 18:00, duração de 3 a 8h); clientes "Cliente Fictício NN".
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: `scripts/gerar-cenarios.js`.** Gera 3 cenários de demo — `cenario-1` "Semana típica" (25 pedidos, 50% RJ), `cenario-2` "Pico de fim de mês" (55 pedidos), `cenario-3` "Muitos clientes só VUC" (25 pedidos, 40% com restrição VUC) — e 12 semanas para o histórico, com variações propositais (picos nas semanas 4 e 8, alta restrição na semana 6, carga fracionada/leve na semana 10). Cada arquivo: `{id, rotulo, data, pedidos}`. Também escreve `public/modelo-pedidos.csv` com o cabeçalho e 3 linhas de exemplo. Rodar `node scripts/gerar-cenarios.js` e conferir os arquivos.
- [ ] **Step 6: Commit** `feat: gerador determinístico de pedidos e cenários fictícios`.

### Task 3: Custo, referência e validador

**Files:**
- Create: `lib/custo.js`, `lib/validador.js`
- Test: `tests/custo.test.js`, `tests/validador.test.js`

**Interfaces:**
- Consumes: formatos compartilhados; `carregarDados()`.
- Produces:
  - `custoRota(veiculo, chavesCidades: string[], distancias, parametros) → number` = `custo_fixo + custo_km × (max km entre as cidades + km_por_parada_extra × (nº de cidades distintas − 1))`, arredondado a 2 casas.
  - `menorVeiculoQueAtende(pedido, frota) → Veiculo | null` (respeita peso, paletes e `restricao_veiculo`).
  - `custoReferencia(pedidos, frota, distancias, parametros) → {custo, nao_atendiveis: string[]}` (um veículo dedicado por pedido).
  - `validar(resultado, pedidos, frota, distancias, parametros) → {rotas: RotaEnriquecida[], violacoes: [{regra, mensagem, rota_index: number|null, pedido_id: string|null}], custo_total}`; `RotaEnriquecida = rota + {peso_kg, paletes, ocupacao_kg, ocupacao_paletes, custo}`.

- [ ] **Step 1: Testes de custo.** Rota de Truck para `["Rio de Janeiro-RJ", "Niterói-RJ"]` com `km_por_parada_extra: 20` → `700 + 3.8 × (445 + 20) = 2467`. Pedido de 30000 kg → `menorVeiculoQueAtende` = `null` e `custoReferencia` o lista em `nao_atendiveis`, com `custo` finito.
- [ ] **Step 2: Testes do validador**, um por regra, cada um esperando a `regra` correspondente em `violacoes`: `"capacidade_kg"`, `"capacidade_paletes"`, `"restricao_veiculo"`, `"mistura_uf"`, `"max_paradas"`, `"janela"` (janelas sem interseção na mesma rota: `max(inicio) >= min(fim)`), `"pedido_inexistente"`, `"pedido_duplicado"`, `"pedido_esquecido"` (nem em rota, nem em `nao_alocados`), `"veiculo_inexistente"`. Um resultado correto → `violacoes` vazio e `custo_total` igual à soma dos `custoRota`.
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4: Implementar** `lib/custo.js` e `lib/validador.js`. Pesos e paletes são somados a partir dos pedidos reais, nunca de números vindos da IA. Se a spec da Task 1 tiver regra verificável que não está nesta lista, adicionar a checagem e o teste dela aqui.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6: Commit** `feat: cálculo de custo, referência e validador de regras`.

### Task 4: Parser de CSV (navegador e testes)

**Files:**
- Create: `public/js/csv.js`
- Test: `tests/csv.test.js`

**Interfaces:**
- Produces: `COLUNAS` (array na ordem do Pedido); `CIDADES_VALIDAS` (as 10 chaves de cidade); `parseCsvPedidos(texto: string, cidadesValidas: string[], maxPedidos = 60) → {pedidos: Pedido[], erros: [{linha: number, mensagem: string}]}`. ES module sem dependências (importável pelo navegador e pelo Node).

- [ ] **Step 1: Testes.** Arquivo com `,` → pedidos corretos; o mesmo com `;`, vírgula decimal em `peso_kg` e BOM → mesmo resultado; coluna faltando → erro na linha 1; `peso_kg` não numérico → erro com o número da linha; cidade fora de `cidadesValidas` → erro; `uf` fora de RJ/RS → erro; 61 linhas → erro "máximo de 60 pedidos"; linhas em branco ignoradas; `CIDADES_VALIDAS` tem exatamente as chaves de `data/distancias.json`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar.** Detectar o separador pelo cabeçalho; sem suporte a campos entre aspas (o modelo não usa); `paletes` inteiro.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: leitura e validação de CSV de pedidos`.

### Task 5: Integração com Claude e limite por IP

**Files:**
- Create: `lib/claude.js`, `lib/rateLimit.js`
- Test: `tests/claude.test.js`, `tests/rateLimit.test.js`

**Interfaces:**
- Consumes: `carregarDados()`.
- Produces:
  - `SCHEMA_ROTEIRIZACAO`, `SCHEMA_COMPARACAO` (JSON Schema com `additionalProperties: false` e `required` em todos os objetos; `veiculo` com `enum` dos tipos da frota).
  - `roteirizarComClaude({spec, frota, distancias, parametros, pedidos}, client) → Promise<ResultadoClaude>`.
  - `compararComClaude(registroA, registroB, client) → Promise<{explicacao: string, fatores: [{fator: string, impacto: "aumentou"|"reduziu", detalhe: string}]}>`.
  - Ambas lançam `ErroIA` (classe exportada, com `motivo: "recusa"|"json_invalido"|"api"`).
  - `criarCliente() → Anthropic | null` (null sem `ANTHROPIC_API_KEY`).
  - `permitir(ip: string, agoraMs: number) → boolean` — 5 chamadas por IP a cada 10 minutos, em memória; `_resetar()` para testes.

- [ ] **Step 1: Testes com cliente falso** (`{beta: {messages: {create: async (params) => resposta}}}`): a chamada usa `model: "claude-opus-5-5"`, `fallbacks: "default"`, `betas` contendo `"server-side-fallback-2026-07-01"`, `output_config.format.type === "json_schema"`; a resposta com bloco `text` de JSON válido → objeto parseado; `stop_reason: "refusal"` → `ErroIA` com motivo `"recusa"`; texto inválido → `"json_invalido"`; `create` lançando erro → `"api"`. `permitir`: 5× true, 6ª false, true de novo após 10 min.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar.** `client.beta.messages.create({model, max_tokens: 16000, betas, fallbacks: "default", output_config: {effort: "medium", format: {type: "json_schema", schema}}, system, messages})`. Roteirização: `system` = papel de analista de roteirização + conteúdo de `spec/regras.md`; `user` = JSON com frota, distâncias, parâmetros e pedidos. Comparação: `system` = analista de custos de frete, que explica em português, em 2 a 4 parágrafos curtos, por que A custou mais ou menos que B, citando números dos registros; `user` = os dois registros sem o campo `rotas` detalhado (manter `mix_veiculos`, `n_rotas`, `ocupacao_media`, `custo_por_palete`, `n_pedidos`, `violacoes`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: integração com Claude (roteirização e comparação) e limite por IP`.

### Task 6: Registro e MockAPI

**Files:**
- Create: `lib/registro.js`, `lib/mockapi.js`
- Test: `tests/registro.test.js`, `tests/mockapi.test.js`

**Interfaces:**
- Consumes: saída de `validar` e `custoReferencia`.
- Produces:
  - `montarRegistro({rotulo, origem, data, pedidos, validado, referencia, resultado}) → Registro` — `saving_pct = round(100 × (1 − custo_total / custo_referencia), 1)`; `custo_por_palete = custo_total / soma de paletes alocados`; `ocupacao_media` = média de `ocupacao_kg` das rotas (0–100); `mix_veiculos` conta rotas por tipo, com zero nos ausentes.
  - `listarRegistros(fetchFn = fetch) → Promise<Registro[]>`; `salvarRegistro(registro, fetchFn = fetch) → Promise<Registro>` — recurso `${MOCKAPI_URL}/roteirizacoes`; status não-2xx ou `MOCKAPI_URL` ausente → lança erro.

- [ ] **Step 1: Testes.** `montarRegistro` com valores conhecidos (2 rotas, custos 1000 e 500, referência 2000 → `saving_pct` 25.0; `mix_veiculos` com zeros); `custo_referencia` 0 → `saving_pct` 0 (sem NaN). MockAPI com `fetchFn` falso: URL e método corretos, corpo JSON; resposta 500 → rejeita.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: montagem de registro e cliente do MockAPI`.

### Task 7: Funções da API e servidor local

**Files:**
- Create: `api/roteirizar.js`, `api/historico.js`, `api/comparar.js`, `api/spec.js`, `dev-server.js`, placeholders `data/resultados/cenario-{1,2,3}.json`, `data/historico.json` (`[]`), `data/comparacoes.json` (`{}`)
- Test: `tests/api.test.js`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces (todas retornam `Response.json`):
  - `POST /api/roteirizar` corpo `{cenario: "cenario-1"}` ou `{pedidos: Pedido[], rotulo?}` → `{modo: "ao_vivo"|"demo", registro, salvo: boolean, aviso?}`. Sem cliente, IP bloqueado ou `ErroIA`: com `cenario` → `data/resultados/<cenario>.json` e `modo: "demo"`; com `pedidos` → status 503 e `{modo: "demo", erro}`. Mais de 60 pedidos → 400.
  - `GET /api/historico` → `{fonte: "mockapi"|"local", registros}`, ordenados por `data`.
  - `POST /api/comparar` corpo `{idA, idB}` → `{modo, explicacao, fatores}`. Mesmo id ou id inexistente → 400. Sem cliente ou com erro → procura `"idA|idB"` ou `"idB|idA"` em `data/comparacoes.json`; se não achar → 503 com mensagem de modo demonstração.
  - `GET /api/spec` → `{markdown}`.
  - IP lido de `x-forwarded-for` (primeiro valor) ou `"local"`.

- [ ] **Step 1: Testes** chamando os handlers diretamente com `new Request(...)`, sem `ANTHROPIC_API_KEY` e sem `MOCKAPI_URL`: roteirizar `{cenario: "cenario-1"}` → 200 com `modo: "demo"`; `{pedidos: [...]}` → 503; 61 pedidos → 400; historico → `fonte: "local"`; comparar com ids iguais → 400.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar os handlers.** No fluxo ao vivo: Claude → `validar` → `custoReferencia` → `montarRegistro` → `salvarRegistro` dentro de try (falha → `salvo: false`).
- [ ] **Step 4: `dev-server.js`.** `http.createServer` na porta 3000: `/api/<nome>` → importa `api/<nome>.js`, converte `IncomingMessage` em `Request`, chama `GET`/`POST` e escreve a `Response`; demais caminhos servem `public/` (`/` → `index.html`, content-type por extensão).
- [ ] **Step 5:** `npm test` → PASS. `npm run dev` e `curl http://localhost:3000/api/historico` → `{"fonte":"local","registros":[]}`.
- [ ] **Step 6: Commit** `feat: funções serverless e servidor local de desenvolvimento`.

### Task 8: Tela do roteirizador

**Files:**
- Create: `public/index.html`, `public/css/estilo.css`, `public/js/app.js`

**Interfaces:**
- Consumes: `POST /api/roteirizar`; `parseCsvPedidos` e `COLUNAS` de `public/js/csv.js`; `data/distancias.json` não é servido, então as cidades válidas ficam numa constante exportada `CIDADES_VALIDAS` em `public/js/csv.js` (mesmas 10 chaves; teste na Task 4 garante que batem com `distancias.json`).

- [ ] **Step 1: Layout (Bootstrap).** Navbar com links Roteirizador · Dashboard · Spec · O caso. Bloco de entrada com 3 cards de cenário e uma área de envio de CSV com link "baixar CSV modelo" (`/modelo-pedidos.csv`). Prévia da tabela de pedidos e lista de erros por linha. Botão "Roteirizar". Bloco de resultado: indicadores (custo total, referência, saving %, nº de rotas, ocupação média), cards por rota (veículo, paradas em ordem, peso/paletes com barra de ocupação, custo, justificativa), alerta vermelho por violação, lista de não alocados, resumo da IA, selo "Ao vivo"/"Demonstração" e aviso quando `salvo: false`.
- [ ] **Step 2: Comportamento.** O botão fica desabilitado com spinner e a mensagem "A IA está roteirizando… pode levar até 1 minuto" durante a chamada. Com erros no CSV, o envio fica bloqueado. A resposta 503 vira um alerta amigável sugerindo os cenários prontos.
- [ ] **Step 3: Verificar no navegador** (`npm run dev`, preview em `localhost:3000`): o cenário 1 mostra o resultado de demonstração; um CSV com `;` e vírgula decimal mostra a prévia; um CSV com cidade inválida mostra o erro na linha certa; o clique duplo não dispara duas requisições (aba de rede).
- [ ] **Step 4: Commit** `feat: tela do roteirizador com cenários e envio de CSV`.

### Task 9: Geração real dos resultados e do histórico

**Pré-requisitos de Frederico:** `.env` com `ANTHROPIC_API_KEY` (créditos comprados e limite de gasto definido) e `MOCKAPI_URL` (projeto criado em mockapi.io com o recurso `roteirizacoes`, sem campos obrigatórios). **Custo estimado: ~US$ 1,50–2,00** (15 roteirizações + 4 comparações). Pedir confirmação antes de rodar.

**Files:**
- Create: `scripts/gerar-historico.js`; preenche `data/resultados/*.json`, `data/historico.json`, `data/comparacoes.json`

**Interfaces:**
- Consumes: `roteirizarComClaude`, `validar`, `custoReferencia`, `montarRegistro`, `salvarRegistro`, `compararComClaude`.

- [ ] **Step 1: Implementar o script.** Para cada cenário de demo → registro com `origem: "cenario"`, salvo em `data/resultados/<id>.json` no formato de resposta de `/api/roteirizar` (`{modo: "demo", registro, salvo: false}`). Para cada semana → registro com `origem: "historico"` e `data` da semana; acumula em `data/historico.json` e envia ao MockAPI. Gera 4 comparações entre pares contrastantes (semana 4 × 3, 6 × 5, 8 × 7, 10 × 9), usando os `id` devolvidos pelo MockAPI (ou `semana-NN` se o MockAPI falhar), e grava em `data/comparacoes.json` com a chave `"idA|idB"`. Flag `--so-cenarios` para regenerar só os resultados de demonstração.
- [ ] **Step 2: Rodar** `node --env-file=.env scripts/gerar-historico.js`. Esperado: 3 resultados e 12 registros; violações listadas no console para revisão.
- [ ] **Step 3: Revisar com Frederico** se as rotas fazem sentido. Se houver violações sistemáticas, ajustar `spec/regras.md` e rodar de novo (cada rodada custa ~US$ 1,50).
- [ ] **Step 4: Commit** `feat: resultados de demonstração e histórico gerados com Claude`.

### Task 10: Dashboard

**Files:**
- Create: `public/dashboard.html`, `public/js/dashboard.js`

**Interfaces:**
- Consumes: `GET /api/historico`, `POST /api/comparar`.

- [ ] **Step 1: Layout.** Indicadores (nº de roteirizações, custo total somado, saving médio, custo médio por palete, ocupação média); gráfico de linha com custo total e custo de referência por roteirização (eixo X = rótulo/data); barras empilhadas de mix de veículos; barras de custo por palete; tabela do histórico (rótulo, data, origem, pedidos, rotas, custo, saving, ocupação, violações). Selo "Dados locais" quando `fonte: "local"`.
- [ ] **Step 2: "Por que ficou mais caro?"** Dois `<select>` com os registros, pré-selecionando um par que tem comparação pronta. Botão "Explicar diferença" com spinner. O resultado mostra a explicação, os fatores com ícone ↑/↓ e um mini-quadro lado a lado com os números de A e B.
- [ ] **Step 3: Verificar no navegador:** o dashboard abre com os 12 registros e 3 gráficos; a comparação semana 4 × 3 mostra a explicação; com o MockAPI fora (`MOCKAPI_URL` vazio), o dashboard ainda abre com o selo "Dados locais".
- [ ] **Step 4: Commit** `feat: dashboard do histórico com comparação explicada por IA`.

### Task 11: Páginas da spec e do caso

**Files:**
- Create: `public/spec.html`, `public/caso.html`

- [ ] **Step 1: `spec.html`.** Busca `/api/spec` e renderiza com `marked` (CDN). Topo: "Esta é a spec que orienta a IA. Mudar uma regra aqui muda o comportamento do roteirizador."
- [ ] **Step 2: `caso.html`.** Texto escrito com Frederico em 4 blocos: **Problema** (roteirização manual, demorada, dependente de conhecimento tácito) → **Meu papel** (traduzir regras de negócio e particularidades do processo em specs para o agente Copilot, junto com Logística e Finanças) → **Resultado** (~10% de saving/mês e −20h/mês na rota SP→RJ em ~3 meses; expansão para SP→RS e outras rotas) → **Esta demo** (o que ela reproduz e o que é fictício). Aviso: "valores reais não divulgados; dados da demo são fictícios".
- [ ] **Step 3: Verificar no navegador** as duas páginas e a navegação entre as 4 páginas.
- [ ] **Step 4: Commit** `feat: páginas da spec e do caso JDE`.

### Task 12: README, GitHub e Vercel

**Files:**
- Create: `README.md`, `docs/prints/*.png`

- [ ] **Step 1: Prints** das 4 páginas via preview do navegador, salvos em `docs/prints/`.
- [ ] **Step 2: `README.md`.** Pitch em 2 linhas · link da demo · prints · como funciona (diagrama da arquitetura do design) · a spec como peça central · modo demonstração · como rodar local (`npm install`, `.env`, `npm run dev`, `npm test`) · stack · aviso de dados fictícios · contexto (caso JDE em percentuais).
- [ ] **Step 3: Rodar `npm test`** → todos PASS. Commit `docs: README com prints e instruções`.
- [ ] **Step 4: GitHub.** Frederico cria um repositório público vazio em github.com (sem README). `git remote add origin <url>`, `git branch -M main`, `git push -u origin main` (o Git Credential Manager abre o login no navegador).
- [ ] **Step 5: Vercel.** Frederico importa o repositório em vercel.com (preset "Other", sem build, output `public`) e cadastra `ANTHROPIC_API_KEY` e `MOCKAPI_URL` nas variáveis de ambiente. Deploy.
- [ ] **Step 6: Verificar a URL pública:** cenário 1 (ao vivo), CSV modelo, dashboard, comparação, spec, caso. Colocar o link da demo no topo do README; commit e push `docs: link da demo publicada`.
