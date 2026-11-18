# SPX ETQ — Erros de Etiquetagem

Extensão independente Chrome/Edge (Manifest V3). **Versão 0.1.2 para teste real**, sem confirmação de funcionamento com os 33 BRs da operação. O ícone do navegador exibe somente as letras **ETQ**.

## Finalidade

O operador cola uma lista de BRs previamente apontados como erro de etiquetagem. A extensão pesquisa a sessão autenticada do SPX e apresenta um **ranking apenas dos operadores responsáveis pelo último recebimento normal**, ordenado por quantidade de BRs distintos. Pode filtrar o ranking por expedição **Geral, AM, PM** (e PM2, caso haja terceira VT).

Não determina sozinho se um BR é erro de etiqueta: **a lista colada é a definição da amostra**.

## Passo a passo

1. Baixe o ZIP da versão de teste fornecido no ChatGPT ou clique em **Code → Download ZIP** neste repositório e extraia.
2. Abra `chrome://extensions` (ou `edge://extensions`), habilite **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta `extension` contendo `manifest.json`.
3. Abra `https://spx.shopee.com.br/`, faça login, clique no ícone **ETQ** e cole os BRs.
4. **Selecione a data da conferência VT**, não necessariamente a data do recebimento dos BRs. O campo sugere o dia atual de São Paulo e pode ser alterado.
5. Clique **Pesquisar e gerar ranking**. Aguarde a consulta de rastreamento e a procura das VTs de conferência. O levantamento das VTs pode envolver diversas rotas e demorar mais que o rastreamento.
6. Veja **Geral**, **AM**, **PM** (e **PM2** se aplicável). Clique no OPS para ver seus BRs; **Copiar ranking** exporta a tabela do filtro atual para Excel/Google Sheets.
7. Se houver BRs não atribuídos, use **Copiar diagnóstico resumido**. Verifique o conteúdo antes de enviar qualquer diagnóstico a terceiros.

Atualizar no GitHub **não atualiza a extensão instalada**: substitua a pasta, recarregue em `chrome://extensions` e atualize a aba do SPX.

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

- `extension/manifest.json`: Manifest V3; ícone somente ETQ.
- `extension/background.js`: abre/fecha o painel pelo ícone.
- `extension/core.js`: identifica último recebimento e OPS, consolida ranking (puro, testável).
- `extension/audit.js`: procura VTs por data e vincula BRs a exceções por leitura (testável com respostas simuladas).
- `extension/page.js`: interface flutuante e execução autenticada no SPX.
- `tests/core.test.cjs`: testes offline, inclusive simulação de 33 BRs, AM/PM, status numérico, Return e erro de consulta.
- `docs/TESTE_REAL_v0.1.2.md`: roteiro operacional e problemas esperados.

Execute `node --test tests/core.test.cjs` e `node --check extension/core.js`, `node --check extension/audit.js`, `node --check extension/page.js`, `node --check extension/background.js`.

## Histórico e controle

- **0.1.0:** primeiro ranking; diagnósticos mostraram 33 BRs pesquisados, zero OPS reconhecidos.
- **0.1.1:** novo ícone somente letras ETQ, mantendo lógica 0.1.0.
- **0.1.2:** reconhece status numérico 1, amplia parser de OPS, adiciona fallback de gestão de recebimento com correspondência temporal estrita, busca VTs auditadas e filtros Geral/AM/PM, diagnósticos numéricos e testes automáticos.

Não modificar os projetos SPX-DV, SPX-OnHold, SPX-Confirm, SPX-SKU, SPX-Delete-Orders ou a extensão de referência LMH Audit. Não adicionar dados reais de pedidos, logins ou respostas brutas nos commits.