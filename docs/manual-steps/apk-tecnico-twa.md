# Empacotar o app do técnico como APK (TWA)

Guia para transformar a PWA (`wave.tallpa.com.br`) em um **APK Android** instalável
via sideload, usando **TWA (Trusted Web Activity)**. O APK é só uma casca que abre a
PWA em tela cheia — o app continua sendo o mesmo Next.js no ar; nada roda offline além
do que o service worker já cacheia (ver [ADR-018](../architecture/ADR-018-push-app-fechado.md)
para o push).

> **Pré-requisito:** a PWA precisa estar no ar com `manifest.webmanifest`, ícones e
> service worker (Fase 1 ✅) e o push configurado (Fase 2 ✅). Este guia é a Fase 3.

Duas trilhas — escolha uma:
- **Trilha A — PWABuilder (web, mais fácil):** não precisa instalar nada localmente.
- **Trilha B — Bubblewrap (CLI):** mais controle, exige Node + JDK + Android SDK.

O resultado das duas é o mesmo: um `.apk` assinado + o `assetlinks.json` para preencher.

---

## Decisões fixas deste app

| Campo | Valor |
|---|---|
| `packageId` (applicationId) | `br.com.tallpa.wave.twa` |
| Host | `wave.tallpa.com.br` |
| Nome / launcher | `Wave Ops` |
| Cores (tema/fundo) | `#050814` |
| Notificações | **habilitadas** (push da Fase 2) |

> O `packageId` é **permanente** depois que o app é instalado nos aparelhos (mudá-lo
> vira "outro app"). Se quiser trocar, faça **antes** do primeiro build. O padrão já está
> em [`twa/twa-manifest.json`](../../twa/twa-manifest.json) e em
> [`public/.well-known/assetlinks.json`](../../public/.well-known/assetlinks.json).

---

## Trilha A — PWABuilder (recomendada para começar)

1. Acesse **https://www.pwabuilder.com** e informe `https://wave.tallpa.com.br`.
2. PWABuilder valida a PWA (manifest, service worker, ícones — já devem passar).
3. Clique em **Package for stores → Android**.
4. Em opções do Android:
   - **Package ID:** `br.com.tallpa.wave.twa`
   - **App name:** `Wave Ops`
   - Mantenha **"Include source code"** marcado (útil para rebuilds).
   - Deixe o PWABuilder **gerar uma nova signing key** e **guarde o `.keystore` e as
     senhas** que ele mostrar — sem isso você não consegue publicar updates.
5. Baixe o zip. Dentro dele vêm:
   - o `.apk` (para testar) e o `.aab` (para loja, se um dia for),
   - o `assetlinks.json` **já com o fingerprint correto**,
   - o `signing.keystore` + arquivo com as senhas.
6. Pule para **"Publicar o assetlinks.json"** abaixo.

---

## Trilha B — Bubblewrap (CLI)

### B.1 Instalar pré-requisitos (uma vez)

```bash
# Node 20 (já usado no projeto). JDK 17 e Android SDK:
brew install --cask temurin@17
npm install -g @bubblewrap/cli
```

Na primeira execução, o Bubblewrap se oferece para baixar o Android SDK e o JDK
automaticamente — pode aceitar.

### B.2 Gerar o projeto a partir do config já pronto

```bash
cd twa
bubblewrap init --manifest ./twa-manifest.json
```

O Bubblewrap vai perguntar sobre a **keystore de assinatura**:
- Crie uma nova quando perguntado (ou aponte uma existente).
- **Escolha uma senha forte e guarde-a** (gerenciador de senhas). Perder a keystore/senha
  significa não conseguir mais publicar updates do mesmo app.

### B.3 Build

```bash
bubblewrap build
```

Gera `app-release-signed.apk` (para sideload) e `app-release-bundle.aab` (loja).

### B.4 Pegar o fingerprint SHA-256

```bash
keytool -list -v -keystore ./android.keystore -alias android | grep SHA256
```

Copie o valor no formato `AA:BB:CC:...` (32 pares hex).

---

## Publicar o `assetlinks.json` (as duas trilhas)

O Digital Asset Links liga o app ao domínio e **remove a barra de URL** do navegador
dentro do app. Sem ele o app funciona, mas mostra uma barra do Chrome no topo.

1. Edite [`public/.well-known/assetlinks.json`](../../public/.well-known/assetlinks.json)
   e substitua `REPLACE_WITH_SHA256_FINGERPRINT_DA_KEYSTORE` pelo fingerprint real
   (Trilha A: veio no zip; Trilha B: passo B.4).
2. Confira que o `package_name` bate com o `packageId` usado no build.
3. Commit + PR + deploy. Depois valide:

```bash
curl -s https://wave.tallpa.com.br/.well-known/assetlinks.json
```

Deve retornar o JSON com o fingerprint real e `content-type: application/json`.

> A verificação do Android acontece na instalação/primeira abertura. Se o `assetlinks.json`
> ainda estiver com o placeholder quando o app abrir, a barra de URL aparece — corrija o
> arquivo, faça deploy e reinstale o app.

---

## Distribuir (sideload)

1. Envie o `.apk` para os técnicos (link de download, Google Drive, WhatsApp).
2. No aparelho, o técnico precisa permitir **"Instalar apps de fontes desconhecidas"**
   para o app de origem (Chrome/Arquivos/WhatsApp) e tocar no `.apk`.
3. Primeira abertura: o app carrega `wave.tallpa.com.br` em tela cheia. Login normal.
4. **Push:** o técnico ainda precisa tocar em **"Ativar avisos"** dentro do app uma vez
   (a permissão de notificação é por dispositivo).

---

## Atualizar o app depois

- **Conteúdo/telas/regras:** nada a fazer — o APK carrega o site; todo deploy web já
  aparece no app.
- **Só é preciso gerar APK novo** quando mudar algo da casca (ícone, nome, cores,
  `packageId`, versão do TWA). Nesse caso:
  1. Suba `appVersionCode` (+1) e `appVersionName` em `twa/twa-manifest.json`.
  2. `bubblewrap build` (ou refaça no PWABuilder) **com a mesma keystore**.
  3. Redistribua o `.apk`.

---

## Segurança da keystore

- **Nunca** commite a keystore nem as senhas. O `.gitignore` já bloqueia `twa/*.keystore`
  e artefatos de build.
- Guarde a keystore + senha num cofre (gerenciador de senhas / cofre da Tallpa). É o
  único jeito de assinar updates do mesmo app.
