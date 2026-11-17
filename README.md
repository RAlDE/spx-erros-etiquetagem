# SPX — Erros de Etiquetagem (ETQ)

Extensão independente Chrome/Edge (Manifest V3) para classificar **operadores por quantidade de BRs com erro de etiquetagem**. **Versão 0.1.1 para teste**, com ícone ETQ apenas em letras; sem validação em sessão SPX real.

## Regra do ranking

1. O operador cola uma lista de BRs no painel **ETQ**, dentro do SPX. O painel reconhece BRs misturados com textos, normaliza e retira repetidos.
2. Para **cada BR único**, consulta o histórico `tracking_info` com a sessão atual.
3. Seleciona o evento **`LMHub_Recebido` mais recente pela data/hora**, não a última etapa de atribuição ou entrega. Extrai **OPS** e nome **desse mesmo evento**. Quando o último evento não revela o OPS, não atribui o erro ao operador de um recebimento anterior.
4. Cada BR confirmado vale **1 erro** no ranking do OPS correspondente. Ordena maior para menor contagem. A lista individual de BRs pode ser aberta clicando no operador.
5. Opcionalmente busca a AT no evento `LMHub_Atribuindo` imediatamente posterior ao último recebimento e tenta ler a posição de **Corredor-Gaiola/Rota** (ex.: `B-34`). É apenas informação auxiliar do BR, **sem ranking de ruas** e sem afetar contagem. Ausência de vínculo seguro significa rua em branco.
6. BRs sem evento/horário/OPS confiáveis aparecem separados. O total do ranking não inclui BRs sem atribuição segura.

**Não se pode interpretar o último evento do histórico como o último recebimento.** O BR pode ter múltiplas rotas e múltiplos recebimentos em dias diferentes. Não deduplicar eventos do histórico, mas contar cada BR colado uma vez.

## Instalação

1. No GitHub, escolha **Code → Download ZIP**, extraia e localize a pasta `extension` (contém `manifest.json`).
2. Chrome: `chrome://extensions` (Edge: `edge://extensions`) → **Modo do desenvolvedor** → **Carregar sem compactação** → selecione `extension`.
3. Abra `https://spx.shopee.com.br/` com uma sessão e permissões válidas.
4. Clique no ícone ETQ para abrir/ocultar o painel; cole os BRs, clique **Pesquisar e gerar ranking**. **Parar** aborta as consultas ainda em curso e preserva resultados já recebidos.
5. Clique em um OPS para abrir os BRs; **Copiar ranking** exporta colunas tabuladas, compatíveis com planilhas.

Ao atualizar os arquivos localmente, clique em **Recarregar** na extensão e atualize a aba SPX. Publicar no GitHub **não atualiza automaticamente** a extensão instalada.

## Fontes e restrições

- Consulta somente leitura `GET /api/fleet_order/order/detail/tracking_info?shipment_id=<BR>`.
- Consulta opcional somente leitura lógica (POST de busca, **sem alteração de estado**) em `/spx_delivery/admin/assignment/assignment_task/search/v2` com a AT do mesmo ciclo, baseada na consulta já usada por `spx-dv`.
- Não captura recebimentos, não imprime etiquetas, não cria exceções, não confirma tratativas e não altera planilhas ou outros repositórios.
- Código executa na aba autenticada do SPX; nada é enviado a servidores da extensão, GitHub ou planilhas. Não guarda a lista em armazenamento persistente.
- As chaves/formatos reais da API podem variar; se a resposta não trouxer o nome textual `LMHub_Recebido` ou o OPS, a extensão **não adivinha códigos de status**. A opção de copiar diagnóstico resumido ajuda a identificar as chaves/status sem exportar respostas brutas.
- Limite de três consultas simultâneas para a lista; erros de autenticação e limitação HTTP interrompem novas consultas.

## Estrutura

- `extension/manifest.json` — configuração MV3.
- `extension/background.js` — abre ou oculta o painel pelo ícone.
- `extension/core.js` — parser, extração e agrupamento testáveis sem acesso ao SPX.
- `extension/page.js` — interface e consultas usando a sessão do SPX, sem persistência.
- `tests/core.test.cjs` — testes sintéticos offline.

## Testes e limite atual

`node --test tests/core.test.cjs` e `node --check extension/*.js` (verifique os arquivos individualmente). A versão inicial precisa ser conferida em uma sessão SPX real, sobretudo o formato de `tracking_info`/`LMHub_Recebido` e o campo de corredor na resposta de AT. **Teste sintético não prova funcionamento em produção.**

## Regra de manutenção

Projeto separado de `spx-dv`, `spx-onhold`, `spx-delete-orders`, `spx-confirm` e `spx-sku`. Não modificar esses projetos. Corrigir apenas o comportamento solicitado, preservar versões validadas, obter os SHAs atuais antes de qualquer edição e documentar alterações. Nunca inserir BRs reais, nomes pessoais, sessões, respostas brutas ou vídeos no GitHub.
## Atualização 0.1.1 — ícone

- Ícone laranja com as letras **ETQ**, sem outros elementos gráficos.
- `manifest.json` atualizado para carregar o ícone também na barra de ferramentas do navegador.
- Nenhuma alteração da lógica de consulta ou classificação por OPS nesta versão.
- Pendência real: investigação de execução com 33 BRs consultados e 0 OPS atribuídos. Precisa do diagnóstico do rastreamento para identificar o formato efetivo da resposta SPX, sem inferir responsáveis.
