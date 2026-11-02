# RadioViva 📻🇧🇷

> **Modern, lightweight, and complete Cinnamon panel applet dedicated to Brazilian radio stations.**
> *Applet moderno, leve e completo para o painel do Linux Mint (Cinnamon), dedicado às rádios de todo o Brasil.*

---

## 🌟 Principais Recursos / Key Features

- **🇧🇷 +1.300 Rádios Brasileiras Validadas**: Emissoras de todos os 26 Estados + Distrito Federal, cobrindo capitais, interior e litoral, além de rádios web e segmentadas por gênero (Rock, Notícias, Sertanejo, Pop, MPB, Forró, Gospel, etc.).
- **🎛️ Player Card Integrado**: Card visual no menu do painel com botões de Play/Pause, Parar, Aumentar/Diminuir volume e Mudo, além do nome da rádio e faixa em reprodução em tempo real.
- **🔎 Busca Instantânea no Brasil**: Widget GTK3 integrado às Configurações do Cinnamon (`cinnamon-settings`), permitindo pesquisar por nome, cidade ou sigla do estado e adicionar às suas favoritas com 1 clique.
- **🔊 Controle de Volume Rápido**:
  - Scroll do mouse sobre o ícone do painel para aumentar/diminuir o volume instantaneamente.
  - Botões dedicados no card do player.
- **⚡ Ultraleve & Resiliente**:
  - Motor de áudio baseado no **MPV** em background daemon via Unix Domain Socket IPC assíncrono.
  - Consumo de memória inferior a 20MB de RAM.
  - Não trava a interface gráfica do Cinnamon em conexões lentas ou instáveis.
- **🎨 Visual Mint & Ícones Simbólicos**: Ícones SVG dedicados monocromáticos e coloridos integrados perfeitamente aos temas Claro e Escuro do Linux Mint.
- **🛑 Desligamento Limpo**: Fechamento automático e seguro de processos em segundo plano ao parar a rádio ou desligar o applet.

---

## 📸 Estrutura do Applet

```
radioviva@alexander/
├── applet.js               # Ponto de entrada do Cinnamon Applet (CJS)
├── metadata.json           # Metadados e versão do Cinnamon Spices
├── settings-schema.json    # Abas de configuração nativas do Cinnamon
├── stylesheet.css          # Estilos visuais integrados ao tema do Mint
├── icon.png                # Ícone principal colorido
├── icon.svg                # Ícone vetorial
├── RadioSearchWidget.py    # Widget de pesquisa de 1.300+ rádios em GTK3
├── core/
│   ├── mpv_player.js       # Driver MPV com IPC Socket JSON assíncrono
│   └── station_catalog.js  # Gerenciamento de catálogo e favoritos
├── data/
│   └── stations_brasil.json # Catálogo estruturado de rádios brasileiras
├── icons/                  # Ícones simbólicos SVG para a barra do painel
└── po/                     # Templates e arquivos de tradução Gettext
```

---

## 🚀 Instalação Rápida (Linux Mint / Cinnamon)

### Pré-requisitos
O RadioViva utiliza o motor de reprodução `mpv` nativo do Linux:
```bash
sudo apt update && sudo apt install -y mpv
```

### Instalação Manual

1. Clone o repositório ou baixe o código:
```bash
git clone https://github.com/alexxnunes/RadioViva.git
cd RadioViva
```

