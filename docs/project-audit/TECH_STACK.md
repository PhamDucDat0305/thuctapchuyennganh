# Công nghệ và dependency

## Công nghệ phát hiện

| Công nghệ | Vai trò | Phiên bản khai báo/thực tế quan sát | Bằng chứng |
|---|---|---|---|
| HTML/CSS | Giao diện tĩnh và layout responsive | Không có version | Các file `*.html`, `css/`. |
| JavaScript ES modules | Logic frontend, gọi API, render UI | Không có compiler/transpiler | `js/api.js`, `js/db.js`, `js/auth.js`; scripts trong HTML. |
| Node.js | Runtime backend | Runtime audit: `v24.19.0`; không có `engines` trong package | `backend/package.json`; `node --version`. |
| npm | Quản lý package backend | Runtime audit: `11.17.0` | `backend/package-lock.json`; `npm --version`. |
| Express | HTTP API | package khai báo `^5.3.0`; `npm ls` cho `5.3.0` | `backend/package.json`, `backend/src/app.js`. |
| `mssql` | SQL Server driver/connection pool | `^12.7.10`; cài `12.7.10` | `backend/src/config/database.js`. |
| `express-session` | Cookie-backed session | `^1.19.0`; cài `1.19.0` | `backend/src/config/session.js`. |
| `connect-mssql-v2` | Lưu session trong SQL Server | `^6.0.0`; cài `6.0.0` | `backend/src/config/session.js`. |
| `argon2` | Băm/đối chiếu password | `^0.45.1`; cài `0.45.1` | `backend/src/routes/auth.routes.js`, `me.routes.js`. |
| `dotenv` | Đọc biến môi trường | `^18.0.8`; cài `18.0.8` | `backend/src/server.js`, `.env.example`. |
| `nodemon` | Restart backend khi phát triển | `^3.1.14`; cài `3.1.14` | Script `dev` trong `backend/package.json`. |
| Font Awesome, Google Fonts | Icon/font qua CDN | Font Awesome URL `6.4.2`; Google Fonts Inter | HTML/CSS liên quan. |

Phiên bản “cài” là kết quả `npm ls --depth=0` tại lần audit, không khẳng định môi trường triển khai của người dùng có cùng phiên bản. Frontend không có lockfile/package manifest.

## Dependency backend

Dependencies runtime: `argon2`, `connect-mssql-v2`, `dotenv`, `express`, `express-session`, `mssql`. Dev dependency: `nodemon`. Rate limiting hiện dùng middleware in-memory tự viết; chưa có thư viện validation schema, security headers, logger cấu trúc, test framework, ORM hoặc OpenAPI generator.

## Build/package tools

- Backend scripts: `npm start` → `node src/server.js`; `npm run dev` → `nodemon src/server.js`.
- Không có script `build`, `test`, `lint` hoặc `format`.
- Không có `package.json` ở root; frontend được phục vụ như static files.
- `backend/package-lock.json` có lockfile version 3. `backend/node_modules/` là thư mục sinh/cài dependency và không được đưa vào tài liệu cấu trúc.
- Không thấy bundler, TypeScript compiler, CSS preprocessor config hoặc CI workflow.

## Cài dependency

Trong `backend/`, lệnh được suy ra từ lockfile: `npm ci`. Lệnh dependency listing đã chạy trong audit: `npm ls --depth=0` và liệt kê đầy đủ các package theo lockfile. Chưa chạy server, nên cài package thành công không chứng minh API hoạt động.

## Chưa xác định

- Phiên bản SQL Server, compatibility level và cấu hình runtime thực tế.
- Phiên bản Node/npm của máy người dùng/môi trường deploy.
- Trình duyệt tối thiểu, web server frontend và các phiên bản CDN thực tế được tải khi chạy.
- Cấu hình production, reverse proxy, HTTPS và domain.
