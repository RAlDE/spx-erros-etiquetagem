# Requisito: ranking de erros por expedição AM / PM

Fonte operacional: captura enviada em 17/11/2026 da página SPX **Gestão Audit → Conferência: LM Hub AT/TO**, endereço `#/mercadao/audit-list`, e código enviado da extensão LMH Audit V2.9.0 (`config.js`, `lib/busca_dia.js`, `lib/audit.js`, `lib/regras.js`, `lib/turnos.js`).

## Regra de negócio
- Uma data pode ter **duas tarefas de conferência VT** e, em casos excepcionais, mais.
- **Primeira VT que começou no dia = AM; segunda = PM; terceira = PM2**, como em `TURNO_ONDA: ['AM', 'PM', 'PM2']` da LMH Audit. Usar o **horário real de criação/início da tarefa no fuso America/Sao_Paulo**. Nunca derivar o dia unicamente do ID: o ID pode representar data diferente da abertura real.
- **Não usar 12:00 como divisão AM/PM**: o segundo turno pode começar antes de 12:00. Na imagem de 17/11, AM abriu às 03:56:43 e PM às 11:21:56; em 16/11, AM às 04:16:22 e PM às 10:11:23.
- Para **identificar o operador responsável** por um BR colado, usar o **último evento normal `LMHub_Recebido`** do histórico do mesmo BR (status numérico 1 quando confirmado). Não usar o operador da VT ou da AT como responsável pela etiqueta. Não confundir Return / status 10.
- Para identificar **a expedição na qual o erro foi detectado**, vincular o BR ao registro de exceção da **VT correspondente**, não simplesmente ao horário do recebimento. A LMH Audit já faz essa associação por `vt_id` e `ordem_onda`.
- Se o mesmo BR aparece em mais de uma VT no escopo analisado, **contar uma única vez**, pela **primeira VT em que a ocorrência aparece**, seguindo `consolidar` em `lib/regras.js`. Não contar novamente em AM e PM.
- **Não adivinhar** turno quando não houver vínculo confiável BR → VT. Listar como `Turno não identificado` e não incluir nos subtotais AM/PM, preservando o total geral de BRs com OPS conhecido.
- **O ranking é somente de operadores**: não criar ranking de ruas/VT. Rua/AT permanecem informações secundárias no detalhe do BR.

## Consultas de referência já existentes na LMH Audit
- `GET /api/in-station/lmhub/audit/task/list`, parâmetro de paginação `pageno,count` ou `page_no,count`, para obter VTs do dia e abertura.
- `GET /api/in-station/lmhub/audit/target/list`, `task_id=VT...`, para rotas/ATs da VT.
- `GET /api/in-station/lmhub/audit/parcel/list`, `validation_task_id=VT...`, `target_id=...` e outros filtros de exceção para os BRs.
- `GET /api/fleet_order/order/detail/tracking_info?shipment_id=BR...` para último recebimento e OPS.

Não assumir que uma consulta isolada `parcel/list?shipment_id=BR` funciona sem os parâmetros de rota: isso ainda requer validação no SPX real.

## Apresentação planejada
- Ranking **Geral | AM | PM**, por OPS e nome, quantidade decrescente. Quando existir terceira VT, mostrar `PM2`.
- Cada operador poderá abrir a lista de BRs (data/hora do último recebimento, VT onde erro foi detectado, turno, AT/rua quando verificados).
- Totais: BRs únicos de entrada, com OPS, AM, PM, PM2, turno indefinido e sem OPS.
- Um BR não deve ser somado duas vezes na visão Geral, nem ter classificação cruzada entre AM e PM.

## Situação
**Especificação registrada, sem implementação nem validação real.** A correção do problema anterior (33 BRs consultados, nenhum OPS identificado) continua pendente. Aplicar e testar em versão futura da ETQ exclusivamente, sem alterar SPX-DV, SPX-OnHold, SPX-Confirm, SPX-SKU nem LMH Audit.
