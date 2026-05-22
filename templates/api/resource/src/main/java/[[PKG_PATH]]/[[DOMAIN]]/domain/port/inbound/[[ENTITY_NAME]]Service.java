package {{FULL_PACKAGE}}.domain.port.inbound;

{{INBOUND_BASE_IMPORT}}
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}DetailResponse;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}SummaryResponse;
{{INBOUND_REQUEST_IMPORTS}}

public interface {{ENTITY_NAME}}Service extends
        {{INBOUND_EXTENDS}} {
}
