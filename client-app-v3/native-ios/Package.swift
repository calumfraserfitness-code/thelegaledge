// swift-tools-version: 5.9
import PackageDescription
// Run the exact Foundation calculations without booting a HealthKit app host.
// The complete iOS app is built separately in CI; HealthKit needs a signed phone test.
let package = Package(name: "LegalEdgeHealthCoreValidation", platforms: [.macOS(.v13)], targets: [
    .target(name: "LegalEdgeHealth", path: "Sources", exclude: ["CoachingAPI.swift", "PrivateStore.swift", "HealthReader.swift", "LegalEdgeHealthApp.swift"], sources: ["HealthCore.swift"]),
    .testTarget(name: "LegalEdgeHealthTests", dependencies: ["LegalEdgeHealth"], path: "Tests")
])
