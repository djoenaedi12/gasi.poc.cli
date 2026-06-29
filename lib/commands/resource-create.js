const _ = require('lodash');
const pluralize = require('pluralize');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');

const { resolveCwd, assertProjectRoot, getPluginModules, detectPluginFromCwd, normalizePluginModuleName, resolvePluginModuleName } = require('../plugin-utils');
const { validateEntityName } = require('../validators');
const { generateApiResource, generateApiEnums } = require('../api-resource-generator');
const { generateWebResources } = require('../web-resource-generator');
const { normalizeRenderedContent } = require('../api-template-engine');
const { ensurePomDependencies } = require('../maven-pom');
const {
    loadGeneratedManifest,
    getGeneratedResource,
    hashResourceSpec,
    recordGeneratedResource,
} = require('../generated-manifest');
const {
    STRING_TYPES,
    loadResourceSpecFile,
    normalizeResourceSpecDocument,
    assertUniqueEntityNames,
} = require('../resource-spec');
const { addGeneratedHeader } = require('../generated-header');

/**
 * Dependencies required by generated resource components.
 *
 * These dependencies are marked as provided because the host/core application
 * is expected to provide the runtime implementation. The plugin only needs
 * them for compilation.
 */
const RESOURCE_REQUIRED_DEPENDENCIES = [
    {
        groupId: 'org.springframework.boot',
        artifactId: 'spring-boot-starter-data-jpa',
        scope: 'provided',
    },
    {
        groupId: 'org.springframework.boot',
        artifactId: 'spring-boot-starter-web',
        scope: 'provided',
    },
    {
        groupId: 'jakarta.validation',
        artifactId: 'jakarta.validation-api',
        scope: 'provided',
    },
    {
        groupId: 'org.projectlombok',
        artifactId: 'lombok',
        scope: 'provided',
    },
];

async function resolvePluginMetadata(pluginDir) {
    const propsFile = path.join(pluginDir, 'src', 'main', 'resources', 'plugin.properties');

    if (!(await fs.pathExists(propsFile))) {
        return null;
    }

    const content = await fs.readFile(propsFile, 'utf8');

    const classMatch = content.match(/^plugin\.class[ \t]*=[ \t]*([^\r\n]*)/m);
    const prefixMatch = content.match(/^plugin\.prefix[ \t]*=[ \t]*([^\r\n]*)/m);

    let packageName = null;

    if (classMatch) {
        const fqcn = classMatch[1].trim();
        const lastDot = fqcn.lastIndexOf('.');

        if (lastDot > 0) {
            packageName = fqcn.substring(0, lastDot);
        }
    }

    return {
        packageName,
        pluginPrefix: prefixMatch ? prefixMatch[1].trim() : '',
        propsFile,
    };
}

function assertUniqueTableNames(resources, pluginPrefix) {
    const tableNames = new Map();

    for (const resource of resources) {
        const tableName = buildTableName(pluginPrefix, resource.entityName);

        if (tableNames.has(tableName)) {
            const existingEntity = tableNames.get(tableName);
            throw new Error(`Duplicate table name "${tableName}" generated from "${existingEntity}" and "${resource.entityName}".`);
        }

        tableNames.set(tableName, resource.entityName);
    }
}

function fieldsWithParent(resource) {
    if (!resource.parent) {
        return resource.fields;
    }

    const parentFieldName = _.lowerFirst(resource.parent);
    if (resource.fields.some((field) => field.name === parentFieldName)) {
        return resource.fields;
    }

    return [
        {
            name: parentFieldName,
            type: 'ManyToOne',
            refEntity: resource.parent,
            required: resource.apiStyle !== 'nested',
            unique: false,
            filterable: true,
            dto: {
                create: true,
                update: true,
                summary: true,
                detail: true,
            },
            validation: {},
        },
        ...resource.fields,
    ];
}

