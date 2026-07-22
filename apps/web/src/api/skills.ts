import { apiGet } from "./client";
import type {
  SkillListItem,
  SkillDetail,
  ChangelogEntry,
  CategoryList,
  Paginated,
  SortBy,
  Order,
  RuntimeType,
  Billing,
  Source,
} from "@skill-market/shared";

export function fetchSkills(params: {
  page?: number;
  pageSize?: number;
  sortBy?: SortBy;
  order?: Order;
  keyword?: string;
  category?: string;
  runtimeType?: RuntimeType;
  billing?: Billing;
  source?: Source;
}): Promise<Paginated<SkillListItem>> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.order) q.set("order", params.order);
  if (params.keyword) q.set("keyword", params.keyword);
  if (params.category) q.set("category", params.category);
  if (params.runtimeType) q.set("runtimeType", params.runtimeType);
  if (params.billing) q.set("billing", params.billing);
  if (params.source) q.set("source", params.source);
  return apiGet<Paginated<SkillListItem>>(`/skills?${q.toString()}`);
}

export function fetchSkillDetail(slug: string): Promise<SkillDetail> {
  return apiGet<SkillDetail>(`/v1/skills/${encodeURIComponent(slug)}`);
}

export function fetchSkillVersions(slug: string): Promise<ChangelogEntry[]> {
  return apiGet<ChangelogEntry[]>(
    `/v1/skills/${encodeURIComponent(slug)}/versions`,
  );
}

export function fetchCategories(): Promise<CategoryList> {
  return apiGet<CategoryList>(`/v1/categories`);
}

export function fetchShowcase(type: string): Promise<SkillListItem[]> {
  return apiGet<SkillListItem[]>(`/v1/showcase/${type}`);
}
