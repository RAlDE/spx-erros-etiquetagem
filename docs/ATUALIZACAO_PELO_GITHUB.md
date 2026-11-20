# Atualização da ETQ pelo GitHub

## Método recomendado — carregador com botão Atualizar

**Desde 19/11/2026, o repositório ETQ é público.** Foi disponibilizado o carregador ETQ 0.2.0 em `loader/`, semelhante ao SPX OnHold. A documentação de instalação está em [INSTALACAO_LOADER.md](INSTALACAO_LOADER.md).

Instale **uma única vez** o diretório `loader` (manifest 0.2.0) em `chrome://extensions`, ative **Permitir scripts do usuário** e pressione **Atualizar pelo GitHub**. Nos próximos testes, basta repetir **Atualizar pelo GitHub** e recarregar a aba do SPX. **Não é necessário GitHub Desktop, novos ZIPs nem reinstalações.**

O módulo de ranking tem versão própria, 0.1.3 nesta primeira publicação do carregador, diferente da versão do carregador 0.2.0. Corrigir o módulo no GitHub e atualizar `catalog.json` é suficiente para distribuir alterações a `core.js`, `audit.js` e `page.js`.

## Método alternativo — GitHub Desktop

Se o usuário preferir trabalhar com uma cópia local dos fontes, pode usar GitHub Desktop para clonar `RAlDE/spx-erros-etiquetagem`. Este é **um método alternativo**, não o método recomendado para os testes da ETQ.

Para usar a instalação antiga de desenvolvimento, selecione a pasta `extension` no Chrome e atualize-a com **Fetch origin → Pull origin → Recarregar extensão → Atualizar aba SPX**. **Não instale o carregador novo e o antigo ao mesmo tempo**, pois podem coexistir painéis independentes.

## Cuidados

- Os dados de BR/OPS não devem ser enviados ao repositório GitHub.
- Não publicar tokens, cookies nem diagnósticos brutos do SPX.
- A atualização só é considerada funcional depois do teste na sessão real do SPX; testes offline não substituem validação operacional.
- O carregador busca somente scripts públicos previstos no catálogo. Não funciona em repositório privado sem autenticação.
- Mudanças nos arquivos do próprio carregador podem exigir uma reinstalação excepcional. Atualizações normais do módulo não.
