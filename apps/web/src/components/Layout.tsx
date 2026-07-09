import { Link, NavLink } from "react-router-dom";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
          <Link to="/" className="font-bold text-xl text-ink tracking-tight">
            Osprey Skill Market
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "text-brand font-medium" : "text-ink-mute hover:text-ink"
              }
            >
              首页
            </NavLink>
            <NavLink
              to="/skills"
              className={({ isActive }) =>
                isActive ? "text-brand font-medium" : "text-ink-mute hover:text-ink"
              }
            >
              全部技能
            </NavLink>
            <a
              href="https://ai.ospreyai.cn/docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-mute hover:text-ink"
            >
              文档
            </a>
            <a
              href="https://open.ospreyai.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-mute hover:text-ink"
            >
              订阅
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
