import SwiftUI
import UniformTypeIdentifiers

struct MarkdownDocument: FileDocument {
    var content: String
    var headings: [Heading] = []

    static var readableContentTypes: [UTType] {
        [.plainText]
    }

    init(content: String = "") {
        self.content = content
        self.headings = MarkdownProcessor.extractHeadings(from: content)
    }

    init(configuration: FileDocumentReadConfiguration) throws {
        let data = configuration.file.regularFileContents ?? Data()
        self.content = String(decoding: data, as: UTF8.self)
        self.headings = MarkdownProcessor.extractHeadings(from: self.content)
    }

    func fileWrapper(configuration: FileDocumentWriteConfiguration) throws -> FileWrapper {
        let data = Data(content.utf8)
        return FileWrapper(regularFileWithContents: data)
    }

    mutating func updateContent(_ newContent: String) {
        self.content = newContent
        self.headings = MarkdownProcessor.extractHeadings(from: newContent)
    }
}
