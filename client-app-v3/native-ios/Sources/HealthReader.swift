import Foundation
import HealthKit

@MainActor final class HealthReader {
    let store = HKHealthStore()
    var observers: [HKObserverQuery] = []
    func type(_ scope: String) -> HKSampleType? {
        switch scope {
        case "steps": return HKObjectType.quantityType(forIdentifier: .stepCount)
        case "sleep_minutes": return HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
        case "resting_heart_rate": return HKObjectType.quantityType(forIdentifier: .restingHeartRate)
        case "weight_kg": return HKObjectType.quantityType(forIdentifier: .bodyMass)
        default: return nil
        }
    }
    func authorize(_ scopes: [String]) async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw ConnectionError.message("Health data is unavailable on this device.") }
        try await store.requestAuthorization(toShare: [], read: Set(scopes.compactMap { type($0) as HKObjectType? }))
    }
    func quantity(_ scope: String, start: Date, end: Date) async throws -> Double? {
        guard let type = type(scope) as? HKQuantityType else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        if scope == "weight_kg" {
            return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Double?, Error>) in
                let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1,
                    sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
                    if let error { continuation.resume(throwing: error); return }
                    continuation.resume(returning: (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo)))
                }; store.execute(query)
            }
        }
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Double?, Error>) in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate,
                options: scope == "steps" ? .cumulativeSum : .discreteAverage) { _, statistic, error in
                if let error { continuation.resume(throwing: error); return }
                let unit: HKUnit = scope == "steps" ? .count() : HKUnit.count().unitDivided(by: .minute())
                let value = scope == "steps" ? statistic?.sumQuantity() : statistic?.averageQuantity()
                continuation.resume(returning: value?.doubleValue(for: unit))
            }; store.execute(query)
        }
    }
    func sleep(start: Date, end: Date) async throws -> Double? {
        guard let type = type("sleep_minutes") as? HKCategoryType else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Double?, Error>) in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                let asleep = (samples as? [HKCategorySample] ?? []).filter { [HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue, HKCategoryValueSleepAnalysis.asleepCore.rawValue, HKCategoryValueSleepAnalysis.asleepDeep.rawValue, HKCategoryValueSleepAnalysis.asleepREM.rawValue].contains($0.value) }
                // Use one source per day, preferring Apple Watch. Merge its overlapping sleep stages.
                let groups = Dictionary(grouping: asleep) { $0.sourceRevision.source.bundleIdentifier + "|" + ($0.sourceRevision.productType ?? "") }
                let preferred = groups.values.sorted { a, b in
                    let aw = a.first?.sourceRevision.productType?.hasPrefix("Watch") ?? false
                    let bw = b.first?.sourceRevision.productType?.hasPrefix("Watch") ?? false
                    return aw != bw ? aw : a.count > b.count
                }.first ?? []
                continuation.resume(returning: sleepMinutes(preferred.map { SleepWindow(start: $0.startDate, end: $0.endDate) }, from: start, to: end))
            }; store.execute(query)
        }
    }
    func daily(_ scopes: [String]) async throws -> [[String: Any]] {
        let calendar = Calendar.current, now = Date(), today = calendar.startOfDay(for: now)
        var rows: [[String: Any]] = []
        for offset in -6...0 {
            guard let start = calendar.date(byAdding: .day, value: offset, to: today),
                  let tomorrow = calendar.date(byAdding: .day, value: 1, to: start) else { continue }
            let end = min(tomorrow, now)
            var row: [String: Any] = ["date": localHealthDate(start)]
            for scope in scopes {
                let value: Double?
                if scope == "sleep_minutes" { value = try await sleep(start: start, end: end) }
                else { value = try await quantity(scope, start: start, end: end) }
                if let value, value.isFinite { row[scope] = scope == "steps" ? value.rounded() : value }
            }
            if row.count > 1 { rows.append(row) }
        }
        return rows
    }
    func stop() async {
        observers.forEach { store.stop($0) }; observers.removeAll()
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in store.disableAllBackgroundDelivery { _, _ in c.resume() } }
    }
    func observe(_ scopes: [String], sync: @escaping @MainActor () async -> Void) {
        observers.forEach { store.stop($0) }; observers.removeAll()
        for scope in scopes {
            guard let type = type(scope) else { continue }
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, done, error in
                guard error == nil else { done(); return }
                Task { @MainActor in await sync(); done() }
            }
            observers.append(query); store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { _, _ in }
        }
    }
}
