# SPX ETQ — Erros de Etiquetagem

Extensão independente Chrome/Edge (Manifest V3). **Versão 0.1.3 para teste real**, sem confirmação de funcionamento com os 33 BRs da operação. O ícone do navegador exibe somente as letras **ETQ**.

## Instalação com atualização pelo GitHub (recomendada)

A partir de 19/11/2026, o repositório é **público** e disponibiliza o **Carregador ETQ 0.2.0** no diretório `loader/`, no mesmo modelo do SPX OnHold. O carregador mantém os scripts de ranking em `extension/core.js`, `extension/audit.js` e `extension/page.js`, atualizados por botão na própria extensão.

**Instalação inicial, uma única vez por computador:** baixe o repositório em ZIP, extraia, carregue **a pasta `loader` (manifest 0.2.0)** em `chrome://extensions`, ative **Permitir scripts do usuário**, clique em **Atualizar pelo GitHub** e recarregue o SPX. **Desative a ETQ 0.1.x antiga**, se estiver instalada, para não misturar carregadores.

**Atualizações futuras:** clique no ícone ETQ → **Atualizar pelo GitHub** → recarregue a aba SPX → **Abrir ETQ**. Não é necessário baixar ZIP, extrair ou usar GitHub Desktop novamente.

[Guia de instalação do carregador](docs/INSTALACAO_LOADER.md). A versão **0.1.3 do módulo de ranking continua em teste real**: o carregador não resolve automaticamente erros de extração de OPS ou vinculação AM/PM.

## Finalidade

O operador cola uma lista de BRs previamente apontados como erro de etiquetagem. A extensão pesquisa a sessão autenticada do SPX e apresenta um **ranking apenas dos operadores responsáveis pelo último recebimento normal**, ordenado por quantidade de BRs distintos. Pode filtrar o ranking por expedição **Geral, AM, PM** (e PM2, caso haja terceira VT).

Não determina sozinho se um BR é erro de etiqueta: **a lista colada é a definição da amostra**.

## Como usar a ETQ após instalar o carregador

1. Faça login em `https://spx.shopee.com.br/`.
2. Clique no ícone ETQ e em **Abrir / fechar painel ETQ**.
3. Cole os BRs e selecione a **data da conferência VT** (não obrigatoriamente a data do recebimento).
4. Clique em **Pesquisar e gerar ranking** e confira **Geral / AM / PM** (ou PM2, quando houver terceira VT).
5. Se ocorrer erro de identificação, copie o diagnóstico resumido, sem publicar BRs reais no GitHub.
6. Para receber uma correção nova, abra o ícone ETQ, clique em **Atualizar pelo GitHub** e recarregue a aba SPX.

## Identificação do operador (último recebimento)

- `GET /api/fleet_order/order/detail/tracking_info?shipment_id=BR...` na sessão atual do SPX.
- O status **numérico `1`** corresponde ao recebimento normal `LMHub_Received`; textos `LMHub_Recebido` e a mensagem explícita de chegada também são reconhecidos. O status `10` corresponde a Return e é excluído.
- Seleciona o **recebimento normal mais recente pelo timestamp**, inclusive quando há múltiplas passagens do mesmo BR. Extrai o OPS **do mesmo evento**, não do motorista, da AT nem de `Admin(Dynamic Routing)`.
- Suporta `[Ops123] NOME`, `[123] NOME` e identificadores estruturados de operador; se o último evento não tiver OPS, não herda de recebimento antigo.
- Se o OPS estiver ausente, a consulta de `GET /api/in-station/uni_receive/receive_management/receive_task/list` é **complementar**, aceitando um resultado somente com **mesmo BR** e **horário até 10 minutos do último recebimento conhecido** e OPS sem conflito. Caso contrário, mantém o BR como não atribuído.
- Usa o ID da estação da sessão quando disponível para filtrar o rastreamento de outros hubs.
- Um BR distinto conta **um erro**, mesmo se o código foi colado mais de uma vez ou se apareceu em várias rotas.

## Turnos AM/PM — vínculo por VT

