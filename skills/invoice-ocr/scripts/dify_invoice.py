"""
发票识别工作流 - 使用 Dify API（经公网网关）
"""
import requests
import os
import json
import csv
from datetime import datetime

# Dify 配置（经公网网关，双 token 鉴权）
DIFY_BASE_URL = "https://ai.ospreyai.cn"
API_KEY = "sk-your-api-key"              # 网关 new-api key
AUTH_TOKEN = "app-sCfow3LXjbKqFMzJOqI5aTcA"  # Dify 应用 API Key
USER = "invoice-bot"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",          # 网关层鉴权
    "X-Authorization": f"Bearer {AUTH_TOKEN}",     # 后端 Dify 鉴权
}


def upload_file(file_path):
    """上传文件到 Dify（经网关）"""
    url = f'{DIFY_BASE_URL}/api/v1/ai/workflow/files/upload'

    # 根据文件类型设置 mime type
    if file_path.lower().endswith('.pdf'):
        mime_type = "application/pdf"
    elif file_path.lower().endswith(('.jpg', '.jpeg')):
        mime_type = "image/jpeg"
    elif file_path.lower().endswith('.png'):
        mime_type = "image/png"
    else:
        mime_type = "application/octet-stream"

    file_tuple = (os.path.basename(file_path), open(file_path, "rb"), mime_type)
    files = {"file": file_tuple}
    data = {'user': USER}

    try:
        response = requests.post(url, headers=HEADERS, data=data, files=files)
        if response.status_code in (200, 201):
            return response.json()["id"]
        print(f"上传失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"上传失败: {e}")

    return None


def run_workflow(upload_file_id, file_path):
    """运行 Dify 工作流进行 OCR 处理（经网关）"""
    # 根据文件类型判断 input type
    if file_path.lower().endswith(('.jpg', '.jpeg', '.png')):
        input_type = "image"
    else:
        input_type = "document"

    url = f"{DIFY_BASE_URL}/api/v1/ai/workflow/workflows/run"
    data = {
        "inputs": {
            "file": {
                "type": input_type,
                "transfer_method": "local_file",
                "url": "",
                "upload_file_id": upload_file_id
            },
            "query": "请识别这张发票的信息",
            "output": "md"
        },
        "response_mode": "blocking",
        "user": USER
    }

    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=120)
        if response.status_code == 200:
            result = response.json()
            if result.get("data", {}).get("status") == "succeeded":
                outputs = result["data"]["outputs"]

                # 优先获取 result 字段
                if "result" in outputs and outputs["result"]:
                    result_content = outputs["result"].strip()

                    # 判断是 CSV 还是 JSON
                    if result_content.startswith('"') or result_content.startswith('发票抬头'):
                        # CSV 格式 - 保存为 md 文件
                        print(f"识别结果(CSV): {result_content[:100]}...")
                        csv_path = os.path.join("result", "md",
                                                os.path.splitext(os.path.basename(file_path))[0] + ".md")
                        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
                        with open(csv_path, 'w', encoding='utf-8-sig') as f:
                            f.write(result_content)
                        print(f"CSV 已保存到 {csv_path}")
                        return csv_path
                    else:
                        # JSON 格式
                        try:
                            invoice_data = json.loads(result_content)
                            print(f"识别结果: {invoice_data}")
                            json_path = os.path.join("result", "json",
                                                     os.path.splitext(os.path.basename(file_path))[0] + ".json")
                            os.makedirs(os.path.dirname(json_path), exist_ok=True)
                            with open(json_path, 'w', encoding='utf-8') as f:
                                json.dump(invoice_data, f, ensure_ascii=False, indent=2)
                            print(f"JSON 已保存到 {json_path}")
                            return json_path
                        except Exception as e:
                            print(f"解析 result 失败: {e}, 原始内容: {result_content[:200]}")

                # 备选：从 files 获取
                files = outputs.get("files") or outputs.get("files_1")
                if files and len(files) > 0:
                    return files[0]["url"]

                print(f"无输出文件: {outputs}")
                return None
            elif result.get("data", {}).get("status") == "running":
                # 等待异步任务完成
                import time
                task_id = result["data"]["task_id"]
                for _ in range(30):  # 最多等待 60 秒
                    time.sleep(2)
                    status_url = f"{DIFY_BASE_URL}/api/v1/ai/workflow/workflows/tasks/{task_id}"
                    status_resp = requests.get(status_url, headers=HEADERS)
                    if status_resp.status_code == 200:
                        status_data = status_resp.json()
                        if status_data.get("data", {}).get("status") == "succeeded":
                            return status_data["data"]["outputs"]["files"][0]["url"]
                print(f"任务超时: {result}")
                return None
            else:
                print(f"工作流状态: {result.get('data', {}).get('status')} - {result}")
        else:
            print(f"工作流运行失败: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"工作流运行失败: {e}")

    return None


def download_file(url, save_path):
    """下载文件"""
    response = requests.get(url)
    if response.status_code == 200:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(response.content)
        print(f"文件已保存到 {save_path}")
        return save_path
    else:
        print(f"下载失败: {response.status_code}")
        return None


def save_to_csv(invoice_data, csv_path):
    """保存发票数据到 CSV"""
    import csv

    fieldnames = [
        "invoice_title", "invoice_number", "issue_date",
        "buyer_name", "buyer_tax_id", "seller_name", "seller_tax_id",
        "item_name", "item_model", "item_quantity", "item_unit_price",
        "item_amount", "item_tax_rate", "item_tax_amount",
        "total_exclusive_tax", "total_tax", "total_inclusive_tax",
        "total_in_words", "remarks"
    ]

    # 展开 items
    rows = []
    for item in invoice_data.get("items", [{}]):
        row = {
            "invoice_title": invoice_data.get("invoice_title", ""),
            "invoice_number": invoice_data.get("invoice_number", ""),
            "issue_date": invoice_data.get("issue_date", ""),
            "buyer_name": invoice_data.get("buyer_info", {}).get("name", ""),
            "buyer_tax_id": invoice_data.get("buyer_info", {}).get("tax_id", ""),
            "seller_name": invoice_data.get("seller_info", {}).get("name", ""),
            "seller_tax_id": invoice_data.get("seller_info", {}).get("tax_id", ""),
            "item_name": item.get("name", ""),
            "item_model": item.get("model", ""),
            "item_quantity": item.get("quantity", ""),
            "item_unit_price": item.get("unit_price", ""),
            "item_amount": item.get("amount", ""),
            "item_tax_rate": item.get("tax_rate", ""),
            "item_tax_amount": item.get("tax_amount", ""),
            "total_exclusive_tax": invoice_data.get("total_amount_exclusive_tax", ""),
            "total_tax": invoice_data.get("total_tax_amount", ""),
            "total_inclusive_tax": invoice_data.get("total_amount_inclusive_tax", {}).get("in_figures", ""),
            "total_in_words": invoice_data.get("total_amount_inclusive_tax", {}).get("in_words", ""),
            "remarks": invoice_data.get("remarks", "")
        }
        rows.append(row)

    # 如果没有 items，添加一行空数据
    if not rows:
        rows.append({k: "" for k in fieldnames})

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"CSV 已保存到 {csv_path}")


