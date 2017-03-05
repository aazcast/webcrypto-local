import { Identity } from "2key-ratchet";
import { RemoteIdentity } from "2key-ratchet";
import { AsymmetricRatchet } from "2key-ratchet";
const WebCrypto = require("node-webcrypto-ossl");
const crypto: Crypto = new WebCrypto();
import * as fs from "fs";

export class OpenSSLStorage {

    public static STORAGE_NAME = ".webcrypto";
    public static IDENTITY_STORAGE = "identity";
    public static SESSION_STORAGE = "sessions";
    public static REMOTE_STORAGE = "remoteIdentity";

    public static async create() {
        if (!fs.existsSync(this.STORAGE_NAME)) {
            fs.mkdirSync(this.STORAGE_NAME);
        }
        return new this();
    }

    public identity: Identity;
    public remoteIdentities: { [key: string]: RemoteIdentity } = {};
    public sessions: { [key: string]: AsymmetricRatchet } = {};

    private constructor() {
        // some
    }

    protected ecKeyToBase64(key: CryptoKey) {
        return new Promise((resolve, reject) => {
            const k: any = key;
            if (key.type === "public") {
                // public key
                k.native_.exportSpki((err: Error, data: Buffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data.toString("base64"));
                    }
                });
            } else {
                // private key
                k.native_.exportPkcs8((err: Error, data: Buffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data.toString("base64"));
                    }
                });
            }
        })
    }

    protected ecKeyToCryptoKey(base64: string, type: string, alg: string) {
        if (type === "public") {
            // public key
            return crypto.subtle.importKey("spki", new Buffer(base64, "base64"), {
                name: alg,
                namedCurve: "P-256",
            }, true, alg === "ECDSA" ? ["verify"] : []);
        } else {
            // private key
            return crypto.subtle.importKey("pkcs8", new Buffer(base64, "base64"), {
                name: alg,
                namedCurve: "P-256",
            }, false, alg === "ECDSA" ? ["sign"] : ["deriveBits", "deriveKey"]);
        }
    }

    public async loadIdentity(): Promise<Identity> {
        const identityPath = OpenSSLStorage.STORAGE_NAME + "/identity.json";
        if (fs.existsSync(identityPath)) {
            const data = fs.readFileSync(identityPath).toString();
            const json = JSON.parse(data);
            // signing key
            json.signingKey.privateKey = await this.ecKeyToCryptoKey(json.signingKey.privateKey, "private", "ECDSA");
            json.signingKey.publicKey = await this.ecKeyToCryptoKey(json.signingKey.publicKey, "public", "ECDSA");
            // exchange key
            json.exchangeKey.privateKey = await this.ecKeyToCryptoKey(json.exchangeKey.privateKey, "private", "ECDH");
            json.exchangeKey.publicKey = await this.ecKeyToCryptoKey(json.exchangeKey.publicKey, "public", "ECDH");
            // onetime pre key
            for (let i = 0; i < json.preKeys.length; i++) {
                const preKey: any = json.preKeys[i];
                preKey.privateKey = await this.ecKeyToCryptoKey(preKey.privateKey, "private", "ECDH");
                preKey.publicKey = await this.ecKeyToCryptoKey(preKey.publicKey, "public", "ECDH");
            }
            // pre key
            for (let i = 0; i < json.signedPreKeys.length; i++) {
                const preKey: any = json.signedPreKeys[i];
                preKey.privateKey = await this.ecKeyToCryptoKey(preKey.privateKey, "private", "ECDH");
                preKey.publicKey = await this.ecKeyToCryptoKey(preKey.publicKey, "public", "ECDH");
            }
            this.identity = await Identity.fromJSON(json);
        }
        return this.identity || null;
    }


    public async saveIdentity(value: Identity) {
        const json = await value.toJSON();
        const res: any = json;
        // signing key
        res.signingKey.privateKey = await this.ecKeyToBase64(json.signingKey.privateKey);
        res.signingKey.publicKey = await this.ecKeyToBase64(json.signingKey.publicKey);
        // exchange key
        res.exchangeKey.privateKey = await this.ecKeyToBase64(json.exchangeKey.privateKey);
        res.exchangeKey.publicKey = await this.ecKeyToBase64(json.exchangeKey.publicKey);
        // onetime pre keys
        for (let i = 0; i < json.preKeys.length; i++) {
            const preKey: any = json.preKeys[i];
            preKey.privateKey = await this.ecKeyToBase64(preKey.privateKey);
            preKey.publicKey = await this.ecKeyToBase64(preKey.publicKey);
        }
        // pre keys
        for (let i = 0; i < json.signedPreKeys.length; i++) {
            const preKey: any = json.signedPreKeys[i];
            preKey.privateKey = await this.ecKeyToBase64(preKey.privateKey);
            preKey.publicKey = await this.ecKeyToBase64(preKey.publicKey);
        }

        fs.writeFileSync(OpenSSLStorage.STORAGE_NAME + "/identity.json", JSON.stringify(res, null, "  "), {
            encoding: "utf8",
            flag: "w+",
        });
    }

    public async loadRemoteIdentity(key: string) {
        return this.remoteIdentities[key];
    }

    public async saveRemoteIdentity(key: string, value: RemoteIdentity) {
        this.remoteIdentities[key] = value;
    }

    public async loadSession(key: string) {
        const res = this.sessions[key];
        return res || null;
    }

    public async saveSession(key: string, value: AsymmetricRatchet) {
        this.sessions[key] = value;
    }

    public async findSession(key: CryptoKey) {
        for (const i in this.sessions) {
            const item = this.sessions[i];
            if (await item.hasRatchetKey(key)) {
                return item;
            }
        }
        return false;
    }

}
