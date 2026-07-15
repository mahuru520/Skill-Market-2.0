// Indexer:读 skills/*/skill.json + SKILL.md 正文 + 目录文件清单 → 写 SQLite
// 一次性导入,DB 自包含。见 SPEC.md 第 6 节。
import {
  Injectable,
  Logger,
  OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".DS_Store",
  "dist",
  "build",
]);

interface RawSkill {
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
  dependencies?: unknown[];
  api?: unknown;
  migration?: { status?: string } & Record<string, unknown>;
  platform?: unknown;
  tags?: unknown;
  examples?: string[];
  install_count?: number;
  hot?: boolean;
  quickstart?: {
    overview: string;
    scenarios: string[];
    example: string;
    notes: string;
  };
  changelog?: Array<{
    version: string;
    date: string;
    changes: string[];
    type: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // 每次启动都跑一次增量导入:有 sha-skip 兜底,未变更的技能不会重写。
    // 这样「往 skills/ 加技能 → 重启 api 容器」即可生效,无需手动 exec 跑 indexer。
    this.logger.log("running incremental import on startup...");
    await this.importAll();
  }

  async onModuleDestroy() {}

  get skillsDir(): string {
    const configured = process.env.SKILLS_DIR;
    if (configured) return configured;
    // 默认指向项目根 skills 目录(相对于 apps/api)
    return join(__dirname, "..", "..", "..", "..", "skills");
  }

