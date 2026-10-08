import Foundation
import CryptoKit
import Security

struct LoginSession: Codable {
    var access_token: String
    var refresh_token: String
    var expires_in: Double
    var user: Account
    struct Account: Codable { let id: UUID }
}
struct PhoneKey: Codable {
    let id: UUID
    let token: String
    let client: UUID
    let expires: Date
    let scopes: [String]
}
enum ConnectionError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}
@MainActor final class CoachingAPI {
    let base = "https://baxvhilvrhshlfizakak.supabase.co"
    let publishable = "sb_publishable_DRoPSo_3TPlU8mMeLQNruw_82hanHNi"
    var session: LoginSession?
    var expires = Date.distantPast
    init() { if let data = PrivateStore.read("session") { session = try? JSONDecoder().decode(LoginSession.self, from: data) } }
    func request(_ path: String, method: String = "GET", body: Any? = nil, authenticated: Bool = true) async throws -> Data {
        if authenticated, session != nil, expires < Date() { try await refresh() }
        guard let url = URL(string: base + path) else { throw ConnectionError.message("Invalid service address.") }
        var request = URLRequest(url: url)
        request.httpMethod = method; request.timeoutInterval = 30
        request.setValue(publishable, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authenticated {
            guard let session else { throw ConnectionError.message("Sign in to continue.") }
            request.setValue("Bearer " + session.access_token, forHTTPHeaderField: "Authorization")
        }
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            throw ConnectionError.message("The request was not confirmed. Check your connection or sign in again.")
        }
        return data
    }
    func store(_ data: Data) throws {
        let saved = try JSONDecoder().decode(LoginSession.self, from: data)
        try PrivateStore.save(data, "session")
        session = saved; expires = Date().addingTimeInterval(max(0, saved.expires_in - 60))
    }
    func signIn(email: String, password: String) async throws {
        try store(await request("/auth/v1/token?grant_type=password", method: "POST",
            body: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), "password": password], authenticated: false))
    }
    func refresh() async throws {
        guard let session else { throw ConnectionError.message("Sign in to continue.") }
        try store(await request("/auth/v1/token?grant_type=refresh_token", method: "POST", body: ["refresh_token": session.refresh_token], authenticated: false))
    }
    func key(scopes: [String]) async throws -> PhoneKey {
        guard let account = session?.user.id else { throw ConnectionError.message("Sign in first.") }
        let data = try await request("/rest/v1/clients?select=id&profile_id=eq.\(account.uuidString)")
        struct Client: Decodable { let id: UUID }
        let clients = try JSONDecoder().decode([Client].self, from: data)
        guard clients.count == 1, let client = clients.first else { throw ConnectionError.message("A single linked coaching account is required. Contact your coach.") }
        if let stored = PrivateStore.read("phoneKey"), let key = try? JSONDecoder().decode(PhoneKey.self, from: stored),
           key.client == client.id, key.scopes == scopes, key.expires > Date().addingTimeInterval(86400) { return key }
        let previous = PrivateStore.read("phoneKey").flatMap { try? JSONDecoder().decode(PhoneKey.self, from: $0) }
        if let previous { try await revoke(previous); PrivateStore.remove("phoneKey") }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw ConnectionError.message("Could not create a private device key.") }
        let token = bytes.map { String(format: "%02x", $0) }.joined()
        let hash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        let expires = Date().addingTimeInterval(30 * 86400)
        let result = try await request("/rest/v1/client_health_ingest_keys?select=id", method: "POST", body: [
            "client_id": client.id.uuidString, "provider": "apple_health", "token_hash": hash,
            "scopes": scopes, "expires_at": ISO8601DateFormatter().string(from: expires)])
        struct KeyRow: Decodable { let id: UUID }
        let rows = try JSONDecoder().decode([KeyRow].self, from: result)
        guard rows.count == 1, let row = rows.first else { throw ConnectionError.message("Device setup was not confirmed.") }
        let key = PhoneKey(id: row.id, token: token, client: client.id, expires: expires, scopes: scopes)
        try PrivateStore.save(JSONEncoder().encode(key), "phoneKey")
        return key
    }
    func upload(_ rows: [[String: Any]], key: PhoneKey) async throws -> Int {
        var request = URLRequest(url: URL(string: base + "/functions/v1/health-device-ingest")!)
        request.httpMethod = "POST"; request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key.token, forHTTPHeaderField: "X-Legal-Edge-Key")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["daily": rows])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
              let body = try JSONSerialization.jsonObject(with: data) as? [String: Any], let count = body["saved_days"] as? Int else {
            throw ConnectionError.message("Upload not confirmed. Your previous readings remain saved. Try again later.")
        }
        return count
    }
    func revoke(_ key: PhoneKey) async throws {
        let data = try await request("/rest/v1/client_health_ingest_keys?id=eq.\(key.id.uuidString)&client_id=eq.\(key.client.uuidString)", method: "PATCH", body: ["revoked_at": ISO8601DateFormatter().string(from: Date())])
        struct Revoked: Decodable { let id: UUID }
        let rows = try JSONDecoder().decode([Revoked].self, from: data)
        guard rows.count == 1, rows.first?.id == key.id else { throw ConnectionError.message("Disconnect was not confirmed. Try again while signed in.") }
    }
    func disconnect() async throws {
        if let data = PrivateStore.read("phoneKey"), let key = try? JSONDecoder().decode(PhoneKey.self, from: data) { try await revoke(key) }
        PrivateStore.remove("phoneKey")
    }
    func signOut() async throws {
        try await disconnect()
        _ = try await request("/auth/v1/logout?scope=local", method: "POST")
        PrivateStore.remove("session"); session = nil; expires = .distantPast
    }
}
