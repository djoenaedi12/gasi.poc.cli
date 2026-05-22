package {{FULL_PACKAGE}}.presentation.controller;

import java.util.List;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

{{CONTROLLER_BASE_IMPORT}}
import gasi.gps.core.starter.infrastructure.util.IdEncoder;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}DetailResponse;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}SummaryResponse;
{{CONTROLLER_REQUEST_IMPORTS}}
import {{FULL_PACKAGE}}.domain.port.inbound.{{ENTITY_NAME}}Service;

@RestController
@RequestMapping("/api/v1/{{API_PATH}}")
public class {{ENTITY_NAME}}Controller
        extends {{CONTROLLER_EXTENDS}} {

    public {{ENTITY_NAME}}Controller({{ENTITY_NAME}}Service {{ENTITY_VAR}}Service, IdEncoder idEncoder) {
        super({{ENTITY_VAR}}Service, idEncoder);
    }

    @Override
    public String getResourceName() {
        return "{{ENTITY_NAME}}";
    }

    @Override
    protected List<String> getDefaultSummaryFields() {
        return List.of({{CONTROLLER_DEFAULT_SUMMARY_FIELDS}});
    }
}
