# Architecture

## Overview

```mermaid
graph TB
    subgraph Clients
        OC[opencode]
        CC[Claude Code]
        C[Cline]
    end

    subgraph "MCP Protocol"
        ST[stdio<br>JSON-RPC]
        HTTP[HTTP<br>Streamable HTTP]
    end

    subgraph "aik-mcp Server"
        CI[loadConfig<br>args + env]
        IN[built-in instructions]
        CS[ContentStore<br>in-memory cache]
        FW[File Watcher<br>chokidar]
        RT[Resource Templates<br>aik:// ]
        TL[MCP Tools<br>list, get, search, write<br>install, uninstall]
        VA[Validate<br>--validate flag]
    end

    subgraph "Filesystem"
        MD[Markdown files<br>rules/ skills/ workflows/<br>agents/ commands/ templates/]
    end

    OC --> ST
    CC --> ST
    C --> ST
    OC --> HTTP
    CC --> HTTP
    C --> HTTP

    ST --> CI
    HTTP --> CI

    CI --> IN
    CI --> CS
    CS --> MD
    FW --> CS
    CS --> RT
    CS --> TL

    VA --> CS
    VA -->|exit code 0/1| CLI

    TL -->|JSON-RPC response| Clients
    RT -->|JSON-RPC response| Clients
```

## Startup sequence

```mermaid
sequenceDiagram
    participant Client
    participant Server as aik-mcp
    participant FS as Filesystem

    Client->>Server: start process
    Server->>Server: loadConfig()
    Server->>Server: load built-in instructions
    Server->>FS: ContentStore.init()
    FS->>Server: scan & cache all .md files
    Server->>Server: register MCP tools & resources
    alt --http mode
        Server->>Server: start HTTP server on port 3456
    else stdio mode
        Server->>Server: connect StdioServerTransport
    end
    Client->>Server: initialize request
    Server->>Client: server capabilities + instructions
    Client->>Server: notifications/initialized
    Note over Client,Server: ready for tool calls & resource reads
```

## Tool call flow

```mermaid
sequenceDiagram
    participant Client
    participant Server as aik-mcp
    participant CS as ContentStore
    participant FS as Filesystem

    Client->>Server: tools/call { name: "aik_get", path: "rules/typescript" }
    Server->>CS: get("rules/typescript")
    CS->>FS: read rules/typescript.md
    FS->>CS: raw markdown + frontmatter
    CS->>Server: ContentItem { path, frontmatter, body }
    Server->>Server: serialize to text
    Server->>Client: { content: [{ text: "..." }] }
```

## Validate flow

```mermaid
sequenceDiagram
    participant CLI as CLI (--validate)
    participant Server as aik-mcp
    participant CS as ContentStore
    participant FS as Filesystem

    CLI->>Server: start with --validate flag
    Server->>FS: loadConfig()
    Server->>CS: ContentStore.init()
    FS->>Server: validateContent(store)
    loop each content item
        Server->>Server: check frontmatter validity
        Server->>Server: check body non-empty
        Server->>Server: check category validity
    end
    alt all valid
        Server->>CLI: ✓ summary + exit 0
    else any invalid
        Server->>CLI: ✗ errors list + exit 1
    end
```

## Components

| Component     | File                      | Responsibility                                                                   |
|---------------|---------------------------|----------------------------------------------------------------------------------|
| Entry point   | `src/index.ts`            | CLI bootstrap, flag parsing, server start                                        |
| Config        | `src/config.ts`           | Parse CLI flags + env vars into `AikConfig`                                      |
| Logger        | `src/logger.ts`           | Pino structured JSON logger                                                      |
| Content Store | `src/content-store.ts`    | Scan, cache, watch, and query `.md` files                                        |
| Search        | `src/search.ts`           | Full-text fuzzy search across cached items                                       |
| Frontmatter   | `src/frontmatter.ts`      | Parse/serialize YAML frontmatter with Zod validation                             |
| Validate      | `src/validate.ts`         | Validate all content items for consistency                                       |
| Tools         | `src/tools/*.ts`          | MCP tool handlers (list, get, search, write, delete, install, uninstall, update) |
| Resources     | `src/resources/index.ts`  | MCP resource templates (`aik://`)                                                |
| Transports    | `src/transports/http.ts`  | HTTP/Streamable HTTP transport                                                   |
| Transports    | `src/transports/stdio.ts` | stdio transport                                                                  |