- Com a data da conferência selecionada, consulta `GET /api/in-station/lmhub/audit/task/list` para identificar as VTs. **Primeira VT aberta no dia = AM; segunda = PM; terceira = PM2**. Não divide por 12h e não deduz o dia exclusivamente do ID da tarefa.
- Para cada VT, consulta `GET /api/in-station/lmhub/audit/target/list?task_id=VT...` e, **somente em rotas com quantidade de Missing/Missorted > 0**, consulta as exceções por `GET /api/in-station/lmhub/audit/parcel/list` com parâmetros descritos na LMH Audit 2.9.0.
- O **turno é o da primeira VT onde a ocorrência do BR foi confirmada**, e não o turno do recebimento. Um BR visto no AM e novamente no PM pertence somente ao AM.
- Se o BR não estiver nas exceções da VT selecionada, a consulta for incompleta ou as VTs não estiverem disponíveis, mantém seu OPS no **ranking Geral**, mas indica o **turno não identificado**. Não soma o BR ao AM/PM por aproximação.
- O filtro por turno opera **apenas no dia selecionado**. Se a lista contiver erros de dias diferentes, faça pesquisas separadas por data. O usuário escolhe a data da conferência, não a data do último recebimento.
- VTs não são, por si só, prova de erro de etiqueta: esse diagnóstico compara a amostra colada às exceções presentes nas tarefas.

## Limites e segurança

- Consultas apenas de leitura de estado; alguns endpoints de busca do SPX utilizam **POST de consulta** sem efeitos de alteração. Nenhum recebimento, confirmação, impressão, exceção ou tarefa é criado.
- Sem envio de BRs a backend externo, GitHub, planilhas ou Apps Script; não usa tokens/cookies diretamente, utiliza a sessão SPX do navegador.
- Não persiste a lista. **Parar** cancela consultas pendentes e mantém o que já foi obtido.
- Até três consultas paralelas por BR e três para rotas de auditoria; há limites de páginas e requisições para não sobrecarregar o SPX. Uma varredura incompleta é sinalizada.
- O comportamento da API do SPX deve ser confirmado em uso real; nenhum teste local valida autenticação, conteúdo real de VT ou formato específico do ambiente.

## Estrutura

- `loader/`: carregador instalado uma única vez; popup **Atualizar pelo GitHub**, ativar/desativar e abrir ETQ.
- `catalog.json`: versão do módulo e arquivos públicos autorizados ao carregador.
- `extension/manifest.json`: instalação antiga, mantida como referência e alternativa manual de desenvolvimento.
- `extension/background.js`: abre/fecha o painel pelo ícone.
- `extension/core.js`: identifica último recebimento e OPS, consolida ranking (puro, testável).
- `extension/audit.js`: procura VTs por data e vincula BRs a exceções por leitura (testável com respostas simuladas).
- `extension/page.js`: interface flutuante e execução autenticada no SPX.
- `tests/core.test.cjs`: testes offline, inclusive simulação de 33 BRs, AM/PM, status numérico, Return e erro de consulta.
- `tests/loader.test.cjs`: testes do carregador público e atualização via GitHub.
- `docs/TESTE_REAL_v0.1.3.md`: roteiro de validação real da nova versão.

Execute `node --test tests/*.test.cjs` e `node --check extension/core.js`, `node --check extension/audit.js`, `node --check extension/page.js`, `node --check extension/background.js`.

## Histórico e controle

- **0.1.0:** primeiro ranking; diagnósticos mostraram 33 BRs pesquisados, zero OPS reconhecidos.
- **0.1.1:** novo ícone somente letras ETQ, mantendo lógica 0.1.0.
- **0.1.2:** reconhece status numérico 1, amplia parser de OPS, adiciona fallback de gestão de recebimento com correspondência temporal estrita, busca VTs auditadas e filtros Geral/AM/PM, diagnósticos numéricos e testes automáticos.

Não modificar os projetos SPX-DV, SPX-OnHold, SPX-Confirm, SPX-SKU, SPX-Delete-Orders ou a extensão de referência LMH Audit. Não adicionar dados reais de pedidos, logins ou respostas brutas nos commits.

## v0.1.3 — Diagnóstico real de 11 BRs (18/11/2026)

- O rastreamento foi encontrado em 10 de 11 BRs, mas o OPS não foi extraído. `status: 1` foi reconhecido; código não utilizava `biz_staff_id` como alternativa ao `operator`. A partir de 0.1.3, o par `biz_staff_id` numérico e `biz_staff_name` não vazio no **mesmo evento** pode identificar o responsável, sem consultar recebimentos anteriores.
- Descoberta de VTs ocorre independentemente de já haver OPS, corrigindo o `vtCount: 0` produzido por não execução. O diagnóstico mostra número de VTs e amostra de nomes de campos, sem conteúdo pessoal.
- Não se altera a regra do último recebimento, nem se força correspondência com tarefas concluídas em outro horário.
- **Teste real obrigatório**: confirmar ao menos dois IDs e nomes contra o rastreamento visual antes de processar grandes lotes.
