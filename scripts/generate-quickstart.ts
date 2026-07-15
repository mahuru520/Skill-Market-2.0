// scripts/generate-quickstart.ts
// 批量调用 LLM 为每个技能的 SKILL.md 生成 quickstart 摘要,写入 skill.json
// 运行方式: npx tsx scripts/generate-quickstart.ts [--dry-run] [--start <slug>]
// 需要设置环境变量: LLM_API_KEY=sk-xxx
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = join(__dirname, "..", "skills");
const DRY_RUN = process.argv.includes("--dry-run");
const API_BASE = process.env.LLM_API_BASE || "https://open.ospreyai.cn/v1";
const API_KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "deepseek-v4-pro";
const DELAY_MS = 200;

// 支持断点续跑
const startFrom = process.argv.includes("--start")
  ? process.argv[process.argv.indexOf("--start") + 1]
  : null;
let started = !startFrom;

interface Quickstart {
  overview: string;      // 一句话概述
  scenarios: string[];    // 适用场景(3-5个)
  example: string;        // 具体 prompt 示例
  notes: string;          // 注意事项
}

// ---------------------------------------------------------------
// YAML frontmatter 剥离
// ---------------------------------------------------------------
function stripFrontMatter(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimStart();
}

// ---------------------------------------------------------------
// LLM 调用
// ---------------------------------------------------------------

/** 从 LLM 返回中提取 JSON:去除 markdown 代码块包裹,尝试截取首个 {...} */
function extractJson(text: string): string {
  let t = text.trim();
  // 去掉 ```json ... ``` 包裹
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) t = fenceMatch[1].trim();
  // 截取从 { 到最后一个 }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  return t;
}

async function callLLM(prompt: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: `你是一个技能文档分析师。阅读技能文档后,用中文输出一个 JSON 对象,格式严格如下:
{
  "overview": "一句话概述这个技能做什么(15字以内)",
  "scenarios": ["场景1", "场景2", "场景3"],
  "example": "最典型的一个 prompt 使用示例(一句话,以用户口吻)",
  "notes": "使用这个技能需要注意什么(30字以内,没有则写'无')"
}
只输出 JSON,不要 markdown 代码块,不要额外解释。`,
            },
            { role: "user", content: `分析以下技能文档:\n\n${prompt}` },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const raw = data.choices[0].message.content;
      const json = extractJson(raw);

      // 验证是否为合法 JSON
      JSON.parse(json);
      return json;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`    [重试 ${attempt + 1}/${retries}] ${(err as Error).message.slice(0, 60)}`);
        await sleep(500);
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------
// 提取文档核心内容(限制长度,节约 token)
// ---------------------------------------------------------------
function extractCore(md: string, maxLen = 3000): string {
  const body = stripFrontMatter(md);
  // 去掉空行和代码块中过长的内容
  const lines = body.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLen = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCode = !inCode;
      if (!inCode) codeLen = 0;
      continue;
    }
    if (inCode) {
      codeLen++;
      if (codeLen <= 5) out.push(line); // 代码块只保留前5行
      continue;
    }
    out.push(line);
  }

  const text = out.join("\n").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "\n...(内容过长,已截断)" : text;
}

// ---------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------
async function main() {
  if (!API_KEY) {
    console.error("请设置环境变量 LLM_API_KEY=sk-xxx");
    console.error(
      "示例: LLM_API_KEY=sk-xxx npx tsx scripts/generate-quickstart.ts",
    );
    process.exit(1);
  }

  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  console.log(`找到 ${dirs.length} 个技能目录`);
  console.log(`API: ${API_BASE} | Model: ${MODEL}`);
  if (DRY_RUN) console.log("[DRY RUN] 不会实际写入");
  console.log("---");

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const slug of dirs) {
    // 断点续跑
    if (!started) {
      if (slug === startFrom) started = true;
      else {
        console.log(`  [跳过] ${slug} (断点续跑)`);
        skipped++;
        continue;
      }
    }

    const skillDir = join(SKILLS_DIR, slug);
    const jsonPath = join(skillDir, "skill.json");
    const mdPath = join(skillDir, "SKILL.md");

    if (!existsSync(jsonPath) || !existsSync(mdPath)) {
      console.log(`  [跳过] ${slug} (缺少 skill.json 或 SKILL.md)`);
      skipped++;
      continue;
    }

    const skillJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 已有 quickstart 且非 overwrite 模式则跳过
    if (skillJson.quickstart && !process.argv.includes("--force")) {
      console.log(`  [跳过] ${slug} (已有 quickstart)`);
      skipped++;
      continue;
    }

    try {
      const mdContent = readFileSync(mdPath, "utf-8");
      const core = extractCore(mdContent);

      console.log(`  [生成] ${slug} ... (${core.length} chars)`);
      const result = await callLLM(core);
      const parsed = JSON.parse(result.trim()) as Quickstart;

      // 校验结构
      if (
        !parsed.overview ||
        !Array.isArray(parsed.scenarios) ||
        !parsed.example
      ) {
        throw new Error(`LLM 返回结构不完整: ${result.slice(0, 100)}`);
      }

      skillJson.quickstart = {
        overview: parsed.overview,
        scenarios: parsed.scenarios.slice(0, 5),
        example: parsed.example,
        notes: parsed.notes || "无",
      };

      if (!DRY_RUN) {
        writeFileSync(jsonPath, JSON.stringify(skillJson, null, 2) + "\n");
      }

      console.log(`    → ${parsed.overview}`);
      updated++;

      // 延迟,避免限流
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  [失败] ${slug}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log("---");
  console.log(
    `完成: ${updated} 更新, ${skipped} 跳过, ${failed} 失败 (dryRun:${DRY_RUN ? "yes" : "no"})`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
