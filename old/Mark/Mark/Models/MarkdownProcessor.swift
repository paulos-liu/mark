import Foundation

// Mutable wrapper for building heading hierarchy
class MutableHeading {
    let level: Int
    let text: String
    let anchor: String
    var children: [MutableHeading] = []

    init(level: Int, text: String, anchor: String) {
        self.level = level
        self.text = text
        self.anchor = anchor
    }

    func toImmutable() -> Heading {
        Heading(
            level: level,
            text: text,
            anchor: anchor,
            children: children.map { $0.toImmutable() }
        )
    }
}

class MarkdownProcessor {
    /// Extract headings from markdown content and build a hierarchical structure
    /// Uses line-by-line parsing with mutable tree building for correct hierarchy
    static func extractHeadings(from markdown: String) -> [Heading] {
        var headings: [MutableHeading] = []
        var stack: [MutableHeading] = []

        let lines = markdown.split(separator: "\n", omittingEmptySubsequences: false)

        for line in lines {
            let trimmedLine = line.trimmingCharacters(in: .whitespaces)

            // Check if line starts with # characters (markdown heading syntax)
            guard trimmedLine.hasPrefix("#") else { continue }

            // Extract heading level (count of # at start)
            var level = 0
            var index = trimmedLine.startIndex

            while index < trimmedLine.endIndex && trimmedLine[index] == "#" {
                level += 1
                index = trimmedLine.index(after: index)
            }

            // Check if # is followed by space (valid markdown heading)
            guard level <= 6 && index < trimmedLine.endIndex && trimmedLine[index] == " " else {
                continue
            }

            // Extract heading text (everything after "# ")
            index = trimmedLine.index(after: index)
            let text = String(trimmedLine[index...]).trimmingCharacters(in: .whitespaces)

            guard !text.isEmpty else { continue }

            let anchor = slugify(text)
            let newHeading = MutableHeading(level: level, text: text, anchor: anchor)

            // Pop from stack until we find a level smaller than current
            while !stack.isEmpty && stack.last!.level >= level {
                stack.removeLast()
            }

            if stack.isEmpty {
                // Top-level heading
                headings.append(newHeading)
                stack.append(newHeading)
            } else {
                // Child of the last heading in stack
                stack.last!.children.append(newHeading)
                stack.append(newHeading)
            }
        }

        // Convert mutable headings to immutable
        return headings.map { $0.toImmutable() }
    }

    /// Convert heading text to URL-safe anchor (slugify)
    /// "My Heading" -> "my-heading"
    static func slugify(_ text: String) -> String {
        text
            .lowercased()
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}
