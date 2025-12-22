<img src="./Logo-Compressed.png" alt="Logo" width="200" style="display:block; margin-left:auto; margin-right:auto;"/>

# 年度男娘程度总结器

![Fancy Junk](https://img.shields.io/badge/Project-Fancy%20Junk-ff69b4) [![License](https://img.shields.io/badge/license-WTFPL-blue)](LICENSE) ![Node >=24](https://img.shields.io/badge/node-%3E%3D24-brightgreen) ![Vue 3](https://img.shields.io/badge/vue-3-brightgreen) ![Fastify](https://img.shields.io/badge/fastify-5-orange)

> "This project is part of the **Fancy Junk** series: Over-engineered solutions for non-existent problems."

输入你的名字，快速获得男娘程度打分与一句话小评价~

## 开发

前瞻：本项目前后端分离，前端代码位于 `fe/` 目录下，后端代码位于 `src/` 目录下。你需要有一个 OpenAI 兼容服务的 LLM 服务才能运行此项目。

### 项目架构

```mermaid
flowchart LR
  Browser(Browser)

  subgraph Edge["Ingress / Static"]
    direction LR
    Nginx["Nginx (deploy/nginx) - 反向代理 / 静态资源"]
  end

  subgraph Frontend["前端 (fe/)"]
    direction TB
    FE["Vue 3 + Tailwind (vite / build -> dist)"]
  end

  subgraph Backend["后端 (src/)"]
    direction TB
    API["TypeScript + Fastify"]
    DB[("SQLite / better-sqlite3")]
  end

  Browser -->|"浏览器请求"| Nginx
  Nginx -->|"静态文件"| FE
  Nginx -->|"反向代理 API"| API
  FE -->|"调用 API"| API
  API -->|"持久化"| DB
  API -->|"调用"| LLM["外部 LLM / OpenAI API"]
```

后端设计上：

1. 具有简单的队列功能（无限排队队列，并发具有限制，队列长度无限 *小心 OOM*），降低 LLM 并发压力
2. SQLite 缓存结果，避免同一名称不同结果
3. 具有输入限长，尽量避免提示词注入滥用
4. 使用了 OpenAI Json 结构化输出功能，尽量避免 LLM 输出格式错误

### 前端

```bash
fe
├── public
└── src
    └── assets
```

`fe` 目录下为前端代码，使用 Vue 3 + Tailwind CSS 编写。

### 后端

```bash
.
├── eslint.config.mjs
├── package-lock.json
├── package.json
├── README.md
├── src
│   └── index.ts
└── tsconfig.json
```

后端代码位于 `src` 目录下，使用 TypeScript + Fastify 编写。