export const RUNTIME_LABEL: Record<string, string> = {
  local: "本地运行",
  external_api: "外网API",
  gateway_migrated_api: "网关迁移",
  gateway_async_api: "网关异步",
};

export const RUNTIME_COLOR: Record<string, string> = {
  local: "bg-canvas text-ink-soft border border-line",
  external_api: "bg-orange-50 text-brand border border-orange-100",
  gateway_migrated_api: "bg-rose-50 text-rose-700 border border-rose-100",
  gateway_async_api: "bg-rose-50 text-rose-700 border border-rose-100",
};

export const BILLING_LABEL: Record<string, string> = {
  free: "免费",
  paid: "计费",
};

export const BILLING_COLOR: Record<string, string> = {
  free: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  paid: "bg-amber-50 text-amber-700 border border-amber-100",
};

export const SOURCE_LABEL: Record<string, string> = {
  clawhub: "ClawHub",
  osprey: "Osprey",
};

export const SOURCE_COLOR: Record<string, string> = {
  clawhub: "bg-sky-50 text-sky-700 border border-sky-100",
  osprey: "bg-violet-50 text-violet-700 border border-violet-100",
};

export const CATEGORY_LABEL: Record<string, string> = {
  image_video: "图像视频",
  comfyui: "ComfyUI",
  document: "文档处理",
  code_debug: "代码调试",
  mail_communication: "邮件通信",
  initialization: "初始化",
  system_config: "系统配置",
};

export const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "score", label: "综合评分" },
  { value: "downloads", label: "下载量" },
  { value: "stars", label: "收藏数" },
  { value: "rank", label: "近期飙升" },
  { value: "updated_at", label: "最近更新" },
];
