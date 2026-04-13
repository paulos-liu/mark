import SwiftUI
import MarkdownUI
import UniformTypeIdentifiers

struct MarkdownEditorView: View {
    @Binding var document: MarkdownDocument
    @State var selectedAnchor: String = ""
    @State var showTOC: Bool = false
    @State var searchText: String = ""
    @State var currentMatchIndex: Int = 0

    var matchPositions: [Int] {
        guard !searchText.isEmpty else { return [] }
        var positions: [Int] = []
        let lowercased = document.content.lowercased()
        let search = searchText.lowercased()
        var startIndex = lowercased.startIndex

        while let range = lowercased.range(of: search, range: startIndex..<lowercased.endIndex) {
            positions.append(lowercased.distance(from: lowercased.startIndex, to: range.lowerBound))
            startIndex = range.upperBound
        }
        return positions
    }

    var currentMatchHeading: String? {
        guard !matchPositions.isEmpty, currentMatchIndex < matchPositions.count else { return nil }
        let matchPos = matchPositions[currentMatchIndex]

        // Find the heading that comes before this match
        let headingsBeforeMatch = document.headings.flatMap { getAllHeadings($0) }
            .filter { heading in
                if let headingPos = document.content.lowercased().range(of: heading.text.lowercased())?.lowerBound {
                    return document.content.lowercased().distance(from: document.content.lowercased().startIndex, to: headingPos) < matchPos
                }
                return false
            }
            .sorted { a, b in
                let aPos = document.content.lowercased().range(of: a.text.lowercased())?.lowerBound ?? document.content.startIndex
                let bPos = document.content.lowercased().range(of: b.text.lowercased())?.lowerBound ?? document.content.startIndex
                return document.content.lowercased().distance(from: document.content.lowercased().startIndex, to: aPos) > document.content.lowercased().distance(from: document.content.lowercased().startIndex, to: bPos)
            }
            .first

        return headingsBeforeMatch?.anchor
    }

    private func getAllHeadings(_ heading: Heading) -> [Heading] {
        [heading] + heading.children.flatMap { getAllHeadings($0) }
    }

    var highlightedContent: String {
        guard !searchText.isEmpty, !matchPositions.isEmpty else { return document.content }

        var result = document.content
        let matches = matchPositions.sorted(by: >)  // Sort descending to avoid index shifting

        for pos in matches {
            let startIndex = result.index(result.startIndex, offsetBy: pos)
            let endIndex = result.index(startIndex, offsetBy: searchText.count)
            let matchText = result[startIndex..<endIndex]
            result.replaceSubrange(startIndex..<endIndex, with: "`\(matchText)`")
        }

        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            // Main content area
            HStack(spacing: 0) {
                // TOC Sidebar - with slide animation
                if showTOC {
                    HStack(spacing: 0) {
                        VStack(spacing: 0) {
                            TableOfContentsView(
                                headings: document.headings,
                                selectedAnchor: $selectedAnchor,
                                searchText: ""
                            )
                        }
                        .frame(minWidth: 200, maxWidth: 250)
                        .background(Color.white)

                        Divider()
                    }
                    .transition(.move(edge: .leading))
                }

                // Content area
                ScrollViewReader { proxy in
                    ScrollView {
                        Markdown(highlightedContent)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .onAppear {
                        if !selectedAnchor.isEmpty {
                            proxy.scrollTo(selectedAnchor, anchor: .top)
                        }
                    }
                    .onChange(of: selectedAnchor) { oldValue, newValue in
                        if !newValue.isEmpty {
                            withAnimation {
                                proxy.scrollTo(newValue, anchor: .top)
                            }
                        }
                    }
                    .onChange(of: searchText) { oldValue, newValue in
                        currentMatchIndex = 0
                    }
                }
                .onDrop(of: [.fileURL], isTargeted: nil) { providers in
                    handleDrop(providers: providers)
                    return true
                }
            }
            .overlay(
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        showTOC.toggle()
                    }
                }) {
                    Image(systemName: showTOC ? "sidebar.leading" : "sidebar.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                }
                .buttonStyle(.plain)
                .frame(width: 44, height: 44)
                .background(Color.black.opacity(0.7))
                .clipShape(Circle())
                .padding(16)
                , alignment: .bottomTrailing
            )
        }
    }

    private func handleDrop(providers: [NSItemProvider]) -> Bool {
        for provider in providers {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, error in
                if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                    openMarkdownFile(url)
                } else if let url = item as? URL {
                    openMarkdownFile(url)
                }
            }
        }
        return true
    }

    private func openMarkdownFile(_ url: URL) {
        // Open the file in a new window
        DispatchQueue.main.async {
            try? NSWorkspace.shared.open([url], withApplicationAt: Bundle.main.bundleURL, options: .newInstance, configuration: [:])
        }
    }

}

#Preview {
    let sampleMarkdown = """
    # Welcome to Mark

    This is a markdown document viewer.

    ## Features

    - Beautiful markdown rendering
    - Collapsible table of contents
    - Fast and responsive

    ## Getting Started

    Just open a .md file with Mark!

    ### Requirements

    - macOS 14+
    - Swift 5.9+
    """

    @State var doc = MarkdownDocument(content: sampleMarkdown)
    return MarkdownEditorView(document: $doc)
}
