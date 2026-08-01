# SYNAP — by VERSA.JS

> **S**istema **Y** **N**inja **A**utomated **P**latform

忍者公园分店注册和计费的数字自助服务终端平台。
快速捕获数据、照片和随行人员。同步计费、主控面板，从任一地点完全控制分店。

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + Vite 8 + TailwindCSS 4.3.3 |
| **后端** | Node.js + Express 5 + Sequelize 6 |
| **数据库** | SQLite (通过 Sequelize) |
| **身份验证** | JWT (jsonwebtoken + bcryptjs) |
| **文件上传** | Multer (照片上传) |
| **导出** | xlsx (Excel 报表) |

---

## 📋 环境要求

- **Node.js** v20 或更高版本
- **npm** v9 或更高版本
- 现代浏览器 (Chrome, Edge, Firefox)

---

## 🚀 安装与运行

### 1. 克隆仓库

```bash
git clone https://github.com/4GeeksAcademy/NinjaPark-JeanF.git
cd NinjaPark-JeanF
```

### 2. 启动后端 (端口 3001)

```bash
cd backend
npm install
node server.js
```

后端将自动执行：
- 同步 SQLite 数据库
- 创建默认种子用户
- 服务启动在 `http://localhost:3001`

### 3. 启动前端 (端口 5173)

**打开另一个终端** 并执行：

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 可用

### 4. 在浏览器中打开

访问 **[http://localhost:5173](http://localhost:5173)**

---

## 👥 种子用户（预定义）

| 用户名 | 密码 | 角色 | 分店 |
|---------|------|------|------|
| `jeanf9839@gmail.com` | `The.poison123` | **master** | 全部 |
| `admin.candelaria` | `AdminCandelaria2026!` | admin | Ninja Park Candelaria |
| `cajero.candelaria` | `CajeroCandelaria2026!` | cajero | Ninja Park Candelaria |
| `admin.chacao` | `AdminChacao2026!` | admin | Ninja Park Chacao |
| `cajero.chacao` | `CajeroChacao2026!` | cajero | Ninja Park Chacao |

> **Master 角色**：完全访问所有分店和管理面板。
> **Admin 角色**：仅限分配给他们的分店。
> **Cajero 角色**：仅对其分店有只读访问权限。

---

## 📡 API 端点

### 身份验证
| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录 (body: `{ username, password }`) |
| `GET` | `/api/auth/me` | 获取当前用户信息 |

### 分店
| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/sedes` | 列出所有分店 |

### 自助服务终端 (注册)
| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/kiosk/register-start` | 开始注册 (查找/创建代表) |
| `POST` | `/api/kiosk/register-complete` | 完成注册 (含随行人员) |
| `POST` | `/api/kiosk/upload-photo` | 从自助终端上传照片 |

### 管理
| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/admin/records` | 列出注册记录 (可按分店/日期筛选) |
| `PATCH` | `/api/admin/records/:id` | 编辑记录 |
| `GET` | `/api/admin/export` | 导出为 JSON |
| `GET` | `/api/admin/export.xlsx` | 导出为 Excel |

### POS 和计费
| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/pos/autocomplete/:cedula` | 按身份证号搜索客户 |
| `GET` | `/api/billing/lookup/:cedula` | 查询计费信息 |
| `GET` | `/api/billing/notifications` | 列出计费通知 |
| `POST` | `/api/billing/webhook` | 计费 Webhook |

---

## 📁 项目结构

```
NinjaPark-JeanF/
├── backend/
│   └── server.js          # Express API + Sequelize + 路由
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 主组件 (React)
│   │   ├── main.jsx       # 入口文件
│   │   └── index.css      # Tailwind 样式 + 动画
│   ├── index.html         # HTML 入口
│   └── package.json
├── README.md
├── README.es.md
└── README.cn.md
```

---

## 🧪 生产构建

```bash
cd frontend
npm run build
```

生成包含优化文件的 `dist/` 目录。

---

## 🎨 动画效果

SYNAP 包含高级流畅动画：
- Hero 和 CTA 区域的浮动装饰粒子
- 背景的闪烁和微光效果
- 基于 Intersection Observer 的渐进式显示
- 4 步交互式时间线
- 带 3D 悬停效果的玻璃卡片
- 带滑入 + 弹性缩放的提示框

所有过渡均使用 `cubic-bezier(0.16, 1, 0.3, 1)` 实现丝滑流畅的运动。

---

## 📄 许可证

学术项目 — 4Geeks Academy Coding Bootcamp。

---

## 👨‍💻 作者

**Jean Franco** — Full Stack Developer 课程毕业设计。

---

*Powered by VERSA.JS — SYNAP 平台 v1.0.0*
