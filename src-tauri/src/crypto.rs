use base64::{engine::general_purpose, Engine};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Nonce};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use thiserror::Error;

const KEY_SIZE: usize = 32;
const SALT_SIZE: usize = 16;
const NONCE_SIZE: usize = 12;
const ITERATIONS: u32 = 120_000;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("contraseña requerida")]
    MissingPassword,
    #[error("payload inválido")]
    InvalidPayload,
    #[error("error criptográfico: {0}")]
    CipherError(String),
}

#[derive(Debug, Serialize, Deserialize)]
struct CipherPayload {
    salt: String,
    nonce: String,
    data: String,
}

pub fn encrypt_secret(password: &str, value: &str) -> std::result::Result<String, CryptoError> {
    if password.is_empty() {
        return Err(CryptoError::MissingPassword);
    }
    let mut salt = [0u8; SALT_SIZE];
    rand::thread_rng().fill_bytes(&mut salt);
    let mut nonce = [0u8; NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce);
    let key = derive_key(password, &salt);
    let cipher = ChaCha20Poly1305::new(&key);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), value.as_bytes())
        .map_err(|err| CryptoError::CipherError(err.to_string()))?;
    let payload = CipherPayload {
        salt: general_purpose::STANDARD.encode(salt),
        nonce: general_purpose::STANDARD.encode(nonce),
        data: general_purpose::STANDARD.encode(ciphertext),
    };
    serde_json::to_string(&payload).map_err(|_| CryptoError::InvalidPayload)
}

pub fn decrypt_secret(password: &str, payload: &str) -> std::result::Result<String, CryptoError> {
    if password.is_empty() {
        return Err(CryptoError::MissingPassword);
    }
    let payload: CipherPayload =
        serde_json::from_str(payload).map_err(|_| CryptoError::InvalidPayload)?;
    let salt = general_purpose::STANDARD
        .decode(payload.salt)
        .map_err(|_| CryptoError::InvalidPayload)?;
    let nonce = general_purpose::STANDARD
        .decode(payload.nonce)
        .map_err(|_| CryptoError::InvalidPayload)?;
    let ciphertext = general_purpose::STANDARD
        .decode(payload.data)
        .map_err(|_| CryptoError::InvalidPayload)?;
    let key = derive_key(password, &salt);
    let cipher = ChaCha20Poly1305::new(&key);
    let plain = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|err| CryptoError::CipherError(err.to_string()))?;
    String::from_utf8(plain).map_err(|_| CryptoError::InvalidPayload)
}

fn derive_key(password: &str, salt: &[u8]) -> chacha20poly1305::Key {
    let mut key = [0u8; KEY_SIZE];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, ITERATIONS, &mut key);
    chacha20poly1305::Key::from_slice(&key).to_owned()
}
