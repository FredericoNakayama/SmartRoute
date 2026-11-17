# SmartRoute — Roteirizador de Fretes com IA

Um agente de IA (Claude) decide **como enviar cada carga de café pelo menor custo**, comparando transportadoras, tipos de veículo e as modalidades **lotação (FTL)** e **fracionado (LTL)**, seguindo uma **spec de regras de negócio**. Um validador em código confere cada regra depois da resposta da IA.

🔗 **Demo:** https://smartroute-nine.vercel.app · Resultado direto: https://smartroute-nine.vercel.app/?cenario=cenario-1 · Dados 100% fictícios.

## Demonstração × IA ao vivo

| | **3 cenários prontos** (demonstração) | **Enviar seu CSV** (IA ao vivo) |
|---|---|---|
| Chama a API do Claude? | **Não** | **Sim**, uma chamada real |
| Quem está testando paga algo? | **Não** | **Não.** A chamada usa a API do Claude, que é paga e mantida pelo desenvolvedor |
| De onde vem o resultado? | Gerado anteriormente pelo Claude e guardado no projeto ([data/resultados/](data/resultados)) | Gerado na hora para os seus pedidos |
| Salva no histórico do dashboard? | Não | Sim |
| Tempo de resposta | Instantâneo | Até cerca de 1 minuto |

No dashboard vale a mesma regra para **"Por que ficou mais caro?"**: os 5 pares com explicação pronta não chamam o Claude; qualquer outro par faz uma chamada real ao Claude.

> **Testar o SmartRoute é sempre gratuito, nos dois modos.** Os avisos de "IA ao vivo" existem só para deixar claro quando há uma chamada real ao Claude: essas chamadas usam uma API paga, mantida pelo desenvolvedor para manter o projeto ativo. Por isso há um limite de uso por visitante (5 chamadas ao vivo a cada 10 minutos) e um teto mensal de gasto; se ele for atingido, o envio de CSV fica temporariamente indisponível e todo o resto continua funcionando.

**Para compartilhar o projeto, envie só o link da demo.** Quem abrir pode explorar os cenários prontos, o dashboard, a spec e o caso real, e testar a IA ao vivo enviando um CSV, sem pagar nada.

| Roteirizador | Dashboard |
|---|---|
| ![Roteirizador](docs/prints/roteirizador.png) | ![Dashboard](docs/prints/dashboard.png) |
| **Spec de regras** | **O caso real** |
| ![Spec](docs/prints/spec.png) | ![Caso](docs/prints/caso.png) |

## Por que este projeto existe

No meu estágio atual na JDE Peet's, participei da construção de um agente no Microsoft Copilot que roteiriza fretes. Junto com Logística e Finanças, **minha tarefa era traduzir as regras de negócio e as particularidades do processo em specs bem definidas** para orientar a IA. Resultados em cerca de 3 meses na rota SP→RJ: **~10% de saving por mês** e **−20h/mês** de trabalho manual; a rota SP→RS já foi criada e outras estão em construção.

O projeto real é confidencial. Esta demo recria a **forma de trabalhar** com dados fictícios, para que qualquer pessoa possa testar.

## O que dá para fazer

| Página | O que mostra |
|---|---|
| **Roteirizador** | Escolha um cenário pronto (demonstração) ou envie um CSV de até 60 pedidos (IA ao vivo). A IA devolve os envios com a justificativa de cada escolha; o validador marca qualquer regra violada; a tela mostra o saving em relação a enviar sem otimização. |
| **Dashboard** | Histórico de roteirizações (MockAPI), indicadores, gráficos e o recurso **"Por que ficou mais caro?"**: a IA compara duas roteirizações e explica a diferença (pares prontos em demonstração; outros pares ao vivo). |
| **Spec de regras** | A spec que vai para a IA: objetivo, dados, modalidades, regras R1–R10, preferências e formato da resposta. |
| **O caso real** | O contexto do projeto na JDE Peet's (só percentuais). |

## Como funciona

```
Navegador (HTML + Bootstrap + JavaScript + Chart.js)
        │
        ▼
Funções serverless na Vercel (JavaScript)
   ├── POST /api/roteirizar  → cenário pronto: resultado guardado (não chama o Claude)
   │                           CSV: Claude (spec + dados) → validador R1–R10 → saving → salva no MockAPI
   ├── GET  /api/historico   → MockAPI (se falhar: cópia local)
   ├── POST /api/comparar    → par pronto: explicação guardada · outro par: Claude ao vivo
   └── GET  /api/spec        → a spec de regras
```

- **A spec é a peça central** ([spec/regras.md](spec/regras.md)): ela é enviada ao Claude em toda roteirização.
- **A IA não é aceita sem conferência:** custos são recalculados a partir das tabelas das transportadoras e cada regra é verificada em código ([lib/validador.js](lib/validador.js)).
- **Saída estruturada:** o Claude responde num JSON Schema fixo ([lib/claude.js](lib/claude.js)).
- **A demo nunca quebra:** os cenários prontos não dependem da API do Claude. Se a IA ao vivo estiver indisponível (sem chave, limite de 5 chamadas a cada 10 minutos por visitante, teto de gasto do desenvolvedor atingido ou erro), só o envio de CSV fica indisponível, com um aviso. Se o MockAPI cair, o dashboard usa a cópia local.
- **Segredos só no servidor:** o navegador nunca chama o Claude nem o MockAPI diretamente.

## Rodar localmente

Requisitos: Node.js 22.

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY e MOCKAPI_URL são opcionais: sem a chave, só o envio de CSV fica indisponível
npm run dev            # http://localhost:3000
npm test               # testes automatizados (node --test)
```

Scripts de dados:

```bash
node scripts/gerar-cenarios.js                          # cenários e semanas fictícias (determinístico)
node --env-file=.env scripts/gerar-historico.js         # resultados, histórico e comparações com o Claude (usa a API paga: alguns dólares para quem roda)
```

## Stack

HTML, CSS, Bootstrap 5, JavaScript (ES modules), Chart.js · Funções serverless na Vercel · API do Claude (`@anthropic-ai/sdk`) com saída estruturada · MockAPI · testes com `node --test`.

---

Projeto de portfólio. Transportadoras, clientes, preços e regras são fictícios.
