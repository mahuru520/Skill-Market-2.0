import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchSkills, fetchCategories } from "../api/skills";
import { SkillCard } from "../components/SkillCard";
import { SORT_OPTIONS, RUNTIME_LABEL, SOURCE_LABEL } from "../lib/labels";
import type { SortBy, RuntimeType, Billing, Source } from "@skill-market/shared";

// 一页全量展示,不分页
const PAGE_SIZE = 200;

export function SkillList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sortBy = (searchParams.get("sortBy") as SortBy) || "score";
  const keyword = searchParams.get("keyword") || "";
  const category = searchParams.get("category") || "";
  const runtimeType = (searchParams.get("runtimeType") as RuntimeType) || "";
  const billing = (searchParams.get("billing") as Billing) || "";
  const source = (searchParams.get("source") as Source) || "";

  const { data, isLoading } = useQuery({
    queryKey: ["skills", { sortBy, keyword, category, runtimeType, billing, source }],
    queryFn: () =>
      fetchSkills({
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy,
        keyword: keyword || undefined,
        category: category || undefined,
        runtimeType: runtimeType || undefined,
        billing: billing || undefined,
        source: source || undefined,
      }),
  });

  const catQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  // 搜索框本地受控,提交(回车/失焦)时写入 URL;输入态不触发请求
  const [keywordInput, setKeywordInput] = useState(keyword);
  useEffect(() => setKeywordInput(keyword), [keyword]);
  const submitKeyword = () => {
    if (keywordInput.trim() !== keyword) update("keyword", keywordInput.trim());
  };

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const skills = data?.skills ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">全部技能</h1>
        <div className="flex-1" />
        <div className="relative w-72 max-w-full">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onBlur={submitKeyword}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitKeyword();
            }}
            placeholder="搜索技能名称或描述…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-card border border-line bg-surface focus:outline-none focus:border-brand"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">🔍</span>
          {keywordInput && (
            <button
              onClick={() => {
                setKeywordInput("");
                update("keyword", "");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink text-sm px-1"
              aria-label="清除"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 筛选区 */}
      <div className="bg-surface rounded-card shadow-card p-4 mb-6 space-y-3">
        {/* 排序 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-mute">排序：</span>
          <select
            value={sortBy}
            onChange={(e) => update("sortBy", e.target.value)}
            className="text-sm border border-line rounded-lg px-2 py-1 bg-surface focus:outline-none focus:border-brand"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* 运行方式筛选 */}
        <FilterRow label="运行方式">
          <Chip active={!runtimeType} onClick={() => update("runtimeType", "")}>
            全部
          </Chip>
          {(Object.keys(RUNTIME_LABEL) as RuntimeType[]).map((rt) => (
            <Chip
              key={rt}
              active={runtimeType === rt}
              onClick={() => update("runtimeType", rt)}
            >
              {RUNTIME_LABEL[rt]}
            </Chip>
          ))}
        </FilterRow>

        {/* 计费筛选 */}
        <FilterRow label="计费">
          <Chip active={!billing} onClick={() => update("billing", "")}>
            全部
          </Chip>
          <Chip active={billing === "free"} onClick={() => update("billing", "free")}>
            免费
          </Chip>
          <Chip active={billing === "paid"} onClick={() => update("billing", "paid")}>
            计费
          </Chip>
        </FilterRow>

        {/* 分类筛选 */}
        <FilterRow label="分类">
          <Chip active={!category} onClick={() => update("category", "")}>
            全部
          </Chip>
          {catQ.data?.items.map((c) => (
            <Chip
              key={c.key}
              active={category === c.key}
              onClick={() => update("category", c.key)}
            >
              {c.name}
            </Chip>
          ))}
        </FilterRow>

        {/* 来源筛选 */}
        <FilterRow label="来源">
          <Chip active={!source} onClick={() => update("source", "")}>
            全部
          </Chip>
          {(Object.keys(SOURCE_LABEL) as Source[]).map((src) => (
            <Chip
              key={src}
              active={source === src}
              onClick={() => update("source", src)}
            >
              {SOURCE_LABEL[src]}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {/* 结果统计 */}
      <div className="text-sm text-ink-mute mb-4">
        {isLoading ? "加载中…" : `共 ${total} 个技能`}
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((s) => (
          <SkillCard key={s.slug} skill={s} />
        ))}
      </div>

      {/* 空状态 */}
      {!isLoading && skills.length === 0 && (
        <div className="text-center py-16 text-ink-mute">
          没有匹配的技能,试试调整筛选条件。
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-ink-mute w-16 shrink-0">{label}：</span>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full transition-colors ${
        active
          ? "bg-brand text-white"
          : "bg-canvas text-ink-soft border border-line hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}
