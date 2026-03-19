// ─── localStorage persistence ───

// Lightweight helpers to encrypt/decrypt sensitive values before persisting.
// Uses the Web Crypto API with a per-origin key derived from a fixed label.
const _LS_CRYPTO_ALGO = { name: 'AES-GCM', length: 256 };
const _LS_CRYPTO_IV_LENGTH = 12; // bytes
const _LS_CRYPTO_KEY_LABEL = 'ironlog-ls-key-v1';

async function _getLsCryptoKey() {
  if (!('crypto' in window) || !window.crypto.subtle) {
    // Fallback: no encryption available.
    return null;
  }
  const enc = new TextEncoder();
  const material = enc.encode(_LS_CRYPTO_KEY_LABEL + '|' + window.location.origin);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    material,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('ironlog-ls-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    _LS_CRYPTO_ALGO,
    false,
    ['encrypt', 'decrypt']
  );
}

async function _lsEncrypt(plainText) {
  const key = await _getLsCryptoKey();
  if (!key) return null;
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(_LS_CRYPTO_IV_LENGTH));
  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );
  const buff = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.byteLength + buff.byteLength);
  combined.set(iv, 0);
  combined.set(buff, iv.byteLength);
  // Base64 encode
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

async function _lsDecrypt(cipherTextB64) {
  const key = await _getLsCryptoKey();
  if (!key) return null;
  try {
    const binary = atob(cipherTextB64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }
    const iv = combined.slice(0, _LS_CRYPTO_IV_LENGTH);
    const data = combined.slice(_LS_CRYPTO_IV_LENGTH);
    const plainBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    const dec = new TextDecoder();
    return dec.decode(plainBuf);
  } catch (e) {
    console.warn('LS secure decrypt error:', e);
    return null;
  }
}

export const LS={
  get:(k)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.warn("Error:",e);}},
  /**
   * Store a value encrypted in localStorage. Falls back to cleartext if
   * encryption is unavailable, to avoid breaking functionality.
   */
  setSecure: async (k,v)=>{try{
    const serialized = JSON.stringify(v);
    const encrypted = await _lsEncrypt(serialized);
    if (encrypted!==null){
      localStorage.setItem(k, encrypted);
    } else {
      // Fallback: store as-is if encryption not supported.
      localStorage.setItem(k, serialized);
    }
  }catch(e){console.warn("Error (secure set):",e);}},
  /**
   * Retrieve an encrypted value from localStorage, transparently decrypting it.
   * Returns null on error or if the key is not present.
   */
  getSecure: async (k)=>{try{
    const stored = localStorage.getItem(k);
    if (!stored) return null;
    // Try decrypt first; if that fails, treat as plaintext JSON.
    const decrypted = await _lsDecrypt(stored);
    const toParse = decrypted!==null ? decrypted : stored;
    return JSON.parse(toParse);
  }catch(e){console.warn("Error (secure get):",e);return null;}},
};

// ─── Cookie helper (for SSO across ironlog.space subdomains) ───
export const Cookie={
  get:(name)=>{const m=document.cookie.match(new RegExp("(^| )"+name+"=([^;]+)"));return m?decodeURIComponent(m[2]):null;},
  set:(name,value,days=30)=>{const exp=new Date(Date.now()+days*864e5).toUTCString();document.cookie=`${name}=${encodeURIComponent(value)};expires=${exp};domain=.ironlog.space;path=/;secure;samesite=lax`;},
  clear:(name)=>{document.cookie=`${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=.ironlog.space;path=/;secure`;},
};
