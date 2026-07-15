// scripts/convert-skills.ts
// 一次性脚本：将 D:\Project\test1\skill 下的 OpenClaw 技能转换为 skill-market 格式
// 运行方式: npx tsx scripts/convert-skills.ts [--dry-run]
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, cpSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

const SOURCE_DIR = "D:/Project/test1/skill";
const TARGET_ROOT = join(__dirname, "..", "skills");
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------
// 1. 分类推断
// ---------------------------------------------------------------
const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: "mail_communication",
    keywords: [
      "mail", "email", "feishu", "dingtalk", "wecom", "bilibili", "douyin",
      "weibo", "xiaohongshu", "zhihu", "wechat", "seo", "market",
      "邮件", "抖音", "快手", "B站", "微博", "小红书", "知乎", "微信", "营销",
    ],
  },
  {
    category: "image_video",
    keywords: ["image", "video", "comfyui", "seedance", "视频", "图片", "剪辑", "文生图", "图生图", "画面"],
  },
  {
    category: "initialization",
    keywords: [
      "init", "upgrade", "topup", "setup", "memory", "honcho", "用户初始化",
      "工作目录", "初始化", "充值", "备份", "backup",
    ],
  },
  // system_config 作为兜底
];

function inferCategory(slug: string, description: string): string {
  const text = `${slug} ${description}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) return rule.category;
    }
  }
  return "system_config";
}

// ---------------------------------------------------------------
// 2. Icon 提取
// ---------------------------------------------------------------
function extractIcon(frontmatter: Record<string, any>): string {
  // 优先从 metadata 各变体取 emoji
  const m = frontmatter.metadata;
  if (m) {
    if (m.openclaw?.emoji) return m.openclaw.emoji;
    if (m.clawdbot?.emoji) return m.clawdbot.emoji;
    if (m.emoji) return m.emoji;
  }
  return "📦";
}

// ---------------------------------------------------------------
// 3. display_name 推断
// ---------------------------------------------------------------
function inferDisplayName(slug: string, frontmatter: Record<string, any>, description: string): string {
  // 从 SKILL.md 标题推断（取 # 后面的内容）
  if (frontmatter.displayName) return frontmatter.displayName;
  // 从 description 截取第一个有意义的短句（可能以英文开头，如 "A股量化..." 或 "B站内容助手"）
  // 找连续的有意义片段：允许英文字母/数字开头，后跟中文
  const m = description.match(/([A-Za-z0-9]*[一-龥][一-龥\s，。！？、；：""''【】《》（）…—]*)/);
  if (m) {
    const cn = m[1].trim();
    if (cn.length > 3 && cn.length < 50) return cn.replace(/[，。！？、；：-].*/, "");
  }
  // fallback: slug 转可读
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------
// 4. YAML frontmatter 解析（简易版，不依赖 gray-matter）
// ---------------------------------------------------------------
function parseFrontmatter(md: string): { frontmatter: Record<string, any>; body: string } {
  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return { frontmatter: {}, body: md };

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) return { frontmatter: {}, body: md };

  const fmBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trimStart();

  const frontmatter: Record<string, any> = {};
  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // 去掉引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // 简单 JSON 内联（如 metadata: { "openclaw": { "emoji": "📺" } }）
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        value = JSON.parse(value);
      } catch {
        // 保持字符串
      }
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// ---------------------------------------------------------------
// 5. 转换单个技能
// ---------------------------------------------------------------
interface RawSkill {
  id: string;
  name: string;
  display_name: string;
  description: string;
  description_en?: string;
  version: string;
  icon?: string;
  category: string;
  runtime_type: string;
  billing?: string;
  owner?: { name?: string; type?: string; verified?: boolean };
  readme?: string;
  files?: unknown[];
  env_vars?: unknown[];
  api?: unknown;
  migration?: unknown;
  platform?: unknown;
  tags?: unknown;
  examples?: string[];
  install_count?: number;
  hot?: boolean;
  changelog?: Array<{ version: string; date: string; changes: string[]; type: string }>;
  created_at?: string;
  updated_at?: string;
}

function convertSkill(skillDir: string, dirName: string): { skill: RawSkill | null; slug: string; error?: string } {
  // 读取 _meta.json（可选）
  let meta: { slug?: string; version?: string; publishedAt?: number; ownerId?: string } | null = null;
  const metaPath = join(skillDir, "_meta.json");
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    } catch {
      // ignore
    }
  }

  // 读取 SKILL.md
  const mdPath = join(skillDir, "SKILL.md");
  if (!existsSync(mdPath)) {
    return { skill: null, slug: dirName, error: "SKILL.md not found" };
  }
  const mdContent = readFileSync(mdPath, "utf-8");
  const { frontmatter } = parseFrontmatter(mdContent);

  // 确定 slug
  const slug = meta?.slug || frontmatter.slug || frontmatter.name || dirName.replace(/-\d+\.\d+\.\d+$/, "");

  // 确定描述
  const description = frontmatter.description || "";

  // 确定版本
  const version = meta?.version || frontmatter.version || "1.0.0";

  // 确定图标
  const icon = extractIcon(frontmatter);

  // 分类
  const category = inferCategory(slug, description);

  // 发布时间
  const publishedDate = meta?.publishedAt ? new Date(meta.publishedAt).toISOString() : new Date().toISOString();

  const skill: RawSkill = {
    id: `openclaw/${slug}`,
    name: slug,
    display_name: inferDisplayName(slug, frontmatter, description),
    description: description.replace(/\n/g, " ").trim(),
    version,
    icon,
    category,
    runtime_type: "local",
    billing: "free",
    owner: { name: "openclaw", type: "community", verified: false },
    readme: "SKILL.md",
    changelog: [
      { version, date: publishedDate.split("T")[0], changes: ["从 OpenClaw 技能市场导入"], type: "MINOR" },
    ],
    created_at: publishedDate,
    updated_at: new Date().toISOString(),
  };

  return { skill, slug };
}

// ---------------------------------------------------------------
// 6. 写入 skill.json 并复制文件
// ---------------------------------------------------------------
function writeSkill(skill: RawSkill, slug: string, sourceDir: string): void {
  const targetDir = join(TARGET_ROOT, slug);

  if (DRY_RUN) {
    console.log(`[DRY-RUN] would write to ${targetDir}/skill.json`);
    return;
  }

  // 创建目标目录
  mkdirSync(targetDir, { recursive: true });

  // 写入 skill.json（与现有技能格式对齐）
  writeFileSync(join(targetDir, "skill.json"), JSON.stringify(skill, null, 2) + "\n", "utf-8");

  // 复制所有文件（除 _meta.json）
  copyDirExcept(sourceDir, targetDir, new Set(["_meta.json"]));
}

function copyDirExcept(src: string, dest: string, exclude: Set<string>): void {
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirExcept(srcPath, destPath, exclude);
    } else {
      try {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);
      } catch {
        console.warn(`  ⚠ failed to copy: ${srcPath}`);
      }
    }
  }
}

// ---------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------
function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const entries = readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  console.log(`Found ${entries.length} skill directories in ${SOURCE_DIR}`);
  if (DRY_RUN) console.log("🔍 DRY RUN mode — no files will be written\n");

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const dirName of entries) {
    const skillDir = join(SOURCE_DIR, dirName);
    const { skill, slug, error } = convertSkill(skillDir, dirName);

    if (error || !skill) {
      skipped++;
      errors.push(`${dirName}: ${error || "unknown error"}`);
      continue;
    }

    writeSkill(skill, slug, skillDir);
    imported++;
    console.log(`  ✅ ${slug} v${skill.version} → skills/${slug}/`);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done: ${imported} imported, ${skipped} skipped`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.log(`  ❌ ${e}`));
  }

  if (!DRY_RUN) {
    console.log(`\nRestart API or run 'pnpm sync' to import into database.`);
  }
}

main();
