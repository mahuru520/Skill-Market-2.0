import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { SkillListItem, RuntimeType, Billing, Source } from "@skill-market/shared";

@Injectable()
export class ShowcaseService {
  constructor(private readonly prisma: PrismaService) {}

  async getByType(type: string): Promise<SkillListItem[]> {
    let orderBy: Record<string, "asc" | "desc"> = { score: "desc" };
    let take = 10;
    let where: Record<string, unknown> = {};

    switch (type) {
      case "top":
        orderBy = { installCount: "desc" };
        take = 10;
        break;
      case "hot":
        where = { hot: true };
        orderBy = { score: "desc" };
        take = 10;
        break;
      case "featured":
        where = { hot: true };
        orderBy = { score: "desc" };
        take = 6;
        break;
      case "recommended":
        orderBy = { score: "desc" };
        take = 8;
        break;
      default:
        orderBy = { score: "desc" };
    }

    const rows = await this.prisma.skill.findMany({
      where,
      orderBy,
      take,
    });

    return rows.map((r) => ({
      slug: r.slug,
      displayName: r.displayName,
      description: r.description,
      descriptionEn: r.descriptionEn ?? undefined,
      version: r.version,
      icon: r.icon,
      category: r.category,
      runtimeType: r.runtimeType as RuntimeType,
      billing: r.billing as Billing,
      source: r.source as Source,
      ownerName: r.ownerName,
      hot: r.hot,
      installCount: r.installCount,
      stars: r.stars,
      score: r.score,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}
