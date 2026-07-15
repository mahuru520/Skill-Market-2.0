#!/usr/bin/env python3
"""
查询供应商账户余额
用法:
  python fetch_balance.py [api_key] [--threshold <阈值>]

自动优先从以下来源读取 api_key:
  1. 命令行参数
  2. 环境变量 OPENCLAW_API_KEY
  3. OpenClaw 配置文件 (自动探测)
"""

import json
import os
import sys
import argparse
from pathlib import Path

# 默认余额安全阈值（低于此值触发 low_balance: true）
DEFAULT_THRESHOLD = 50.0


# ---------------------------------------------------------------------------
# API Key 自动探测
# ---------------------------------------------------------------------------

def _find_openclaw_config() -> Path | None:
    """自动探测 OpenClaw 配置文件路径"""
    candidates = [
        # 本地开发 / 直接运行
        Path("E:/Dev/cec-u-claw/CEC-Claw/data/.openclaw/openclaw.json"),
        Path("E:/Dev/cec-u-claw/CEC-Claw/data/.openclaw/config.json"),
        # Linux/macOS 标准路径
        Path.home() / ".openclaw" / "openclaw.json",
        Path.home() / ".config" / "openclaw" / "openclaw.json",
        # Windows 标准路径
        Path(os.environ.get("LOCALAPPDATA", "")) / "openclaw" / "openclaw.json",
        Path(os.environ.get("APPDATA", "")) / "openclaw" / "openclaw.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def _extract_api_key_from_config(config_path: Path) -> str | None:
    """从 OpenClaw 配置中提取第一个 provider 的 apiKey"""
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        models = config.get("models", {}).get("providers", {})
        for provider_name, provider_cfg in models.items():
            key = provider_cfg.get("apiKey")
            if key:
                return key
    except Exception:
        pass
    return None


def resolve_api_key(cli_key: str | None) -> str | None:
    """
    按优先级解析 apiKey:
    CLI > 环境变量 > OpenClaw 配置文件
    """
    if cli_key:
        return cli_key

    env_key = os.environ.get("OPENCLAW_API_KEY")
    if env_key:
        return env_key

    config_path = _find_openclaw_config()
    if config_path:
        key = _extract_api_key_from_config(config_path)
        if key:
            print(f"[balance-checker] 从配置文件自动读取 apiKey: {config_path}", file=sys.stderr)
            return key

    return None


# ---------------------------------------------------------------------------
# 余额查询
# ---------------------------------------------------------------------------

def fetch_balance(api_key: str, threshold: float | None = None) -> dict:
    """通过本地 API 查询余额"""
    import urllib.request

    url = "http://127.0.0.1:18780/api/fetch-balance"
    payload = json.dumps({"apiKey": api_key}).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,fr;q=0.7,ja;q=0.6,zh-TW;q=0.5,it;q=0.4",
    }

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    result = {
        "balance": data.get("balance"),
        "unit": "元",
    }

    if threshold is not None:
        result["low_balance"] = result["balance"] < threshold

    return result


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="查询账户余额（自动从环境变量或 OpenClaw 配置读取 apiKey）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
默认安全阈值: {DEFAULT_THRESHOLD} 元

示例:
  python fetch_balance.py                                    # 自动探测
  python fetch_balance.py sk-xxxx                            # 显式指定
  python fetch_balance.py --threshold 10                     # 自定义阈值
  OPENCLAW_API_KEY=sk-xxxx python fetch_balance.py           # 环境变量
        """
    )
    parser.add_argument("api_key", nargs="?", default=None, help="供应商 API Key（省略则自动探测）")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD,
                        help=f"余额阈值，低于该值时 low_balance 为 true（默认: {DEFAULT_THRESHOLD}）")
    args = parser.parse_args()

    api_key = resolve_api_key(args.api_key)
    if not api_key:
        print("错误: 无法自动探测 apiKey，请通过以下方式提供:", file=sys.stderr)
        print("  1. 命令行参数: python fetch_balance.py <api_key>", file=sys.stderr)
        print("  2. 环境变量:   set OPENCLAW_API_KEY=<api_key>", file=sys.stderr)
        print("  3. 配置文件:   确保 OpenClaw 配置文件中有有效的 apiKey", file=sys.stderr)
        sys.exit(1)

    try:
        result = fetch_balance(api_key, args.threshold)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
