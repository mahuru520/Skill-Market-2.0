// 共享 TS 类型:前后端通用的 Skill DTO 与枚举
// 字段对齐 skills/*/skill.json 真实结构

export type RuntimeType = "gateway_migrated_api" | "gateway_async_api" | "external_api" | "local";

export type Billing = "free" | "paid";

export type Source = "clawhub" | "osprey";

export type SortBy = "score" | "downloads" | "stars" | "rank" | "updated_at";

export type Order = "asc" | "desc";

export interface EnvVar {
  key: string;
  description?: string;
  required?: boolean;
  source?: string;
  example?: string;
}

export interface Dependency {
  name: string;
  min_version?: string;
  type?: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  desc?: string;
}

export interface SkillApi {
  base_url: string;
  auth_type?: string;
  endpoints?: ApiEndpoint[];
  rate_limit?: string;
  timeout_sec?: number;
}

export interface SkillMigration {
  migrated_from: string;
  migrated_to: string;
  behavior_change: string;
  status: "verified" | "pending";
}

export interface SkillOwner {
  name: string;
  type: string;
  verified: boolean;
  avatar?: string;
  url?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  type: string;
}

export interface SkillFile {
  path: string;
  size: number;
  type: "file" | "dir";
}

// 列表页 skill(精简,不含 readme 正文)
export interface SkillListItem {
  slug: string;
  displayName: string;
  description: string;
  descriptionEn?: string;
  version: string;
  icon: string;
  category: string;
  runtimeType: RuntimeType;
  billing: Billing;
  source: Source;
  ownerName: string;
  hot: boolean;
  installCount: number;
  stars: number;
  score: number;
  updatedAt: string;
}

export interface QuickstartData {
  overview: string;
  scenarios: string[];
  example: string;
  notes: string;
}

// 详情页 skill(完整)
export interface SkillDetail {
  slug: string;
  displayName: string;
  description: string;
  descriptionEn?: string;
  summary?: string;
  version: string;
  icon: string;
  category: string;
  runtimeType: RuntimeType;
  source: Source;
  ownerName: string;
  ownerVerified: boolean;
  readmePath: string;
  envVars?: EnvVar[];
  dependencies?: Dependency[];
  api?: SkillApi;
  migration?: SkillMigration;
  platform?: unknown;
  tags?: unknown;
  examples?: string[];
  hot: boolean;
  installCount: number;
  stars: number;
  score: number;
  billing: Billing;
  readme: string;
  quickstart?: QuickstartData;
  files?: SkillFile[];
  createdAt: string;
  updatedAt: string;
  latestVersion?: ChangelogEntry;
  contentZhAvailable: boolean;
}

// 统一响应封装
export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export interface Paginated<T> {
  skills: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Category {
  key: string;
  name: string;
  nameEn: string;
  sortOrder: number;
  level: number;
  active: boolean;
}

export interface CategoryList {
  count: number;
  items: Category[];
}
