package {{PACKAGE_NAME}}.application.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import gasi.gps.core.api.file.FileRow;
import gasi.gps.dataupload.domain.model.DataRowUpl;
import gasi.gps.dataupload.domain.model.DataUpl;
import gasi.gps.dataupload.domain.model.DataUplTemplateColumn;
import gasi.gps.dataupload.domain.model.DataUplTemplateSpec;
import gasi.gps.dataupload.domain.model.UploadRowStatus;
import gasi.gps.dataupload.domain.port.inbound.DataUplProcessor;

/**
 * Upload processor for {{ENTITY_NAME}} data.
 *
 * @since 1.0.0
 */
@Component
public class {{ENTITY_NAME}}UplProcessor implements DataUplProcessor {

    @Override
    public String resource() {
        return "{{RESOURCE_NAME}}";
    }

    @Override
    public DataUplTemplateSpec templateSpec() {
        return DataUplTemplateSpec.builder("{{RESOURCE_NAME}}-template.csv")
                .column(DataUplTemplateColumn.text(
                        "lookupValue1",
                        "Lookup Value 1",
                        true,
                        "Required. Replace with the first lookup value.",
                        "Primary identifier used by this upload processor."))
                .column(DataUplTemplateColumn.text(
                        "lookupValue2",
                        "Lookup Value 2",
                        false,
                        "Optional second lookup value.",
                        "Additional lookup value if the upload needs a compound identifier."))
                .column(DataUplTemplateColumn.text(
                        "lookupValue3",
                        "Lookup Value 3",
                        false,
                        "Optional third lookup value.",
                        "Additional lookup value if the upload needs a compound identifier."))
                .build();
    }

    @Override
    public List<DataRowUpl> parse(List<FileRow> rows, DataUpl dataUpl, Map<String, String> params) {
        return rows.stream()
                .map(row -> {
                    DataRowUpl dataRow = DataRowUpl.builder()
                            .dataUpl(dataUpl)
                            .rowNumber(row.rowNumber())
                            .rowData(row.rawData())
                            .lookupValue1(row.values().get("lookupValue1"))
                            .lookupValue2(row.values().get("lookupValue2"))
                            .lookupValue3(row.values().get("lookupValue3"))
                            .rowStatus(UploadRowStatus.RAW)
                            .build();

                    return dataRow;
                })
                .toList();
    }

    @Override
    public List<DataRowUpl> validateRows(DataUpl dataUpl, List<DataRowUpl> rows, Map<String, String> params) {
        rows.forEach(row -> {
            row.setRowStatus(UploadRowStatus.VALID);
            row.setErrorMessage(null);
        });
        return rows;
    }

    @Override
    public void commitRows(DataUpl dataUpl, List<DataRowUpl> rows, Map<String, String> params) {
        // TODO: Insert or update {{ENTITY_NAME}} data from valid upload rows.
    }
}
