import SwiftUI

@main
struct MarkApp: App {
    var body: some Scene {
        DocumentGroup(newDocument: MarkdownDocument()) { file in
            MarkdownEditorView(document: file.$document)
                .frame(minWidth: 1000, minHeight: 600)
                .navigationTitle("Mark")
        }
    }
}