  async importAll(): Promise<{ imported: number; skipped: number }> {
    const dir = this.skillsDir;
    this.logger.log(`scanning ${dir} for skill.json ...`);
    const entries = existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      : [];

    let imported = 0;
    let skipped = 0;
    for (const name of entries) {
      const skillDir = join(dir, name);
      const jsonPath = join(skillDir, "skill.json");
      if (!existsSync(jsonPath)) {
        skipped++;
        continue;
      }
      try {
        await this.importOne(skillDir);
        imported++;
      } catch (err) {
        this.logger.error(`failed to import ${name}: ${(err as Error).message}`);
        skipped++;
      }
    }
    this.logger.log(`import done: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped };
  }

  private async importOne(skillDir: string) {
    const jsonPath = join(skillDir, "skill.json");
    const rawText = readFileSync(jsonPath, "utf-8");
    const sha = createHash("sha1").update(rawText).digest("hex").slice(0, 16);

    const raw: RawSkill = JSON.parse(rawText);
    const slug = raw.name;

    // sha 未变则跳过
    const existing = await this.prisma.skill.findUnique({
      where: { slug },
      select: { sha: true, installCount: true },
    });
    if (existing?.sha === sha) {
      this.logger.debug(`skip unchanged: ${slug}`);
      return;
    }

    const readmePath = raw.readme || "SKILL.md";
    const readmeAbs = join(skillDir, readmePath);
    const readme = existsSync(readmeAbs)
      ? readFileSync(readmeAbs, "utf-8")
      : "";

    const files = this.scanFiles(skillDir);
    const billing = this.deriveBilling(raw.runtime_type, raw.billing);
    // 下载数:已存在的技能保留 DB 真实计数(升级版本/skill.json 改动不抹零),
    // 全新技能用 skill.json 的 seed 值。
    const installCount =
      existing != null ? existing.installCount : raw.install_count ?? 0;
    const stars = 0; // 用户行为,初始 0
    const migrationStatus = raw.migration?.status;
    const hot = raw.hot ?? false;
    const score = this.computeScore({
      installCount,
      stars,
      migrationStatus,
      hot,
    });

    const createdAt = raw.created_at
      ? new Date(raw.created_at)
      : new Date("2026-01-01T00:00:00Z");
    const updatedAt = raw.updated_at ? new Date(raw.updated_at) : new Date();

    await this.prisma.skill.upsert({
      where: { slug },
      create: {
        slug,
        displayName: raw.display_name ?? slug,
        description: raw.description ?? "",
        descriptionEn: raw.description_en ?? null,
        summary: raw.quickstart ? JSON.stringify(raw.quickstart) : "",
        version: raw.version ?? "",
        icon: raw.icon ?? "",
        category: raw.category ?? "other",
        runtimeType: raw.runtime_type ?? "local",
        source: raw.owner?.type ?? "official",
        ownerName: raw.owner?.name ?? "official",
        ownerVerified: raw.owner?.verified ?? true,
        readmePath,
        envVars: raw.env_vars ? JSON.stringify(raw.env_vars) : null,
        dependencies: raw.dependencies ? JSON.stringify(raw.dependencies) : null,
        api: raw.api ? JSON.stringify(raw.api) : null,
        migration: raw.migration ? JSON.stringify(raw.migration) : null,
        platform: raw.platform ? JSON.stringify(raw.platform) : null,
        tags: raw.tags ? JSON.stringify(raw.tags) : null,
        examples: raw.examples ? JSON.stringify(raw.examples) : null,
        hot,
        installCount,
        stars,
        score,
        billing,
        readme,
        files: JSON.stringify(files),
        sha,
        createdAt,
        updatedAt,
      },
      update: {
        displayName: raw.display_name ?? slug,
        description: raw.description ?? "",
        descriptionEn: raw.description_en ?? null,
        version: raw.version ?? "",
        icon: raw.icon ?? "",
        category: raw.category ?? "other",
        runtimeType: raw.runtime_type ?? "local",
        source: raw.owner?.type ?? "official",
        ownerName: raw.owner?.name ?? "official",
        ownerVerified: raw.owner?.verified ?? true,
        readmePath,
        envVars: raw.env_vars ? JSON.stringify(raw.env_vars) : null,
        dependencies: raw.dependencies ? JSON.stringify(raw.dependencies) : null,
        api: raw.api ? JSON.stringify(raw.api) : null,
        migration: raw.migration ? JSON.stringify(raw.migration) : null,
        platform: raw.platform ? JSON.stringify(raw.platform) : null,
        tags: raw.tags ? JSON.stringify(raw.tags) : null,
        examples: raw.examples ? JSON.stringify(raw.examples) : null,
        hot,
        score,
        billing,
        readme,
        files: JSON.stringify(files),
        sha,
        updatedAt,
      },
    });

    // 同步版本(changelog)
    await this.prisma.skillVersion.deleteMany({ where: { skillId: slug } });
    // 注意:upsert 用 slug 作为业务键,但 Skill.id 是 cuid。先取 id。
    const saved = await this.prisma.skill.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (saved && raw.changelog?.length) {
      for (const c of raw.changelog) {
        const date = new Date(c.date || updatedAt);
        await this.prisma.skillVersion.create({
          data: {
            skillId: saved.id,
            version: c.version,
            changelog: JSON.stringify(c),
            date: isNaN(date.getTime()) ? updatedAt : date,
          },
        });
      }
    }

    this.logger.log(`imported: ${slug} v${raw.version}`);
  }

  private scanFiles(rootDir: string): Array<{
    path: string;
    size: number;
    type: "file" | "dir";
  }> {
    const out: Array<{ path: string; size: number; type: "file" | "dir" }> = [];
    const walk = (dir: string) => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        if (SKIP_DIRS.has(name)) continue;
        const full = join(dir, name);
        let st;
        try {
          st = statSync(full);
        } catch {
          continue;
        }
        const rel = relative(rootDir, full).split(sep).join("/");
        if (st.isDirectory()) {
          out.push({ path: rel, size: 0, type: "dir" });
          walk(full);
        } else {
          out.push({ path: rel, size: st.size, type: "file" });
        }
      }
    };
    walk(rootDir);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  private deriveBilling(
    runtimeType: string | undefined,
    explicitBilling?: string,
  ): "free" | "paid" {
    // skill.json 显式声明 billing 时优先用(用于「外网API 但免费」等例外)
    if (explicitBilling === "free" || explicitBilling === "paid") {
      return explicitBilling;
    }
    if (runtimeType === "gateway_migrated_api" || runtimeType === "external_api")
      return "paid";
    return "free";
  }

  private computeScore(args: {
    installCount: number;
    stars: number;
    migrationStatus?: string;
    hot: boolean;
  }): number {
    const verifiedBonus = args.migrationStatus === "verified" ? 100 : 0;
    const hotBonus = args.hot ? 50 : 0;
    return args.installCount * 1 + args.stars * 5 + verifiedBonus + hotBonus;
  }
}
