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
├── vite.config.ts               ← build UMD untuk runtime plugin host
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

Web build output ke `plugins/hr-plugin/dist/plugin-hr.umd.cjs`.

---

### `gasi plugin deploy <name>`

Deploy plugin ke platform.

```bash
# Deploy API (copy JAR → platform-app/plugins/)
gasi plugin deploy hr --target api

# Deploy Web (copy bundle dan update manifest)
gasi plugin deploy hr --target web

# Keduanya
gasi plugin deploy hr --target all

# Dry run
gasi plugin deploy hr --target all --dry-run
```

> Web deploy copy file dari `plugins/hr-plugin/dist/` ke `platform-app/public/plugins/`
> dan menambahkan URL bundle ke `platform-app/public/plugins/manifest.json`.


---

### `gasi plugin clean <name>`

Hapus deployed files dari platform.

```bash
# Hapus JAR dari platform-app/plugins/
gasi plugin clean hr --target api

# Hapus UMD dari platform-app/public/plugins/ dan manifest
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
    Remove bundle   : platform-app/public/plugins/plugin-hr.umd.cjs
    Remove manifest : /plugins/plugin-hr.umd.cjs
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

**Output web resource** mengikuti naming convention `gasi.poc.web`:

```
src/features/employees/
├── components/
│   ├── EmployeeColumns.tsx
│   └── EmployeeForm.tsx
├── hooks/
│   └── useEmployee.ts
├── pages/
│   ├── EmployeeCreatePage.tsx
│   ├── EmployeeDetailPage.tsx
│   ├── EmployeeEditPage.tsx
│   └── EmployeeListPage.tsx
├── schemas/
│   ├── employeeCreateSchema.ts
│   └── employeeUpdateSchema.ts
├── services/
│   └── employeeService.ts
├── types/
│   └── employee.types.ts
└── routes.tsx
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
  "mode": "crud",
  "identifier": ["employeeNo", "fullName"],
  "basePath": "/hr/employees",
  "fields": [
    {
      "name": "employeeNo",
      "type": "String",
      "required": true,
      "dto": { "summary": true, "detail": true, "create": true, "update": true },
      "filterable": true,
      "ui": {
        "table": {
          "searchable": true
        }
      }
    },
    {
      "name": "fullName",
      "type": "String",
      "required": true,
      "dto": { "summary": true, "detail": true, "create": true, "update": true },
      "filterable": true,
      "ui": {
        "table": {
          "searchable": true
        }
      }
    },
    { "name": "email",      "type": "String",  "required": false, "dto": { "summary": false,"detail": true, "create": true, "update": true }, "validation": { "email": true } },
    {
      "name": "joinDate",
      "type": "Date",
      "required": false,
      "dto": { "summary": true, "detail": true, "create": true, "update": true },
      "filterable": true,
      "ui": {
        "table": {
          "filter": {
            "enabled": true,
            "placement": "popover",
            "type": "date-range"
          }
        }
      }
    },
    {
      "name": "isActive",
      "type": "Boolean",
      "required": true,
      "dto": { "summary": true, "detail": true, "create": true, "update": true },
      "filterable": true,
      "ui": {
        "table": {
          "filter": {
            "enabled": true,
            "placement": "toolbar"
          }
        }
      }
    }
  ]
}
```

**Tipe field:** `String`, `Integer`, `Long`, `BigDecimal`, `Double`, `Boolean`, `Date`, `DateTime`, `Instant`, `ManyToOne`, `Enum`

`mode` bersifat opsional dan default-nya `crud`.

- `mode: "crud"`: generator API memakai base write+read (`BaseService`/`BaseServiceImpl`/`BaseController`). Generator web membuat list, detail, create, edit, form, schema, tombol add/edit/delete, dan bulk action sesuai permission.
- `mode: "read"`: generator API memakai read-only base (`BaseReadService`/`BaseReadServiceImpl`/`BaseReadController`). Generator web hanya membuat list dan detail. List tetap punya search/filter/sort/pagination/export dan row action view/detail, tetapi tidak membuat tombol add, edit, delete, bulk delete, upload, create page, edit page, form, atau schema create/update.

Contoh read-only resource:

```json
{
  "entityName": "AuditLog",
  "mode": "read",
  "identifier": ["eventType", "actor"],
  "fields": [
    { "name": "eventType", "type": "String", "required": true, "filterable": true },
    { "name": "actor", "type": "String", "required": false, "filterable": true },
    { "name": "resourceName", "type": "String", "required": true, "filterable": true },
    { "name": "createdAt", "type": "Instant", "required": true, "filterable": true }
  ]
}
```

`identifier` bersifat opsional dan dipakai web generator untuk mengganti segment ID di breadcrumb detail/edit. Bisa string tunggal atau array field, misalnya `"identifier": "code"` atau `"identifier": ["code", "name"]`. Field yang dipakai harus ikut di DTO detail.

### Field metadata

`filterable` adalah capability API/backend. Field dengan `filterable: true` akan disiapkan agar boleh dipakai dalam request filter backend. Jangan pakai `filterable` sebagai satu-satunya instruksi tampilan datatable.

Untuk tampilan web, gunakan block kecil `ui.table`. Konfigurasi global search sebaiknya diletakkan di level resource:

```json
{
  "entityName": "Employee",
  "ui": {
    "table": {
      "searchFields": ["employeeNo", "fullName"]
    }
  },
  "fields": []
}
```

Konfigurasi filter/visibility yang spesifik field tetap diletakkan di field:

```json
{
  "name": "status",
  "type": "Enum",
  "enumName": "EmployeeStatus",
  "enumValues": ["ACTIVE", "INACTIVE"],
  "filterable": true,
  "defaultColumn": true,
  "ui": {
    "table": {
      "filter": {
        "enabled": true,
        "placement": "toolbar",
        "type": "select",
        "options": [
          { "label": "Active", "value": "ACTIVE" },
          { "label": "Inactive", "value": "INACTIVE" }
        ]
      }
    }
  }
}
```

Untuk target API, setiap `Enum` otomatis dibuatkan class Java di package `domain.model`, misalnya
`src/main/java/.../domain/model/EmployeeStatus.java`. Nilai enum bisa ditulis lewat
`enumValues` atau `values`; jika kosong, CLI tetap membuat file enum kosong yang bisa dilengkapi manual.

Supported `ui.table` properties:

| Property | Keterangan |
|---|---|
| `searchFields` | Daftar field untuk global search datatable di level resource. |
| `searchable` | Field masuk global search datatable. Cocok untuk override field-specific jika tidak memakai `resource.ui.table.searchFields`. |
| `visibleByDefault` | Override kolom default visible di table. Jika tidak ada, generator fallback ke `defaultColumn`. |
| `filter.enabled` | Field ditampilkan sebagai filter UI datatable. |
| `filter.placement` | `"toolbar"` untuk inline kiri dekat search, `"popover"` untuk tombol Filter kanan. |
| `filter.type` | Optional: `"text"`, `"select"`, `"multi-select"`, `"date"`, atau `"date-range"`. Jika tidak ada, generator infer dari tipe field. |
| `filter.options` | Optional untuk select/multi-select. Boolean filter otomatis punya opsi all/yes/no. |

Fallback lama tetap didukung:

- Jika tidak ada `ui.table.searchable` sama sekali pada satu resource, `filterable: true` pada `String`, `Text`, dan `MediumText` masih masuk global `searchFields`.
- Jika tidak ada `ui.table.filter.enabled` sama sekali pada satu resource, non-string `filterable: true` masih memakai jalur advanced/more filter lama.
- Jika resource sudah mulai memakai `ui.table.filter.enabled`, generator menganggap filter UI resource itu explicit dan hanya field yang diberi `ui.table.filter.enabled: true` yang muncul di datatable filters.

Untuk resource yang bisa dipilih lewat lookup picker, gunakan `ui.lookup` di level resource. Ini menjadi default cara entity tersebut tampil di semua picker:

```json
{
  "entityName": "Department",
  "ui": {
    "lookup": {
      "labelFields": ["code", "name"],
      "searchFields": ["code", "name"],
      "columns": [
        { "field": "code", "label": "Code" },
        { "field": "name", "label": "Name" }
      ]
    }
  },
  "fields": []
}
```

Supported `ui.lookup` properties:

| Property | Keterangan |
|---|---|
| `labelFields` | Field referensi yang digabung sebagai label di trigger form setelah dipilih. |
| `searchFields` | Field referensi yang dikirim ke lookup search. |
| `descriptionFields` | Optional, field referensi yang tampil sebagai deskripsi pada mode lookup satu kolom. |
| `columns` | Kolom yang tampil di modal lookup. Bisa array string atau object `{ "field": "...", "label": "..." }`. |

Field relasi `ManyToOne` cukup mengarah ke resource target:

```json
{
  "name": "department",
  "type": "ManyToOne",
  "refEntity": "Department",
  "required": true,
  "filterable": true
}
```

`ui.lookup` di field relasi masih boleh dipakai sebagai override khusus jika picker tertentu harus berbeda dari default resource.

Contoh pola datatable yang disarankan:

```json
{
  "name": "name",
  "type": "String",
  "filterable": true,
  "ui": {
    "table": {
      "searchable": true
    }
  }
}
```

```json
{
  "name": "active",
  "type": "Boolean",
  "filterable": true,
  "ui": {
    "table": {
      "filter": {
        "enabled": true,
        "placement": "toolbar"
      }
    }
  }
}
```

```json
{
  "name": "createdAt",
  "type": "Instant",
  "filterable": true,
  "ui": {
    "table": {
      "filter": {
        "enabled": true,
        "placement": "popover",
        "type": "date-range"
      }
    }
  }
}
```

Resource child bisa menambahkan `parent` tanpa mendefinisikan field parent secara manual. CLI otomatis menambahkan relasi `ManyToOne` dengan nama field lower-camel dari parent, misalnya `parent: "Employee"` menjadi field domain `employee` dan DTO field `employeeId`.

```json
{
  "entityName": "Department",
  "parent": "Employee",
  "apiStyle": "root",
  "embedInParentDto": false,
  "exposeApi": true,
  "fields": [
    { "name": "name", "type": "String" }
  ]
}
```

Default saat `parent` diisi:

- `apiStyle`: `nested`
- `embedInParentDto`: `false`
- `exposeApi`: `true`

Gunakan `apiStyle: "root"` kalau parent id dikirim dari DTO child, misalnya `employeeId`. Untuk web generator, mode ini membuat input lookup parent di form child dan service FE memakai `/api/v1/departments`.

Gunakan `apiStyle: "nested"` kalau parent id berasal dari URL. Untuk web generator, route dan axios service akan mengikuti parent path, misalnya `/employees/:employeeId/departments` dan `/api/v1/employees/${employeeId}/departments`.

Gunakan `embedInParentDto: true` kalau child kecil perlu ikut masuk ke DTO parent dan disubmit bareng parent. Untuk API generator, mode ini menambahkan field child ke `ParentCreateRequest`, `ParentUpdateRequest`, `ParentDetailResponse`, mapper, dan service parent. Untuk web generator, mode ini menambahkan inline editable table di form parent memakai `FormArrayTable`.

Contoh embedded child:

```json
{
  "entityName": "EmployeeEmergencyContact",
  "parent": "Employee",
  "as": "emergencyContacts",
  "embedInParentDto": true,
  "exposeApi": false,
  "fields": [
    { "name": "name", "type": "String", "required": true },
    { "name": "relationship", "type": "Enum", "enumName": "EmergencyContactRelationship", "required": true },
    { "name": "department", "type": "ManyToOne", "refEntity": "Department", "required": true },
    { "name": "phone", "type": "String", "required": true }
  ]
}
```

Hasil form parent:

```tsx
<FormArrayTable
  form={form}
  name="emergencyContacts"
  title="Employee Emergency Contacts"
  addLabel="Add Employee Emergency Contact"
  createRow={() => ({ name: "", relationship: "", departmentId: "", phone: "" })}
  columns={[
    { name: "name", header: "Name", type: "text" },
    { name: "relationship", header: "Relationship", type: "select", options: [] },
    { name: "departmentId", header: "Department", type: "lookup", options: [] },
    { name: "phone", header: "Phone", type: "text" }
  ]}
/>
```

Rekomendasi pemakaian:

- `apiStyle: "root"`: child bisa dikelola dari menu/list sendiri, parent dipilih lewat lookup.
- `apiStyle: "nested"`: child punya page sendiri di bawah parent dan tampil sebagai tab table di detail/edit parent.
- `embedInParentDto: true`: child diedit inline di form parent dan ikut submit di payload parent.
