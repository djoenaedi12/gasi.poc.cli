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

**Opsi:**

| Flag | Keterangan |
|---|---|
| `-n, --name <name>` | Nama plugin (contoh: `hr`) |
| `-t, --target <target>` | Target: `api`, `web`, atau `all` (default: `all`) |
| `--plugin-prefix <prefix>` | Prefix tabel plugin (API only) |
| `-d, --domain <domain>` | Nama package domain Java (API only) |
| `-p, --package <package>` | Base package (API only, default: `gasi.gps`) |
| `-v, --plugin-version <version>` | Versi plugin (default: `1.0.0`) |
| `--description <desc>` | Deskripsi plugin |
| `--depends-on <dep>` | Dependensi plugin lain (API only, bisa diulang) |
| `--no-flyway` | Skip sample Flyway migration (API only) |
| `--no-register` | Skip auto-register di parent `pom.xml` (API only) |
| `-y, --yes` | Skip prompt interaktif, gunakan default |
| `--cwd <path>` | Root project directory (default: cwd) |

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

**Opsi:**

| Flag | Keterangan |
|---|---|
| `-t, --target <target>` | Target: `api`, `web`, atau `all` (default: `api`) |
| `--skip-tests` | Skip tests saat Maven build (API only) |
| `--profile <name>` | Maven profile yang diaktifkan (API only) |
| `--verbose` | Tampilkan full Maven output (API only) |
| `--dry-run` | Print command tanpa menjalankan |
| `--cwd <path>` | Root project directory (default: cwd) |

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

**Opsi:**

| Flag | Keterangan |
|---|---|
| `-t, --target <target>` | Target: `api`, `web`, atau `all` (default: `api`) |
| `--plugins-dir <path>` | Override direktori deployment plugin |
| `--keep-old` | Simpan JAR lama yang sudah dideploy (API only) |
| `--keep-deployed` | Skip hapus file deployed saat delete |
| `--dry-run` | Print aksi deploy tanpa mengubah file |
| `--cwd <path>` | Root project directory (default: cwd) |

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

**Opsi:**

| Flag | Keterangan |
|---|---|
| `-t, --target <target>` | Target: `api`, `web`, atau `all` (default: `api`) |
| `--plugins-dir <path>` | Override direktori deployment plugin |
| `--dry-run` | Print aksi clean tanpa mengubah file |
| `--cwd <path>` | Root project directory (default: cwd) |

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

**Opsi:**

| Flag | Keterangan |
|---|---|
| `-t, --target <target>` | Target: `api`, `web`, atau `all` (default: `api`) |
| `--plugins-dir <path>` | Override direktori deployment plugin |
| `--keep-deployed` | Simpan file deployed saat hapus folder plugin |
| `--dry-run` | Print rencana hapus tanpa mengeksekusi |
| `-y, --yes` | Skip konfirmasi |
| `--cwd <path>` | Root project directory (default: cwd) |

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

**Opsi:**

| Flag | Keterangan |
|---|---|
| `--cwd <path>` | Root project directory (default: cwd) |

---

### `gasi resource create`

Generate full CRUD resource di dalam plugin yang sudah ada.

```bash
# API resource (interactive)
gasi resource create Employee --cwd plugins/hr-plugin

# Web resource di dalam plugin
gasi resource create Employee --target web --web-dir plugins/hr-plugin

# API + Web sekaligus dari file definisi
gasi resource create --target all --web-dir plugins/hr-plugin -f resource.json

# Multiple file sekaligus
gasi resource create --target api -f employee.json -f department.json

# Overwrite file web yang sudah ada
gasi resource create --target web --web-dir plugins/hr-plugin -f resource.json --web-force
```

**Opsi:**

| Flag | Keterangan |
|---|---|
| `--target <target>` | Target: `api`, `web`, atau `all` (default: `api`) |
| `--web-dir <path>` | Root frontend plugin untuk `--target web/all` |
| `--web-force` | Overwrite file web yang sudah digenerate |
| `-f, --file <file>` | File definisi resource (JSON). Bisa diulang untuk multi-file. |
| `-y, --yes` | Skip konfirmasi |
| `--cwd <path>` | Root project directory (default: cwd) |

**Output web resource** mengikuti naming convention `gasi.poc.web`:

```
src/features/employees/
├── components/
│   ├── EmployeeColumns.tsx
│   └── EmployeeForm.tsx
├── hooks/
│   └── useEmployee.ts
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── en.ts
│       └── id.ts
├── lookups/
│   ├── employeeLookup.ts
│   └── index.ts
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

Hapus semua file resource API yang sudah di-generate.

```bash
gasi resource delete Employee

# Termasuk hapus migration SQL
gasi resource delete Employee --include-migration

# Skip konfirmasi
gasi resource delete Employee -y
```

**Opsi:**

| Flag | Keterangan |
|---|---|
| `--include-migration` | Hapus juga file Flyway migration SQL |
| `-y, --yes` | Skip konfirmasi |
| `--cwd <path>` | Root project directory (default: cwd) |

> Migration SQL tidak dihapus secara default. Gunakan `--include-migration` untuk menghapusnya.

---

### `gasi uploader create <name>`

Generate `DataUplProcessor` untuk upload data.

```bash
# Interactive (pilih plugin dari daftar)
gasi uploader create Employee

