package org.sgapps.ativhub;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReportBrowser")
public class ReportBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String id = call.getString("workOrderId", "");
        if (!id.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) {
            call.reject("Identificador da OS inválido.");
            return;
        }
        Uri url = Uri.parse("https://ativhub.sgapps.org/work-orders/" + id + "/print");
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url)
                .addCategory(Intent.CATEGORY_BROWSABLE));
            call.resolve();
        } catch (ActivityNotFoundException exception) {
            call.reject("Nenhum navegador disponível para abrir o relatório.", exception);
        }
    }
}
