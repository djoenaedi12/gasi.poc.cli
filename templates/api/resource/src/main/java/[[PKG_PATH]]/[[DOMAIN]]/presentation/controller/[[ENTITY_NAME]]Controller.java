package {{FULL_PACKAGE}}.presentation.controller;

import java.util.List;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

{{CONTROLLER_BASE_IMPORT}}
import gasi.gps.core.starter.infrastructure.util.IdEncoder;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}DetailResponse;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}SummaryResponse;
{{CONTROLLER_REQUEST_IMPORTS}}
{{CONTROLLER_NESTED_IMPORTS}}
import {{FULL_PACKAGE}}.domain.port.inbound.{{ENTITY_NAME}}Service;

@RestController
@RequestMapping("/api/v1/{{CONTROLLER_API_PATH}}")
public class {{ENTITY_NAME}}Controller{{CONTROLLER_CLASS_EXTENDS}} {

{{CONTROLLER_BODY}}
}