# Tentukan plugin dan resource name secara eksplisit
gasi uploader create Employee --plugin hr --resource employees
```

**Opsi:**

| Flag | Keterangan |
|---|---|
| `--plugin <name>` | Nama plugin target (contoh: `hr` atau `plugins/hr-plugin`) |
| `--resource <name>` | Nama resource upload API (contoh: `employees`) |
| `-y, --yes` | Skip konfirmasi |
| `--cwd <path>` | Root project directory (default: cwd) |

---

## Resource Definition File

```json
{
  "entityName": "Employee",
  "mode": "crud",
  "identifier": ["employeeNo", "fullName"],
  "basePath": "/hr/employees",
  "fields": [
    { "name": "employeeNo", "type": "String",  "required": true,  "filterable": true, "dto": { "summary": true, "detail": true, "create": true, "update": true } },
    { "name": "fullName",   "type": "String",  "required": true,  "filterable": true, "dto": { "summary": true, "detail": true, "create": true, "update": true } },
    { "name": "email",      "type": "String",  "required": false, "dto": { "summary": false, "detail": true, "create": true, "update": true }, "validation": { "email": true } },
    { "name": "joinDate",   "type": "Date",    "required": false, "filterable": true, "dto": { "summary": true, "detail": true, "create": true, "update": true } },
    { "name": "isActive",   "type": "Boolean", "required": true,  "filterable": true, "dto": { "summary": true, "detail": true, "create": true, "update": true } }
  ]
}
```

### Multi-resource file

File definisi bisa berisi lebih dari satu resource. Format yang didukung:

**Array langsung:**
```json
[
  { "entityName": "Employee", "fields": [...] },
  { "entityName": "Department", "fields": [...] }
]
```

**Object dengan key `resources`:**
```json
{
  "resources": [
    { "entityName": "Employee", "fields": [...] },
    { "entityName": "Department", "fields": [...] }
  ]
}
```

Semua `entityName` di dalam satu file (atau lintas beberapa `-f`) harus unik.

---

### Tipe Field

| Tipe | Java | Keterangan |
|---|---|---|
| `String` | `String` | Teks pendek, default length 255 |
| `Text` | `String` | Teks panjang (`@Lob`) |
| `MediumText` | `String` | Teks sedang (`@Column(columnDefinition = "MEDIUMTEXT")`) |
| `Integer` | `Integer` | Bilangan bulat 32-bit |
| `Long` | `Long` | Bilangan bulat 64-bit |
| `BigDecimal` | `BigDecimal` | Desimal presisi tinggi |
| `Double` | `Double` | Desimal double |
| `Boolean` | `Boolean` | True/false |
| `Date` | `LocalDate` | Tanggal |
| `DateTime` | `LocalDateTime` | Tanggal dan waktu |
| `Instant` | `Instant` | Timestamp UTC |
| `Enum` | `<EnumName>` | Enum Java, butuh `enumName` |
| `ManyToOne` | `<Entity>` | Relasi FK, butuh `refEntity` |

---

### Field Properties

| Property | Tipe | Default | Keterangan |
|---|---|---|---|
| `name` | string | — | Nama field, camelCase |
| `type` | string | — | Tipe field (lihat tabel di atas) |
| `required` | boolean | `true` | Field wajib diisi |
| `unique` | boolean | `false` | Field harus unik. Hanya untuk `String`, `Integer`, `Long`. |
| `filterable` | boolean | `false` | Field bisa dipakai sebagai filter di API backend |
| `length` | number | `255` | Panjang maksimum kolom. Hanya untuk `String`. |
| `enumName` | string | — | Nama class Enum Java. Wajib untuk `Enum`. |
| `enumValues` | string[] | — | Nilai-nilai enum (UPPER_SNAKE_CASE). Bisa juga pakai `values`. |
| `refEntity` | string | — | Nama entity referensi, PascalCase. Wajib untuk `ManyToOne`. |
| `dto` | object | semua `true` | Kontrol inklusi field di masing-masing DTO (`create`, `update`, `summary`, `detail`). |
| `defaultColumn` | boolean | `true` | Apakah kolom tampil secara default di datatable. |
| `description` | string | — | Teks deskripsi field yang ditampilkan di form. |
| `tooltip` | string | — | Teks tooltip yang muncul saat hover di form. |
| `filterable` | boolean | `false` | Kapabilitas filter API/backend. |
| `validation` | object | `{}` | Validasi field (lihat tabel validasi). |

---

### Field Validation

Blok `validation` mendukung constraint per tipe field.

**String, Text, MediumText:**

| Key | Tipe | Keterangan |
|---|---|---|
| `email` | boolean | Validasi format email |
| `minLength` | number | Panjang minimum string |
| `maxLength` | number | Panjang maksimum string (tidak boleh melebihi `length`) |
| `pattern` | string | Regex Java yang harus cocok |
| `patternMessage` | string | Pesan error custom untuk `pattern` |

**Integer, Long:**

| Key | Tipe | Keterangan |
|---|---|---|
| `min` | number | Nilai minimum |
| `max` | number | Nilai maksimum |
| `positive` | boolean | Harus > 0 |
| `positiveOrZero` | boolean | Harus >= 0 |
| `negative` | boolean | Harus < 0 |
| `negativeOrZero` | boolean | Harus <= 0 |

**BigDecimal, Double:**

| Key | Tipe | Keterangan |
|---|---|---|
| `decimalMin` | string | Nilai minimum (string desimal, misal `"0.01"`) |
| `decimalMax` | string | Nilai maksimum |
| `digits` | object | `{ "integer": N, "fraction": N }` — batas digit integer dan pecahan |
| `positive` | boolean | Harus > 0 |
| `positiveOrZero` | boolean | Harus >= 0 |
| `negative` | boolean | Harus < 0 |
| `negativeOrZero` | boolean | Harus <= 0 |

**Date, DateTime, Instant:**

| Key | Tipe | Keterangan |
|---|---|---|
| `past` | boolean | Harus di masa lalu |
| `pastOrPresent` | boolean | Harus di masa lalu atau sekarang |
| `future` | boolean | Harus di masa depan |
| `futureOrPresent` | boolean | Harus di masa depan atau sekarang |

> Hanya satu dari empat di atas yang boleh aktif sekaligus.

**Boolean:**

| Key | Tipe | Keterangan |
|---|---|---|
| `assertTrue` | boolean | Harus bernilai `true` |
| `assertFalse` | boolean | Harus bernilai `false` |

Contoh validasi:

```json
{ "name": "email", "type": "String", "validation": { "email": true, "maxLength": 100 } }
{ "name": "salary", "type": "BigDecimal", "validation": { "decimalMin": "0.00", "digits": { "integer": 10, "fraction": 2 } } }
{ "name": "age", "type": "Integer", "validation": { "min": 18, "max": 65 } }
{ "name": "birthDate", "type": "Date", "validation": { "past": true } }
```

---

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

Contoh konfigurasi `ui` di level resource:

```json
{
  "entityName": "Employee",
  "ui": {
    "table": {
      "searchFields": ["employeeNo", "fullName"],
      "filters": [
        { "field": "joinDate", "type": "date-range", "placement": "inline" },
        { "field": "isActive", "type": "boolean", "placement": "toolbar" }
      ]
    }
  },
  "fields": [
    { "name": "employeeNo", "type": "String",  "filterable": true },
    { "name": "joinDate",   "type": "Date",    "filterable": true },
    { "name": "isActive",   "type": "Boolean", "filterable": true }
  ]
}
```

Untuk target API, setiap `Enum` otomatis dibuatkan class Java di package `domain.model`, misalnya
`src/main/java/.../domain/model/EmployeeStatus.java`. Nilai enum bisa ditulis lewat
`enumValues` atau `values`; jika kosong, CLI tetap membuat file enum kosong yang bisa dilengkapi manual.

Supported `ui.table` properties:

| Property | Keterangan |
|---|---|
| `searchFields` | Daftar field untuk global search datatable. |
| `defaultColumns` | Daftar field yang tampil sebagai kolom default di datatable. |
| `filters` | Daftar filter datatable. Bisa string field atau object `{ "field": "...", "placement": "inline" }`. Placement valid: `"inline"` atau `"toolbar"`, default `"toolbar"`. |

Setiap item di dalam `filters` bisa berupa string field name atau object dengan opsi berikut:

| Key | Keterangan |
|---|---|
| `field` | Nama field yang difilter |
| `placement` | `"inline"` atau `"toolbar"` (default `"toolbar"`) |
| `type` | `"text"`, `"select"`, `"multi-select"`, `"date"`, `"date-range"`, `"lookup"`, `"boolean"`, atau `"toggle"`. Jika tidak diisi, generator infer dari tipe field (`ManyToOne` → `"lookup"`, `Boolean` → `"boolean"`). |
| `options` | Optional untuk `select`/`multi-select`. Boolean filter otomatis punya opsi all/yes/no. |

Contoh filter lookup untuk relasi `ManyToOne` (`Employee.department`):

```json
{
  "entityName": "Employee",
  "ui": {
    "table": {
      "filters": [
        { "field": "department", "type": "lookup", "placement": "inline" }
      ]
    }
  },
  "fields": [...]
}
```

Generator membuat filter ke field `departmentId`, tetapi UI-nya memakai `LookupPicker` dengan preset `departmentLookup`.

Contoh filter boolean dan toggle:

```json
{
  "ui": {
    "table": {
      "filters": [
        { "field": "active",         "type": "boolean", "placement": "toolbar" },
        { "field": "primaryAddress", "type": "toggle",  "placement": "inline" }
      ]
    }
  }
}
```

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
