import SwiftUI

struct TableOfContentsView: View {
    let headings: [Heading]
    @Binding var selectedAnchor: String
    let searchText: String

    var filteredHeadings: [Heading] {
        if searchText.isEmpty {
            return headings
        }
        return headings.compactMap { filterHeading($0) }
    }

    private func filterHeading(_ heading: Heading) -> Heading? {
        let matchesQuery = heading.text.localizedCaseInsensitiveContains(searchText)
        let filteredChildren = heading.children.compactMap { filterHeading($0) }

        if matchesQuery || !filteredChildren.isEmpty {
            var filtered = heading
            filtered.children = filteredChildren
            return filtered
        }
        return nil
    }

    var body: some View {
        List {
            if filteredHeadings.isEmpty {
                Text(searchText.isEmpty ? "No headings found" : "No matches found")
                    .foregroundColor(.secondary)
                    .font(.caption)
            } else {
                ForEach(filteredHeadings) { heading in
                    HeadingRowView(heading: heading, selectedAnchor: $selectedAnchor)
                }
            }
        }
        .listStyle(.plain)
    }
}

// Separate view to avoid recursive ViewBuilder issues
struct HeadingRowView: View {
    let heading: Heading
    @Binding var selectedAnchor: String

    var body: some View {
        if heading.children.isEmpty {
            // Leaf node - just a button
            Button(action: { selectedAnchor = heading.anchor }) {
                Text(heading.displayText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .foregroundColor(.primary)
        } else {
            // Has children
            DisclosureGroup {
                ForEach(heading.children) { child in
                    HeadingRowView(heading: child, selectedAnchor: $selectedAnchor)
                }
            } label: {
                Button(action: { selectedAnchor = heading.anchor }) {
                    Text(heading.displayText)
                }
                .buttonStyle(.plain)
                .foregroundColor(.primary)
            }
        }
    }
}

#Preview {
    let sampleHeadings = [
        Heading(level: 1, text: "Introduction", anchor: "introduction", children: [
            Heading(level: 2, text: "Getting Started", anchor: "getting-started"),
            Heading(level: 2, text: "Installation", anchor: "installation")
        ]),
        Heading(level: 1, text: "Usage", anchor: "usage")
    ]

    @State var selectedAnchor = ""
    return TableOfContentsView(headings: sampleHeadings, selectedAnchor: $selectedAnchor, searchText: "")
}
