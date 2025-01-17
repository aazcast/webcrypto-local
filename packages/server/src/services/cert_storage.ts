import * as proto from "@webcrypto-local/proto";
import * as asn1js from "asn1js";
import * as graphene from "graphene-pk11";
import { Convert } from "pvtsutils";
import { isEqualBuffer } from "pvutils";
import request from "request";
import { CryptoCertificate, CryptoStorages, NativeCrypto } from "webcrypto-core";
const pkijs = require("pkijs");

import { Server, Session } from "../connection";
import { ServiceCryptoItem } from "../crypto_item";
import { WebCryptoLocalError } from "../error";
import { CryptoService } from "./crypto";
import { Service } from "./service";

// register new attribute for pkcs11 modules
graphene.registerAttribute("x509Chain", 2147483905, "buffer");

export class CertificateStorageService extends Service<CryptoService> {

  constructor(server: Server, crypto: CryptoService) {
    super(server, crypto, [
      //#region List of actions
      proto.CertificateStorageKeysActionProto,
      proto.CertificateStorageIndexOfActionProto,
      proto.CertificateStorageGetItemActionProto,
      proto.CertificateStorageSetItemActionProto,
      proto.CertificateStorageRemoveItemActionProto,
      proto.CertificateStorageClearActionProto,
      proto.CertificateStorageImportActionProto,
      proto.CertificateStorageExportActionProto,
      proto.CertificateStorageGetChainActionProto,
      proto.CertificateStorageGetCRLActionProto,
      proto.CertificateStorageGetOCSPActionProto,
      //#endregion
    ]);
  }

  public async getCrypto(id: string): Promise<NativeCrypto & CryptoStorages> {
    return await this.object.getCrypto(id);
  }

  public getMemoryStorage() {
    return this.object.object.memoryStorage;
  }