function collectEnumSpecs(resources) {
    const enumSpecs = new Map();

    for (const resource of resources) {
        for (const field of resource.fields) {
            if (field.type !== 'Enum') {
                continue;
            }

            const values = field.enumValues || [];
            const existing = enumSpecs.get(field.enumName);

            if (existing) {
                const existingValues = existing.values.join('|');
                const nextValues = values.join('|');
                if (existingValues && nextValues && existingValues !== nextValues) {
                    throw new Error(`Enum "${field.enumName}" has conflicting values across resource fields.`);
                }

                if (!existing.values.length && values.length) {
                    existing.values = values;
                }
                continue;
            }

            enumSpecs.set(field.enumName, {
                name: field.enumName,
                values,
            });
        }
    }

    return [...enumSpecs.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function wireChildResourcesToParentDtos({ pluginDir, packageName, resources }) {
    const generatedOrChanged = [];
    const children = resources.filter((resource) => resource.parent && resource.embedInParentDto);

    for (const child of children) {
        const parent = resources.find((resource) => resource.entityName === child.parent);
        const parentEntityName = child.parent;
        const childFieldName = child.as || pluralize(_.lowerFirst(child.entityName));
        const shape = inferChildDtoShape(child);

        if (shape === 'objectList') {
            const requestFile = await ensureChildRequestDto({ pluginDir, packageName, child });
            const responseFile = await ensureChildResponseDto({ pluginDir, packageName, child });
            generatedOrChanged.push(requestFile, responseFile);
        }

        const createFile = path.join(pluginDir, 'src', 'main', 'java', ...packageName.split('.'), 'application', 'dto', `${parentEntityName}CreateRequest.java`);
        const updateFile = path.join(pluginDir, 'src', 'main', 'java', ...packageName.split('.'), 'application', 'dto', `${parentEntityName}UpdateRequest.java`);
        const detailFile = path.join(pluginDir, 'src', 'main', 'java', ...packageName.split('.'), 'application', 'dto', `${parentEntityName}DetailResponse.java`);

        const parentExistsInThisRun = Boolean(parent);
        await patchParentDtoFile({
            file: createFile,
            child,
            childFieldName,
            shape,
            dtoKind: 'create',
            required: parentExistsInThisRun,
        });
        await patchParentDtoFile({
            file: updateFile,
            child,
            childFieldName,
            shape,
            dtoKind: 'update',
            required: parentExistsInThisRun,
        });
        await patchParentDtoFile({
            file: detailFile,
            child,
            childFieldName,
            shape,
            dtoKind: 'detail',
            required: parentExistsInThisRun,
        });

        if (shape === 'objectList') {
            const mapperFile = path.join(pluginDir, 'src', 'main', 'java', ...packageName.split('.'), 'application', 'mapper', `${parentEntityName}DtoMapper.java`);
            await patchParentDtoMapperFile({ file: mapperFile, packageName, child, required: parentExistsInThisRun });
            generatedOrChanged.push(mapperFile);
        }

        generatedOrChanged.push(createFile, updateFile, detailFile);
    }

    return [...new Set(generatedOrChanged)];
}

function inferChildDtoShape(child) {
    return child.fields.length === 1 && child.fields[0].type === 'ManyToOne'
        ? 'idSet'
        : 'objectList';
}

async function ensureChildRequestDto({ pluginDir, packageName, child }) {
    const file = dtoFile(pluginDir, packageName, `${child.entityName}Request.java`);
    if (await fs.pathExists(file)) {
        await patchChildDtoTypeImports({ file, packageName, fields: child.fields });
        return file;
    }

    await fs.ensureDir(path.dirname(file));
    await writeJavaFile(file, renderChildDto({
        packageName,
        className: `${child.entityName}Request`,
        fields: child.fields,
        response: false,
    }));
    return file;
}

async function ensureChildResponseDto({ pluginDir, packageName, child }) {
    const file = dtoFile(pluginDir, packageName, `${child.entityName}Response.java`);
    if (await fs.pathExists(file)) {
        await patchChildDtoTypeImports({ file, packageName, fields: child.fields });
        return file;
    }

    await fs.ensureDir(path.dirname(file));
    await writeJavaFile(file, renderChildDto({
        packageName,
        className: `${child.entityName}Response`,
        fields: child.fields,
        response: true,
    }));
    return file;
}

function dtoFile(pluginDir, packageName, fileName) {
    return path.join(pluginDir, 'src', 'main', 'java', ...packageName.split('.'), 'application', 'dto', fileName);
}

async function patchChildDtoTypeImports({ file, packageName, fields }) {
    let source = await fs.readFile(file, 'utf8');
    const original = source;

    collectFieldTypeImports(fields, packageName).forEach((importName) => {
        source = ensureImport(source, importName);
    });

    if (source !== original) {
        await writeJavaFile(file, source);
    }
}

function renderChildDto({ packageName, className, fields, response }) {
    const imports = new Set([
        'lombok.AllArgsConstructor',
        'lombok.Builder',
        'lombok.Data',
        'lombok.NoArgsConstructor',
    ]);

    if (!response) {
        for (const field of fields) {
            if (field.required) {
                imports.add(field.type === 'ManyToOne' || STRING_TYPES.has(field.type)
                    ? 'jakarta.validation.constraints.NotBlank'
                    : 'jakarta.validation.constraints.NotNull');
            }
        }
    }

    collectFieldTypeImports(fields, packageName).forEach((importName) => imports.add(importName));

    const fieldLines = fields.map((field) => renderChildDtoField(field, response)).join('\n\n');

    return `package ${packageName}.application.dto;\n\n${[...imports].sort().map((importName) => `import ${importName};`).join('\n')}\n\n@Data\n@Builder\n@NoArgsConstructor\n@AllArgsConstructor\npublic class ${className} {\n\n${fieldLines}\n}\n`;
}

function renderChildDtoField(field, response) {
    const annotations = [];
    const fieldName = field.type === 'ManyToOne' ? `${field.name}Id` : field.name;
    const type = field.type === 'ManyToOne' ? 'String' : childDtoJavaType(field);

    if (!response && field.required) {
        annotations.push(field.type === 'ManyToOne' || STRING_TYPES.has(field.type)
            ? '    @NotBlank'
            : '    @NotNull');
    }

    return `${annotations.length ? annotations.join('\n') + '\n' : ''}    private ${type} ${fieldName};`;
}

function childDtoJavaType(field) {
    if (field.type === 'Enum') return field.enumName;
    if (field.type === 'BigDecimal') return 'BigDecimal';
    if (field.type === 'Date') return 'LocalDate';
    if (field.type === 'DateTime') return 'LocalDateTime';
    if (field.type === 'Instant') return 'Instant';
    if (field.type === 'Integer') return 'Integer';
    if (field.type === 'Long') return 'Long';
    if (field.type === 'Double') return 'Double';
    if (field.type === 'Boolean') return 'Boolean';
    return 'String';
}

function collectFieldTypeImports(fields, packageName) {
    const imports = new Set();
    for (const field of fields) {
        if (field.type === 'BigDecimal') imports.add('java.math.BigDecimal');
        if (field.type === 'Date') imports.add('java.time.LocalDate');
        if (field.type === 'DateTime') imports.add('java.time.LocalDateTime');
        if (field.type === 'Instant') imports.add('java.time.Instant');
        if (field.type === 'Enum') imports.add(`${packageName}.domain.model.${field.enumName}`);
    }
    return imports;
}

async function patchParentDtoFile({ file, child, childFieldName, shape, dtoKind, required }) {
    if (!(await fs.pathExists(file))) {
        if (required) {
            throw new Error(`Parent DTO file not found for child ${child.entityName}: ${file}`);
        }
        return;
    }

    let source = await fs.readFile(file, 'utf8');
    const original = source;

    if (shape === 'idSet') {
        source = ensureImport(source, 'java.util.Set');
        source = ensureClassField(source, `    private Set<String> ${childFieldName};`);
    } else {
        source = ensureImport(source, 'java.util.List');
        const type = dtoKind === 'detail'
            ? `${child.entityName}Response`
            : `${child.entityName}Request`;

        if (dtoKind !== 'detail') {
            source = ensureImport(source, 'jakarta.validation.Valid');
            source = ensureClassField(source, `    @Valid\n    private List<${type}> ${childFieldName};`);
        } else {
            source = ensureClassField(source, `    private List<${type}> ${childFieldName};`);
        }
    }

    if (source !== original) {
        await writeJavaFile(file, source);
    }
}

function ensureImport(source, importName) {
    const importLine = `import ${importName};`;
    if (source.includes(importLine)) {
        return source;
    }
    return source.replace(/(package [^;]+;\n)/, `$1\n${importLine}\n`);
}

function ensureClassField(source, fieldBlock) {
    const fieldNameMatch = fieldBlock.match(/private [^;]+ ([a-zA-Z0-9_]+);/);
    if (fieldNameMatch && source.includes(` ${fieldNameMatch[1]};`)) {
        return source;
    }

    const insert = `\n${fieldBlock}\n`;
    const index = source.lastIndexOf('\n}');
    if (index === -1) {
        return `${source.trimEnd()}${insert}}\n`;
    }
    return source.slice(0, index) + insert + source.slice(index);
}

async function writeJavaFile(file, source) {
    await fs.writeFile(file, normalizeRenderedContent(addGeneratedHeader(source, file), file), 'utf8');
}

async function patchParentDtoMapperFile({ file, packageName, child, required }) {
    if (!(await fs.pathExists(file))) {
        if (required) {
            throw new Error(`Parent DTO mapper file not found for child ${child.entityName}: ${file}`);
        }
        return;
    }

    let source = await fs.readFile(file, 'utf8');
    const original = source;

    source = ensureImport(source, `${packageName}.application.dto.${child.entityName}Response`);
    source = ensureImport(source, `${packageName}.domain.model.${child.entityName}`);
    source = ensureImport(source, 'org.springframework.beans.factory.annotation.Autowired');
    source = ensureAbstractMapper(source);
    source = ensureMapperIdEncoderField(source);
    source = ensureChildResponseMapperMethod(source, child);

    if (source !== original) {
        await writeJavaFile(file, source);
    }
}

function ensureAbstractMapper(source) {
    return source.replace(/public interface ([A-Za-z0-9_]+DtoMapper) extends /, 'public abstract class $1 implements ');
}

function ensureMapperIdEncoderField(source) {
    if (source.includes('protected IdEncoder idEncoder;')) {
        return source;
    }
    source = ensureImport(source, 'org.springframework.beans.factory.annotation.Autowired');
    return source.replace(/(\{\n)/, '$1\n    @Autowired\n    protected IdEncoder idEncoder;\n');
}

function ensureChildResponseMapperMethod(source, child) {
    const methodName = `to${child.entityName}Response`;
    if (source.includes(`${methodName}(`)) {
        return source;
    }

    const method = renderChildResponseMapperMethod(child);
    const index = source.lastIndexOf('\n}');
    if (index === -1) {
        return `${source.trimEnd()}\n${method}\n}\n`;
    }
    return source.slice(0, index) + `\n${method}\n` + source.slice(index);
}

function renderChildResponseMapperMethod(child) {
    const responseFields = child.fields.map((field) => {
        if (field.type === 'ManyToOne') {
            return `                .${field.name}Id(${_.lowerFirst(child.entityName)}.get${_.upperFirst(field.name)}() != null
                        ? idEncoder.encode(${_.lowerFirst(child.entityName)}.get${_.upperFirst(field.name)}().getId())
                        : null)`;
        }
        return `                .${field.name}(${_.lowerFirst(child.entityName)}.get${_.upperFirst(field.name)}())`;
    }).join('\n');

    return `    public ${child.entityName}Response to${child.entityName}Response(${child.entityName} ${_.lowerFirst(child.entityName)}) {
        if (${_.lowerFirst(child.entityName)} == null) {
            return null;
        }
        return ${child.entityName}Response.builder()
${responseFields}
                .build();
    }
`;
}

async function wireChildResourcesToParentServices({ pluginDir, packageName, resources }) {
    const changed = [];
    const childrenByParent = new Map();

    for (const child of resources.filter((resource) => resource.parent && resource.embedInParentDto)) {
        if (!childrenByParent.has(child.parent)) {
            childrenByParent.set(child.parent, []);
        }
        childrenByParent.get(child.parent).push(child);
    }

    for (const [parentEntityName, children] of childrenByParent.entries()) {
        const file = path.join(pluginDir, 'src', 'main', 'java', ...packageName.split('.'), 'application', 'hook', `${parentEntityName}EmbeddedChildrenHook.java`);
        await writeJavaFile(file, renderEmbeddedChildrenHook({ packageName, parentEntityName, children }));
        changed.push(file);
    }

    return changed;
}

function renderEmbeddedChildrenHook({ packageName, parentEntityName, children }) {
    const parentVar = _.lowerFirst(parentEntityName);
    const childShapes = children.map((child) => ({
        child,
        shape: inferChildDtoShape(child),
        fieldName: child.as || pluralize(_.lowerFirst(child.entityName)),
        parentFieldName: parentVar,
    }));
    const childTargetFields = uniqueTargetFields(children);
    const imports = renderEmbeddedChildrenHookImports({ packageName, parentEntityName, childShapes, targetFields: childTargetFields });
    const fields = renderEmbeddedChildrenHookFields({ parentEntityName, childShapes, targetFields: childTargetFields });
    const constructor = renderEmbeddedChildrenHookConstructor({ parentEntityName, parentVar, childShapes, targetFields: childTargetFields });
    const requestArgs = childShapes.map(({ fieldName }) => `request.get${_.upperFirst(fieldName)}()`).join(', ');

    return `package ${packageName}.application.hook;\n\n${imports}\n@Component\n@Order(10)\n@ResourceHook(value = "${parentEntityName}", layer = HookLayer.SERVICE)\npublic class ${parentEntityName}EmbeddedChildrenHook\n        implements ResourceServiceHook<${parentEntityName}, ${parentEntityName}CreateRequest, ${parentEntityName}UpdateRequest,\n        ${parentEntityName}SummaryResponse, ${parentEntityName}DetailResponse>, ApprovalTargetHook {\n\n${fields}${constructor}    @Override\n    public String resourceType() {\n        return "${parentEntityName}";\n    }\n\n    @Override\n    public void afterCreate(String resourceType, ${parentEntityName} saved, ${parentEntityName}CreateRequest request) {\n        ResolvedRefs refs = validateAndResolveIds(${requestArgs});\n${childShapes.map(({ child, fieldName }) => `        save${child.entityName}s(request.get${_.upperFirst(fieldName)}(), saved, refs);`).join('\n')}\n    }\n\n    @Override\n    public void afterUpdate(String resourceType, ${parentEntityName} saved, ${parentEntityName}UpdateRequest request) {\n        ResolvedRefs refs = validateAndResolveIds(${requestArgs});\n        deleteEmbeddedChildren(saved.getId());\n${childShapes.map(({ child, fieldName }) => `        save${child.entityName}s(request.get${_.upperFirst(fieldName)}(), saved, refs);`).join('\n')}\n    }\n\n    @Override\n    public void afterDelete(String resourceType, Long id) {\n        deleteEmbeddedChildren(id);\n    }\n\n    @Override\n    public void afterFindByIdResponse(String resourceType, ${parentEntityName}DetailResponse response, ${parentEntityName} domain) {\n        enrichDetail(response, domain.getId());\n    }\n\n    @Override\n    public void afterCreateResponse(String resourceType, ${parentEntityName}DetailResponse response, ${parentEntityName} saved, ${parentEntityName}CreateRequest request) {\n        enrichDetail(response, saved.getId());\n    }\n\n    @Override\n    public void afterUpdateResponse(String resourceType, ${parentEntityName}DetailResponse response, ${parentEntityName} saved, ${parentEntityName}UpdateRequest request) {\n        enrichDetail(response, saved.getId());\n    }\n\n    @Override\n    public void afterCreateRejected(String resourceType, BaseModel data) {\n        deleteEmbeddedChildren(data.getId());\n    }\n\n    @Override\n    public void afterUpdateApproved(String resourceType, BaseModel activeData, BaseModel pendingData) {\n        ${parentEntityName} active = (${parentEntityName}) activeData;\n        deleteEmbeddedChildren(active.getId());\n        copyEmbeddedChildren(pendingData.getId(), active);\n        deleteEmbeddedChildren(pendingData.getId());\n    }\n\n    @Override\n    public void afterUpdateRejected(String resourceType, BaseModel pendingData) {\n        deleteEmbeddedChildren(pendingData.getId());\n    }\n\n    @Override\n    public void afterDeleteApproved(String resourceType, BaseModel data) {\n        deleteEmbeddedChildren(data.getId());\n    }\n\n    private void enrichDetail(${parentEntityName}DetailResponse response, Long ${parentVar}Id) {\n${childShapes.map(({ child, fieldName }) => `        response.set${_.upperFirst(fieldName)}(to${child.entityName}Responses(find${child.entityName}s(${parentVar}Id)));`).join('\n')}\n    }\n\n    private void deleteEmbeddedChildren(Long ${parentVar}Id) {\n${childShapes.map(({ child }) => `        delete${child.entityName}s(${parentVar}Id);`).join('\n')}\n    }\n\n    private void copyEmbeddedChildren(Long source${parentEntityName}Id, ${parentEntityName} target${parentEntityName}) {\n${childShapes.map(({ child }) => `        copy${child.entityName}s(source${parentEntityName}Id, target${parentEntityName});`).join('\n')}\n    }\n\n${childShapes.map(renderChildFindDeleteSaveMethods).join('\n')}\n${childShapes.map(renderChildCopyMethods).join('\n')}\n${renderValidateAndResolve({ childShapes, targetFields: childTargetFields })}${renderResolvedRefs(childTargetFields)}${renderGenericHelpers({ parentEntityName })}}\n`;
}

function renderEmbeddedChildrenHookImports({ packageName, parentEntityName, childShapes, targetFields }) {
    const imports = new Set([
        'java.util.Collections',
        'java.util.List',
        'java.util.Map',
        'java.util.Set',
        'java.util.function.Function',
        'java.util.stream.Collectors',
        'org.springframework.core.annotation.Order',
        'org.springframework.data.jpa.domain.Specification',
        'org.springframework.stereotype.Component',
        `${packageName}.application.dto.${parentEntityName}CreateRequest`,
        `${packageName}.application.dto.${parentEntityName}DetailResponse`,
        `${packageName}.application.dto.${parentEntityName}SummaryResponse`,
        `${packageName}.application.dto.${parentEntityName}UpdateRequest`,
        `${packageName}.application.mapper.${parentEntityName}DtoMapper`,
        `${packageName}.domain.model.${parentEntityName}`,
        'gasi.gps.core.api.application.exception.BusinessException',
        'gasi.gps.core.api.application.hook.HookLayer',
        'gasi.gps.core.api.application.hook.ResourceHook',
        'gasi.gps.core.api.application.hook.ResourceServiceHook',
        'gasi.gps.core.api.approval.ApprovalTargetHook',
        'gasi.gps.core.api.domain.model.BaseModel',
        'gasi.gps.core.api.domain.model.SimpleFilter',
        'gasi.gps.core.api.domain.model.SortOrder',
        'gasi.gps.core.api.domain.port.outbound.BaseRepositoryPort',
        'gasi.gps.core.starter.infrastructure.specification.GenericSpecification',
        'gasi.gps.core.starter.infrastructure.util.IdEncoder',
    ]);

    for (const { child, shape } of childShapes) {
        imports.add(`${packageName}.domain.model.${child.entityName}`);
        imports.add(`${packageName}.infrastructure.entity.${child.entityName}Entity`);
        imports.add(`${packageName}.infrastructure.mapper.${child.entityName}Mapper`);
        imports.add(`${packageName}.infrastructure.persistence.${child.entityName}EntityRepository`);
        if (shape === 'objectList') {
            imports.add(`${packageName}.application.dto.${child.entityName}Request`);
            imports.add(`${packageName}.application.dto.${child.entityName}Response`);
        } else {
            imports.add(`${packageName}.infrastructure.entity.${parentEntityName}Entity`);
        }
        for (const field of child.fields) {
            if (field.type === 'ManyToOne') {
                imports.add(`${packageName}.domain.model.${field.refEntity}`);
                imports.add(`${packageName}.domain.port.outbound.${field.refEntity}RepositoryPort`);
                if (shape === 'idSet') {
                    imports.add(`${packageName}.infrastructure.entity.${field.refEntity}Entity`);
                }
            }
        }
    }

    targetFields.forEach((field) => {
        imports.add(`${packageName}.domain.model.${field.refEntity}`);
        imports.add(`${packageName}.domain.port.outbound.${field.refEntity}RepositoryPort`);
    });

    return [...imports].sort().map((importName) => `import ${importName};`).join('\n') + '\n\n';
}

function renderEmbeddedChildrenHookFields({ parentEntityName, childShapes, targetFields }) {
    const lines = [
        '    private final IdEncoder idEncoder;',
        `    private final ${parentEntityName}DtoMapper ${_.lowerFirst(parentEntityName)}DtoMapper;`,
    ];
    for (const { child } of childShapes) {
        const childVar = _.lowerFirst(child.entityName);
        lines.push(`    private final ${child.entityName}EntityRepository ${childVar}EntityRepository;`);
        lines.push(`    private final ${child.entityName}Mapper ${childVar}Mapper;`);
    }
    for (const field of targetFields) {
        lines.push(`    private final ${field.refEntity}RepositoryPort ${_.lowerFirst(field.refEntity)}RepositoryPort;`);
    }
    return lines.join('\n') + '\n\n';
}

function renderEmbeddedChildrenHookConstructor({ parentEntityName, parentVar, childShapes, targetFields }) {
    const params = [
        'IdEncoder idEncoder',
        `${parentEntityName}DtoMapper ${parentVar}DtoMapper`,
        ...childShapes.flatMap(({ child }) => [
            `${child.entityName}EntityRepository ${_.lowerFirst(child.entityName)}EntityRepository`,
            `${child.entityName}Mapper ${_.lowerFirst(child.entityName)}Mapper`,
        ]),
        ...targetFields.map((field) => `${field.refEntity}RepositoryPort ${_.lowerFirst(field.refEntity)}RepositoryPort`),
    ];
    const assignments = [
        '        this.idEncoder = idEncoder;',
        `        this.${parentVar}DtoMapper = ${parentVar}DtoMapper;`,
        ...childShapes.flatMap(({ child }) => {
            const childVar = _.lowerFirst(child.entityName);
            return [
                `        this.${childVar}EntityRepository = ${childVar}EntityRepository;`,
                `        this.${childVar}Mapper = ${childVar}Mapper;`,
            ];
        }),
        ...targetFields.map((field) => `        this.${_.lowerFirst(field.refEntity)}RepositoryPort = ${_.lowerFirst(field.refEntity)}RepositoryPort;`),
    ];

    return `    public ${parentEntityName}EmbeddedChildrenHook(${params.join(',\n            ')}) {\n${assignments.join('\n')}\n    }\n\n`;
}

function renderChildCopyMethods({ child, shape, parentFieldName }) {
    const childVar = _.lowerFirst(child.entityName);
    const parentType = _.upperFirst(parentFieldName);
    if (shape === 'idSet') {
        const target = child.fields[0];
        return `    private void copy${child.entityName}s(Long source${parentType}Id, ${parentType} target${parentType}) {\n        ${parentType}Entity ${parentFieldName}Entity = ${parentType}Entity.builder().id(target${parentType}.getId()).build();\n        List<${child.entityName}Entity> entities = find${child.entityName}s(source${parentType}Id).stream()\n                .map(entity -> ${child.entityName}Entity.builder()\n                        .${parentFieldName}(${parentFieldName}Entity)\n                        .${target.name}(${target.refEntity}Entity.builder().id(entity.get${_.upperFirst(target.name)}().getId()).build())\n                        .build())\n                .collect(Collectors.toList());\n        ${childVar}EntityRepository.saveAll(entities);\n    }\n`;
    }

    return `    private void copy${child.entityName}s(Long source${parentType}Id, ${parentType} target${parentType}) {\n        List<${child.entityName}Entity> entities = find${child.entityName}s(source${parentType}Id).stream()\n                .map(entity -> {\n                    ${child.entityName} ${childVar} = ${childVar}Mapper.toDomain(entity);\n                    ${childVar}.setId(null);\n                    ${childVar}.setVersion(null);\n                    ${childVar}.set${parentType}(target${parentType});\n                    return ${childVar}Mapper.toEntity(${childVar});\n                })\n                .collect(Collectors.toList());\n        ${childVar}EntityRepository.saveAll(entities);\n    }\n`;
}

function isBasicGeneratedService(source, entityName) {
    return source.includes(`class ${entityName}ServiceImpl`)
        && !source.includes(`public ${entityName}DetailResponse create(`)
        && !source.includes(`private ${entityName}DetailResponse enrichDetail(`);
}

function renderParentService({ packageName, parentEntityName, parentResource, children }) {
    const parentVar = _.lowerFirst(parentEntityName);
    const childShapes = children.map((child) => ({
        child,
        shape: inferChildDtoShape(child),
        fieldName: child.as || pluralize(_.lowerFirst(child.entityName)),
        parentFieldName: _.lowerFirst(parentEntityName),
    }));
    const parentCreateReferenceFields = uniqueManyToOneFields(fieldsForDto(parentResource?.fields ?? [], 'create'));
    const parentUpdateReferenceFields = uniqueManyToOneFields(fieldsForDto(parentResource?.fields ?? [], 'update'));
    const parentReferenceFields = uniqueManyToOneFields([
        ...parentCreateReferenceFields,
        ...parentUpdateReferenceFields,
    ]);
    const childTargetFields = uniqueTargetFields(children);
    const targetFields = uniqueRefTargetFields([...childTargetFields, ...parentReferenceFields]);
    const imports = renderParentServiceImports({ packageName, parentEntityName, childShapes, targetFields, parentReferenceFields });
    const fields = renderParentServiceFields({ parentEntityName, childShapes, targetFields, parentReferenceFields });
    const constructor = renderParentServiceConstructor({ parentEntityName, parentVar, childShapes, targetFields, parentReferenceFields });
    const createArgs = childShapes.map(({ fieldName }) => `request.get${_.upperFirst(fieldName)}()`).join(', ');
    const resolvedArgs = createArgs ? createArgs : '';

    const resolveCreateRefs = parentCreateReferenceFields.length
        ? `        resolve${parentEntityName}CreateReferences(${parentVar}, ${renderParentReferenceArgs(parentCreateReferenceFields)});\n`
        : '';
    const resolveUpdateRefs = parentUpdateReferenceFields.length
        ? `        resolve${parentEntityName}UpdateReferences(${parentVar}, ${renderParentReferenceArgs(parentUpdateReferenceFields)});\n`
        : '';

    return `package ${packageName}.application.service;\n\n${imports}\n@Service\npublic class ${parentEntityName}ServiceImpl\n        extends BaseServiceImpl<${parentEntityName}, ${parentEntityName}CreateRequest, ${parentEntityName}UpdateRequest, ${parentEntityName}SummaryResponse, ${parentEntityName}DetailResponse>\n        implements ${parentEntityName}Service {\n\n${fields}\n    private final ThreadLocal<ResolvedRefs> currentRefs = new ThreadLocal<>();\n\n${constructor}\n    @Override\n    public String resourceType() {\n        return \"${parentEntityName}\";\n    }\n\n    @Override\n    public ${parentEntityName}DetailResponse create(${parentEntityName}CreateRequest request, MutationOptions options) {\n        currentRefs.set(validateAndResolveIds(${resolvedArgs}));\n        try {\n            ${parentEntityName}DetailResponse response = super.create(request, options);\n            ${parentEntityName} ${parentVar} = repositoryPort.findById(idEncoder.decode(response.getId())).orElseThrow();\n            ResolvedRefs refs = currentRefs.get();\n${childShapes.map(({ child, fieldName }) => `            save${child.entityName}s(request.get${_.upperFirst(fieldName)}(), ${parentVar}, refs);`).join('\n')}\n            return enrichDetail(response);\n        } finally {\n            currentRefs.remove();\n        }\n    }\n\n    @Override\n    public ${parentEntityName}DetailResponse update(Long id, ${parentEntityName}UpdateRequest request, MutationOptions options) {\n        currentRefs.set(validateAndResolveIds(${resolvedArgs}));\n        try {\n            ${parentEntityName}DetailResponse response = super.update(id, request, options);\n            Long ${parentVar}Id = idEncoder.decode(response.getId());\n            ${parentEntityName} ${parentVar} = repositoryPort.findById(${parentVar}Id).orElseThrow();\n            ResolvedRefs refs = currentRefs.get();\n${childShapes.map(({ child }) => `            delete${child.entityName}s(${parentVar}Id);`).join('\n')}\n${childShapes.map(({ child, fieldName }) => `            save${child.entityName}s(request.get${_.upperFirst(fieldName)}(), ${parentVar}, refs);`).join('\n')}\n            return enrichDetail(response);\n        } finally {\n            currentRefs.remove();\n        }\n    }\n\n    @Override\n    public void delete(Long id, MutationOptions options) {\n${childShapes.map(({ child }) => `        delete${child.entityName}s(id);`).join('\n')}\n        super.delete(id, options);\n    }\n\n    @Override\n    protected ${parentEntityName}DetailResponse enrichDetail(${parentEntityName}DetailResponse response) {\n        Long ${parentVar}Id = idEncoder.decode(response.getId());\n${childShapes.map(({ child, fieldName }) => `        response.set${_.upperFirst(fieldName)}(to${child.entityName}Responses(find${child.entityName}s(${parentVar}Id)));`).join('\n')}\n        return response;\n    }\n\n${childShapes.map(renderChildFindDeleteSaveMethods).join('\n')}\n${renderValidateAndResolve({ childShapes, targetFields: childTargetFields })}\n${renderResolvedRefs(childTargetFields)}\n${renderParentReferenceMethods({ parentEntityName, parentCreateReferenceFields, parentUpdateReferenceFields })}\n${renderGenericHelpers({ parentEntityName })}\n}\n`;
}

function renderParentServiceImports({ packageName, parentEntityName, childShapes, targetFields, parentReferenceFields }) {
    const imports = new Set([
        'java.util.Collections',
        'java.util.List',
        'java.util.Map',
        'java.util.Set',
        'java.util.function.Function',
        'java.util.stream.Collectors',
        'org.springframework.data.jpa.domain.Specification',
        'org.springframework.stereotype.Service',
        'gasi.gps.core.api.domain.port.inbound.MutationOptions',
        `${packageName}.application.dto.${parentEntityName}CreateRequest`,
        `${packageName}.application.dto.${parentEntityName}DetailResponse`,
        `${packageName}.application.dto.${parentEntityName}SummaryResponse`,
        `${packageName}.application.dto.${parentEntityName}UpdateRequest`,
        `${packageName}.application.mapper.${parentEntityName}DtoMapper`,
        `${packageName}.domain.model.${parentEntityName}`,
        `${packageName}.domain.port.inbound.${parentEntityName}Service`,
        `${packageName}.domain.port.outbound.${parentEntityName}RepositoryPort`,
        'gasi.gps.core.api.application.exception.BusinessException',
        'gasi.gps.core.api.domain.model.BaseModel',
        'gasi.gps.core.api.domain.model.SimpleFilter',
        'gasi.gps.core.api.domain.model.SortOrder',
        'gasi.gps.core.api.domain.port.outbound.BaseRepositoryPort',
        'gasi.gps.core.starter.application.approval.ApprovalExtensionRegistry',
        'gasi.gps.core.starter.application.approval.ApprovalTargetHookRegistry',
        'gasi.gps.core.starter.application.hook.ResourceMapperHookRegistry',
        'gasi.gps.core.starter.application.hook.ResourceServiceHookRegistry',
        'gasi.gps.core.starter.application.service.BaseServiceImpl',
        'gasi.gps.core.starter.infrastructure.i18n.MessageUtil',
        'gasi.gps.core.starter.infrastructure.specification.GenericSpecification',
        'gasi.gps.core.starter.infrastructure.util.IdEncoder',
    ]);
    if (parentReferenceFields.length) {
        imports.add('gasi.gps.core.starter.application.support.ReferenceResolver');
    }

    for (const { child, shape } of childShapes) {
        imports.add(`${packageName}.domain.model.${child.entityName}`);
        imports.add(`${packageName}.infrastructure.entity.${child.entityName}Entity`);
        imports.add(`${packageName}.infrastructure.mapper.${child.entityName}Mapper`);
        imports.add(`${packageName}.infrastructure.persistence.${child.entityName}EntityRepository`);
        if (shape === 'objectList') {
            imports.add(`${packageName}.application.dto.${child.entityName}Request`);
            imports.add(`${packageName}.application.dto.${child.entityName}Response`);
        } else {
            imports.add(`${packageName}.infrastructure.entity.${parentEntityName}Entity`);
        }
        for (const field of child.fields) {
            if (field.type === 'ManyToOne') {
                imports.add(`${packageName}.domain.model.${field.refEntity}`);
                imports.add(`${packageName}.domain.port.outbound.${field.refEntity}RepositoryPort`);
                if (shape === 'idSet') {
                    imports.add(`${packageName}.infrastructure.entity.${field.refEntity}Entity`);
                }
            }
        }
    }

    targetFields.forEach((field) => {
        imports.add(`${packageName}.domain.model.${field.refEntity}`);
        imports.add(`${packageName}.domain.port.outbound.${field.refEntity}RepositoryPort`);
    });

    return [...imports].sort().map((importName) => `import ${importName};`).join('\n') + '\n\n';
}

function renderParentServiceFields({ parentEntityName, childShapes, targetFields, parentReferenceFields }) {
    const lines = [
        `    private final ${parentEntityName}DtoMapper ${_.lowerFirst(parentEntityName)}DtoMapper;`,
    ];
    if (parentReferenceFields.length) {
        lines.push('    private final ReferenceResolver referenceResolver;');
    }
    for (const { child } of childShapes) {
        const childVar = _.lowerFirst(child.entityName);
        lines.push(`    private final ${child.entityName}EntityRepository ${childVar}EntityRepository;`);
        lines.push(`    private final ${child.entityName}Mapper ${childVar}Mapper;`);
    }
    for (const field of targetFields) {
        lines.push(`    private final ${field.refEntity}RepositoryPort ${_.lowerFirst(field.refEntity)}RepositoryPort;`);
    }
    return lines.join('\n') + '\n\n';
}

function renderParentServiceConstructor({ parentEntityName, parentVar, childShapes, targetFields, parentReferenceFields }) {
    const params = [
        `${parentEntityName}RepositoryPort repositoryPort`,
        `${parentEntityName}DtoMapper dtoMapper`,
        'MessageUtil messageUtil',
        'IdEncoder idEncoder',
        'ResourceServiceHookRegistry hookRegistry',
        'ResourceMapperHookRegistry mapperHookRegistry',
        'ApprovalExtensionRegistry approvalExtensionRegistry',
        'ApprovalTargetHookRegistry approvalTargetHookRegistry',
        ...(parentReferenceFields.length ? ['ReferenceResolver referenceResolver'] : []),
        ...childShapes.flatMap(({ child }) => [
            `${child.entityName}EntityRepository ${_.lowerFirst(child.entityName)}EntityRepository`,
            `${child.entityName}Mapper ${_.lowerFirst(child.entityName)}Mapper`,
        ]),
        ...targetFields.map((field) => `${field.refEntity}RepositoryPort ${_.lowerFirst(field.refEntity)}RepositoryPort`),
    ];
    const assignments = [
        `        this.${parentVar}DtoMapper = dtoMapper;`,
        ...(parentReferenceFields.length ? ['        this.referenceResolver = referenceResolver;'] : []),
        ...childShapes.flatMap(({ child }) => {
            const childVar = _.lowerFirst(child.entityName);
            return [
                `        this.${childVar}EntityRepository = ${childVar}EntityRepository;`,
                `        this.${childVar}Mapper = ${childVar}Mapper;`,
            ];
        }),
        ...targetFields.map((field) => `        this.${_.lowerFirst(field.refEntity)}RepositoryPort = ${_.lowerFirst(field.refEntity)}RepositoryPort;`),
    ];

    return `    public ${parentEntityName}ServiceImpl(${params.join(',\n            ')}) {\n        super(repositoryPort, dtoMapper, messageUtil, idEncoder, hookRegistry, mapperHookRegistry, approvalExtensionRegistry, approvalTargetHookRegistry);\n${assignments.join('\n')}\n    }\n\n`;
}

function renderChildFindDeleteSaveMethods({ child, shape, fieldName, parentFieldName }) {
    const childVar = _.lowerFirst(child.entityName);
    const parentType = _.upperFirst(parentFieldName);
    if (shape === 'idSet') {
        const target = child.fields[0];
        return `    private List<${child.entityName}Entity> find${child.entityName}s(Long ${parentFieldName}Id) {\n        Specification<${child.entityName}Entity> spec = GenericSpecification.from(parentFilter(${parentFieldName}Id));\n        return ${childVar}EntityRepository.findAll(spec);\n    }\n\n    private void delete${child.entityName}s(Long ${parentFieldName}Id) {\n        List<${child.entityName}Entity> entities = find${child.entityName}s(${parentFieldName}Id);\n        if (!entities.isEmpty()) {\n            ${childVar}EntityRepository.deleteAllInBatch(entities);\n        }\n    }\n\n    private void save${child.entityName}s(Set<String> ${fieldName}, ${parentType} ${parentFieldName}, ResolvedRefs refs) {\n        if (${fieldName} == null || ${fieldName}.isEmpty()) {\n            return;\n        }\n        ${parentType}Entity ${parentFieldName}Entity = ${parentType}Entity.builder().id(${parentFieldName}.getId()).build();\n        List<${child.entityName}Entity> entities = ${fieldName}.stream()\n                .filter(id -> id != null && !id.isBlank())\n                .map(idEncoder::decode)\n                .map(${target.name}Id -> ${child.entityName}Entity.builder()\n                        .${parentFieldName}(${parentFieldName}Entity)\n                        .${target.name}(${target.refEntity}Entity.builder().id(${target.name}Id).build())\n                        .build())\n                .collect(Collectors.toList());\n        ${childVar}EntityRepository.saveAll(entities);\n    }\n\n    private Set<String> to${child.entityName}Responses(List<${child.entityName}Entity> entities) {\n        return entities.stream()\n                .map(entity -> idEncoder.encode(entity.get${_.upperFirst(target.name)}().getId()))\n                .collect(Collectors.toSet());\n    }\n`;
    }

    const requestType = `${child.entityName}Request`;
    const responseType = `${child.entityName}Response`;
    const saveSetters = child.fields.map((field) => {
        if (field.type === 'ManyToOne') {
            return `                            .${field.name}(req.get${_.upperFirst(field.name)}Id() != null && !req.get${_.upperFirst(field.name)}Id().isBlank()
                                    ? refs.${_.lowerFirst(field.refEntity)}Map.get(idEncoder.decode(req.get${_.upperFirst(field.name)}Id()))
                                    : null)`;
        }
        return `                            .${field.name}(req.get${_.upperFirst(field.name)}())`;
    }).join('\n');
    return `    private List<${child.entityName}Entity> find${child.entityName}s(Long ${parentFieldName}Id) {\n        Specification<${child.entityName}Entity> spec = GenericSpecification.from(parentFilter(${parentFieldName}Id));\n        return ${childVar}EntityRepository.findAll(spec);\n    }\n\n    private void delete${child.entityName}s(Long ${parentFieldName}Id) {\n        List<${child.entityName}Entity> entities = find${child.entityName}s(${parentFieldName}Id);\n        if (!entities.isEmpty()) {\n            ${childVar}EntityRepository.deleteAllInBatch(entities);\n        }\n    }\n\n    private void save${child.entityName}s(List<${requestType}> requests, ${parentType} ${parentFieldName}, ResolvedRefs refs) {\n        if (requests == null || requests.isEmpty()) {\n            return;\n        }\n        List<${child.entityName}Entity> entities = requests.stream()\n                .map(req -> {\n                    ${child.entityName} ${childVar} = ${child.entityName}.builder()\n                            .${parentFieldName}(${parentFieldName})\n${saveSetters}\n                            .build();\n                    return ${childVar}Mapper.toEntity(${childVar});\n                })\n                .collect(Collectors.toList());\n        ${childVar}EntityRepository.saveAll(entities);\n    }\n\n    private List<${responseType}> to${child.entityName}Responses(List<${child.entityName}Entity> entities) {\n        return entities.stream()\n                .map(entity -> ${childVar}Mapper.toDomain(entity))\n                .map(${parentFieldName}DtoMapper::to${child.entityName}Response)\n                .collect(Collectors.toList());\n    }\n`;
}

function renderValidateAndResolve({ childShapes, targetFields }) {
    const params = childShapes.map(({ shape, child, fieldName }) => {
        if (shape === 'idSet') return `Set<String> ${fieldName}`;
        return `List<${child.entityName}Request> ${fieldName}`;
    });
    const initMaps = targetFields.map((field) => `        Map<Long, ${field.refEntity}> ${_.lowerFirst(field.refEntity)}Map = Collections.emptyMap();`).join('\n');
    const validationBlocks = childShapes.map(({ child, shape, fieldName }) => renderChildValidationBlock({ child, shape, fieldName })).join('\n\n');
    const returnArgs = targetFields.map((field) => `${_.lowerFirst(field.refEntity)}Map`).join(', ');

    return `    private ResolvedRefs validateAndResolveIds(${params.join(', ')}) {\n        BusinessException.Collector collector = new BusinessException.Collector();\n\n${initMaps}\n\n${validationBlocks}\n\n        collector.validate();\n        return new ResolvedRefs(${returnArgs});\n    }\n\n`;
}

function renderChildValidationBlock({ child, shape, fieldName }) {
    if (shape === 'idSet') {
        const target = child.fields[0];
        const targetVar = _.lowerFirst(target.refEntity);
        return `        if (${fieldName} != null && !${fieldName}.isEmpty()) {\n            Set<Long> ${target.name}Ids = ${fieldName}.stream()\n                    .filter(id -> id != null && !id.isBlank())\n                    .map(idEncoder::decode)\n                    .collect(Collectors.toSet());\n            ${targetVar}Map = batchFetch(${targetVar}RepositoryPort, ${target.name}Ids);\n            collectMissing(${target.name}Ids, ${targetVar}Map, \"${target.name}Id\", collector);\n        }`;
    }

    const manyToOneFields = child.fields.filter((field) => field.type === 'ManyToOne');
    const idSets = manyToOneFields.map((field) => `            Set<Long> ${field.name}Ids = ${fieldName}.stream()\n                    .map(req -> req.get${_.upperFirst(field.name)}Id())\n                    .filter(id -> id != null && !id.isBlank())\n                    .map(idEncoder::decode)\n                    .collect(Collectors.toSet());`).join('\n');
    const fetches = manyToOneFields.map((field) => {
        const targetVar = _.lowerFirst(field.refEntity);
        return `            ${targetVar}Map = batchFetch(${targetVar}RepositoryPort, ${field.name}Ids);\n            collectMissing(${field.name}Ids, ${targetVar}Map, \"${field.name}Id\", collector);`;
    }).join('\n');

    return `        if (${fieldName} != null && !${fieldName}.isEmpty()) {\n${idSets}\n\n${fetches}\n        }`;
}

function renderResolvedRefs(targetFields) {
    const fields = targetFields.map((field) => `        final Map<Long, ${field.refEntity}> ${_.lowerFirst(field.refEntity)}Map;`).join('\n');
    const params = targetFields.map((field) => `Map<Long, ${field.refEntity}> ${_.lowerFirst(field.refEntity)}Map`).join(', ');
    const assignments = targetFields.map((field) => `            this.${_.lowerFirst(field.refEntity)}Map = ${_.lowerFirst(field.refEntity)}Map;`).join('\n');

    return `    private static class ResolvedRefs {\n${fields}\n\n        ResolvedRefs(${params}) {\n${assignments}\n        }\n    }\n\n`;
}

function renderParentReferenceArgs(parentReferenceFields) {
    return parentReferenceFields
        .map((field) => `request.get${_.upperFirst(field.name)}Id()`)
        .join(', ');
}

function renderParentReferenceMethods({ parentEntityName, parentCreateReferenceFields, parentUpdateReferenceFields }) {
    return [
        renderParentReferenceMethod(parentEntityName, 'Create', parentCreateReferenceFields),
        renderParentReferenceMethod(parentEntityName, 'Update', parentUpdateReferenceFields),
    ].filter(Boolean).join('');
}

function renderParentReferenceMethod(parentEntityName, suffix, parentReferenceFields) {
    const parentVar = _.lowerFirst(parentEntityName);
    if (!parentReferenceFields.length) {
        return '';
    }

    const params = parentReferenceFields
        .map((field) => `String ${field.name}Id`)
        .join(', ');
    const resolves = parentReferenceFields
        .map((field) => `        ${field.refEntity} ${field.name} = referenceResolver.resolve(
                ${_.lowerFirst(field.refEntity)}RepositoryPort,
                ${field.name}Id,
                "${field.name}Id",
                collector);`)
        .join('\n');
    const applies = parentReferenceFields
        .map((field) => `        ${parentVar}.set${_.upperFirst(field.name)}(${field.name});`)
        .join('\n');

    return `    private void resolve${parentEntityName}${suffix}References(${parentEntityName} ${parentVar}, ${params}) {
        BusinessException.Collector collector = new BusinessException.Collector();
${resolves}
        collector.validate();
${applies}
    }

`;
}

function renderGenericHelpers({ parentEntityName }) {
    const parentFieldName = _.lowerFirst(parentEntityName);
    return `    private SimpleFilter parentFilter(Long ${parentFieldName}Id) {\n        return SimpleFilter.builder()\n                .field(\"${parentFieldName}.id\")\n                .operator(SimpleFilter.FilterOperator.EQUALS)\n                .value(${parentFieldName}Id)\n                .build();\n    }\n\n    private <T extends BaseModel> Map<Long, T> batchFetch(BaseRepositoryPort<T> port, Set<Long> ids) {\n        if (ids.isEmpty()) {\n            return Collections.emptyMap();\n        }\n        SimpleFilter inFilter = SimpleFilter.builder()\n                .field(\"id\")\n                .operator(SimpleFilter.FilterOperator.IN)\n                .value(ids)\n                .build();\n        List<T> results = port.findAll(inFilter, Collections.<SortOrder>emptyList());\n        return results.stream()\n                .collect(Collectors.toMap(BaseModel::getId, Function.identity()));\n    }\n\n    private <T> void collectMissing(Set<Long> requestedIds, Map<Long, T> foundMap,\n            String fieldName, BusinessException.Collector collector) {\n        requestedIds.stream()\n                .filter(id -> !foundMap.containsKey(id))\n                .map(idEncoder::encode)\n                .forEach(encodedId -> collector.add(\"Invalid \" + fieldName + \": \" + encodedId));\n    }\n`;
}

function uniqueTargetFields(children) {
    const fields = new Map();
    for (const child of children) {
        for (const field of child.fields) {
            if (field.type === 'ManyToOne') {
                fields.set(field.refEntity, field);
            }
        }
    }
    return [...fields.values()];
}

function fieldsForDto(fields, dtoName) {
    return fields.filter((field) => !field.dto || field.dto[dtoName] !== false);
}

function uniqueManyToOneFields(fields) {
    const byName = new Map();
    for (const field of fields) {
        if (field.type === 'ManyToOne') {
            byName.set(field.name, field);
        }
    }
    return [...byName.values()];
}

function uniqueRefTargetFields(fields) {
    const byRef = new Map();
    for (const field of fields) {
        if (field.type === 'ManyToOne') {
            byRef.set(field.refEntity, field);
        }
    }
    return [...byRef.values()];
}

function buildTableName(pluginPrefix, entityName) {
    const baseTableName = pluralize(_.snakeCase(entityName));

    if (!pluginPrefix) {
        return baseTableName;
    }

    return `${pluginPrefix}_${baseTableName}`;
}

async function loadResourceSpecsFromFiles(filePaths, cwd, fallbackEntityName) {
    const resources = [];

    for (const filePath of filePaths) {
        const loaded = await loadResourceSpecFile(filePath, cwd);

        const sourceLabel = path.relative(cwd, loaded.file);
        const normalized = normalizeResourceSpecDocument(
            loaded.spec,
            filePaths.length === 1 ? fallbackEntityName : null,
            sourceLabel,
        );

        for (const resource of normalized) {
            resources.push({
                ...resource,
                sourceFile: loaded.file,
            });
        }
    }

    assertUniqueEntityNames(resources, 'resource files');

    return resources;
}

function normalizeFileOptions(fileOption) {
    if (!fileOption) {
        return [];
    }

    if (Array.isArray(fileOption)) {
        return fileOption.filter(Boolean);
    }

    return [fileOption];
}

function normalizeTarget(target) {
    if (!target) {
        throw new Error('--target is required. Allowed: api, web.');
    }

    const value = target;
    const normalized = String(value).toLowerCase();
    const aliases = {
        be: 'api',
        backend: 'api',
        fe: 'web',
        frontend: 'web',
    };
    const resolved = aliases[normalized] || normalized;

    if (!['api', 'web'].includes(resolved)) {
        throw new Error(`Invalid --target "${target}". Allowed: api, web.`);
    }

    return resolved;
}

async function resolveWebDir(opts, cwd) {
    const candidates = opts.plugin
        ? [
            path.resolve(cwd, opts.plugin),
            path.resolve(cwd, normalizePluginModuleName(opts.plugin)),
        ]
        : [cwd];

    for (const candidate of [...new Set(candidates)]) {
        const packageJson = path.join(candidate, 'package.json');
        const srcDir = path.join(candidate, 'src');

        if (await fs.pathExists(packageJson) && await fs.pathExists(srcDir)) {
            return candidate;
        }
    }

    if (opts.plugin) {
        throw new Error(`Invalid --plugin for web target: ${opts.plugin}. Expected package.json and src/.`);
    }

    throw new Error('--plugin is required for --target web when current directory is not the web plugin project.');
}

async function collectResourceSpecs({ entityName, opts, cwd, filePaths }) {
    if (filePaths.length > 0) {
        const resourceSpecs = await loadResourceSpecsFromFiles(filePaths, cwd, entityName);

        console.log(chalk.gray(`  Loaded resource definition file(s): ${filePaths.length}`));
        console.log(chalk.gray(`  Resources: ${resourceSpecs.length}\n`));

        return resourceSpecs;
    }

    throw new Error('Resource generation is non-interactive. Provide at least one -f, --file <file>.');
}

async function generateWebTarget({ entityName, opts, cwd, filePaths, resourceSpecs }) {
    const webDir = await resolveWebDir(opts, cwd);
    const pluginModule = path.relative(cwd, webDir).replace(/\\/g, '/') || opts.plugin;
    const specs = resourceSpecs || await collectResourceSpecs({ entityName, opts, cwd, filePaths });

    const spinner = ora('Generating web resource files...').start();

    try {
        const manifest = await loadGeneratedManifest(webDir, 'web');
        const targetSpecs = [];
        const unchangedSpecs = [];

        for (const resource of specs) {
            const record = getGeneratedResource(manifest, pluginModule, resource.entityName);
            if (opts.sync && record && record.specHash === hashResourceSpec(resource)) {
                unchangedSpecs.push(resource);
            } else {
                targetSpecs.push(resource);
            }
        }

        if (opts.sync && unchangedSpecs.length) {
            for (const resource of unchangedSpecs) {
                spinner.info(`Unchanged: ${resource.entityName}`);
            }
            spinner.start('Generating web resource files...');
        }

        if (opts.sync && targetSpecs.length === 0) {
            spinner.succeed(`All ${specs.length} resource(s) are already up to date.`);
            return;
        }

        const { generatedFiles, filesByEntity } = await generateWebResources({
            webDir,
            resources: targetSpecs,
            force: Boolean(opts.sync),
        });

        for (const resource of targetSpecs) {
            await recordGeneratedResource({
                cwd: webDir,
                pluginModule,
                resource,
                generatedFiles: filesByEntity[resource.entityName] || [],
                target: 'web',
            });
        }

        spinner.succeed(`Generated ${generatedFiles.length} web files from ${targetSpecs.length} resource(s).`);
        console.log();

        printGeneratedFiles(webDir, generatedFiles);

        console.log(chalk.green.bold('\n✓ Web resource created successfully!\n'));
        console.log(chalk.bold('Next steps:'));
        console.log(chalk.gray('  1.') + ' Review generated forms, columns, lookup options, and routes');
        console.log(chalk.gray('  2.') + ' Confirm generated routes are registered in your app router');
        console.log(chalk.gray('  3.') + ' Adjust filters or pagination if the resource needs server-side search\n');
    } catch (err) {
        spinner.fail('Failed to generate web resource.');
        throw err;
    }
}

async function resolveApiTargetContext(opts) {
    const detected = await detectPluginFromCwd(resolveCwd(opts));

    if (detected) {
        console.log(`  Plugin: ${chalk.green(detected.pluginModule)}\n`);
        return {
            cwd: detected.projectRoot,
            pluginModule: detected.pluginModule,
            pluginDir: detected.pluginDir,
        };
    }

    const cwd = resolveCwd(opts);
    await assertProjectRoot(cwd);

    const pluginModules = await getPluginModules(cwd);
    if (!pluginModules.length) {
        throw new Error('No plugin modules found in the parent pom.xml. Create a plugin first with "gasi plugin create".');
    }

    if (opts.plugin) {
        const pluginModule = resolvePluginModuleName(opts.plugin, pluginModules);
        const pluginDir = path.join(cwd, pluginModule);
        const metadata = await resolvePluginMetadata(pluginDir);

        if (!metadata || !metadata.packageName) {
            throw new Error(`Invalid --plugin "${opts.plugin}". Ensure plugin.properties exists and contains plugin.class.`);
        }

        return {
            cwd,
            pluginModule,
            pluginDir,
        };
    }

    const validPluginModules = [];
    for (const mod of pluginModules) {
        const metadata = await resolvePluginMetadata(path.join(cwd, mod));

        if (metadata && metadata.packageName) {
            validPluginModules.push(mod);
        }
    }

    if (validPluginModules.length === 1) {
        return {
            cwd,
            pluginModule: validPluginModules[0],
            pluginDir: path.join(cwd, validPluginModules[0]),
        };
    }

    throw new Error('Use --plugin <module> when running from a project with multiple plugins.');
}

async function loadApiGenerationContext({ entityName, opts, filePaths }) {
    const { cwd, pluginModule, pluginDir } = await resolveApiTargetContext(opts);
    const pluginName = path.basename(pluginModule).replace(/-plugin$/, '');
    const pluginMetadata = await resolvePluginMetadata(pluginDir);

    if (!pluginMetadata) {
        const propsFile = path.join(pluginDir, 'src', 'main', 'resources', 'plugin.properties');
        throw new Error(`plugin.properties is required in ${propsFile}`);
    }

    const pluginPrefixRaw = pluginMetadata.pluginPrefix
        ? pluginMetadata.pluginPrefix.trim()
        : '';

    const pluginPrefix = pluginPrefixRaw
        ? _.snakeCase(pluginPrefixRaw).toLowerCase()
        : '';

    const resourceSpecs = await collectResourceSpecs({ entityName, opts, cwd, filePaths });

    assertUniqueTableNames(resourceSpecs, pluginPrefix);

    return {
        cwd,
        pluginModule,
        pluginDir,
        pluginName,
        pluginMetadata,
        pluginPrefixRaw,
        pluginPrefix,
        resourceSpecs,
        syncMode: Boolean(opts.sync),
    };
}

function printApiGenerationSummary({ cwd, pluginModule, pluginPrefixRaw, pluginPrefix, resourceSpecs }) {
    console.log('\n' + chalk.bold('Summary:'));
    console.log(`  Plugin         : ${chalk.green(pluginModule)}`);
    console.log(`  Prefix         : ${pluginPrefixRaw ? chalk.green(pluginPrefixRaw) : chalk.gray('(none)')}`);
    console.log(`  Resources      : ${chalk.green(resourceSpecs.length)}`);

    for (const resource of resourceSpecs) {
        const tableName = buildTableName(pluginPrefix, resource.entityName);

        console.log();
        console.log(`  Entity         : ${chalk.green(resource.entityName)}`);
        console.log(`  Table          : ${chalk.green(tableName)}`);
        if (resource.parent) {
            console.log(`  Parent         : ${chalk.green(resource.parent)}`);
            console.log(`  Parent field   : ${chalk.green(_.lowerFirst(resource.parent))}`);
            console.log(`  API style      : ${chalk.green(resource.apiStyle)}`);
            console.log(`  Embed parent DTO: ${resource.embedInParentDto ? chalk.green('yes') : chalk.gray('no')}`);
            if (resource.embedInParentDto) {
                console.log(`  Parent DTO as  : ${resource.as ? chalk.green(resource.as) : chalk.gray('(default)')}`);
            }
            console.log(`  Expose API     : ${resource.exposeApi ? chalk.green('yes') : chalk.gray('no')}`);
        }

        if (resource.sourceFile) {
            console.log(`  Source file    : ${chalk.gray(path.relative(cwd, resource.sourceFile))}`);
        }

        console.log(`  Fields         :`);

        for (const f of resource.fields) {
            const typeLabel = f.type === 'ManyToOne'
                ? `→${f.refEntity}`
                : f.type === 'Enum'
                    ? `Enum(${f.enumName}${f.enumValues?.length ? `: ${f.enumValues.join('|')}` : ''})`
                    : f.type;

            const flags = [];
            if (f.required) flags.push('required');
            if (f.unique) flags.push('unique');
            if (f.filterable) flags.push('filterable');

            const flagStr = flags.length ? chalk.gray(` [${flags.join(', ')}]`) : '';
            const dtoStr = chalk.gray(formatDtoFlags(f.dto));
            const validationStr = chalk.gray(formatValidationFlags(f.validation));
            console.log(`    - ${chalk.cyan(f.name)} ${chalk.yellow(typeLabel)}${flagStr}${dtoStr}${validationStr}`);
        }
    }

    console.log();
}

async function generateApiTarget(context) {
    const {
        cwd,
        pluginDir,
        pluginName,
        pluginModule,
        pluginMetadata,
        pluginPrefix,
        pluginPrefixRaw,
        resourceSpecs,
        syncMode,
    } = context;
    const spinner = ora('Generating API resource files...').start();

    try {
        const allGeneratedFiles = [];
        const manifest = await loadGeneratedManifest(pluginDir, 'api');
        const targetResourceSpecs = [];
        const unchangedResourceSpecs = [];

        for (const resource of resourceSpecs) {
            const record = getGeneratedResource(manifest, pluginModule, resource.entityName);
            if (syncMode && record && record.specHash === hashResourceSpec(resource)) {
                unchangedResourceSpecs.push(resource);
            } else {
                targetResourceSpecs.push(resource);
            }
        }

        if (syncMode && unchangedResourceSpecs.length) {
            for (const resource of unchangedResourceSpecs) {
                spinner.info(`Unchanged: ${resource.entityName}`);
            }
            spinner.start('Generating API resource files...');
        }

        if (syncMode && targetResourceSpecs.length === 0) {
            spinner.succeed(`All ${resourceSpecs.length} resource(s) are already up to date.`);
            return;
        }

        const pluginPomPath = path.join(pluginDir, 'pom.xml');
        const pomUpdated = await ensurePomDependencies(
            pluginPomPath,
            RESOURCE_REQUIRED_DEPENDENCIES
        );

        if (pomUpdated) {
            allGeneratedFiles.push(pluginPomPath);
        }

        const enumFiles = await generateApiEnums({
            pluginDir,
            enums: collectEnumSpecs(targetResourceSpecs),
            force: syncMode,
        });
        allGeneratedFiles.push(...enumFiles);

        for (const resource of targetResourceSpecs) {
            const tableName = buildTableName(pluginPrefix, resource.entityName);
            const fields = fieldsWithParent(resource);

            const generatedFiles = await generateApiResource({
                cwd,
                pluginDir,
                pluginName,
                pluginPrefix,
                pluginPrefixRaw,
                entityName: resource.entityName,
                tableName,
                fields,
                parent: resource.parent,
                apiStyle: resource.apiStyle,
                embedInParentDto: resource.embedInParentDto,
                as: resource.as,
                exposeApi: resource.exposeApi,
                ui: resource.ui,
                mode: resource.mode,
                force: syncMode,
            });

            allGeneratedFiles.push(...generatedFiles);
            await recordGeneratedResource({
                cwd: pluginDir,
                pluginModule,
                resource,
                generatedFiles,
                target: 'api',
            });
        }

        const childDtoFiles = await wireChildResourcesToParentDtos({
            pluginDir,
            packageName: pluginMetadata.packageName,
            resources: resourceSpecs,
        });
        const parentServiceFiles = await wireChildResourcesToParentServices({
            pluginDir,
            packageName: pluginMetadata.packageName,
            resources: resourceSpecs,
        });

        allGeneratedFiles.push(...childDtoFiles);
        allGeneratedFiles.push(...parentServiceFiles);

        spinner.succeed(`Generated ${allGeneratedFiles.length} files from ${targetResourceSpecs.length} resource(s).`);
        console.log();
        printGeneratedFiles(cwd, allGeneratedFiles);
    } catch (err) {
        spinner.fail('Failed to generate API resource.');
        throw err;
    }

    console.log(chalk.green.bold('\n✓ API resource created successfully!\n'));
    console.log(chalk.bold('Next steps:'));
    console.log(chalk.gray('  1.') + ' Review and adjust the generated files (DTOs, validation, etc.)');
    console.log(chalk.gray('  2.') + ` Build: ${chalk.cyan('gasi plugin build ' + pluginName)}`);
    console.log(chalk.gray('  3.') + ` Deploy: ${chalk.cyan('gasi plugin deploy ' + pluginName)}\n`);
}

function printGeneratedFiles(rootDir, files) {
    for (const file of files) {
        console.log(chalk.gray('    ' + path.relative(rootDir, file)));
    }
}

async function resourceCreate(entityName, opts) {
    console.log(chalk.cyan.bold('\n  gasi — Resource Generator\n'));

    const filePaths = normalizeFileOptions(opts.file);
    const target = normalizeTarget(opts.target);

    if (entityName) {
        const result = validateEntityName(entityName);
        if (result !== true) throw new Error(result);
    }

    if (target === 'web') {
        const cwd = resolveCwd(opts);
        await generateWebTarget({ entityName, opts, cwd, filePaths });
        return;
    }

    if (filePaths.length === 0) {
        throw new Error('Resource generation is non-interactive. Provide at least one -f, --file <file>.');
    }

    const apiContext = await loadApiGenerationContext({ entityName, opts, filePaths });
    printApiGenerationSummary(apiContext);

    await generateApiTarget(apiContext);
}

function formatDtoFlags(dto) {
    if (!dto) {
        return '';
    }

    const included = [];

    if (dto.create) included.push('create');
    if (dto.update) included.push('update');
    if (dto.summary) included.push('summary');
    if (dto.detail) included.push('detail');

    return included.length
        ? ` DTO:${included.join(',')}`
        : ' DTO:none';
}

function formatValidationFlags(validation) {
    if (!validation || Object.keys(validation).length === 0) {
        return '';
    }

    const parts = [];

    for (const [key, value] of Object.entries(validation)) {
        if (key === 'digits' && value) {
            parts.push(`digits(${value.integer},${value.fraction})`);
        } else if (value === true) {
            parts.push(key);
        } else if (value !== false && value !== undefined && value !== null && value !== '') {
            parts.push(`${key}=${value}`);
        }
    }

    return parts.length
        ? ` validation:${parts.join(',')}`
        : '';
}

module.exports = resourceCreate;
