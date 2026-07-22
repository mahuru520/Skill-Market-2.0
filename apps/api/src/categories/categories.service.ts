import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface SeedCategory {
  key: string;
  name: string;
  nameEn: string;
  sortOrder: number;
}

const SEED: SeedCategory[] = [
  { key: "comfyui", name: "ComfyUI", nameEn: "ComfyUI", sortOrder: 15 },
  { key: "image_video", name: "图像视频", nameEn: "Image & Video", sortOrder: 10 },
  { key: "document", name: "文档处理", nameEn: "Document", sortOrder: 20 },
  { key: "code_debug", name: "代码调试", nameEn: "Code & Debug", sortOrder: 30 },
  { key: "mail_communication", name: "邮件通信", nameEn: "Mail & Communication", sortOrder: 40 },
  { key: "initialization", name: "初始化", nameEn: "Initialization", sortOrder: 50 },
  { key: "system_config", name: "系统配置", nameEn: "System Config", sortOrder: 60 },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // 幂等补齐:每次启动确保 SEED 中定义的分类都存在(新增分类如 comfyui 也能落库)
    for (const c of SEED) {
      await this.prisma.category.upsert({
        where: { key: c.key },
        create: { key: c.key, name: c.name, nameEn: c.nameEn, sortOrder: c.sortOrder },
        update: { name: c.name, nameEn: c.nameEn, sortOrder: c.sortOrder },
      });
    }
  }

  async list() {
    const items = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return { count: items.length, items };
  }
}
