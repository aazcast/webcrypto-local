import * as ratchet from "2key-ratchet";
import * as idb from "idb";
import { Convert } from "pvtsutils";
import { AES_CBC, ECDH, ECDSA, isEdge, isFirefox, updateEcPublicKey } from "../utils";
import { RatchetStorage } from "./base";

interface IWrapKey {
  key: CryptoKey;
  iv: ArrayBuffer;
}

export class BrowserStorage extends RatchetStorage {

  public static STORAGE_NAME = "webcrypto-remote";
  public static IDENTITY_STORAGE = "identity";
  public static SESSION_STORAGE = "sessions";
  public static REMOTE_STORAGE = "remoteIdentity";

  public static async create() {
    const db = await idb.openDB(this.STORAGE_NAME, 1, {
      upgrade: (updater) => {
        updater.createObjectStore(this.SESSION_STORAGE);
        updater.createObjectStore(this.IDENTITY_STORAGE);
        updater.createObjectStore(this.REMOTE_STORAGE);
      },
    });
    return new BrowserStorage(db);
  }

  protected db: idb.IDBPDatabase;

  private constructor(db: idb.IDBPDatabase) {
    super();
    this.db = db;
  }

  public async loadWrapKey(): Promise<IWrapKey | null> {
    const wKey = await this.db.transaction(BrowserStorage.IDENTITY_STORAGE)
      .objectStore(BrowserStorage.IDENTITY_STORAGE)
      .get("wkey") as IWrapKey;
    if (wKey) {
      if (isEdge()) {
        if (!(wKey.key instanceof ArrayBuffer)) {
          return null;
        }
        wKey.key = await ratchet.getEngine().crypto.subtle.importKey("raw", wKey.key, { name: AES_CBC.name, length: 256 } as any, false, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]) as any;
      }
      AES_CBC.iv = wKey.iv;
    }
    return wKey || null;
  }

  public async saveWrapKey(key: IWrapKey) {
    if (isEdge()) {
      key = {
        key: await ratchet.getEngine().crypto.subtle.exportKey("raw", key.key) as any,
        iv: key.iv,
      };

    }
    await this.db.transaction(BrowserStorage.IDENTITY_STORAGE, "readwrite")
      .objectStore(BrowserStorage.IDENTITY_STORAGE)
      .put(key, "wkey");
  }

  public async loadIdentity() {
    const json: ratchet.IJsonIdentity = await this.db.transaction(BrowserStorage.IDENTITY_STORAGE)
      .objectStore(BrowserStorage.IDENTITY_STORAGE)
      .get("identity");
    let res: ratchet.Identity | null = null;
    if (json) {
      if (isFirefox() || isEdge()) {
        const wkey = await this.loadWrapKey();
        if (!(wkey && wkey.key.usages.some((usage) => usage === "encrypt")
          && json.exchangeKey.privateKey instanceof ArrayBuffer)) {
          return null;
        }
        // Replace private data to CryptoKey
        json.exchangeKey.privateKey = await ratchet.getEngine().crypto.subtle.decrypt(AES_CBC, wkey.key, json.exchangeKey.privateKey as any)
          .then((buf) =>
            ratchet.getEngine().crypto.subtle.importKey("jwk", JSON.parse(Convert.ToUtf8String(buf)), ECDH, false, ["deriveKey", "deriveBits"]),
          );
        json.signingKey.privateKey = await ratchet.getEngine().crypto.subtle.decrypt(AES_CBC, wkey.key, json.signingKey.privateKey as any)
          .then((buf) =>
            ratchet.getEngine().crypto.subtle.importKey("jwk", JSON.parse(Convert.ToUtf8String(buf)), ECDSA, false, ["sign"]),
          );

        if (isEdge()) {
          json.exchangeKey.publicKey = await ratchet.getEngine().crypto.subtle.unwrapKey("jwk", json.exchangeKey.publicKey as any, wkey.key, AES_CBC, ECDH, true, []);
          json.signingKey.publicKey = await ratchet.getEngine().crypto.subtle.unwrapKey("jwk", json.signingKey.publicKey as any, wkey.key, AES_CBC, ECDSA, true, ["verify"]);
        }
      }

      res = await ratchet.Identity.fromJSON(json);
    }
    return res;
  }

  public async saveIdentity(value: ratchet.Identity) {
    let wkey: IWrapKey | undefined;
    if (isFirefox() || isEdge()) {
      // TODO: Remove after Firefox is fixed
      // Create wrap key
      wkey = {
        key: await ratchet.getEngine().crypto.subtle.generateKey({ name: AES_CBC.name, length: 256 }, isEdge(), ["wrapKey", "unwrapKey", "encrypt", "decrypt"]),
        iv: ratchet.getEngine().crypto.getRandomValues(new Uint8Array(AES_CBC.iv)).buffer,
      };
      await this.saveWrapKey(wkey);

      // Regenerate identity with extractable flag
      const exchangeKeyPair = await ratchet.getEngine().crypto.subtle
        .generateKey(value.exchangeKey.privateKey.algorithm as any, true, ["deriveKey", "deriveBits"]) as CryptoKeyPair;
      value.exchangeKey.privateKey = exchangeKeyPair.privateKey;
      await updateEcPublicKey(value.exchangeKey.publicKey, exchangeKeyPair.publicKey);

      const signingKeyPair = await ratchet.getEngine().crypto.subtle
        .generateKey(value.signingKey.privateKey.algorithm as any, true, ["sign", "verify"]) as CryptoKeyPair;
      value.signingKey.privateKey = signingKeyPair.privateKey;
      await updateEcPublicKey(value.signingKey.publicKey, signingKeyPair.publicKey);
    }

    const json = await value.toJSON();

    if (isFirefox() || isEdge()) {
      if (!wkey) {
        throw new Error("WrapKey is empty");
      }

      // Replace private key data
      json.exchangeKey.privateKey = await ratchet.getEngine().crypto.subtle.wrapKey("jwk", value.exchangeKey.privateKey, wkey.key, AES_CBC) as any;
      json.signingKey.privateKey = await ratchet.getEngine().crypto.subtle.wrapKey("jwk", value.signingKey.privateKey, wkey.key, AES_CBC) as any;

      if (isEdge()) {
        // Replace public key data, because Edge doesn't support EC
        json.exchangeKey.publicKey = await ratchet.getEngine().crypto.subtle.wrapKey("jwk", value.exchangeKey.publicKey.key, wkey.key, AES_CBC) as any;
        json.signingKey.publicKey = await ratchet.getEngine().crypto.subtle.wrapKey("jwk", value.signingKey.publicKey.key, wkey.key, AES_CBC) as any;
      }
    }

    await this.db.transaction(BrowserStorage.IDENTITY_STORAGE, "readwrite")
      .objectStore(BrowserStorage.IDENTITY_STORAGE)
      .put(json, "identity");
  }

  public async loadRemoteIdentity(key: string) {
    const json: ratchet.IJsonRemoteIdentity = await this.db.transaction(BrowserStorage.REMOTE_STORAGE)
      .objectStore(BrowserStorage.REMOTE_STORAGE)
      .get(key);
    let res: ratchet.RemoteIdentity | null = null;
    if (json) {
      res = await ratchet.RemoteIdentity.fromJSON(json);
    }
    return res;
  }

  public async saveRemoteIdentity(key: string, value: ratchet.RemoteIdentity) {
    const json = await value.toJSON();
    await this.db.transaction(BrowserStorage.REMOTE_STORAGE, "readwrite")
      .objectStore(BrowserStorage.REMOTE_STORAGE)
      .put(json, key);
  }

  public async loadSession(key: string) {
    const json: ratchet.IJsonAsymmetricRatchet = await this.db.transaction(BrowserStorage.SESSION_STORAGE)
      .objectStore(BrowserStorage.SESSION_STORAGE)
      .get(key);
    let res: ratchet.AsymmetricRatchet | null = null;
    if (json) {
      const identity = await this.loadIdentity();
      if (!identity) {
        throw new Error("Identity is empty");
      }
      const remoteIdentity = await this.loadRemoteIdentity(key);
      if (!remoteIdentity) {
        throw new Error("Remote identity is not found");
      }
      res = await ratchet.AsymmetricRatchet.fromJSON(identity, remoteIdentity, json);
    }
    return res;
  }

  public async saveSession(key: string, value: ratchet.AsymmetricRatchet) {
    const json = await value.toJSON();
    await this.db.transaction(BrowserStorage.SESSION_STORAGE, "readwrite")
      .objectStore(BrowserStorage.SESSION_STORAGE)
      .put(json, key);
  }

}
