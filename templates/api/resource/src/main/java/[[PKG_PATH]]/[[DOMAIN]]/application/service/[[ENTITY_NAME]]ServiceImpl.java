package {{FULL_PACKAGE}}.application.service;

{{SERVICE_IMPORTS}}
{{SERVICE_BASE_IMPORT}}
{{SERVICE_AUDIT_IMPORT}}
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}DetailResponse;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}SummaryResponse;
{{SERVICE_REQUEST_IMPORTS}}
import {{FULL_PACKAGE}}.application.mapper.{{ENTITY_NAME}}DtoMapper;
import {{FULL_PACKAGE}}.domain.model.{{ENTITY_NAME}};
import {{FULL_PACKAGE}}.domain.port.inbound.{{ENTITY_NAME}}Service;
import {{FULL_PACKAGE}}.domain.port.outbound.{{ENTITY_NAME}}RepositoryPort;

@Service
{{SERVICE_AUDIT_ANNOTATION}}
public class {{ENTITY_NAME}}ServiceImpl
        extends {{SERVICE_EXTENDS}}
        implements {{ENTITY_NAME}}Service {

{{SERVICE_FIELDS}}
    public {{ENTITY_NAME}}ServiceImpl({{SERVICE_CONSTRUCTOR_PARAMS}}) {
        super(repositoryPort, dtoMapper, messageUtil, idEncoder);
{{SERVICE_CONSTRUCTOR_ASSIGNMENTS}}
    }

    @Override
    protected String resourceType() {
        return "{{ENTITY_NAME}}";
    }

{{SERVICE_REFERENCE_METHODS}}
}
