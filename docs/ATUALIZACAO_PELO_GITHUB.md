# ETQ — Atualização pelo GitHub (sem ZIP a cada teste)

## Processo oficial a partir de 19/11/2026

O repositório privado `RAlDE/spx-erros-etiquetagem` é a fonte única das versões de teste. O desenvolvedor publica todas as correções no branch `main` (com changelog/commit). Não é mais necessário baixar e extrair arquivos ZIP a cada versão.

**Limitação:** publicar no GitHub não altera automaticamente os arquivos carregados pelo Chrome. É necessário sincronizar o repositório no computador e recarregar a extensão. Não executar JavaScript remoto de GitHub; preservar Manifest V3 e o caráter privado do repositório.

## Configuração única — GitHub Desktop (Windows)

1. Instalar o programa oficial **GitHub Desktop**: https://desktop.github.com/ e entrar com a conta GitHub `RAlDE`.
2. Em **File > Clone repository... > GitHub.com**, escolher `RAlDE/spx-erros-etiquetagem`. Selecionar uma pasta local estável e clicar em **Clone**. Alternativamente, na página do repositório, usar **Code > Open with GitHub Desktop**.
3. No GitHub Desktop, usar **Repository > Show in Explorer** (Mostrar no Explorador) e localizar a subpasta `extension` que contém o arquivo `manifest.json`.
4. Em `chrome://extensions` (ou `edge://extensions`), ativar **Modo do desenvolvedor**, desativar ou remover a ETQ antiga carregada de uma pasta extraída de ZIP e selecionar **Carregar sem compactação**.
5. **Escolher a pasta `extension` dentro do clone do GitHub**, não a raiz do repositório. Fixar o ícone ETQ e atualizar a página do SPX.

## Atualizações futuras — sempre o mesmo repositório

1. Receber a mensagem de que uma nova versão ETQ foi publicada no GitHub.
2. Abrir o **GitHub Desktop** no repositório `spx-erros-etiquetagem` e na branch `main`.
3. Clicar em **Fetch origin**; quando aparecer, clicar em **Pull origin** para trazer os commits novos. Se o aplicativo já indicar **Pull origin**, clicar nele diretamente.
4. Abrir `chrome://extensions` e clicar em **Recarregar** (ícone de seta circular) no cartão **SPX — Erros de Etiquetagem**.
5. Recarregar a aba do SPX. Abrir ETQ e conferir a versão indicada no cabeçalho antes de executar o teste.

Assim não é necessário fazer **Code > Download ZIP**, extrair, substituir arquivos ou reinstalar a extensão em cada ciclo.

## Se ocorrer algum problema

- **Versão antiga continua aparecendo:** confira se o cartão do Chrome aponta para a pasta `extension` do clone e não para a antiga pasta extraída; confira o branch `main`, execute **Pull origin**, recarregue a extensão e atualize o SPX.
- **GitHub Desktop não mostra atualizações:** confirme `RAlDE/spx-erros-etiquetagem` e `main`; clique em **Fetch origin**.
- **Conflito de alterações locais:** não usar **Discard**, **Force push** ou **Reset** sem analisar os arquivos. Solicitar revisão antes.
- **Extensão não abre:** confirmar o `manifest.json` da pasta selecionada e consultar **Erros** no cartão da extensão.
- **Repositório privado não aparece:** confirmar login da conta `RAlDE` no GitHub Desktop.

## Organização para os próximos testes

- Cada alteração será versionada e registrada no GitHub.
- Não modificar os repositórios SPX-DV, SPX-OnHold, SPX-Confirm, SPX-SKU, nem SPX-Delete-Orders.
- Não usar atualização automática de código JavaScript via URL pública ou token embutido na extensão.
- O usuário fornece prints/diagnósticos; o código é corrigido no GitHub; a instalação local é sincronizada via **Pull origin + Recarregar**, sem ZIP.

Referências oficiais:
- https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-a-repository-from-github-to-github-desktop
- https://docs.github.com/en/get-started/learning-to-code/getting-started-with-git
- https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world
