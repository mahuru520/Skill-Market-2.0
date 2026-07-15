import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import archiver from "archiver";
import { PrismaService } from "../prisma/prisma.service";
import type {
  SkillDetail,
  SkillListItem,
  Paginated,
  SortBy,
  Order,
  RuntimeType,
  Billing,
  ChangelogEntry,
  EnvVar,
  Dependency,
  SkillApi,
  SkillMigration,
  SkillFile,
} from "@skill-market/shared";

const SORT_FIELD: Record<SortBy, string> = {
  score: "score",
  downloads: "installCount",
  stars: "stars",
  rank: "score", // 近期飙升暂用 score
  updated_at: "updatedAt",
};

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page?: number;
    pageSize?: number;
    sortBy?: SortBy;
    order?: Order;
    keyword?: string;
    category?: string;
    runtimeType?: RuntimeType;
    billing?: Billing;
  }): Promise<Paginated<SkillListItem>> {
    const page = Math.max(1, params.page ?? 1);
    // 上限放开到 500,配合前端「全部技能一页全量展示」(当前 25 个技能)
    const pageSize = Math.min(500, Math.max(1, params.pageSize ?? 12));
    const sortBy = params.sortBy ?? "score";
    const order = params.order ?? "desc";
    const sortField = SORT_FIELD[sortBy] ?? "score";

    const where: Record<string, unknown> = {};
    if (params.category) where.category = params.category;
    if (params.runtimeType) where.runtimeType = params.runtimeType;
    if (params.billing) where.billing = params.billing;
    if (params.keyword) {
      const kw = params.keyword;
      where.OR = [
        { slug: { contains: kw } },
        { displayName: { contains: kw } },
        { description: { contains: kw } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.skill.count({ where }),
    ]);

    const skills: SkillListItem[] = rows.map((r) => ({
      slug: r.slug,
      displayName: r.displayName,
      description: r.description,
      descriptionEn: r.descriptionEn ?? undefined,
      version: r.version,
      icon: r.icon,
      category: r.category,
      runtimeType: r.runtimeType as RuntimeType,
      billing: r.billing as Billing,
      source: r.source,
      ownerName: r.ownerName,
      hot: r.hot,
      installCount: r.installCount,
      stars: r.stars,
      score: r.score,
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { skills, total, page, pageSize };
  }

  async detail(slug: string): Promise<SkillDetail> {
    const r = await this.prisma.skill.findUnique({ where: { slug } });
    if (!r) throw new NotFoundException(`skill not found: ${slug}`);

    const versions = await this.prisma.skillVersion.findMany({
      where: { skillId: r.id },
      orderBy: { date: "desc" },
    });
    const latest = versions[0];
    const latestVersion = latest
      ? (parseJson<ChangelogEntry>(latest.changelog) ?? {
          version: latest.version,
          date: latest.date.toISOString(),
          changes: [],
          type: "",
        })
      : undefined;

    return {
      slug: r.slug,
      displayName: r.displayName,
      description: r.description,
      descriptionEn: r.descriptionEn ?? undefined,
      summary: r.summary ?? "",
      version: r.version,
      icon: r.icon,
      category: r.category,
      runtimeType: r.runtimeType as RuntimeType,
      source: r.source,
      ownerName: r.ownerName,
      ownerVerified: r.ownerVerified,
      readmePath: r.readmePath,
      envVars: parseJson<EnvVar[]>(r.envVars),
      dependencies: parseJson<Dependency[]>(r.dependencies),
      api: parseJson<SkillApi>(r.api),
      migration: parseJson<SkillMigration>(r.migration),
      platform: parseJson(r.platform),
      tags: parseJson(r.tags),
      examples: parseJson<string[]>(r.examples),
      hot: r.hot,
      installCount: r.installCount,
      stars: r.stars,
      score: r.score,
      billing: r.billing as Billing,
      readme: r.readme,
      files: parseJson<SkillFile[]>(r.files),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      latestVersion,
      contentZhAvailable: !!r.description,
    };
  }

  /**
   * 下载技能整目录 zip:installCount +1,流式返回 zip。
   * 用 GET 而非 POST,使前端 <a download> 能直接触发浏览器原生下载。
   */
  async download(slug: string, res: Response): Promise<void> {
    const skill = await this.prisma.skill.findUnique({
      where: { slug },
      select: { slug: true },
    });
    if (!skill) throw new NotFoundException(`skill not found: ${slug}`);

    const skillsDir = process.env.SKILLS_DIR ?? "";
    const dir = join(skillsDir, slug);
    if (!skillsDir || !existsSync(dir) || !statSync(dir).isDirectory()) {
      throw new NotFoundException(`skill directory not found: ${slug}`);
    }

    // 原子自增下载数(不阻塞下载流程,失败仅日志)
    this.prisma.skill
      .update({ where: { slug }, data: { installCount: { increment: 1 } } })
      .catch(() => undefined);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(slug)}.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err) => {
      // 流已开始,只能 abort
      res.destroy(err);
    });
    archive.pipe(res);
    archive.directory(dir, false);
    archive.finalize();
  }

  /**
   * 对标 skillhub.cn/install/:slug.md — 返回 SKILL.md 触发浏览器下载。
   * Content-Type: text/plain, Content-Disposition: attachment。
   * installCount +1。
   */
  async serveSkillMd(slug: string, res: Response): Promise<void> {
    const skill = await this.prisma.skill.findUnique({
      where: { slug },
      select: { slug: true },
    });
    if (!skill) throw new NotFoundException(`skill not found: ${slug}`);

    const skillsDir = process.env.SKILLS_DIR ?? "";
    const filePath = join(skillsDir, slug, "SKILL.md");
    if (!skillsDir || !existsSync(filePath)) {
      throw new NotFoundException(`SKILL.md not found for: ${slug}`);
    }

    // 原子自增下载数(不阻塞响应,失败仅日志)
    this.prisma.skill
      .update({ where: { slug }, data: { installCount: { increment: 1 } } })
      .catch(() => undefined);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment;filename="${encodeURIComponent(slug)}.md"`,
    );
    createReadStream(filePath).pipe(res);
  }

  async versions(slug: string): Promise<ChangelogEntry[]> {
    const skill = await this.prisma.skill.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!skill) throw new NotFoundException(`skill not found: ${slug}`);
    const rows = await this.prisma.skillVersion.findMany({
      where: { skillId: skill.id },
      orderBy: { date: "desc" },
    });
    return rows
      .map(
        (v) =>
          parseJson<ChangelogEntry>(v.changelog) ?? {
            version: v.version,
            date: v.date.toISOString(),
            changes: [],
            type: "",
          },
      )
      .filter(Boolean) as ChangelogEntry[];
  }
}
