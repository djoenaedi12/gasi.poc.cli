# gasi CLI

Developer toolkit untuk scaffolding plugin dan resource pada project GASI.

## Instalasi

```bash
npm install -g .
# atau langsung jalankan
node bin/gasi.js
```

---

## Commands

Semua command plugin mendukung `--target api | web | all`.

| Target | Keterangan |
|---|---|
| `api` | Hanya Spring Boot + PF4J (Maven) |
| `web` | Hanya React + Vite (npm) |
| `all` | Keduanya sekaligus |

---

### `gasi plugin create`

Generate skeleton plugin baru.

```bash
# Interactive (default target: all)
gasi plugin create

# Web plugin saja
gasi plugin create --target web --name hr

# API plugin saja
gasi plugin create --target api --name hr

# Keduanya
gasi plugin create --target all --name hr -y
```

**Output web plugin** (`plugins/hr-plugin/`):
```
plugins/hr-plugin/
├── src/
│   ├── features/hr/routes.tsx   ← entry point routes
│   └── index.ts                 ← register ke pluginRegistry
├── package.json
├── vite.config.ts               ← build UMD → platform-app/public/plugins/
└── tsconfig.json
```

---

### `gasi plugin build <name>`

Build plugin.

```bash
# Build web saja
gasi plugin build hr --target web

# Build API saja
gasi plugin build hr --target api

# Build keduanya
gasi plugin build hr --target all

# Dry run
gasi plugin build hr --target all --dry-run
```

Web build output ke `plugins/hr-plugin/dist/plugin-hr.umd.js`.

---

### `gasi plugin deploy <name>`

Deploy plugin ke platform.

```bash
# Deploy API (copy JAR → platform-app/plugins/)
gasi plugin deploy hr --target api

# Deploy Web (verifikasi bundle ada di platform-app/public/plugins/)
gasi plugin deploy hr --target web

# Keduanya
gasi plugin deploy hr --target all

# Dry run
gasi plugin deploy hr --target all --dry-run
```

> Web deploy copy file dari `plugins/hr-plugin/dist/` ke `platform-app/public/plugins/`.


---

### `gasi plugin clean <name>`

Hapus deployed files dari platform.

```bash
# Hapus JAR dari platform-app/plugins/
gasi plugin clean hr --target api

# Hapus .umd.js dari platform-app/public/plugins/
gasi plugin clean hr --target web

# Keduanya
gasi plugin clean hr --target all

# Dry run
gasi plugin clean hr --target all --dry-run
```

---

### `gasi plugin delete <name>`

Hapus folder plugin dan semua deployed files.

```bash
# Hapus API plugin
gasi plugin delete hr --target api

# Hapus web plugin
gasi plugin delete hr --target web

# Hapus keduanya
gasi plugin delete hr --target all

# Skip konfirmasi
gasi plugin delete hr --target all -y

# Dry run
gasi plugin delete hr --target all --dry-run
```

Delete plan yang ditampilkan sebelum eksekusi:
```
Delete plan:

  API:
    Unregister from : pom.xml
    Remove dir      : plugins/hr-plugin
    Remove JAR      : platform-app/plugins/hr-plugin-1.0.0.jar

  Web:
    Remove dir      : plugins/hr-plugin
    Remove bundle   : platform-app/public/plugins/plugin-hr.umd.js
```

---

### `gasi plugin list`

List plugin yang terdaftar di parent `pom.xml`.

```bash
gasi plugin list
```

---

### `gasi resource create`

Generate full CRUD resource di dalam plugin yang sudah ada.

```bash
# API resource
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

Generate `DataUplProcessor` untuk upload data.

```bash
gasi uploader create Employee --plugin hr
```

---

## Resource Definition File

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

**Tipe field:** `String`, `Integer`, `Long`, `BigDecimal`, `Double`, `Boolean`, `Date`, `DateTime`, `Instant`, `ManyToOne`, `Enum`
