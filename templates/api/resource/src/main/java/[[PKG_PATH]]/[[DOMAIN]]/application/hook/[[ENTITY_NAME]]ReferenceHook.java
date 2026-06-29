package {{FULL_PACKAGE}}.application.hook;

{{REFERENCE_HOOK_IMPORTS}}
@Component
@Order(0)
@ResourceHook(value = "{{ENTITY_NAME}}", layer = HookLayer.SERVICE)
public class {{ENTITY_NAME}}ReferenceHook
        implements ResourceServiceHook<{{ENTITY_NAME}}, {{ENTITY_NAME}}CreateRequest, {{ENTITY_NAME}}UpdateRequest,
        {{ENTITY_NAME}}SummaryResponse, {{ENTITY_NAME}}DetailResponse> {

{{REFERENCE_HOOK_FIELDS}}
    public {{ENTITY_NAME}}ReferenceHook({{REFERENCE_HOOK_CONSTRUCTOR_PARAMS}}) {
{{REFERENCE_HOOK_CONSTRUCTOR_ASSIGNMENTS}}
    }

{{REFERENCE_HOOK_METHODS}}
}
