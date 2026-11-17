# Roteirizador de Fretes com IA — Design

**Data:** 17/11/2026 · **Sprint:** 4h · **Objetivo final:** portfólio para a trilha AI Builder do Programa de Estágio GenAI do iFood.

## 1. Intenção
Versão pública e demonstrável do agente de roteirização que Frederico ajudou a construir na JDE Peet's (Copilot, rotas SP→RJ e SP→RS, ~10% de saving/mês, −20h/mês de trabalho manual). O projeto real é confidencial; esta demo recria a **ideia** com dados 100% fictícios, para que um recrutador consiga **clicar num link e ver funcionando**.

Mensagem central: a contribuição dele no projeto real — **traduzir regras de negócio em uma spec bem definida que orienta a IA a roteirizar corretamente** — mais a capacidade de **analisar os resultados com IA**.

Frederico precisa conseguir explicar cada parte numa entrevista; por isso a stack usa só o que ele já conhece.

## 2. Objetivos, não-objetivos e anti-objetivos
**Objetivos**
- Roteirizar pedidos (cenários prontos ou CSV enviado) a partir de uma spec de regras escrita por Frederico, visível na página.
- Validar a resposta da IA com código determinístico e mostrar violações.
- Mostrar o saving estimado em relação a um cenário de referência sem roteirização.
- Guardar cada roteirização num histórico compartilhado (MockAPI).
- Dashboard com indicadores do histórico e explicação por IA de por que uma roteirização ficou mais cara ou mais barata que outra.
- Página contando o caso da JDE (só percentuais).
- Código num **repositório público no GitHub** (README com prints, arquitetura e como rodar; commits ao longo do sprint), e a Vercel publica a partir desse repositório. Os dois links vão na inscrição.

**Não-objetivos:** otimização matemática ótima, login, banco de dados próprio, mapa interativo, integração com TMS/ERP.

**Anti-objetivos (fracasso mesmo se funcionar)**
- Qualquer dado, valor, cliente ou regra real da JDE.
- Demo quebrada ou sem resposta quando o recrutador clicar (sem créditos, limite de uso, MockAPI fora do ar).
- Código que Frederico não consiga explicar.
- Aparência de protótipo de aula.

## 3. Restrições
- 4h de trabalho contínuo.
- Node.js ainda não instalado (pré-requisito).
- Assinatura Claude (claude.ai) **não** inclui API: chamadas ao modelo exigem créditos separados no Claude Console.
- MockAPI gratuito tem limite de recursos e de registros e é uma API aberta (quem tiver a URL escreve nela).

## 4. Abordagens consideradas
| | Abordagem | Trade-off |
|---|---|---|
| **A (escolhida)** | App web + Claude API, deploy na Vercel | Parece produto, link clicável; exige conta Vercel |
| B | Workflow n8n + planilha | Usa n8n, mas recrutador não consegue testar; n8n cloud é pago |
| C | Streamlit (Python) | Mais rápido, mas com cara de protótipo de dados |

Dentro de A, a stack inicial (Next.js + TypeScript + Tailwind + Zod) foi trocada por tecnologias que Frederico já domina.

Para o histórico: `localStorage` (cada visitante vê só o seu) foi trocado por **MockAPI** (histórico compartilhado, e é exatamente o "API sem backend profundo" que a vaga pede).

## 5. Design

### Stack
- **Front:** HTML + CSS + Bootstrap 5 + JavaScript puro + Chart.js (via CDN, sem build).
- **Backend:** funções serverless em JavaScript (Node) na pasta `api/` da Vercel.
- **IA:** `@anthropic-ai/sdk`, modelo `claude-opus-5-5`, pensamento adaptativo, saída estruturada via JSON Schema, *fallback* automático no servidor se o modelo recusar.
- **Persistência:** MockAPI (recurso `roteirizacoes`), acessado **só pelas funções serverless**.
- **Segredos (variáveis de ambiente na Vercel):** `ANTHROPIC_API_KEY`, `MOCKAPI_URL`.

### Arquitetura
```
Navegador (HTML + Bootstrap + JS + Chart.js)
        │
        ▼
Funções serverless na Vercel (JS)
   ├── POST /api/roteirizar  → Claude → validador → salva no MockAPI → devolve resultado
   ├── GET  /api/historico   → lê do MockAPI (fallback: data/historico.json)
   └── POST /api/comparar    → Claude explica a diferença entre 2 roteirizações
```

