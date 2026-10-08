import SwiftUI

@MainActor final class HealthConnection: ObservableObject {
    @Published var signedIn = false
    @Published var busy = false
    @Published var message = "Sign in with your Legal Edge client account."
    @Published var lastReceipt: Date?
    @Published var steps = true
    @Published var sleep = true
    @Published var heart = false
    @Published var weight = false
    let api = CoachingAPI()
    let reader = HealthReader()
    var lastAttempt = Date.distantPast
    var sharing = false
    init() {
        signedIn = api.session != nil
        if let data = PrivateStore.read("phoneKey"), let key = try? JSONDecoder().decode(PhoneKey.self, from: data) {
            steps = key.scopes.contains("steps"); sleep = key.scopes.contains("sleep_minutes")
            heart = key.scopes.contains("resting_heart_rate"); weight = key.scopes.contains("weight_kg")
            sharing = true; reader.observe(key.scopes) { [weak self] in await self?.sync() }
        }
    }
    var scopes: [String] { [(steps,"steps"),(sleep,"sleep_minutes"),(heart,"resting_heart_rate"),(weight,"weight_kg")].filter { $0.0 }.map { $0.1 } }
    func login(email: String, password: String) async {
        busy = true; defer { busy = false }
        do { try await api.signIn(email: email, password: password); signedIn = true; message = "Choose the readings you want to share." }
        catch { message = "Sign-in was not confirmed. Check your email and password, or reset them in the coaching app." }
    }
    func connect() async {
        guard !busy, !scopes.isEmpty else { return }
        busy = true
        do {
            try await reader.authorize(scopes)
            _ = try await api.key(scopes: scopes)
            sharing = true
            reader.observe(scopes) { [weak self] in await self?.sync() }
            busy = false
            await sync()
        } catch { message = error.localizedDescription; busy = false }
    }
    func sync() async {
        guard signedIn, sharing, !busy, Date().timeIntervalSince(lastAttempt) >= 60 else { return }
        busy = true; lastAttempt = Date(); defer { busy = false }
        do {
            let scopes: [String]
            if let data = PrivateStore.read("phoneKey"), let key = try? JSONDecoder().decode(PhoneKey.self, from: data) { scopes = key.scopes }
            else { message = "Choose permissions and reconnect."; return }
            let rows = try await reader.daily(scopes)
            guard !rows.isEmpty else { message = "No selected readings are available. Check Health permissions and run again with your phone unlocked."; return }
            let key = try await api.key(scopes: scopes)
            let count = try await api.upload(rows, key: key)
            guard count > 0 else { message = "No saved days were confirmed."; return }
            lastReceipt = Date(); message = "Saved \(count) days to your private coaching account."
        } catch { message = "Sharing paused: \(error.localizedDescription) Open the app unlocked to retry." }
    }
    func disconnect() async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        do { try await api.disconnect(); sharing = false; await reader.stop(); message = "Sharing disconnected. Your saved readings remain in your coaching account." }
        catch { message = error.localizedDescription }
    }
    func logout() async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        do { try await api.signOut(); sharing = false; await reader.stop(); signedIn = false; lastReceipt = nil; message = "Signed out." }
        catch { message = error.localizedDescription }
    }
}
@main @MainActor struct LegalEdgeHealthApp: App {
    @StateObject var connection = HealthConnection()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup { ConnectionScreen().environmentObject(connection).onChange(of: phase) { _, value in
            if value == .active { Task { await connection.sync() } }
        } }
    }
}
struct ConnectionScreen: View {
    @EnvironmentObject var connection: HealthConnection
    @State private var email = ""
    @State private var password = ""
    let navy = Color(red: 0.055, green: 0.105, blue: 0.165)
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    Label("THE LEGAL EDGE", systemImage: "shield.lefthalf.filled").font(.caption.weight(.bold))
                    Image(systemName: "heart.text.clipboard").font(.system(size: 54, weight: .light)).foregroundStyle(Color(red:0.67,green:0.53,blue:0.22))
                    Text("Your health.\nConnected to your coach.").font(.system(size: 36, weight: .medium, design: .serif))
                    Text("Choose what to share from your iPhone and Apple Watch. Your individual readings stay in your private coaching account.").foregroundStyle(.secondary)
                    if !connection.signedIn {
                        TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                        SecureField("Password", text: $password).textContentType(.password)
                        Button("Sign in") { let secret = password; password = ""; Task { await connection.login(email: email, password: secret) } }.buttonStyle(.borderedProminent)
                    } else {
                        Toggle("Daily steps", isOn: $connection.steps)
                        Toggle("Sleep duration", isOn: $connection.sleep)
                        Toggle("Resting heart rate", isOn: $connection.heart)
                        Toggle("Weight", isOn: $connection.weight)
                        Button("Choose Health permissions & share") { Task { await connection.connect() } }.buttonStyle(.borderedProminent)
                        Button("Refresh readings") { Task { await connection.sync() } }.buttonStyle(.bordered)
                        if let receipt = connection.lastReceipt { Label("Upload confirmed \(receipt.formatted())", systemImage: "checkmark.circle.fill") }
                        Text("Apple controls background delivery. Updates may wait until your phone is unlocked. Missing readings stay blank.").font(.footnote).foregroundStyle(.secondary)
                        Link("Open my coaching dashboard", destination: URL(string: "https://legal-edge-client-app.vercel.app/")!)
                        Button("Disconnect sharing") { Task { await connection.disconnect() } }
                        Button("Sign out") { Task { await connection.logout() } }
                    }
                    Text(connection.message).font(.callout).accessibilityAddTraits(.updatesFrequently)
                    if connection.busy { ProgressView() }
                }.padding(28).disabled(connection.busy)
            }.background(Color(red: 0.975, green: 0.969, blue: 0.95)).foregroundStyle(navy).tint(navy)
        }
    }
}
