import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import OpenAI from 'openai';
import crypto from 'node:crypto';

const MAX_NAME_LENGTH = Number.parseInt(
  process.env.MAX_NAME_LENGTH ?? '15',
  10,
);
const LLM_CONCURRENCY = Number.parseInt(process.env.LLM_CONCURRENCY ?? '5', 10);

class Semaphore {
  private available: number;
  private readonly queue: Array<(release: () => void) => void> = [];

  constructor(capacity: number) {
    this.available = Math.max(1, capacity);
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return this.release;
    }

    return new Promise((resolve) => {
      this.queue.push((release) => resolve(release));
    });
  }

  private readonly release = (): void => {
    const next = this.queue.shift();
    if (next) {
      next(this.release);
      return;
    }

    this.available += 1;
  };
}

const llmSemaphore = new Semaphore(LLM_CONCURRENCY);

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin:
    process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN?.split(',') || []
      : '*',
  methods: ['POST', 'OPTIONS'],
});

// Initialize SQLite
const db = new Database('nanniang.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    name_hash TEXT PRIMARY KEY,
    name TEXT,
    json_data TEXT
  )
`);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'lm-studio', // LM Studio 随便填个 Key
  baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1', // 默认 LM Studio 地址
});

const SYSTEM_PROMPT = `# Role
你是一位二次元亚文化领域的资深鉴定师。

# Task
计算用户输入名字的“男娘指数”。
**评分时**请在内心思考以下维度（不需要输出详细过程，只输出最终分数和一句话吐槽）：
1. 语义：是否包含软萌字眼（酱、喵、洛）或反差字眼。
2. 语音：读音是否软糯。
3. 梗：是否关联知名伪娘角色。

# Output Constraints (非常重要)
- "analysis" 字段必须严格限制在 **50个字以内**。
- "analysis" 字段 **禁止换行**，禁止使用 Markdown 列表。
- 只需用一句话犀利地点评，或者玩一个梗即可。不要长篇大论。

# Scoring Rules
- 90-100: SSS/SS (老二次元/知名角色)
- 75-89: S/A (好听/中性)
- 40-74: B/C (普通/现充)
- 0-39: D/E (硬汉/大叔)`;

// 定义结构化输出的 Schema
const responseSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'nanniang_evaluation',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        score: { type: 'number' },
        rank: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        analysis: {
          type: 'string',
          // 修改这里：增加否定词和长度限制
          description:
            'EXTREMELY SHORT comment (max 30 words). NO Markdown, NO newlines. Just one funny sentence.',
        },
        match_character: { type: 'string' },
      },
      required: ['score', 'rank', 'tags', 'analysis', 'match_character'],
      additionalProperties: false,
    },
  },
};

interface ScoreRequest {
  name: string;
}

interface ScoreResponse {
  score: number;
  rank: string;
  tags: string[];
  analysis: string;
  match_character: string;
}

fastify.post<{ Body: ScoreRequest }>('/api/score', async (request, reply) => {
  const { name } = request.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return reply.status(400).send({ error: 'Name is required' });
  }

  const cleanName = name.trim();

  // 这里的长度限制很重要，防止 prompt 注入太长
  if (cleanName.length > MAX_NAME_LENGTH) {
    return reply.status(400).send({
      error: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    });
  }

  const nameHash = crypto.createHash('md5').update(cleanName).digest('hex');

  // Check Cache
  const row = db
    .prepare('SELECT json_data FROM results WHERE name_hash = ?')
    .get(nameHash) as { json_data: string } | undefined;

  if (row) {
    request.log.info(`Cache Hit for: ${cleanName}`);
    return JSON.parse(row.json_data);
  }

  // Cache Miss - Call LLM
  request.log.info(`Calling LLM for: ${cleanName}`);

  const release = await llmSemaphore.acquire();

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'qwen3-30b-instruct', // 确保这个名字和你 LM Studio 加载的一致，或者随便填也行(取决于LM Studio设置)
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: cleanName },
      ],
      // @ts-expect-error: OpenAI Node SDK 类型定义有时候滞后，这里强制忽略类型检查
      response_format: responseSchema,
      temperature: 0.8,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('Empty response from LLM');
    }

    const resultJsonStr = choice.message.content;

    // Validate JSON (Parsing acts as validation)
    const result = JSON.parse(resultJsonStr) as ScoreResponse;

    // Save to Cache
    db.prepare(
      'INSERT OR REPLACE INTO results (name_hash, name, json_data) VALUES (?, ?, ?)',
    ).run(nameHash, cleanName, resultJsonStr);

    return result;
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Failed to generate score' });
  } finally {
    release();
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
