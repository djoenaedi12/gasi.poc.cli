package {{FULL_PACKAGE}}.application.mapper;

import org.mapstruct.Mapper;
{{DTO_MAPPER_EXTRA_IMPORTS}}
{{DTO_MAPPER_MAPPING_TARGET_IMPORT}}
{{DTO_MAPPER_AUTOWIRED_IMPORT}}

{{DTO_MAPPER_BASE_IMPORT}}
import gasi.gps.core.starter.infrastructure.util.IdEncoder;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}DetailResponse;
import {{FULL_PACKAGE}}.application.dto.{{ENTITY_NAME}}SummaryResponse;
{{DTO_MAPPER_REQUEST_IMPORTS}}
import {{FULL_PACKAGE}}.domain.model.{{ENTITY_NAME}};
{{DTO_MAPPER_CHILD_IMPORTS}}

@Mapper(componentModel = "spring", uses = { IdEncoder.class })
public abstract class {{ENTITY_NAME}}DtoMapper implements {{DTO_MAPPER_BASE_INTERFACE}} {

{{DTO_MAPPER_ID_ENCODER_FIELD}}
{{DTO_MAPPER_WRITE_METHODS}}

{{DTO_MAPPER_SUMMARY_MAPPINGS}}
    @Override
    public abstract {{ENTITY_NAME}}SummaryResponse toSummary({{ENTITY_NAME}} model);

{{DTO_MAPPER_DETAIL_MAPPINGS}}
    @Override
    public abstract {{ENTITY_NAME}}DetailResponse toDetail({{ENTITY_NAME}} model);

{{DTO_MAPPER_CHILD_METHODS}}
}
