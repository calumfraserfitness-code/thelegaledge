import Foundation

struct SleepWindow {
    let start: Date
    let end: Date
}
func sleepMinutes(_ windows: [SleepWindow], from start: Date, to end: Date) -> Double? {
    let clipped = windows.map { SleepWindow(start: max($0.start, start), end: min($0.end, end)) }
        .filter { $0.start < $0.end }.sorted { $0.start < $1.start }
    guard let first = clipped.first else { return nil }
    var a = first.start, b = first.end, seconds: TimeInterval = 0
    for window in clipped.dropFirst() {
        if window.start <= b { b = max(b, window.end) }
        else { seconds += b.timeIntervalSince(a); a = window.start; b = window.end }
    }
    return (seconds + b.timeIntervalSince(a)) / 60
}
func localHealthDate(_ date: Date, timeZone: TimeZone = .current) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = timeZone
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}
