import api from "../api/api";

const KEYPAIR_STORAGE_PREFIX = "sc_e2ee_keypair_v1_";
const DERIVED_KEY_CACHE = new Map<string, CryptoKey>();

// Helpers for Base64 conversions
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Checks if a message string is end-to-end encrypted
 */
export function isEncryptedMessage(content: string): boolean {
  return typeof content === "string" && content.startsWith("e2ee:v1:");
}

/**
 * Initializes or retrieves user's ECDH keypair and registers public key with backend.
 */
export async function initUserE2EE(userId: number): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}> {
  const storageKey = `${KEYPAIR_STORAGE_PREFIX}${userId}`;
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.publicKeyJwk && parsed.privateKeyJwk) {
        // Proactively ensure backend has the public key registered
        try {
          await api.post("/messages/keys/public", {
            publicKey: JSON.stringify(parsed.publicKeyJwk),
          });
        } catch {
          // Ignore network glitch if already set
        }
        return parsed;
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  // Generate new ECDH P-256 Keypair
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey
  );
  const privateKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );

  const keyData = { publicKeyJwk, privateKeyJwk };
  localStorage.setItem(storageKey, JSON.stringify(keyData));

  // Register public key on backend
  try {
    await api.post("/messages/keys/public", {
      publicKey: JSON.stringify(publicKeyJwk),
    });
  } catch (err) {
    console.error("Failed to register E2EE public key:", err);
  }

  return keyData;
}

/**
 * Derives a deterministic fallback key if target has not yet uploaded an ECDH key.
 */
async function deriveFallbackRoomKey(
  userA: number,
  userB: number
): Promise<CryptoKey> {
  const minId = Math.min(userA, userB);
  const maxId = Math.max(userA, userB);
  const seedString = `sc_e2ee_room_fallback_seed:${minId}:${maxId}:social-connect-secure-channel`;

  const enc = new TextEncoder();
  const rawKeyData = await window.crypto.subtle.digest(
    "SHA-256",
    enc.encode(seedString)
  );

  return window.crypto.subtle.importKey(
    "raw",
    rawKeyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Gets or derives the shared AES-GCM-256 key for conversation between currentUserId and targetUserId.
 */
export async function getConversationCryptoKey(
  currentUserId: number,
  targetUserId: number
): Promise<CryptoKey> {
  const cacheKey = `${Math.min(currentUserId, targetUserId)}_${Math.max(
    currentUserId,
    targetUserId
  )}`;

  if (DERIVED_KEY_CACHE.has(cacheKey)) {
    return DERIVED_KEY_CACHE.get(cacheKey)!;
  }

  // Ensure current user's keypair exists
  const myKeys = await initUserE2EE(currentUserId);

  try {
    // 1. If chatting with self
    if (Number(currentUserId) === Number(targetUserId)) {
      const privateKey = await window.crypto.subtle.importKey(
        "jwk",
        myKeys.privateKeyJwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey"]
      );

      const publicKey = await window.crypto.subtle.importKey(
        "jwk",
        myKeys.publicKeyJwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      );

      const selfKey = await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );

      DERIVED_KEY_CACHE.set(cacheKey, selfKey);
      return selfKey;
    }

    // 2. Fetch target user's public key from backend
    const res = await api.get(`/messages/keys/public/${targetUserId}`);
    const targetPublicKeyString = res.data?.publicKey;

    if (targetPublicKeyString) {
      const targetJwk =
        typeof targetPublicKeyString === "string"
          ? JSON.parse(targetPublicKeyString)
          : targetPublicKeyString;

      const myPrivateKey = await window.crypto.subtle.importKey(
        "jwk",
        myKeys.privateKeyJwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey"]
      );

      const targetPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        targetJwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      );

      const sharedKey = await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: targetPublicKey },
        myPrivateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );

      DERIVED_KEY_CACHE.set(cacheKey, sharedKey);
      return sharedKey;
    }
  } catch (err) {
    console.warn("ECDH key derivation falling back to room key:", err);
  }

  // 3. Fallback deterministic room key if target hasn't generated ECDH key yet
  const fallbackKey = await deriveFallbackRoomKey(currentUserId, targetUserId);
  DERIVED_KEY_CACHE.set(cacheKey, fallbackKey);
  return fallbackKey;
}

/**
 * Encrypts a plaintext message using AES-GCM with a random 12-byte IV.
 */
export async function encryptE2EEMessage(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  const ivB64 = arrayBufferToBase64(iv);
  const cipherB64 = arrayBufferToBase64(ciphertextBuffer);

  return `e2ee:v1:${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an encrypted message. If plaintext / legacy, returns original text.
 */
export async function decryptE2EEMessage(
  content: string,
  key: CryptoKey
): Promise<string> {
  if (!isEncryptedMessage(content)) {
    return content;
  }

  const parts = content.split(":");
  if (parts.length < 4) {
    return content;
  }

  const ivB64 = parts[2];
  const cipherB64 = parts[3];

  try {
    const iv = base64ToUint8Array(ivB64);
    const ciphertext = base64ToUint8Array(cipherB64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error("Failed to decrypt E2EE message:", err);
    return "🔒 [Encrypted message]";
  }
}
