package com.example.app.architecture.fixtures.flows.host;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.net.Socket;
import java.net.URL;
import java.net.http.HttpClient;
import java.nio.file.Path;

/**
 * Plants rule 3, one parameter per alternative of its pattern. Naming the types is enough:
 * the rule is about the dependency, and a signature creates one without a line of
 * executable code.
 *
 * <p>Every alternative is present on purpose. A pattern with seven branches of which the
 * fixtures exercise one leaves six unproven, which is the shape of a rule that quietly
 * stops working. See the README.
 */
public final class OpensEveryResource {

    private OpensEveryResource() {}

    @SuppressWarnings("unused")
    static void everyAlternative(
            Path nioFile,
            HttpClient netHttp,
            File file,
            FileInputStream fileInput,
            FileOutputStream fileOutput,
            FileReader fileReader,
            FileWriter fileWriter,
            Socket socket,
            URL url) {
        // Deliberately empty: rule 3 judges the dependency, not the behaviour.
    }
}
