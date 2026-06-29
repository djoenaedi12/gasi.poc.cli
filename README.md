# GASI CLI

GASI CLI adalah toolkit developer untuk membantu membuat, membangun, dan memasang plugin pada aplikasi GASI. CLI ini menghasilkan struktur backend Spring Boot + PF4J dan frontend React + Vite dari file definisi JSON, lalu membantu proses build, deploy, clean, dan delete agar pekerjaan berulang bisa dilakukan dengan cara yang konsisten.

README ini ditujukan untuk developer baru yang ingin memahami alur kerja project dan mulai membuat plugin atau resource sendiri.

## Daftar Isi

- [Kapan Menggunakan CLI Ini](#kapan-menggunakan-cli-ini)
- [Prasyarat](#prasyarat)
- [Struktur Project](#struktur-project)
- [Instalasi Lokal](#instalasi-lokal)
- [Konsep Utama](#konsep-utama)
- [Alur Kerja Cepat](#alur-kerja-cepat)
- [Plugin Definition](#plugin-definition)
- [Resource Definition](#resource-definition)
- [Command Reference](#command-reference)
- [Uploader Generator](#uploader-generator)
- [Tips Aman Saat Generate](#tips-aman-saat-generate)
- [Troubleshooting](#troubleshooting)

## Kapan Menggunakan CLI Ini

Gunakan GASI CLI saat ingin:

- membuat skeleton plugin API atau web dari definisi JSON;
- menambahkan resource CRUD atau read-only ke plugin;
- membuat halaman list, detail, create, edit, service, schema, lookup, dan i18n untuk web resource;
- membuat class, DTO, mapper, repository, service, controller, migration, dan hook untuk API resource;
- build plugin API atau web;
- deploy plugin hasil build ke aplikasi platform;
- menghapus plugin atau resource yang pernah digenerate.

CLI ini cocok dipakai dari root project aplikasi, bukan dari folder CLI-nya, karena sebagian besar command membaca struktur `pom.xml`, `plugins/`, dan `platform-app/`.

## Prasyarat

Pastikan environment lokal memiliki:

- Node.js 18 atau lebih baru;
- npm;
- Java dan Maven untuk build plugin API;
- akses ke root project GASI yang berisi `pom.xml`, `plugins/`, dan `platform-app/`;
- dependency frontend sudah siap jika ingin build atau deploy plugin web.

## Struktur Project

Gambaran struktur yang umum dipakai:

```text
gasi-workspace/
├── gasi-api/
│   ├── pom.xml
│   ├── plugins/
│   └── platform-app/
│       └── plugins/
├── gasi-web/
│   ├── platform-app/
│   │   └── public/
│   │       └── plugins/
│   │           └── manifest.json
│   └── plugins/
└── gasi-cli/
    ├── bin/gasi.js
    ├── lib/
    └── templates/
```

Catatan:

- Untuk target `api`, CLI bekerja pada project Maven dan folder `plugins/<nama>-plugin`.
- Untuk target `web`, CLI bekerja pada workspace npm dan folder `plugins/<nama>-plugin`.
- Deploy web akan menyalin bundle ke `platform-app/public/plugins/` dan memperbarui `platform-app/public/plugins/manifest.json`.
- Deploy API akan menyalin JAR ke `platform-app/plugins/`.

## Instalasi Lokal

Dari folder `gasi-cli`:

```bash
npm install
```

Jalankan langsung:

```bash
node bin/gasi.js --help
```

Atau daftarkan command `gasi` secara lokal:

```bash
npm link
gasi --help
```

Jika tidak ingin memakai `npm link`, semua contoh command bisa diganti menjadi:

```bash
node /path/to/gasi-cli/bin/gasi.js <command>
```

## Konsep Utama

### Target

Banyak command menerima `--target`:

| Target | Fungsi |
| --- | --- |
| `api` | Generate, build, deploy, clean, atau delete bagian backend Spring Boot + PF4J. |
| `web` | Generate, build, deploy, clean, atau delete bagian frontend React + Vite. |
| `all` | Menjalankan operasi API dan web sekaligus. Hanya tersedia pada command lifecycle seperti build, deploy, clean, dan delete. |

### Plugin

Plugin adalah modul fitur yang bisa memiliki bagian API dan/atau web. Plugin dibuat dari file definisi JSON menggunakan command `plugin sync`.

Contoh module hasil generate:

```text
plugins/hr-plugin/
├── pom.xml                         # API plugin
├── src/main/java/...               # API source
├── src/main/resources/...          # plugin.properties, migration, i18n
├── package.json                    # web plugin
├── vite.config.ts
└── src/features/hr/routes.tsx
```

Isi folder tergantung target yang digenerate.

### Resource

Resource adalah entity atau layar data di dalam plugin. Dari satu resource definition, CLI dapat membuat:

- API: entity, DTO, mapper, repository, service, controller, migration, dan hook;
- Web: route, page, form, columns, service, hooks, schemas, lookup, types, dan i18n.

Resource bisa dibuat sebagai:

- `crud`: memiliki create, read, update, delete;
- `read`: hanya untuk data yang dibaca atau dikelola dari tempat lain.

### Manifest Generated

Command resource menyimpan catatan file generated agar operasi berikutnya dapat mengenali file yang sudah pernah dibuat. Ini membantu command `plan`, `sync`, dan `delete` bekerja lebih aman.

## Alur Kerja Cepat

Contoh membuat plugin `hr` dengan API dan web.

### 1. Buat file plugin definition

Simpan sebagai `hr-plugin.json` di root project target:

```json
{
  "name": "hr",
  "version": "1.0.0",
  "description": "Human resource plugin",
  "api": {
    "domain": "hr",
    "package": "gasi.gps",
    "pluginPrefix": "hr",
    "dependsOn": [],
    "flyway": true,
    "register": true
  },
  "web": {
    "displayName": "HR"
  }
}
```

### 2. Validasi plugin definition

```bash
gasi plugin validate --target api -f hr-plugin.json
gasi plugin validate --target web -f hr-plugin.json
```

### 3. Lihat rencana generate

```bash
gasi plugin plan --target api -f hr-plugin.json
gasi plugin plan --target web -f hr-plugin.json
```

### 4. Generate plugin

```bash
gasi plugin sync --target api -f hr-plugin.json
gasi plugin sync --target web -f hr-plugin.json
```

### 5. Buat resource definition

Simpan sebagai `department-resource.json`:

```json
{
  "entityName": "Department",
  "mode": "crud",
  "identifier": ["code", "name"],
  "ui": {
    "table": {
      "searchFields": ["code", "name"],
      "filters": [
        { "field": "code", "type": "text", "placement": "toolbar" },
        { "field": "name", "type": "text", "placement": "toolbar" }
      ]
    },
    "lookup": {
      "labelFields": ["code", "name"],
      "searchFields": ["code", "name"],
      "columns": [
        { "field": "code", "label": "Code" },
        { "field": "name", "label": "Name" }
      ]
    }
  },
  "fields": [
    {
      "name": "code",
      "type": "String",
      "length": 50,
      "required": true,
      "unique": true,
      "filterable": true,
      "validation": {
        "minLength": 2,
        "maxLength": 50,
        "pattern": "^[A-Z0-9-]+$",
        "patternMessage": "Code must contain uppercase letters, numbers, or dash only"
      },
      "defaultColumn": true
    },
    {
      "name": "name",
      "type": "String",
      "length": 150,
      "required": true,
      "filterable": true,
      "validation": {
        "minLength": 3,
        "maxLength": 150
      },
      "defaultColumn": true
    },
    {
      "name": "description",
      "type": "Text",
      "required": false,
      "dto": {
        "create": true,
        "update": true,
        "summary": false,
        "detail": true
      },
      "validation": {
        "maxLength": 1000
      }
    }
  ]
}
```

### 6. Generate resource ke plugin

```bash
gasi resource validate -f department-resource.json

gasi resource plan \
  --target api \
  --plugin plugins/hr-plugin \
  -f department-resource.json

gasi resource sync \
  --target api \
  --plugin plugins/hr-plugin \
  -f department-resource.json

gasi resource sync \
  --target web \
  --plugin plugins/hr-plugin \
  -f department-resource.json
```

### 7. Build dan deploy plugin

```bash
gasi plugin build hr --target all --skip-tests
gasi plugin deploy hr --target all
```

Setelah deploy web, cek `platform-app/public/plugins/manifest.json`. Bundle plugin harus terdaftar di sana.

## Plugin Definition

Minimal:

```json
{
  "name": "hr",
  "version": "1.0.0",
  "description": "Human resource plugin"
}
```

Dengan konfigurasi lengkap:

```json
{
  "name": "hr",
  "version": "1.0.0",
  "description": "Human resource plugin",
  "api": {
    "domain": "hr",
    "package": "gasi.gps",
    "pluginPrefix": "hr",
    "dependsOn": ["master-data-plugin"],
    "flyway": true,
    "register": true
  },
  "web": {
    "displayName": "HR"
  }
}
```

Field penting:

| Field | Keterangan |
| --- | --- |
| `name` | Nama plugin. Dipakai untuk folder, artifact, dan identifier. |
| `version` | Versi plugin. Default `1.0.0` jika kosong. |
| `description` | Deskripsi plugin. |
| `api.domain` | Nama domain Java. Default dari `name` tanpa dash. |
| `api.package` | Base package Java. Default `gasi.gps`. |
| `api.pluginPrefix` | Prefix plugin untuk naming API. Default sama dengan `name`. |
| `api.dependsOn` | Daftar dependency plugin PF4J. |
| `api.flyway` | Generate konfigurasi Flyway. Default `true`. |
| `api.register` | Register module ke parent `pom.xml`. Default `true`. |
| `web.displayName` | Nama tampil plugin di UI. |

## Resource Definition

Resource definition bisa berupa satu object, array, atau object dengan property `resources`.

Satu resource:

```json
{
  "entityName": "Employee",
  "mode": "crud",
  "fields": [
    { "name": "employeeNo", "type": "String", "length": 50, "required": true, "unique": true },
    { "name": "fullName", "type": "String", "length": 150, "required": true },
    { "name": "email", "type": "String", "length": 150, "required": false, "validation": { "email": true } }
  ]
}
```

Banyak resource dalam satu file:

```json
{
  "resources": [
    {
      "entityName": "Department",
      "mode": "crud",
      "fields": [
        { "name": "code", "type": "String", "length": 50, "required": true, "unique": true },
        { "name": "name", "type": "String", "length": 150, "required": true }
      ]
    },
    {
      "entityName": "JobTitle",
      "mode": "read",
      "fields": [
        { "name": "code", "type": "String", "length": 50, "required": true, "unique": true },
        { "name": "name", "type": "String", "length": 150, "required": true }
      ]
    }
  ]
}
```

### Field Resource

| Field | Keterangan |
| --- | --- |
| `entityName` | Nama entity dalam PascalCase, contoh `Employee`. |
| `mode` | `crud` atau `read`. Default `crud`. |
| `parent` | Parent entity untuk nested resource, contoh `Employee`. |
| `apiStyle` | `root` atau `nested`. Default `nested` jika ada `parent`, selain itu `root`. |
| `embedInParentDto` | Menentukan apakah resource ikut ditanam ke DTO parent. Default `false`. |
| `as` | Nama property saat resource dipakai sebagai child. |
| `exposeApi` | Menentukan apakah endpoint API dibuat. Default `true`. |
| `identifier` | Field yang dipakai sebagai label identitas data. Default mencoba `name` dan `code`. |
| `ui` | Konfigurasi table dan lookup untuk frontend. |
| `fields` | Daftar field entity. Wajib diisi. |

### Tipe Field

Tipe yang didukung:

| Type | Catatan |
| --- | --- |
| `String` | Mendukung `length`; default `255`. |
| `Text` | Untuk text panjang. |
| `MediumText` | Untuk text lebih panjang. |
| `Integer` | Bilangan bulat. |
| `Long` | Bilangan bulat besar. |
| `BigDecimal` | Angka decimal presisi. |
| `Double` | Angka decimal floating-point. |
| `Boolean` | Nilai true/false. |
| `Date` | Tanggal. |
| `DateTime` | Tanggal dan jam. |
| `Instant` | Timestamp. |
| `Enum` | Wajib isi `enumName`; bisa isi `enumValues`. |
| `ManyToOne` | Wajib isi `refEntity`. |

Contoh `Enum`:

```json
{
  "name": "status",
  "type": "Enum",
  "enumName": "EmployeeStatus",
  "enumValues": ["ACTIVE", "INACTIVE"],
  "required": true
}
```

Contoh `ManyToOne`:

```json
{
  "name": "department",
  "type": "ManyToOne",
  "refEntity": "Department",
  "required": true
}
```

### Konfigurasi Field

| Field | Keterangan |
| --- | --- |
| `name` | Nama field dalam camelCase. |
| `type` | Salah satu tipe field yang didukung. |
| `required` | Default `true`. |
| `unique` | Didukung untuk `String`, `Integer`, dan `Long`. Default `false`. |
| `filterable` | Menandai field dapat difilter. Default `false`. |
| `defaultColumn` | Menentukan apakah field muncul sebagai default column. Default `true`. |
| `dto` | Kontrol field masuk DTO `create`, `update`, `summary`, dan `detail`. |
| `description` | Deskripsi field. |
| `tooltip` | Bantuan singkat untuk UI. |
| `validation` | Aturan validasi berdasarkan tipe field. |
| `ui` | Konfigurasi UI khusus untuk field. |

Contoh `dto`:

```json
{
  "name": "internalNote",
  "type": "Text",
  "required": false,
  "dto": {
    "create": true,
    "update": true,
    "summary": false,
    "detail": true
  }
}
```

### Validasi

Validasi yang didukung mengikuti tipe field.

| Type | Validation |
| --- | --- |
| `String`, `Text`, `MediumText` | `email`, `minLength`, `maxLength`, `pattern`, `patternMessage` |
| `Integer`, `Long` | `min`, `max`, `positive`, `positiveOrZero`, `negative`, `negativeOrZero` |
| `BigDecimal`, `Double` | `decimalMin`, `decimalMax`, `digits`, `positive`, `positiveOrZero`, `negative`, `negativeOrZero` |
| `Date`, `DateTime`, `Instant` | `past`, `pastOrPresent`, `future`, `futureOrPresent` |
| `Boolean` | `assertTrue`, `assertFalse` |

Contoh decimal:

```json
{
  "name": "salary",
  "type": "BigDecimal",
  "required": true,
  "validation": {
    "decimalMin": "0",
    "digits": {
      "integer": 15,
      "fraction": 2
    }
  }
}
```

### UI Table dan Lookup

Contoh konfigurasi table:

```json
{
  "ui": {
    "table": {
      "searchFields": ["employeeNo", "fullName", "email"],
      "defaultColumns": ["employeeNo", "fullName", "email"],
      "filters": [
        { "field": "employeeNo", "type": "text", "placement": "toolbar" },
        { "field": "active", "type": "toggle", "placement": "toolbar" }
      ]
    }
  }
}
```

Tipe filter yang didukung:

- `text`
- `select`
- `multi-select`
- `date`
- `date-range`
- `lookup`
- `boolean`
- `toggle`

Contoh lookup:

```json
{
  "ui": {
    "lookup": {
      "labelFields": ["code", "name"],
      "searchFields": ["code", "name"],
      "descriptionFields": ["description"],
      "columns": [
        { "field": "code", "label": "Code" },
        { "field": "name", "label": "Name" }
      ]
    }
  }
}
```

## Command Reference

### Global

```bash
gasi --help
gasi --version
```

Sebagian besar command menerima:

| Flag | Keterangan |
| --- | --- |
| `--cwd <path>` | Root project target. Default adalah current working directory. |

### Plugin Commands

#### `plugin validate`

Validasi file plugin definition tanpa membuat file.

```bash
gasi plugin validate --target api -f hr-plugin.json
gasi plugin validate --target web -f hr-plugin.json
```

| Flag | Keterangan |
| --- | --- |
| `--target <target>` | Wajib. `api` atau `web`. |
| `-f, --file <file>` | Wajib. File plugin definition JSON. |
| `--cwd <path>` | Root project target. |

#### `plugin plan`

Menampilkan rencana generate plugin.

```bash
gasi plugin plan --target api -f hr-plugin.json
gasi plugin plan --target web -f hr-plugin.json
```

#### `plugin sync`

Generate skeleton plugin dari JSON.

```bash
gasi plugin sync --target api -f hr-plugin.json
gasi plugin sync --target web -f hr-plugin.json
```

Jika folder atau file sudah ada dan tidak perlu diubah, command akan menandainya sebagai unchanged.

#### `plugin list`

Menampilkan plugin module yang terdaftar di parent `pom.xml`.

```bash
gasi plugin list
```

#### `plugin build <name>`

Build plugin API, web, atau keduanya.

```bash
gasi plugin build hr --target api
gasi plugin build hr --target web
gasi plugin build hr --target all
gasi plugin build hr --target all --skip-tests
gasi plugin build hr --target all --dry-run
```

| Flag | Keterangan |
| --- | --- |
| `-t, --target <target>` | `api`, `web`, atau `all`. Default `api`. |
| `--skip-tests` | Skip test Maven untuk target API. |
| `--profile <name>` | Mengaktifkan Maven profile. |
| `--verbose` | Menampilkan output Maven lengkap. |
| `--dry-run` | Menampilkan command tanpa menjalankan. |
| `--cwd <path>` | Root project target. |

#### `plugin deploy <name>`

Deploy plugin hasil build ke platform.

```bash
gasi plugin deploy hr --target api
gasi plugin deploy hr --target web
gasi plugin deploy hr --target all
gasi plugin deploy hr --target all --dry-run
```

| Flag | Keterangan |
| --- | --- |
| `-t, --target <target>` | `api`, `web`, atau `all`. Default `api`. |
| `--plugins-dir <path>` | Override folder deployment plugin. |
| `--keep-old` | Menyimpan JAR lama saat deploy API. |
| `--dry-run` | Menampilkan aksi deploy tanpa mengubah file. |
| `--cwd <path>` | Root project target. |

Hasil deploy:

- API: JAR disalin ke `platform-app/plugins/`.
- Web: bundle disalin ke `platform-app/public/plugins/` dan manifest diperbarui.

#### `plugin clean <name>`

Menghapus file plugin yang sudah dideploy, tanpa menghapus source plugin.

```bash
gasi plugin clean hr --target api
gasi plugin clean hr --target web
gasi plugin clean hr --target all
gasi plugin clean hr --target all --dry-run
```

#### `plugin delete <name>`

Menghapus source plugin dan file deployed.

```bash
gasi plugin delete hr --target api
gasi plugin delete hr --target web
gasi plugin delete hr --target all
gasi plugin delete hr --target all -y
gasi plugin delete hr --target all --keep-deployed
gasi plugin delete hr --target all --dry-run
```

| Flag | Keterangan |
| --- | --- |
| `-t, --target <target>` | `api`, `web`, atau `all`. Default `api`. |
| `--plugins-dir <path>` | Override folder deployment plugin. |
| `--keep-deployed` | Tidak menghapus file deployed. |
| `--dry-run` | Menampilkan rencana hapus tanpa menjalankan. |
| `-y, --yes` | Skip konfirmasi. |
| `--cwd <path>` | Root project target. |

### Resource Commands

#### `resource validate`

Validasi satu atau banyak file resource definition.

```bash
gasi resource validate -f department-resource.json
gasi resource validate -f department-resource.json -f employee-resource.json
```

#### `resource plan`

Membandingkan resource definition dengan manifest generated di plugin target.

```bash
gasi resource plan \
  --target api \
  --plugin plugins/hr-plugin \
  -f department-resource.json
```

| Flag | Keterangan |
| --- | --- |
| `--target <target>` | Wajib. `api` atau `web`. |
| `--plugin <module>` | Wajib. Module plugin target, contoh `plugins/hr-plugin`. |
| `-f, --file <file>` | File resource definition JSON. Bisa diulang. |
| `--cwd <path>` | Root project target. |

#### `resource sync`

Generate atau update resource dari definition.

```bash
gasi resource sync \
  --target api \
  --plugin plugins/hr-plugin \
  -f department-resource.json

gasi resource sync \
  --target web \
  --plugin plugins/hr-plugin \
  -f department-resource.json
```

#### `resource delete <entityName>`

Menghapus file generated untuk resource tertentu berdasarkan manifest.

```bash
gasi resource delete Department \
  --target api \
  --plugin plugins/hr-plugin

gasi resource delete Department \
  --target web \
  --plugin plugins/hr-plugin \
  -y
```

## Uploader Generator

Command uploader membuat class `DataUplProcessor` di plugin API yang sudah ada dan menambahkan dependency upload yang diperlukan.

```bash
gasi uploader create Employee --plugin hr --resource employee -y
```

Jika command dijalankan dari dalam folder plugin, CLI dapat mencoba mendeteksi plugin target secara otomatis.

| Flag | Keterangan |
| --- | --- |
| `--plugin <name>` | Nama plugin target, contoh `hr` atau `plugins/hr-plugin`. |
| `--resource <name>` | Nama resource upload API, contoh `employee`. |
| `-y, --yes` | Skip konfirmasi. |
| `--cwd <path>` | Root project target. |

Setelah generate, review bagian parsing, validasi row, dan commit data pada class processor yang dibuat.

## Tips Aman Saat Generate

- Jalankan `validate` sebelum `sync`.
- Jalankan `plan` sebelum `sync` saat bekerja di plugin yang sudah berisi banyak file.
- Gunakan `--dry-run` untuk build, deploy, clean, dan delete saat ingin melihat efek command lebih dulu.
- Commit perubahan penting sebelum menjalankan operasi delete.
- Jangan edit manual file dengan header generated kecuali memang siap menjaga perubahan tersebut saat sync berikutnya.
- Pisahkan file definition plugin dan resource agar perubahan mudah direview.

## Troubleshooting

### `Plugin definition file not found`

Pastikan path pada `-f` benar relatif terhadap `--cwd` atau current working directory.

### `Invalid --target`

Gunakan `api` atau `web` untuk command generate. Gunakan `all` hanya pada command lifecycle seperti `build`, `deploy`, `clean`, dan `delete`.

### `No plugin modules found in the parent pom.xml`

Jalankan command dari root project API yang memiliki parent `pom.xml`, atau isi `--cwd` ke root yang benar.

### Build API gagal

Coba jalankan dengan output lengkap:

```bash
gasi plugin build hr --target api --verbose
```

Periksa dependency Maven, Java version, dan apakah module plugin terdaftar di parent `pom.xml`.

### Build web gagal

Pastikan dependency npm sudah terinstall di workspace target, lalu cek apakah plugin web ada di `plugins/<name>-plugin`.

```bash
npm install
gasi plugin build hr --target web
```

### Bundle web tidak muncul di aplikasi

Periksa:

- file bundle ada di `platform-app/public/plugins/`;
- `platform-app/public/plugins/manifest.json` berisi URL bundle;
- nama bundle sesuai hasil build;
- browser tidak memakai cache lama.

### Perlu melihat stack trace

Set environment variable `GASI_DEBUG`:

```bash
GASI_DEBUG=1 gasi resource sync --target api --plugin plugins/hr-plugin -f department-resource.json
```

## Script Development

Dari folder `gasi-cli`:

```bash
npm run start -- --help
npm run check:resource-idempotency
```

`check:resource-idempotency` membantu memastikan generator resource tetap stabil saat dijalankan ulang.
