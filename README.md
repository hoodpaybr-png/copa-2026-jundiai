# Copa do Mundo 2026 — Jundiaí/SP

Site com a tabela completa da Copa do Mundo 2026: grupos, classificação,
jogos de hoje/próximos, tabela completa (104 jogos) com filtros, onde
assistir no Brasil e artilheiros — horários sempre em **horário de
Brasília**.

---

## 1. O que é automático e o que não é

| Recurso | Status |
|---|---|
| Tabela de jogos, datas, horários, estádios, "onde assistir" | **Fixo** (dados de 12/06/2026). Eu atualizo o arquivo `data/matches.json` sempre que você pedir. |
| Placar em tempo real, "em andamento"/"encerrado" | **Automático**, se você configurar a variável `API_FOOTBALL_KEY` (passo 3). Atualiza a cada ~30 min sozinho. |
| Classificação dos grupos (V/E/D/Pts) | **Automático**, com a mesma chave. |
| Artilheiros / assistências | **Automático**, com a mesma chave (a partir do momento em que a API tiver dados). |
| Confrontos do mata-mata (16-avos em diante, ex: "1ºA x 2ºB") | Ficam com placeholders até a fase de grupos terminar. Quando os classificados forem conhecidos, me peça para atualizar `data/matches.json` com os confrontos reais. |

Sem a chave de API configurada, o site funciona perfeitamente como
**tabela/calendário/onde assistir** — só não mostra placares/classificação/
artilheiros em tempo real (aparece um aviso explicando isso).

---

## 2. Deploy na Vercel (gratuito)

### Opção mais simples — Vercel CLI
```bash
npm install -g vercel
cd copa-2026-jundiai
vercel        # primeiro deploy (gera link tipo copa-2026-jundiai.vercel.app)
vercel --prod # promove para produção
```

### Opção recomendada — GitHub + import
1. Crie um repositório novo no GitHub e suba esta pasta inteira.
2. Em https://vercel.com → **Add New > Project** → selecione o repositório.
3. Framework Preset: **Other** (não precisa de build command — é HTML/CSS/JS puro
   + funções serverless em `/api`).
4. Clique em **Deploy**. Em poucos segundos você recebe a URL
   `https://<algo>.vercel.app`.

Qualquer novo `git push` para a branch principal gera um novo deploy
automaticamente.

---

## 3. Ativar placar/classificação/artilheiros em tempo real (API-Football)

**Recomendação custo x benefício**: [API-Football (api-sports.io)](https://www.api-football.com/)
tem um plano **gratuito de 100 requisições/dia**, e cobre bem a Copa do
Mundo (jogos, classificação e artilheiros). Como o site usa cache de 30
minutos, isso dá no máximo ~48 requisições/dia mesmo com tráfego alto — bem
dentro do limite gratuito. Se mais adiante você quiser dados mais
granulares (lances, escalações, estatísticas detalhadas por jogador em
tempo real), os planos pagos começam por valores baixos (na faixa de
US$ 10-20/mês no plano "Pro").

Passo a passo:
1. Crie uma conta gratuita em https://dashboard.api-football.com/register
2. Copie sua **API Key** no painel.
3. Na Vercel: **Project Settings > Environment Variables**, adicione:
   - Nome: `API_FOOTBALL_KEY`
   - Valor: *(sua chave)*
   - Ambiente: Production (e Preview, se quiser)
4. Re-deploy (Vercel > Deployments > ... > Redeploy).

A partir daí, `/api/live` passa a responder com `configured: true` e o site
preenche automaticamente placares, classificação dos grupos e artilheiros.

> Observação: a liga "FIFA World Cup" na API-Football é o `league=1`. Isso
> já está configurado em `api/live.js`. Caso a API mude o ID para a edição
> 2026, me avise para eu ajustar.

---

## 4. Atualizar os dados da tabela manualmente

Quando você quiser que eu atualize algo (resultados, confrontos do
mata-mata definidos, mudanças de transmissão, etc.), me peça normalmente
("atualiza a tabela com os jogos que já têm resultado" / "preenche os
confrontos das oitavas de final"). Eu regenero o arquivo
`data/matches.json` e te devolvo já pronto para subir (substituir o arquivo
e dar `git push`, ou re-upload na Vercel).

---

## 5. Estrutura do projeto

```
.
├── index.html          # página única (tabs: Hoje, Tabela, Grupos, Onde Assistir, Artilheiros)
├── css/styles.css       # design (cards em formato de "ticket de estádio")
├── js/app.js            # lógica de renderização, filtros, contagem regressiva, integração com /api/live
├── data/matches.json    # 104 jogos, grupos, estádios, transmissão (atualizado manualmente)
├── api/live.js          # função serverless: placar/classificação/artilheiros via API-Football
├── vercel.json
└── package.json
```

---

## 6. Domínio próprio

Depois do primeiro deploy, em **Project Settings > Domains** na Vercel você
pode apontar um domínio/subdomínio seu (ex: `copa.hoodpay.com.br`) criando
um registro CNAME conforme instruído pela própria Vercel. Quando quiser
fazer isso, me chame que eu te ajudo com os registros de DNS.
