# gasi CLI

Developer toolkit untuk scaffolding plugin dan resource pada project GASI.

## Instalasi

```bash
npm install -g .
# atau langsung jalankan
node bin/gasi.js
```

## Commands

### `gasi plugin create`

Generate skeleton plugin baru. Mendukung target **api** (Spring Boot + PF4J),
**web** (React + Vite monorepo), atau **all** (keduanya).

```bash
# Interactive — akan ditanya target, nama, versi, dll
gasi plugin create

# Web plugin saja
gasi plugin create --target web --name hr

# API plugin saja
gasi plugin create --target api --name hr

# Keduanya (default)
gasi plugin create --target all --name hr

# Non-interactive
gasi plugin create --target web --name hr --description "HR Module" -y
```

**Options:**

| Flag | Keterangan |
|---|---|
| `-n, --name` | Nama plugin (tanpa suffix `-plugin`) |
| `-t, --target` | `api`, `web`, atau `all` (default: `all`) |
| `-v, --plugin-version` | Versi plugin (default: `1.0.0`) |
| `--description` | Deskripsi plugin |
| `-d, --domain` | Java domain package (API only) |
| `-p, --package` | Base Java package (API only, default: `gasi.gps`) |
| `--depends-on` | Plugin dependency PF4J (API only) |
| `--no-flyway` | Skip Flyway migration sample (API only) |
| `--no-register` | Skip register ke parent pom.xml (API only) |
| `-y, --yes` | Skip semua prompt, pakai defaults |
| `--cwd` | Root project directory |

**Output web plugin** (`plugins/hr-plugin/`):
```
plugins/hr-plugin/
├── src/
│   ├── features/
│   │   └── hr/
│   │       └── routes.tsx     ← entry point routes, tambahkan sub-feature di sini
│   └── index.ts               ← register plugin ke pluginRegistry
├── package.json               ← @gasi/plugin-hr
├── vite.config.ts             ← build UMD → platform-app/public/plugins/
└── tsconfig.json
```

**Setelah generate web plugin:**
```bash
# Build plugin
npm run build -w plugins/hr-plugin

# Daftarkan di platform-app/src/main.tsx
await loadAndStartPlugins(['/plugins/plugin-hr.umd.js']);

# Tambah feature/resource
gasi resource create --target web --web-dir plugins/hr-plugin
```

---

### `gasi plugin list`

List plugin yang terdaftar di parent `pom.xml`.

```bash
gasi plugin list
```

---

### `gasi plugin build <name>`

Build plugin API dengan Maven.

```bash
gasi plugin build hr
gasi plugin build hr --skip-tests
gasi plugin build hr --dry-run
```

---

### `gasi plugin deploy <name>`

Copy JAR hasil build ke folder `platform-app/plugins/`.

```bash
gasi plugin deploy hr
gasi plugin deploy hr --dry-run
```

---

### `gasi plugin clean <name>`

Hapus JAR yang sudah di-deploy dari `platform-app/plugins/`.

```bash
gasi plugin clean hr
```

---

### `gasi plugin delete <name>`

Hapus folder plugin dan unregister dari `pom.xml`.

```bash
gasi plugin delete hr
gasi plugin delete hr --dry-run
```

---

### `gasi resource create`

Generate full CRUD resource (entity, service, controller, pages, hooks, dll)
di dalam plugin yang sudah ada.

```bash
# API resource (default)
gasi resource create Employee --cwd plugins/hr-plugin

# Web resource di dalam plugin
gasi resource create Employee --target web --web-dir plugins/hr-plugin

# Dari file definisi
gasi resource create --target web --web-dir plugins/hr-plugin -f resource.json
```

---

### `gasi resource delete <entityName>`

Hapus semua file resource yang sudah di-generate.

```bash
gasi resource delete Employee
```

---

### `gasi uploader create <name>`

Generate `DataUplProcessor` untuk upload data di dalam plugin.

```bash
gasi uploader create Employee --plugin hr
```

---

## Resource Definition File

Gunakan file JSON untuk mendefinisikan entity dengan field-fieldnya:

```json
{
  "entityName": "Employee",
  "basePath": "/hr/employees",
  "fields": [
    { "name": "employeeNo", "type": "String",  "required": true,  "dto": { "summary": true, "detail": true, "create": true, "update": true }, "filterable": true },
    { "name": "fullName",   "type": "String",  "required": true,  "dto": { "summary": true, "detail": true, "create": true, "update": true }, "filterable": true },
    { "name": "email",      "type": "String",  "required": false, "dto": { "summary": false,"detail": true, "create": true, "update": true }, "validation": { "email": true } },
    { "name": "joinDate",   "type": "Date",    "required": false, "dto": { "summary": true, "detail": true, "create": true, "update": true } },
    { "name": "isActive",   "type": "Boolean", "required": true,  "dto": { "summary": true, "detail": true, "create": true, "update": true } }
  ]
}
```

**Tipe field yang didukung:**
`String`, `Integer`, `Long`, `BigDecimal`, `Double`, `Boolean`, `Date`, `DateTime`, `Instant`, `ManyToOne`, `Enum`