2. Execute o script de instalação automática:
```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

O script copiará os arquivos para `~/.local/share/cinnamon/applets/radioviva@alexander` e adicionará o applet automaticamente à sua barra de tarefas do Cinnamon.

---

## ⚙️ Configurações e Personalização

Clique com o **botão direito** no ícone do RadioViva na barra do Cinnamon e selecione **Configurar...**:

1. **Minhas Rádios**: Lista reordenável com suas rádios favoritas marcadas para exibição rápida no menu.
2. **Buscar no Brasil**: Mais de 1.300 estações brasileiras indexadas. Digite qualquer termo (ex: `Campinas`, `Rock`, `CBN`, `Piracicaba`, `Salvador`, `Sertanejo`) e clique em **➕ Adicionar Selecionada às Minhas Rádios**.
3. **Barra de Tarefas & Visual**:
   - Exibir/ocultar nome da música ou nome da rádio na barra.
   - Alternar entre ícone colorido e ícone simbólico monocromático.
4. **Áudio & Reprodução**:
   - Volume inicial padrão e passo de incremento por scroll.
   - Buffer de rede e timeout de conexão.
5. **Gravação ao Vivo & Timer**:
   - Gravação direta de streams em MP3 para `~/Música/RadioViva`.

---

## 📦 Publicação no Cinnamon Spices

Este projeto foi desenhado de acordo com as diretrizes oficiais de desenvolvimento do **Linux Mint Cinnamon Spices** (`linuxmint/cinnamon-spices-applets`):
- Sem binários compilados externos ou código ofuscado.
- Metadados padronizados em `metadata.json` com `max-instances: 1`.
- Suporte a `settings-schema.json` e widget GTK3 personalizado.
- Gerenciamento limpo de eventos do Clutter sem retenção de ponteiro do mouse (pointer grab).

---

## 📋 Notas de Versão & Relatório de Correções (Changelog)

### Versão 1.0.1 — *Hardening, Estabilidade e Otimização Térmica/CPU*
- **🔥 Correção Crítica de CPU e Ventoinha (100% de carga em 1 núcleo)**:
  - Resolvido loop infinito de EOF (`line === null`) na escuta assíncrona do socket IPC (`MpvPlayer._startListening`). Quando o MPV fechava o socket, o fluxo caía em leitura recursiva descontrolada. Agora encerra imediatamente e libera os recursos.
  - Perfil de execução do MPV otimizado para consumo nulo em idle: flags `--no-video`, `--audio-display=no`, `--vid=no`, `--vo=null`, `--no-osc`, `--no-osd-bar`, `--input-default-bindings=no`, `--no-input-builtin-bindings`, `--gapless-audio=yes` e buffer restrito com `--demuxer-max-bytes=2048KiB`.
- **🛑 Desligamento Real e Prevenção de Múltiplos Áudios Simultâneos**:
  - `stop()` agora envia comando `quit` e encerra o processo via `_terminateMpvProcess()`, garantindo 0% de CPU, 0 MB de RAM e impossibilidade de áudio fantasma após parar.
  - Cancelamento automático de timers pendentes de reconexão (`_clearTimers()`) ao solicitar parada ou troca rápida de rádio.
  - Implementado mutex `_isConnecting` e fila de callback único (`_pendingPlayCallback`) para evitar colisões e aberturas simultâneas ao trocar de estação rapidamente.
  - Regex de limpeza de processos órfãos (`_killOrphanMpvProcesses`) ancorada estritamente ao executável (`^/usr/bin/mpv .*--title=RadioViva$`).
- **🧟 Prevenção de Processos Zumbis (`<defunct>`) e `GLib-GIO-CRITICAL`**:
  - Implementado `wait_async()` em todos os subprocessos (`mpv` e `pkill`), garantindo a colheita imediata de códigos de saída pelo kernel.
  - Eliminadas chamadas a `g_subprocess_get_if_exited()` em instâncias em execução, prevenindo avisos críticos no log do Cinnamon.
- **🎚️ Interface & I/O em Disco Otimizados**:
  - Adicionada trava anti-reentrância (`this._updatingSlider`) no controle deslizante de volume.
  - Adicionado debounce de 400ms na gravação de preferências de volume (`_scheduleSaveVolume`), eliminando gravações desnecessárias em disco a cada pixel arrastado.
  - Removido `--force-media-title=RadioViva` e adicionada escuta de `metadata/by-key/icy-title` para correta exibição dos títulos das faixas transmitidas ao vivo.
- **🛡️ Auditoria de Segurança & Boas Práticas Linux Mint**:
  - Validação estrita de protocolos de streaming permitidos (`http`, `https`, `mms`, `rtmp`, `rtmps`).
  - Higienização e escape de metadados ICY (`GLib.markup_escape_text`) contra injeção de tags em notificações.
  - Substituição de chamadas síncronas de sistema de arquivos GIO (`query_exists`, `query_info`, `file_test`) por métodos assíncronos não bloqueantes para 100% de conformidade com o scanner do Cinnamon Spices.
  - Atualização do `scripts/install.sh` para recarga limpa via DBus (`org.Cinnamon.LookingGlass.ReloadExtension`).

### Versão 1.0.0 — *Lançamento Inicial*
- Catálogo estruturado com mais de 1.300 emissoras de rádio de todo o Brasil (26 Estados + DF).
- Widget de busca instantânea integrado às configurações nativas do Cinnamon em GTK3.
- Player card com botões de controle, exibição de status e slider de volume.
- Suporte a ícones monocromáticos simbólicos e coloridos.
- Gravação direta de streams de rádio em MP3.

---

## 📄 Licença

Distribuído sob a licença **GPL-3.0**. Consulte o arquivo [LICENSE](file:///home/alexander/Documentos/RadioViva/LICENSE) para mais detalhes.

---

Desenvolvido com carinho por **Alexander** 🇧🇷