def process_invoice(file_path):
    """处理单个发票文件"""
    print(f"处理文件: {file_path}")

    # 1. 上传文件
    file_id = upload_file(file_path)
    if not file_id:
        return None

    # 2. 运行工作流
    result_url = run_workflow(file_id, file_path)
    if not result_url:
        return None

    # 3. 处理结果（可能是本地路径或 URL）
    result_path = os.path.join("result", "md", os.path.splitext(os.path.basename(file_path))[0] + ".md")

    if result_url.startswith('http://') or result_url.startswith('https://'):
        # 是 URL，下载文件
        download_file(result_url, result_path)
    else:
        # 已经是本地路径，直接使用
        result_path = result_url

    return result_path


# 使用示例
if __name__ == "__main__":
    # 处理文件夹中的所有发票
    invoice_dir = r"C:\Users\lc_y2\Desktop\4轮报销-41692.71"
    output_csv = "result/invoices.csv"

    if os.path.exists(invoice_dir):
        file_list = [os.path.join(invoice_dir, f) for f in os.listdir(invoice_dir)
                     if f.endswith(('.pdf', '.jpg', '.jpeg', '.png'))]
        print(f"找到 {len(file_list)} 个文件，逐个处理...")

        all_results = []
        for file_path in file_list:
            try:
                result_path = process_invoice(file_path)
                if result_path:
                    all_results.append(result_path)
            except Exception as e:
                print(f"处理失败 {file_path}: {e}")

        # 读取并解析结果
        all_invoices = []
        for result_path in all_results:
            if not result_path or not os.path.exists(result_path):
                continue
            with open(result_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()

            # 解析 CSV 或 JSON
            if result_path.endswith('.md') or ',' in content:
                import io

                reader = csv.DictReader(io.StringIO(content))
                for row in reader:
                    all_invoices.append((result_path, row))
            elif result_path.endswith('.json'):
                invoice_list = json.loads(content)
                if invoice_list:
                    all_invoices.append((result_path, invoice_list[0]))

        # 保存合并的 CSV
        if all_invoices:
            fieldnames = [
                "filename", "invoice_title", "invoice_number", "issue_date",
                "buyer_name", "buyer_tax_id", "seller_name", "seller_tax_id",
                "item_name", "item_quantity", "item_unit_price",
                "item_amount", "item_tax_rate", "item_tax_amount",
                "total_exclusive_tax", "total_tax", "total_inclusive_tax",
                "total_in_words", "remarks", "issuer"
            ]

            os.makedirs(os.path.dirname(output_csv), exist_ok=True)
            with open(output_csv, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()

                for json_path, invoice in all_invoices:
                    filename = os.path.basename(json_path)
                    # 去掉扩展名
                    if filename.endswith('.json'):
                        filename = filename[:-5]
                    elif filename.endswith('.md'):
                        filename = filename[:-3]
                    row = {"filename": filename}

                    # 解析 items（JSON 字符串）
                    items_str = invoice.get("商品详情(items)", invoice.get("商品详情", "[]"))
                    try:
                        items = json.loads(items_str)
                        item = items[0] if items else {}
                    except:
                        items = []
                        item = {}

                    # 字段映射 - 支持 CSV 和 JSON 两种格式
                    field_map = {
                        # JSON 格式
                        "发票抬头(invoice_title)": "invoice_title",
                        "发票号码(invoice_number)": "invoice_number",
                        "开票日期(issue_date)": "issue_date",
                        "购买方名称(buyer_info.name)": "buyer_name",
                        "购买方税号(buyer_info.tax_id)": "buyer_tax_id",
                        "销售方名称(seller_info.name)": "seller_name",
                        "销售方税号(seller_info.tax_id)": "seller_tax_id",
                        "合计金额(total_amount_exclusive_tax)": "total_exclusive_tax",
                        "合计税额(total_tax_amount)": "total_tax",
                        "价税合计小写(total_amount_inclusive_tax.in_figures)": "total_inclusive_tax",
                        "价税合计大写(total_amount_inclusive_tax.in_words)": "total_in_words",
                        "备注(remarks)": "remarks",
                        "开票人(issuer)": "issuer",
                        # CSV 格式
                        "发票抬头": "invoice_title",
                        "发票号码": "invoice_number",
                        "开票日期": "issue_date",
                        "购买方名称": "buyer_name",
                        "购买方税号": "buyer_tax_id",
                        "销售方名称": "seller_name",
                        "销售方税号": "seller_tax_id",
                        "合计金额": "total_exclusive_tax",
                        "合计税额": "total_tax",
                        "价税合计大写": "total_in_words",
                        "价税合计小写": "total_inclusive_tax",
                        "备注": "remarks",
                        "开票人": "issuer"
                    }

                    for cn_key, en_key in field_map.items():
                        if cn_key in invoice:
                            row[en_key] = invoice[cn_key]

                    row["item_name"] = item.get("name", "")
                    row["item_quantity"] = item.get("quantity", "")
                    row["item_unit_price"] = item.get("unit_price", "")
                    row["item_amount"] = item.get("amount", "")
                    row["item_tax_rate"] = item.get("tax_rate", "")
                    row["item_tax_amount"] = item.get("tax_amount", "")

                    # 转换时间戳
                    if "issue_date" in row:
                        try:
                            # 尝试转换为日期
                            ts = int(str(row["issue_date"]))
                            row["issue_date"] = datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
                        except:
                            pass  # 保持原值

                    writer.writerow(row)

            print(f"\nCSV 已保存到 {output_csv}")
            print(f"共处理 {len(all_invoices)} 个发票")
