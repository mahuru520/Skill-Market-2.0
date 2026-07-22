import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { SkillsService } from "./skills.service";
import type {
  ApiResponse,
  SkillDetail,
  Paginated,
  SkillListItem,
  SortBy,
  Order,
  RuntimeType,
  Billing,
  Source,
  ChangelogEntry,
} from "@skill-market/shared";

@Controller()
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  // 兼容 skillhub 风格的无版本前缀列表接口
  @Get("skills")
  async list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: SortBy,
    @Query("order") order?: Order,
    @Query("keyword") keyword?: string,
    @Query("category") category?: string,
    @Query("runtimeType") runtimeType?: RuntimeType,
    @Query("billing") billing?: Billing,
    @Query("source") source?: Source,
  ): Promise<ApiResponse<Paginated<SkillListItem>>> {
    const data = await this.service.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      sortBy,
      order,
      keyword,
      category,
      runtimeType,
      billing,
      source,
    });
    return { code: 0, data, message: "ok" };
  }

  @Get("v1/skills/:slug")
  async detail(
    @Param("slug") slug: string,
  ): Promise<ApiResponse<SkillDetail>> {
    try {
      const data = await this.service.detail(slug);
      return { code: 0, data, message: "ok" };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw e;
    }
  }

  @Get("v1/skills/:slug/versions")
  async versions(
    @Param("slug") slug: string,
  ): Promise<ApiResponse<ChangelogEntry[]>> {
    const data = await this.service.versions(slug);
    return { code: 0, data, message: "ok" };
  }

  // 对标 skillhub.cn/install/:slug.md — 触发浏览器下载 SKILL.md
  // installCount +1
  @Get("install/:slug.md")
  async installMarkdown(
    @Param("slug") slug: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.service.serveSkillMd(slug, res);
  }

  // 下载技能整目录 zip,同时 installCount +1。
  // 用 GET 让前端 <a download> 直接触发浏览器原生下载。
  @Get("v1/skills/:slug/download")
  async download(
    @Param("slug") slug: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.service.download(slug, res);
  }
}
