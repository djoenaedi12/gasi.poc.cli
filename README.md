# GASI CLI

GASI CLI is a developer toolkit for creating, building, and deploying GASI plugins. It generates backend Spring Boot + PF4J and frontend React + Vite structures from JSON definition files, then helps with build, deploy, clean, and delete workflows.

This README is written for new developers who need to understand the project workflow and start creating plugins or resources.

## Table of Contents

- [When to Use This CLI](#when-to-use-this-cli)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Installation](#local-installation)
- [Core Concepts](#core-concepts)
- [Quick Workflow](#quick-workflow)
- [Plugin Definition](#plugin-definition)
- [Resource Definition](#resource-definition)
- [Command Reference](#command-reference)
- [Uploader Generator](#uploader-generator)
- [Safe Generation Tips](#safe-generation-tips)
- [Troubleshooting](#troubleshooting)

## When to Use This CLI

Use GASI CLI when you need to:

- create API or web plugin skeletons from JSON definitions;
- add CRUD or read-only resources to a plugin;
- generate web resource pages, forms, routes, services, schemas, lookups, types, and i18n files;
- generate API resource classes, DTOs, mappers, repositories, services, controllers, migrations, and hooks;
- build API or web plugins;
- deploy built plugins to the platform;
- remove generated plugins or resources.

The CLI is usually run from the target application root, not from the CLI folder, because most commands read `pom.xml`, `plugins/`, and `platform-app/`.

## Prerequisites

Make sure your local environment has:

- Node.js 18 or newer;
- npm;
- Java and Maven for API plugin builds;
- access to a GASI project root that contains `pom.xml`, `plugins/`, and `platform-app/`;
- installed frontend dependencies if you want to build or deploy web plugins.

## Project Structure

Typical workspace layout:

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

Notes:

- For target `api`, the CLI works with a Maven project and `plugins/<name>-plugin`.
- For target `web`, the CLI works with an npm workspace and `plugins/<name>-plugin`.
- Web deploy copies bundles to `platform-app/public/plugins/` and updates `platform-app/public/plugins/manifest.json`.
- API deploy copies JAR files to `platform-app/plugins/`.

## Local Installation

From the `gasi-cli` folder:

```bash
npm install
```

Run directly:

```bash
node bin/gasi.js --help
```

Or register the local `gasi` command:

```bash
npm link
gasi --help
```

If you do not use `npm link`, replace examples with:

```bash
node /path/to/gasi-cli/bin/gasi.js <command>
```

## Core Concepts

### Target

Many commands accept `--target`:

| Target | Purpose |
| --- | --- |
| `api` | Generate, build, deploy, clean, or delete the backend Spring Boot + PF4J side. |
| `web` | Generate, build, deploy, clean, or delete the frontend React + Vite side. |
| `all` | Run API and web lifecycle operations together. Available for commands such as build, deploy, clean, and delete. |

### Plugin

A plugin is a feature module that can have an API side, a web side, or both. Plugins are created from JSON definitions with `plugin sync`.

Example generated module:

```text
plugins/hr-plugin/
├── pom.xml
├── src/main/java/...
├── src/main/resources/...
├── package.json
├── vite.config.ts
└── src/features/hr/routes.tsx
```

The actual contents depend on the generated target.

### Resource

A resource is an entity or data screen inside a plugin. From one resource definition, the CLI can generate:

- API files: entity, DTOs, mapper, repository, service, controller, migration, and hook;
- Web files: routes, pages, form, columns, service, hooks, schemas, lookup, types, and i18n.

Resource modes:

- `crud`: create, read, update, delete;
- `read`: read-only resource.

### Generated Manifest

Resource commands keep a record of generated files so later operations can plan, sync, and delete more safely.

## Quick Workflow

Example: create an `hr` plugin with API and web targets.

### 1. Create a plugin definition

Save this as `hr-plugin.json` in the target project root:

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

### 2. Validate the plugin definition

```bash
gasi plugin validate --target api -f hr-plugin.json
gasi plugin validate --target web -f hr-plugin.json
```

### 3. Review the generation plan

```bash
gasi plugin plan --target api -f hr-plugin.json
gasi plugin plan --target web -f hr-plugin.json
```

### 4. Generate the plugin

```bash
gasi plugin sync --target api -f hr-plugin.json
gasi plugin sync --target web -f hr-plugin.json
```

### 5. Create a resource definition

Save this as `department-resource.json`:

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

### 6. Generate the resource into the plugin

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

### 7. Build and deploy the plugin

```bash
gasi plugin build hr --target all --skip-tests
gasi plugin deploy hr --target all
```

After web deploy, check `platform-app/public/plugins/manifest.json`. The plugin bundle should be listed there.

## Plugin Definition

Minimal definition:

```json
{
  "name": "hr",
  "version": "1.0.0",
  "description": "Human resource plugin"
}
```

Fuller example:

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

Important fields:

| Field | Description |
| --- | --- |
| `name` | Plugin name. Used for folder, artifact, and identifiers. |
| `version` | Plugin version. Defaults to `1.0.0`. |
| `description` | Plugin description. |
| `api.domain` | Java domain name. Defaults from `name` without dashes. |
| `api.package` | Java base package. Defaults to `gasi.gps`. |
| `api.pluginPrefix` | API naming prefix. Defaults to `name`. |
| `api.dependsOn` | PF4J plugin dependencies. |
| `api.flyway` | Generate Flyway configuration. Defaults to `true`. |
| `api.register` | Register the module in parent `pom.xml`. Defaults to `true`. |
| `web.displayName` | Display name in the UI. |

## Resource Definition

A resource definition can be a single object, an array, or an object with `resources`.

Single resource:

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

Multiple resources:

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

### Resource Fields

| Field | Description |
| --- | --- |
| `entityName` | Entity name in PascalCase, for example `Employee`. |
| `mode` | `crud` or `read`. Defaults to `crud`. |
| `parent` | Parent entity for nested resources, for example `Employee`. |
| `apiStyle` | `root` or `nested`. Defaults to `nested` when `parent` exists, otherwise `root`. |
| `embedInParentDto` | Whether the resource is embedded in the parent DTO. Defaults to `false`. |
| `as` | Property name when the resource is used as a child. |
| `exposeApi` | Whether API endpoints are generated. Defaults to `true`. |
| `identifier` | Fields used as the record label. Defaults to available `name` and `code`. |
| `ui` | Frontend screen, table, and lookup configuration. |
| `fields` | Entity field list. Required. |

### Supported Field Types

| Type | Notes |
| --- | --- |
| `String` | Supports `length`; default `255`. |
| `Text` | Long text. |
| `MediumText` | Longer text. |
| `Integer` | Integer number. |
| `Long` | Large integer number. |
| `BigDecimal` | Precise decimal. |
| `Double` | Floating-point decimal. |
| `Boolean` | True/false value. |
| `Date` | Date. |
| `DateTime` | Date and time. |
| `Instant` | Timestamp. |
| `Enum` | Requires `enumName`; can include `enumValues`. |
| `ManyToOne` | Requires `refEntity`. |

Enum example:

```json
{
  "name": "status",
  "type": "Enum",
  "enumName": "EmployeeStatus",
  "enumValues": ["ACTIVE", "INACTIVE"],
  "required": true
}
```

Many-to-one example:

```json
{
  "name": "department",
  "type": "ManyToOne",
  "refEntity": "Department",
  "required": true
}
```

### Field Configuration

| Field | Description |
| --- | --- |
| `name` | Field name in camelCase. |
| `type` | One of the supported field types. |
| `required` | Defaults to `true`. |
| `unique` | Supported for `String`, `Integer`, and `Long`. Defaults to `false`. |
| `filterable` | Marks the field as filterable. Defaults to `false`. |
| `defaultColumn` | Whether the field is shown as a default column. Defaults to `true`. |
| `dto` | Controls inclusion in `create`, `update`, `summary`, and `detail` DTOs. |
| `description` | Field description. |
| `tooltip` | Short UI helper text. |
| `validation` | Type-specific validation rules. |
| `ui` | Field-specific UI configuration. Prefer top-level `ui.create`, `ui.edit`, and `ui.detail` for screen layout. |

DTO example:

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

### Validation

Validation keys depend on the field type.

| Type | Validation |
| --- | --- |
| `String`, `Text`, `MediumText` | `email`, `minLength`, `maxLength`, `pattern`, `patternMessage` |
| `Integer`, `Long` | `min`, `max`, `positive`, `positiveOrZero`, `negative`, `negativeOrZero` |
| `BigDecimal`, `Double` | `decimalMin`, `decimalMax`, `digits`, `positive`, `positiveOrZero`, `negative`, `negativeOrZero` |
| `Date`, `DateTime`, `Instant` | `past`, `pastOrPresent`, `future`, `futureOrPresent` |
| `Boolean` | `assertTrue`, `assertFalse` |

Decimal example:

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

### UI Table and Lookup

Table configuration example:

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

Supported filter types:

- `text`
- `select`
- `multi-select`
- `date`
- `date-range`
- `lookup`
- `boolean`
- `toggle`

Lookup example:

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

### UI Screens, Tabs, and Layout

For generated web resources, put screen layout under top-level `ui.create`, `ui.edit`, and `ui.detail`.

```json
{
  "ui": {
    "create": {
      "tabs": [
        {
          "id": "general",
          "title": "General",
          "sections": [
            {
              "title": "Identity",
              "rows": [
                {
                  "columns": [
                    { "span": 1, "field": "employeeNo" },
                    { "span": 3, "field": "fullName" }
                  ]
                },
                {
                  "columns": [
                    { "span": 1, "field": "email" },
                    { "span": 1, "field": "phoneNumber" },
                    { "span": 1, "field": "active" }
                  ]
                },
                {
                  "columns": [
                    { "span": 1, "field": "bio" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "edit": {
      "tabs": [
        {
          "id": "general",
          "title": "General",
          "sections": []
        },
        {
          "id": "certification-identification",
          "title": "Certification & Identification",
          "children": [
            { "resource": "EmployeeCertification", "title": "Certifications" },
            { "resource": "EmployeeInternalToken", "title": "Identifications" }
          ]
        }
      ]
    },
    "detail": {
      "tabs": [
        {
          "id": "general",
          "title": "General",
          "sections": []
        },
        {
          "id": "certification-identification",
          "title": "Certification & Identification",
          "children": [
            { "resource": "EmployeeCertification", "title": "Certifications" },
            { "resource": "EmployeeInternalToken", "title": "Identifications" }
          ]
        }
      ]
    }
  }
}
```

Screen keys:

| Key | Used by |
| --- | --- |
| `ui.create` | Create page form layout. |
| `ui.edit` | Edit page form layout. |
| `ui.detail` | Detail/view page layout. |
| `ui.table` | List/table search, filters, and default columns. |
| `ui.lookup` | How this resource appears when selected from another resource. |

Layout structure:

| Key | Description |
| --- | --- |
| `tabs[]` | Screen tabs. A tab can contain `sections`, `children`, or both. |
| `tabs[].id` | Kebab-case tab id, for example `general` or `certification-identification`. |
| `tabs[].title` | Display title for the tab. |
| `sections[]` | Visual groups inside a tab. |
| `rows[]` | Rows inside a section. |
| `columns[]` | Fields inside a row. |
| `columns[].field` | Field name. For `ManyToOne`, use the model field name such as `department`; the generator maps it to `departmentId` in forms when needed. |
| `columns[].span` | Relative width in the row. `1 + 3` means 1/4 and 3/4. A single column is full width. |
| `children[]` | Child/nested resources intended to appear in the tab. |

Fallback rules:

- If `ui.edit` is missing, the generator can fall back to `ui.create`.
- If `ui.detail` is missing, the generator can fall back to `ui.edit`, then `ui.create`.
- If no screen layout exists, generated pages use the default one-column layout.
- `ui.form` is still accepted as a legacy fallback, but new resources should use `ui.create`, `ui.edit`, and `ui.detail`.

Child and nested resources:

- Use `ui.edit.tabs[].children` and `ui.detail.tabs[].children` to document desired child grouping, for example one tab that contains certification and identification data.
- Create pages usually should not show non-embedded child resources because the parent record does not have an id yet.
- Resources with `embedInParentDto: true` can be edited with the parent payload.
- Nested child table generation currently still follows the generated nested child wiring; configured `children` is validated and kept in the resource schema so grouping can be connected by the generator.

## Command Reference

### Global

```bash
gasi --help
gasi --version
```

Most commands accept:

| Flag | Description |
| --- | --- |
| `--cwd <path>` | Target project root. Defaults to the current working directory. |

### Plugin Commands

#### `plugin validate`

Validate a plugin definition without creating files.

```bash
gasi plugin validate --target api -f hr-plugin.json
gasi plugin validate --target web -f hr-plugin.json
```

| Flag | Description |
| --- | --- |
| `--target <target>` | Required. `api` or `web`. |
| `-f, --file <file>` | Required. Plugin definition JSON file. |
| `--cwd <path>` | Target project root. |

#### `plugin plan`

Show the plugin generation plan.

```bash
gasi plugin plan --target api -f hr-plugin.json
gasi plugin plan --target web -f hr-plugin.json
```

#### `plugin sync`

Generate the plugin skeleton from JSON.

```bash
gasi plugin sync --target api -f hr-plugin.json
gasi plugin sync --target web -f hr-plugin.json
```

If folders or files already exist and do not need changes, the command marks them as unchanged.

#### `plugin list`

List plugin modules registered in the parent `pom.xml`.

```bash
gasi plugin list
```

#### `plugin build <name>`

Build API, web, or both plugin targets.

```bash
gasi plugin build hr --target api
gasi plugin build hr --target web
gasi plugin build hr --target all
gasi plugin build hr --target all --skip-tests
gasi plugin build hr --target all --dry-run
```

| Flag | Description |
| --- | --- |
| `-t, --target <target>` | `api`, `web`, or `all`. Default `api`. |
| `--skip-tests` | Skip Maven tests for API builds. |
| `--profile <name>` | Activate a Maven profile. |
| `--verbose` | Show full Maven output. |
| `--dry-run` | Print commands without running them. |
| `--cwd <path>` | Target project root. |

#### `plugin deploy <name>`

Deploy a built plugin to the platform.

```bash
gasi plugin deploy hr --target api
gasi plugin deploy hr --target web
gasi plugin deploy hr --target all
gasi plugin deploy hr --target all --dry-run
```

| Flag | Description |
| --- | --- |
| `-t, --target <target>` | `api`, `web`, or `all`. Default `api`. |
| `--plugins-dir <path>` | Override the plugin deployment directory. |
| `--keep-old` | Keep old JARs when deploying API plugins. |
| `--dry-run` | Print deploy actions without changing files. |
| `--cwd <path>` | Target project root. |

Deploy output:

- API: JAR copied to `platform-app/plugins/`.
- Web: bundle copied to `platform-app/public/plugins/` and manifest updated.

#### `plugin clean <name>`

Remove deployed plugin files without deleting the plugin source.

```bash
gasi plugin clean hr --target api
gasi plugin clean hr --target web
gasi plugin clean hr --target all
gasi plugin clean hr --target all --dry-run
```

#### `plugin delete <name>`

Delete plugin source and deployed files.

```bash
gasi plugin delete hr --target api
gasi plugin delete hr --target web
gasi plugin delete hr --target all
gasi plugin delete hr --target all -y
gasi plugin delete hr --target all --keep-deployed
gasi plugin delete hr --target all --dry-run
```

| Flag | Description |
| --- | --- |
| `-t, --target <target>` | `api`, `web`, or `all`. Default `api`. |
| `--plugins-dir <path>` | Override the plugin deployment directory. |
| `--keep-deployed` | Keep deployed files. |
| `--dry-run` | Print delete plan without executing it. |
| `-y, --yes` | Skip confirmation. |
| `--cwd <path>` | Target project root. |

### Resource Commands

#### `resource validate`

Validate one or more resource definition files.

```bash
gasi resource validate -f department-resource.json
gasi resource validate -f department-resource.json -f employee-resource.json
```

#### `resource plan`

Compare resource definitions with the generated manifest in the target plugin.

```bash
gasi resource plan \
  --target api \
  --plugin plugins/hr-plugin \
  -f department-resource.json
```

| Flag | Description |
| --- | --- |
| `--target <target>` | Required. `api` or `web`. |
| `--plugin <module>` | Required. Target plugin module, for example `plugins/hr-plugin`. |
| `-f, --file <file>` | Resource definition JSON file. Can be repeated. |
| `--cwd <path>` | Target project root. |

#### `resource sync`

Generate or update resources from definitions.

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

Delete generated files for a resource based on the manifest.

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

The uploader command creates a `DataUplProcessor` class in an existing API plugin and adds the required upload dependency.

```bash
gasi uploader create Employee --plugin hr --resource employee -y
```

If run from inside a plugin folder, the CLI can try to detect the target plugin automatically.

| Flag | Description |
| --- | --- |
| `--plugin <name>` | Target plugin name, for example `hr` or `plugins/hr-plugin`. |
| `--resource <name>` | Upload API resource name, for example `employee`. |
| `-y, --yes` | Skip confirmation. |
| `--cwd <path>` | Target project root. |

After generation, review parsing, row validation, and commit logic in the generated processor class.

## Safe Generation Tips

- Run `validate` before `sync`.
- Run `plan` before `sync` when working in a plugin that already has many files.
- Use `--dry-run` for build, deploy, clean, and delete when you want to preview the effect.
- Commit important changes before delete operations.
- Avoid manually editing files marked as generated unless you are ready to maintain those changes during later syncs.
- For web resource custom behavior, register optional custom logic with `registerResourceCustom` from `@gasi/core-ui`; generated files read it through the registry and do not require empty custom files.
- Keep plugin and resource definition files separate so changes are easy to review.

## Troubleshooting

### `Plugin definition file not found`

Make sure the `-f` path is correct relative to `--cwd` or the current working directory.

### `Invalid --target`

Use `api` or `web` for generation commands. Use `all` only for lifecycle commands such as `build`, `deploy`, `clean`, and `delete`.

### `No plugin modules found in the parent pom.xml`

Run the command from the API project root that contains the parent `pom.xml`, or set `--cwd` to the correct root.

### API build fails

Run with full output:

```bash
gasi plugin build hr --target api --verbose
```

Check Maven dependencies, Java version, and whether the plugin module is registered in parent `pom.xml`.

### Web build fails

Make sure npm dependencies are installed in the target workspace and the web plugin exists in `plugins/<name>-plugin`.

```bash
npm install
gasi plugin build hr --target web
```

### Web bundle does not appear in the app

Check that:

- the bundle exists in `platform-app/public/plugins/`;
- `platform-app/public/plugins/manifest.json` contains the bundle URL;
- the bundle name matches the build output;
- the browser is not using stale cache.

### Need a stack trace

Set `GASI_DEBUG`:

```bash
GASI_DEBUG=1 gasi resource sync --target api --plugin plugins/hr-plugin -f department-resource.json
```

## Development Scripts

From the `gasi-cli` folder:

```bash
npm run start -- --help
npm run check:resource-idempotency
```

`check:resource-idempotency` helps verify that the resource generator stays stable when run repeatedly.