  protected async onMessage(session: Session, action: proto.ActionProto) {
    const result = new proto.ResultProto(action);
    switch (action.action) {
      // getItem
      case proto.CertificateStorageGetItemActionProto.ACTION: {
        // prepare incoming data
        const params = await proto.CertificateStorageGetItemActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);
        // do operation
        const item = await crypto.certStorage.getItem(
          params.key,
          (params.algorithm.isEmpty() ? undefined : params.algorithm.toAlgorithm())!,
          (!params.keyUsages ? undefined : params.keyUsages)!,
        );

        if (item) {
          // add key to memory storage
          const cryptoKey = new ServiceCryptoItem(item.publicKey, params.providerID);
          this.getMemoryStorage().add(cryptoKey);
          // add cert to memory storage
          const cryptoCert = new ServiceCryptoItem(item, params.providerID);
          this.getMemoryStorage().add(cryptoCert);

          // create Cert proto
          const certProto = await cryptoCert.toProto();
          (certProto as any).publicKey = cryptoKey.toProto();
          result.data = await certProto.exportProto();
        }
        break;
      }
      // setItem
      case proto.CertificateStorageSetItemActionProto.ACTION: {
        // prepare incoming data
        const params = await proto.CertificateStorageSetItemActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);
        const cert = this.getMemoryStorage().item(params.item.id).item as CryptoCertificate;
        // do operation
        const index = await crypto.certStorage.setItem(cert as any);
        result.data = Convert.FromUtf8String(index);
        // result
        break;
      }
      // remove
      case proto.CertificateStorageRemoveItemActionProto.ACTION: {
        // prepare incoming data
        const params = await proto.CertificateStorageRemoveItemActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);
        // do operation
        await crypto.certStorage.removeItem(params.key);
        // result
        break;
      }
      // importCert
      case proto.CertificateStorageImportActionProto.ACTION: {
        // prepare incoming data
        const params = await proto.CertificateStorageImportActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);
        const data = params.format === "pem" ? Convert.ToUtf8String(params.data) : params.data;

        // do operation
        const item = await crypto.certStorage.importCert(params.format, data, params.algorithm.toAlgorithm(), params.keyUsages);

        // add key to memory storage
        const cryptoKey = new ServiceCryptoItem(item.publicKey, params.providerID);
        this.getMemoryStorage().add(cryptoKey);
        // add cert to memory storage
        const cryptoCert = new ServiceCryptoItem(item, params.providerID);
        this.getMemoryStorage().add(cryptoCert);
        // result
        const certProto = await cryptoCert.toProto();
        (certProto as any).publicKey = cryptoKey.toProto();
        result.data = await certProto.exportProto();
        break;
      }
      // exportCert
      case proto.CertificateStorageExportActionProto.ACTION: {
        //#region prepare incoming data
        const params = await proto.CertificateStorageExportActionProto.importProto(action);

        const crypto = await this.getCrypto(params.providerID);
        const cert = this.getMemoryStorage().item(params.item.id).item as CryptoCertificate;
        //#endregion
        //#region do operation
        const exportedData = await crypto.certStorage.exportCert(params.format, cert as any);
        ////#endregion
        //#region result
        if (exportedData instanceof ArrayBuffer) {
          result.data = exportedData;
        } else {
          result.data = Convert.FromUtf8String(exportedData);
        }
        //#endregion
        break;
      }
      // keys
      case proto.CertificateStorageKeysActionProto.ACTION: {
        // load cert storage
        const params = await proto.CertificateStorageKeysActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);

        // do operation
        const keys = await crypto.certStorage.keys();
        // result
        result.data = (await proto.ArrayStringConverter.set(keys)).buffer;
        break;
      }
      // clear
      case proto.CertificateStorageClearActionProto.ACTION: {
        // load cert storage
        const params = await proto.CertificateStorageKeysActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);

        // do operation
        await crypto.certStorage.clear();
        // result
        break;
      }
      // indexOf
      case proto.CertificateStorageIndexOfActionProto.ACTION: {
        // load cert storage
        const params = await proto.CertificateStorageIndexOfActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);
        const cert = this.getMemoryStorage().item(params.item.id);

        // do operation
        const index = await crypto.certStorage.indexOf(cert.item as CryptoCertificate);
        // result
        if (index) {
          result.data = Convert.FromUtf8String(index);
        }
        break;
      }
      // getChain
      case proto.CertificateStorageGetChainActionProto.ACTION: {
        // load cert storage
        const params = await proto.CertificateStorageGetChainActionProto.importProto(action);
        const crypto = await this.getCrypto(params.providerID);
        const cert = this.getMemoryStorage().item(params.item.id).item as CryptoCertificate;
        // Get chain works only for x509 item type
        if (cert.type !== "x509") {
          throw new WebCryptoLocalError(WebCryptoLocalError.CODE.ACTION_COMMON, "Wrong item type, must be 'x509'");
        }

        // do operation
        const resultProto = new proto.CertificateStorageGetChainResultProto();
        const pkiEntryCert = await certC2P(crypto, cert);
        if (pkiEntryCert.subject.isEqual(pkiEntryCert.issuer)) { // self-signed
          // Dont build chain for self-signed certificates
          const itemProto = new proto.ChainItemProto();
          itemProto.type = "x509";
          itemProto.value = pkiEntryCert.toSchema(true).toBER(false);

          resultProto.items.push(itemProto);
        } else if ("session" in crypto) {
          let buffer: Buffer | undefined;
          try {
            buffer = (cert as any).p11Object.getAttribute("x509Chain") as Buffer;
          } catch (e) {
            // nothing
          }

          if (buffer) {
            this.emit("info", "Service:CertificateStorage:GetChain: CKA_X509_CHAIN is supported");
            const ulongSize = (cert as any).p11Object.handle.length;
            let i = 0;
            while (i < buffer.length) {
              const itemType = buffer.slice(i, i + 1)[0];
              const itemProto = new proto.ChainItemProto();
              switch (itemType) {
                case 1:
                  itemProto.type = "x509";
                  break;
                case 2:
                  itemProto.type = "crl";
                  break;
                default:
                  throw new WebCryptoLocalError(WebCryptoLocalError.CODE.ACTION_COMMON, "Unknown type of item of chain");
              }
              i++;
              const itemSizeBuffer = buffer.slice(i, i + ulongSize);
              const itemSize = itemSizeBuffer.readInt32LE(0);
              const itemValue = buffer.slice(i + ulongSize, i + ulongSize + itemSize);
              itemProto.value = new Uint8Array(itemValue).buffer;
              resultProto.items.push(itemProto);
              i += ulongSize + itemSize;
            }
          } else {
            this.emit("info", "Service:CertificateStorage:GetChain: CKA_X509_CHAIN is not supported");
            // Get all certificates from token
            const indexes = await crypto.certStorage.keys();
            const trustedCerts = [];
            const certs = [];
            for (const index of indexes) {
              // only certs
              const parts = index.split("-");
              if (parts[0] !== "x509") {
                continue;
              }

              const cryptoCert = await crypto.certStorage.getItem(index);
              const pkiCert = await certC2P(crypto, cryptoCert);
              // don't add entry cert
              // TODO: https://github.com/PeculiarVentures/PKI.js/issues/114
              if (isEqualBuffer(pkiEntryCert.tbs, pkiCert.tbs)) {
                continue;
              }
              if (pkiCert.subject.isEqual(pkiCert.issuer)) { // Self-signed cert
                trustedCerts.push(pkiCert);
              } else {
                certs.push(pkiCert);
              }
            }
            // Add entry certificate to the end of array
            // NOTE: PKIjs builds chain for the last certificate in list
            if (pkiEntryCert.subject.isEqual(pkiEntryCert.issuer)) { // Self-signed cert
              trustedCerts.push(pkiEntryCert);
            }
            certs.push(pkiEntryCert);
            // Build chain for certs
            pkijs.setEngine("PKCS#11 provider", crypto, new pkijs.CryptoEngine({ name: "", crypto, subtle: crypto.subtle }));
            // console.log("Print incoming certificates");
            // console.log("Trusted:");
            // console.log("=================================");
            // await printCertificates(crypto, trustedCerts);
            // console.log("Certificates:");
            // console.log("=================================");
            // await printCertificates(crypto, certs);
            const chainBuilder = new pkijs.CertificateChainValidationEngine({
              trustedCerts,
              certs,
            });

            const chain = await chainBuilder.verify();
            let resultChain = [];
            if (chain.result) {
              // Chain was created
              resultChain = chainBuilder.certs;
            } else {
              // cannot build chain. Return only entry certificate
              resultChain = [pkiEntryCert];
            }
            // Put certs to result
            for (const item of resultChain) {
              const itemProto = new proto.ChainItemProto();
              itemProto.type = "x509";
              itemProto.value = item.toSchema(true).toBER(false);

              resultProto.items.push(itemProto);
            }
          }
        } else {
          throw new WebCryptoLocalError(WebCryptoLocalError.CODE.ACTION_NOT_SUPPORTED, "Provider doesn't support GetChain method");
        }

        // log
        if (resultProto.items) {
          const items = resultProto.items
            .map((item) => item.type);
          this.emit("info", `Service:CertificateStorage:GetChain: ${items.join(",")} items:${items.length}`);
        }

        // result
        result.data = await resultProto.exportProto();

        break;
      }
      // getCRL
      case proto.CertificateStorageGetCRLActionProto.ACTION: {
        const params = await proto.CertificateStorageGetCRLActionProto.importProto(action);

        // do operation
        const crlArray = await new Promise<ArrayBuffer>((resolve, reject) => {
          request(params.url, { encoding: null }, (err, response, body) => {
            try {
              const message = `Cannot get CRL by URI '${params.url}'`;
              if (err) {
                throw new Error(`${message}. ${err.message}`);
              }
              if (response.statusCode !== 200) {
                throw new Error(`${message}. Bad status ${response.statusCode}`);
              }

              if (Buffer.isBuffer(body)) {
                body = body.toString("binary");
              }
              body = prepareData(body);
              // convert body to ArrayBuffer
              body = new Uint8Array(body).buffer;

              // try to parse CRL for checking
              try {
                const asn1 = asn1js.fromBER(body);
                if (asn1.result.error) {
                  throw new Error(`ASN1: ${asn1.result.error}`);
                }
                const crl = new pkijs.CertificateRevocationList({
                  schema: asn1.result,
                });
                if (!crl) {
                  throw new Error(`variable crl is empty`);
                }
              } catch (e) {
                console.error(e);
                throw new Error(`Cannot parse received CRL from URI '${params.url}'`);
              }

              resolve(body);
            } catch (e) {
              reject(e);
            }
          });
        });

        // result
        result.data = crlArray;

        break;
      }
      // getOCSP
      case pkijs.CertificateStorageGetOCSPActionProto.ACTION: {
        const params = await pkijs.CertificateStorageGetOCSPActionProto.importProto(action);

        // do operation
        const ocspArray = await new Promise<ArrayBuffer>((resolve, reject) => {
          let url = params.url;
          const options: request.CoreOptions = { encoding: null };
          if (params.options.method === "get") {
            // GET
            const b64 = Buffer.from(params.url).toString("hex");
            url += "/" + b64;
            options.method = "get";
          } else {
            // POST
            options.method = "post";
            options.headers = { "Content-Type": "application/ocsp-request" };
            options.body = Buffer.from(params.request);
          }
          request(url, options, (err, response, body) => {
            try {
              const message = `Cannot get OCSP by URI '${params.url}'`;
              if (err) {
                throw new Error(`${message}. ${err.message}`);
              }
              if (response.statusCode !== 200) {
                throw new Error(`${message}. Bad status ${response.statusCode}`);
              }

              if (Buffer.isBuffer(body)) {
                body = body.toString("binary");
              }
              body = prepareData(body);
              // convert body to ArrayBuffer
              body = new Uint8Array(body).buffer;

              // try to parse CRL for checking
              try {
                const asn1 = asn1js.fromBER(body);
                if (asn1.result.error) {
                  throw new Error(`ASN1: ${asn1.result.error}`);
                }
                const ocsp = new pkijs.OCSPResponse({
                  schema: asn1.result,
                });
                if (!ocsp) {
                  throw new Error(`variable ocsp is empty`);
                }
              } catch (e) {
                console.error(e);
                throw new Error(`Cannot parse received OCSP from URI '${params.url}'`);
              }

              resolve(body);
            } catch (e) {
              reject(e);
            }
          });
        });

        // result
        result.data = ocspArray;

        break;
      }
      default:
        throw new WebCryptoLocalError(WebCryptoLocalError.CODE.ACTION_NOT_IMPLEMENTED, `Action '${action.action}' is not implemented`);
    }
    return result;
  }

}

/**
 * Convert DER/PEM string to buffer
 *
 * @param data    Incoming DER/PEM string
 */
function prepareData(data: string) {
  if (data.indexOf("-----") === 0) {
    // incoming data is PEM encoded string
    data = data.replace(/-----[\w\s]+-----/gi, "").replace(/[\n\r]/g, "");
    return Buffer.from(data, "base64");
  } else {
    return Buffer.from(data, "binary");
  }
}

/**
 * Converts CryptoCertificate to PKIjs Certificate
 *
 * @param crypto      Crypto provider
 * @param cert        Crypto certificate
 */
async function certC2P(provider: CryptoStorages, cert: CryptoCertificate) {
  const certDer = await provider.certStorage.exportCert("raw", cert as any);
  const asn1 = asn1js.fromBER(certDer);
  const pkiCert = new pkijs.Certificate({ schema: asn1.result });
  return pkiCert;
}
