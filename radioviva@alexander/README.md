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

## 📄 Licença

Distribuído sob a licença **GPL-3.0**. Consulte o arquivo [LICENSE](file:///home/alexander/Documentos/RadioViva/LICENSE) para mais detalhes.

---

Desenvolvido com carinho por **Alexander** 🇧🇷
