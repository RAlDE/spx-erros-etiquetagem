# Instalação única: Carregador ETQ pelo GitHub

## Situação do projeto

- **Carregador:** v0.2.0 (arquivos em `loader/`), instalação local necessária uma única vez por computador.
- **Módulo ETQ (ranking):** v0.1.3 (código em `extension/core.js`, `extension/audit.js`, `extension/page.js`), ainda em testes operacionais no SPX.
- **Repositório público:** https://github.com/RAlDE/spx-erros-etiquetagem

A nova instalação segue o modelo do SPX OnHold, com catálogo `catalog.json` público e `chrome.userScripts` para registrar o módulo na sessão do SPX. **Não precisa instalar GitHub Desktop**.

## Instalação inicial — uma vez em cada computador

1. No GitHub, clique em **Code > Download ZIP** apenas uma vez ou use o pacote `SPX-ETQ-Loader-v0.2.0-instalacao-unica.zip` da conversa. Extraia e localize a pasta `loader` do repositório, ou a pasta `ETQ-Loader` do pacote.
2. Vá a `chrome://extensions` (ou `edge://extensions`) e ative o **Modo do desenvolvedor**.
3. **Desative ou remova a instalação ETQ antiga (v0.1.x)** para não criar painéis duplicados. Não desative SPX-DV, SPX OnHold ou outras extensões.
4. Clique **Carregar sem compactação** e selecione a pasta `loader` (ou `ETQ-Loader`) onde está o `manifest.json` de **versão 0.2.0**. Não selecione a pasta `extension` do projeto: ela contém a versão antiga sem atualização por botão.
5. Abra **Detalhes** da nova ETQ e habilite **Permitir scripts do usuário** (Chrome 138+).
6. Clique no ícone ETQ. Use **Atualizar pelo GitHub**; em seguida, recarregue a página do SPX e clique **Abrir / fechar painel ETQ**.

## Próximas atualizações

- Eu publico a correção no branch `main` e atualizo `catalog.json` com a versão do módulo.
- Você abre o ícone ETQ, clica **Atualizar pelo GitHub**, atualiza a aba do SPX e clica **Abrir ETQ**.
- Não precisa baixar ZIP, extrair, usar GitHub Desktop nem reinstalar a extensão a cada nova correção.
- O campo "Módulo GitHub" no popup mostra a versão do ranking ativa; o carregador permanece na versão 0.2.0 enquanto os recursos de atualização não mudarem.

## Observações

- A atualização muda o **código do módulo**, não o pacote local do carregador, o que é suficiente para corrigir as rotinas de ranking e consultas em `core.js`, `audit.js` e `page.js`.
- Se precisarmos alterar os arquivos do próprio carregador (`loader/background.js`, `loader/popup.js` ou `loader/manifest.json`), uma atualização local excepcional será necessária.
- Se a busca falhar, confirme a conexão com GitHub, `Permitir scripts do usuário` habilitado, SPX autenticado e clique em **Atualizar** novamente.
- O carregador somente baixa scripts públicos autorizados de `RAlDE/spx-erros-etiquetagem` e não envia BRs, OPS ou diagnósticos ao GitHub.
- Publicar o código no GitHub não equivale a validar a leitura da API no ambiente real do SPX. A v0.1.3 ainda precisa de testes reais antes de confiar na contagem e nos turnos AM/PM.
