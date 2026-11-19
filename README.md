# Lumina — Leitor ePub & PDF Minimalista com Sincronização em Nuvem

Aplicativo moderno e de alto desempenho para leitura de livros digitais nos formatos **ePub** e **PDF**, com sincronização em tempo real entre dispositivos (**Windows Desktop**, **Android** e **Web**), autenticação Google e armazenamento seguro no **Google Cloud Firestore**.

---

## 🚀 Como Obter os Instaladores Nativos (.exe, .msi e .apk)

Como o build de Android e instaladores Windows requer compiladores nativos (Rust, Android SDK/NDK 34 e WiX/NSIS), o projeto inclui um **Workflow de Integração Contínua (CI) automatizado no GitHub Actions** pronto para gerar os instaladores em nuvem.

### Opção 1: Pelo GitHub Actions (Recomendado — Sem necessidade de SDKs locais)

1. Envie o código para o seu repositório GitHub (`git push origin main`).
2. No seu repositório no GitHub, clique na aba **Actions**.
3. Selecione o workflow **`Build Native Installers (Windows Tauri + Android APK)`** no menu lateral esquerdo.
4. Clique no botão **`Run workflow`** e confirme na branch `main` (ou o workflow rodará automaticamente em qualquer push na branch `main`).
5. Quando o workflow finalizar:
   - Na seção **Artifacts** na parte inferior da execução, você encontrará:
     - 📦 **`lumina-windows-installers`**: Instalador executável (`.exe` NSIS) e pacote de instalação corporativo (`.msi`).
     - 📱 **`lumina-android-apk`**: Pacote instalável do aplicativo Android (`.apk`).
   - Basta clicar em cada um para fazer o download dos arquivos compilados prontos para instalar.

---

### Opção 2: Compilação Local

Se você possuir ou instalar as ferramentas na sua máquina:

#### 1. Instalador Windows (.exe e .msi):
**Pré-requisitos:** Node.js 20+, Rust (`rustup` / MSVC C++ Build Tools).
```bash
# 1. Instalar dependências
npm install

# 2. Compilar os instaladores do Windows
npm run tauri:build:win
```
*Os arquivos gerados ficarão disponíveis em:*
- `src-tauri/target/release/bundle/nsis/Lumina_1.0.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Lumina_1.0.0_x64_pt-BR.msi`

#### 2. Aplicativo Android (.apk):
**Pré-requisitos:** Node.js 20+, JDK 17, Android Studio / SDK (Platform 34, Build Tools 34.0.0, NDK 26.3), Rust com targets Android (`rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android`).
```bash
# 1. Inicializar suporte Android (apenas na 1ª vez)
npm run tauri:android:init

# 2. Compilar o APK
npm run tauri:build:apk
```
*O APK gerado ficará em:*
- `src-tauri/gen/android/app/build/outputs/apk/release/app-release-unsigned.apk` (ou em `universal/debug`).

---

## 🔒 Conexão Firebase & Regras de Segurança (`firestore.rules`)

O aplicativo conecta-se diretamente ao Cloud Firestore utilizando o banco de dados dedicado do projeto:

- **Projeto (projectId):** `asymmetric-jar-jcxst`
- **ID do banco Firestore:** `ai-studio-1c82bb82-ff6f-4dcf-aeff-590a92a0607d`
- **Domínio de Autenticação:** `asymmetric-jar-jcxst.firebaseapp.com`
- **Console do Firestore:** [Acessar Banco de Dados no Console Firebase](https://console.firebase.google.com/project/asymmetric-jar-jcxst/firestore/databases/ai-studio-1c82bb82-ff6f-4dcf-aeff-590a92a0607d/data)

### Arquitetura de Dados Isolada por Usuário (`users/{userId}`)

Todos os dados são 100% isolados por `userId` autenticado via Google Sign-In:

| Coleção / Caminho | Descrição e Conteúdo |
| :--- | :--- |
| `users/{userId}` | Perfil do usuário, data de criação e último dispositivo ativo (`Windows Desktop`, `Android` ou `Web`). |
| `users/{userId}/preferences/{prefId}` | Preferências de leitura (tema claro/escuro, tema do leitor, família e tamanho de fonte, altura de linha, modo deslizar/paginado). |
| `users/{userId}/categories/{categoryId}` | Categorias personalizadas para organização da biblioteca. |
| `users/{userId}/books/{bookId}` | Livros digitais (.epub e .pdf), metadados, capas, favoritos e progresso percentual e de capítulo sincronizado. |
| `users/{userId}/books/{bookId}/chapters/{chapterId}` | Capítulos e páginas individuais sincronizados na nuvem para leitura contínua entre PC e celular. |
| `users/{userId}/bookmarks/{bookmarkId}` | Marcadores, anotações de leitura e trechos destacados com identificação de dispositivo. |

### Revisão e Garantias de Segurança em `firestore.rules`

As regras em [firestore.rules](file:///C:/Projetos/lumina/firestore.rules) foram revisadas e endurecidas contra ataques e inconsistências:
1. **Negação Global por Padrão:** Qualquer documento fora do schema especificado é bloqueado para leitura e escrita.
2. **Isolamento de Tenant:** Um usuário `userA` nunca pode ler, listar, criar ou atualizar dados pertencentes a `userB` (`request.auth.uid == userId`).
3. **Autenticação Verificada:** Escritas exigem usuário autenticado com e-mail verificado ou provedor oficial Google Sign-In.
4. **Imutabilidade de Chaves Primárias:** Os campos `id`, `ownerId` e `createdAt` são imutáveis após a criação.
5. **Prevenção de Órfãos (Foreign Key Constraints):**
   - Não é possível criar um `BookChapter` sem que o livro pai `Book` exista e pertença ao mesmo usuário.
   - Não é possível criar um `Bookmark` apontando para um livro inexistente.
6. **Integridade de Tipos e Limites de Payload:**
   - Tamanho estrito de strings para prevenir estouro de storage.
   - Limite de até 10 categorias por livro para evitar arrays desbalanceados.
   - Suporte a livros extensos com até 10.000 capítulos/páginas.
   - Timestamps validados estritamente contra o relógio do servidor (`request.time`).
