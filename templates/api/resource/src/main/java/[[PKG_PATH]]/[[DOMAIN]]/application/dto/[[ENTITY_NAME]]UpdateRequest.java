package {{FULL_PACKAGE}}.application.dto;

{{UPDATE_REQUEST_IMPORTS}}
import gasi.gps.core.api.application.dto.VersionedRequest;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class {{ENTITY_NAME}}UpdateRequest implements VersionedRequest {
    
    @NotNull
    private Integer version;

{{UPDATE_REQUEST_FIELDS}}
}
