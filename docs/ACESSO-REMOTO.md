# Usar o Kortex no celular

O Kortex roda no seu computador e guarda tudo lá. O celular é só uma "janela" para ele. Existem três jeitos de abrir, do mais simples ao mais completo:

|                                     | Como                | Funciona fora de casa | Instala como app    | Precisa de                |
| ----------------------------------- | ------------------- | --------------------- | ------------------- | ------------------------- |
| **1. Só este computador** (padrão)  | `npm start`         | não                   | sim, no próprio PC  | nada                      |
| **2. Mesma rede Wi-Fi**             | `npm run start:lan` | não                   | **não** (sem HTTPS) | PIN recomendado           |
| **3. De qualquer lugar, com HTTPS** | Tailscale           | **sim**               | **sim**             | conta grátis no Tailscale |

> **Por que o HTTPS importa:** os navegadores só deixam um site virar app instalado (e funcionar sem internet) em **HTTPS** ou em `localhost`. Pela rede local o endereço é `http://192.168…`, então o Kortex abre e funciona normalmente, mas sem o botão "Instalar".

Nos três casos o computador precisa estar **ligado, sem suspender, com o Kortex rodando** (`npm start` aberto).

---

## 2. Mesma rede Wi-Fi

1. **Crie um PIN** em _Configurações → Segurança_. (Sem PIN, qualquer pessoa na sua rede abre o Kortex.)
2. Pare o Kortex (`Ctrl+C`) e inicie com:
   ```bash
   npm run start:lan
   ```
3. **Windows:** na primeira vez, o firewall pergunta se o Node pode receber conexões. Marque **redes privadas** e permita.
4. O terminal mostra o endereço, algo como `http://192.168.0.12:3333` (também aparece em _Configurações → Acesso pelo celular_, com botão de copiar).
5. No celular, conectado **ao mesmo Wi-Fi**, abra esse endereço e digite o PIN.

**Não abre?**

- Celular e computador precisam estar na **mesma rede**. Wi-Fi de visitantes costuma ser isolado dos outros aparelhos.
- Confira o firewall (passo 3) e se há uma VPN ligada no computador.
- O IP pode mudar com o tempo. Para fixar, reserve o IP do computador no roteador.

---

## 3. De qualquer lugar, com HTTPS (Tailscale)

O [Tailscale](https://tailscale.com) cria uma rede privada só sua entre seus aparelhos e entrega um endereço HTTPS. Não precisa abrir portas no roteador, e só os aparelhos da **sua** conta enxergam o Kortex.

1. Instale o Tailscale **no computador e no celular** e entre com a mesma conta.
2. No [painel de administração](https://login.tailscale.com/admin/dns), ligue **MagicDNS** e **HTTPS Certificates** (uma vez só).
3. No computador, inicie o Kortex normalmente (`npm start`). **Não precisa** do `start:lan`: o Tailscale conversa com o Kortex dentro do próprio computador.
4. Em outro terminal, publique-o na sua rede privada:
   ```bash
   tailscale serve --bg 3333
   ```
   O comando mostra um endereço como `https://meu-pc.seu-tailnet.ts.net`. (Se o comando mudar numa versão futura, confira `tailscale serve --help` ou a [documentação](https://tailscale.com/kb/1242/tailscale-serve).)
5. No celular (com o Tailscale ligado), abra esse endereço, digite o PIN e **instale**:
   - **Android (Chrome):** botão **Instalar o Kortex** em _Configurações → Acesso pelo celular_, ou menu ⋮ → _Instalar app_.
   - **iPhone/iPad (Safari):** Compartilhar → _Adicionar à Tela de Início_.

Para desfazer: `tailscale serve reset`.

**Boas práticas**

- Mantenha o PIN ativo mesmo na rede privada.
- **Não use o "Funnel"** do Tailscale: ele publica na internet aberta. Se precisar, use um PIN longo (o login trava após 5 erros seguidos, mas um PIN fraco ainda é um risco).

---

## O que funciona sem internet?

O app instalado **abre** sem rede (a "casca" fica guardada no celular), mas **os dados vêm do seu computador**. Sem conexão com ele, as telas avisam que não conseguem carregar. Por segurança, os dados da API nunca são guardados no celular.

## Perguntas frequentes

**"Endereço … não permitido" (BAD_HOST).** Por segurança o Kortex só responde a `localhost`, endereços IP, `*.ts.net` (Tailscale), `*.local` e ao nome do computador. Se você usa um domínio próprio, libere-o antes de iniciar: `KORTEX_ALLOWED_HOSTS=kortex.minhacasa.com` (vários separados por vírgula; `*.exemplo.com` vale para subdomínios).

**"Origem não permitida" (BAD_ORIGIN) ao salvar.** O navegador indicou que o pedido veio de outro site. Acesse o Kortex diretamente pelo endereço dele (não dentro de outra página ou iframe).

**Esqueci o PIN.** No computador, pare o Kortex e rode `npm run reset-pin`. Seus dados continuam intactos; depois crie um PIN novo.

**"Muitas tentativas. Aguarde…"** Após 5 PINs errados o login trava por 30 s (dobrando a cada erro, até 15 min). Aguarde e tente de novo.

**Troquei o PIN e o celular pediu de novo.** É o esperado: trocar o PIN desconecta os outros aparelhos.

**Atualizei o Kortex (`git pull`). E o app instalado?** Ao abrir com conexão, ele pega a versão nova sozinho. Se parecer desatualizado, feche e abra de novo.

**Posso usar com colegas?** Cada pessoa instala o próprio Kortex no próprio computador, com os próprios dados e PIN. Não existe uma conta compartilhada.
