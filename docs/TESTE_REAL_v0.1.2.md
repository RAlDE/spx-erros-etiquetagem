# Teste real ETQ v0.1.2 — roteiro

## Antes de executar

- Instale a **pasta nova** do ZIP 0.1.2; em `chrome://extensions`, recarregue e depois atualize a aba do SPX.
- Selecione a data **da conferência VT**. Por exemplo, tarefas AM 03:56 e PM 11:21 abertas em 17/11/2026 correspondem ao dia **17/11/2026**, independentemente da data do último `LMHub_Recebido`.
- Faça primeiro um teste com **3 a 5 BRs** conhecidos, incluindo pelo menos um com múltiplos recebimentos, antes de pesquisar a lista completa.

## O que conferir

1. O número de BRs válidos corresponde ao que foi colado, sem duplicatas.
2. O ranking Geral mostra OPS e nome do **último** recebimento normal. Confirme manualmente 2–3 BRs pela linha de rastreamento, sem usar o autor de `LMHub_Atribuindo`.
3. O código `status 10` (Return) não é tratado como recebimento normal.
4. As VTs da data são exibidas com horários reais de abertura e rótulos **AM**, **PM**, **PM2** se houver.
5. Um BR encontrado nas exceções da VT entra no filtro do respectivo turno. Se existir em AM e PM, aparece só em AM.
6. BR não localizado nas VTs permanece no ranking **Geral** com turno `—` e **não** aumenta AM/PM.
7. **Copiar ranking** contém o filtro selecionado (Geral/AM/PM).
8. Em caso de falha, copie o diagnóstico resumido de BR não atribuído e informe em qual etapa parou: `Rastreamento`, `Procurando tarefas VT` ou `Conferência AM/PM`.

## Resultado de testes locais

**33 testes simulados aprovados**, cobrindo status1, exclusão Return, OPS `[OpsID]` e `[ID]`, múltiplos recebimentos, estação, erro de horário, recebimento complementar com mesmo BR/horário, importação de BRs, ranking sem duplicidade, VT por data de criação, AM/PM/PM2, paginação e falha de endpoints.

**Não houve teste autenticado com o SPX real nesta versão.** O comportamento real das APIs de Gestão Audit e o vínculo por `parcel/list` precisam ser validados na estação selecionada; a extensão sinaliza dados de turno ausentes e varredura incompleta em vez de inventar turnos.
