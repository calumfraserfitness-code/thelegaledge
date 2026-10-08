import XCTest
@testable import LegalEdgeHealth
final class HealthCoreTests: XCTestCase {
    func testOverlappingStagesAreNotAddedTwice() {
        let start = Date(timeIntervalSince1970: 0)
        let windows = [SleepWindow(start:start,end:start.addingTimeInterval(3600)), SleepWindow(start:start.addingTimeInterval(1800),end:start.addingTimeInterval(5400))]
        XCTAssertEqual(sleepMinutes(windows,from:start,to:start.addingTimeInterval(7200)),90)
        XCTAssertEqual(sleepMinutes(windows,from:start.addingTimeInterval(3600),to:start.addingTimeInterval(7200)),30)
        XCTAssertNil(sleepMinutes([],from:start,to:start.addingTimeInterval(7200)))
    }
    func testDateUsesDeviceTimeZone() {
        let date = Date(timeIntervalSince1970: 1791415800)
        XCTAssertNotEqual(localHealthDate(date,timeZone:TimeZone(secondsFromGMT:0)!),localHealthDate(date,timeZone:TimeZone(secondsFromGMT:-18000)!))
    }
}
