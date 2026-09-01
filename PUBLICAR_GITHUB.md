# Publicar no GitHub

## Opção mais fácil pelo site do GitHub

1. Crie um repositório vazio chamado `vicosa-smart-indicadores`.
2. Não marque a opção de criar README, porque o projeto já possui um.
3. Extraia o ZIP final no computador.
4. No GitHub, use **Add file → Upload files**.
5. Envie o conteúdo da pasta `vicosa-smart-indicadores`, mantendo a estrutura de pastas.

## Via Git

Na pasta do projeto:

```bash
git init
git add .
git commit -m "feat: central de indicadores Viçosa SMART"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/vicosa-smart-indicadores.git
git push -u origin main
```

## Antes de publicar

Confirme que estes arquivos NÃO existem no commit:

```text
.env
server/.env
node_modules/
client/node_modules/
server/node_modules/
```

O `.gitignore` já está preparado para ignorar esses itens.
