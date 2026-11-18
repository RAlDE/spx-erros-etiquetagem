# Teste real ETQ v0.1.3 — OPS + VT AM/PM

## Preparação

1. Desative ou remova a ETQ antiga (0.1.2); extraia o ZIP e carregue a **pasta ETQ-SPX** em chrome://extensions pelo modo desenvolvedor. Confirme versão 0.1.3 e atualize a aba SPX.
2. Abra SPX autenticado na estação correta, entre em Gestão Audit → Conferência: LM Hub AT/TO, e abra o painel ETQ pelo ícone laranja das letras ETQ.
3. Escolha a data real da **VT em que o erro foi detectado**. Na captura de 18/11/2026 são visíveis duas VTs: primeira às 04:52:37 (AM), segunda às 11:04:18 (PM).
4. Cole inicialmente 3 a 5 BRs de erro de etiqueta conhecidos. Clique em Pesquisar e gerar ranking.

## O que validar

- O ranking Geral identifica OPS e nome a partir do último evento normal status 1, mesmo quando a identidade aparece em `biz_staff_id` e `biz_staff_name`, sem usar operador de evento antigo ou Return.
- Compare manualmente dois casos com o rastreio visual real, data/hora e operador. Se divergirem, não utilize os resultados ainda.
- O painel mostra VTs encontradas mesmo quando nenhum OPS foi identificado (corrige o anterior `vtCount: 0`).
- AM corresponde à VT que abriu primeiro; PM à segunda VT, independentemente de 12h. Um BR só conta uma vez no Geral e apenas na primeira VT em que aparece entre as exceções consultadas.
- Se um BR não tiver vínculo VT comprovado, ele aparece no Geral sem turno. Sem evento normal ou identidade segura, ele não entra no ranking.

## Se o teste ainda falhar

Expanda BRs sem operador → Copiar diagnóstico resumido. O relatório inclui apenas códigos, campos, formatos de identificação, situação das VTs e contagens — não inclui nomes de operadores ou valores crus do histórico. Envie o JSON e um print do painel. Não envie cookies, tokens, Authorization, senhas ou respostas brutas do SPX.

## Limites

Testes locais não são validação de API SPX. O pareamento do `biz_staff_id` pressupõe que o par ID+nome pertença ao mesmo evento de recebimento. O objetivo deste teste é confirmar essa correspondência contra a interface visual antes do uso operacional.
