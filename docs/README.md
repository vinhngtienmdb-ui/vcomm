# Tài liệu VComm

| Tài liệu | Nội dung |
| --- | --- |
| [decisions/0001-kien-truc-tong-the.md](decisions/0001-kien-truc-tong-the.md) | Các quyết định kiến trúc: monorepo, mini app, một CSDL nhiều schema, đa pháp nhân |
| [specs/platform.md](specs/platform.md) | Đặc tả mini app Nền tảng: tổ chức, đăng nhập, phân quyền, duyệt chứng từ |
| [data-model/core.sql](data-model/core.sql) | Mô hình dữ liệu schema `core` (PostgreSQL 16) |

Thứ tự xây ERP: **Nền tảng → Sản phẩm → Kho** → Mua hàng & Bán hàng → Tài chính & Kế toán → Khách hàng, Đối tác & Nhân sự.

Thử mô hình dữ liệu trên máy có PostgreSQL:

```bash
createdb vcomm_dev && psql -v ON_ERROR_STOP=1 -d vcomm_dev -f docs/data-model/core.sql
```
