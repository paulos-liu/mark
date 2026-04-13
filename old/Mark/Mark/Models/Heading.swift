import Foundation

struct Heading: Identifiable {
    let id = UUID()
    let level: Int           // 1-6 for #, ##, etc.
    let text: String         // Heading text
    let anchor: String       // For scroll targeting (slugified)
    var children: [Heading] = []

    /// Create a display string for the heading (with indentation based on level)
    var displayText: String {
        text
    }

    /// Create a unique identifier for scrolling
    var scrollId: String {
        anchor
    }
}