### Domínio fictício (revisado na sessão da spec)
O problema real era **escolher como enviar cada carga de café pelo menor preço**, comparando transportadoras, tipos de veículo e modalidades. Distância e janela de horário saem; entram transportadoras, modalidades, prazos e disponibilidade.
- **Origem:** CD fictício em Cajamar/SP. **Destinos:** 5 cidades no RJ e 5 no RS (`data/cidades.json`).
- **Frota (`data/frota.json`):** VUC < Toco < Truck < Carreta, com capacidade em kg e paletes.
- **Transportadoras (`data/transportadoras.json`, 3 fictícias):** por UF — lotação (FTL: preço por tipo de veículo, adicional por parada, prazo) e fracionado (LTL: preço por palete, mínimo por pedido, prazo, veículo de entrega). Nem toda transportadora opera todo veículo.
- **Cenário (um dia de envio):** `data_envio`, pedidos e disponibilidade do dia (veículos livres por transportadora e paletes de espaço fracionado por transportadora/UF, já reduzidos por restrições de empilhamento de cargas de terceiros).
- **Pedido:** `id, cliente, cidade, uf, peso_kg, paletes, data_limite_entrega, restricao_veiculo, aceita_fracionado`.
- **Spec (`spec/regras.md`):** R1 todo pedido com destino · R2 capacidade · R3 espaço fracionado · R4 disponibilidade · R5 transportadora opera a combinação · R6 restrição de veículo do cliente · R7 prazo · R8 uma UF por rota · R9 máx. 4 cidades · R10 cliente que exige carga dedicada. Objetivo: menor custo total; pagar mais só para cumprir prazo.

### Entrada de pedidos
1. **Cenários prontos (3):** arquivos em `data/cenarios/`.
2. **Envio de CSV:** o arquivo é lido no navegador (JS puro), as colunas e os tipos são validados, e os erros aparecem linha a linha antes de enviar. Há um botão para baixar um **CSV modelo**. Limite de 60 pedidos por envio (controla custo e tempo de resposta).

### Fluxo de roteirização
1. Pedidos (cenário ou CSV) vão para `POST /api/roteirizar`.
2. A função monta a mensagem: spec + frota + distâncias + pedidos, e pede ao Claude o JSON no schema definido: rotas (veículo, paradas em ordem, peso/paletes, justificativa), pedidos não alocados com motivo, resumo.
3. **Validador (JS)** confere cada regra verificável, recalcula o custo com a fórmula fixa e lista as violações.
4. Calcula o **saving vs. referência** (um veículo dedicado, o menor que comporta, por pedido).
5. Salva no MockAPI: data, origem (cenário/CSV), nº de pedidos, rotas, custo, saving, ocupação média, mix de veículos e violações.
6. A tela mostra cards de rota, violações destacadas, custo total e saving.

**Custo (das tabelas das transportadoras):** lotação = preço do veículo na UF + adicional por parada × (cidades distintas − 1); fracionado = por pedido, máx(preço/palete × paletes, mínimo).

**Referência para o saving ("sem otimização"):** cada pedido em lotação dedicada, no menor veículo que o atende, na transportadora mais barata para esse veículo (ignorando disponibilidade).

### Dashboard (`/dashboard.html`)
- **Indicadores:** custo total, custo por palete, saving médio, ocupação média, nº de roteirizações.
- **Gráficos (Chart.js):** custo e saving ao longo do tempo; mix de veículos; custo por palete por roteirização.
- **Tabela** do histórico.
- **"Por que ficou mais caro?":** o usuário escolhe duas roteirizações e `POST /api/comparar` manda os dois registros ao Claude, que explica as diferenças (volume, nº de paradas, veículos maiores por restrição, ocupação baixa, mistura de cidades distantes etc.).
- **Histórico fictício pré-gerado:** 10–15 roteirizações de "semanas" diferentes, com variações propositais (pico de pedidos, cliente só-VUC, carga fracionada), carregadas no MockAPI uma vez e copiadas em `data/historico.json` como fallback.

### A demo nunca quebra
- **Sem chave de API, sem créditos ou limite atingido:** os cenários prontos usam resultados pré-gerados (`data/resultados/`). O envio de CSV e a comparação mostram um aviso de "modo demonstração". Para as comparações, há algumas explicações pré-geradas entre pares do histórico.
- **MockAPI fora do ar:** o dashboard usa `data/historico.json`, e a roteirização funciona mesmo sem salvar.
- **Limite por IP** nas funções que chamam o Claude, além do limite de gasto mensal no Console.

### Páginas
`index.html` (roteirizador) · `dashboard.html` · `spec.html` (spec renderizada) · `caso.html` (caso JDE: problema → spec → agente → resultados em %).

### Custo estimado
~US$ 0,05–0,10 por roteirização ao vivo; menos por comparação.

## 6. Ordem do sprint e o que cortar se atrasar
| Tempo | Bloco |
|---|---|
| 0:00–0:30 | Frederico descreve as regras → `spec/regras.md`; dados fictícios |
| 0:30–1:30 | `/api/roteirizar` + validador + cálculo de saving |
| 1:30–2:15 | `index.html` (cenários, CSV, resultado) |
| 2:15–3:15 | MockAPI + histórico pré-gerado + dashboard + `/api/comparar` |
| 3:15–3:35 | `caso.html` e `spec.html` |
| 3:35–4:00 | Deploy, README, vídeo curto |

**Se atrasar, cortar nesta ordem:** `spec.html` (o link vai direto para o arquivo no GitHub) → limite por IP (fica só o limite de gasto) → gráficos além do primeiro.

## 7. Pré-requisitos do usuário
1. Instalar Node.js LTS.
2. Comprar créditos de API no Claude Console (mínimo US$ 5) e definir limite de gasto.
3. Contas gratuitas: GitHub, Vercel e mockapi.io.

## 8. Deixado para quem constrói
Visual exato, números fictícios (distâncias, custos, pedidos), texto da página do caso, formato exato do JSON Schema e do registro no MockAPI.
