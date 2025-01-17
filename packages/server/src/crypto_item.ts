import * as proto from "@webcrypto-local/proto";
import * as core from "webcrypto-core";
import { DEFAULT_HASH_ALG } from "./const";
import { WebCryptoLocalError } from "./error";
import { digest } from "./helper";

export interface CryptoItem {
  type: string;
}

export class ServiceCryptoItem {

  public id: string;
  public providerID: string;

  public item: CryptoItem;

  constructor(item: CryptoItem, providerID: string) {
    const p11Object = (item as any).p11Object;
    const id = `${providerID}${p11Object.session.handle.toString()}${p11Object.handle.toString()}${item.type}${(item as any).id}`;
    this.id = digest(DEFAULT_HASH_ALG, id).toString("hex");
    this.item = item;
    this.providerID = providerID;
  }

  public toKeyProto(item: CryptoKey) {
    const itemProto = new proto.CryptoKeyProto();
    itemProto.providerID = this.providerID;
    itemProto.id = this.id;
    itemProto.algorithm.fromAlgorithm(item.algorithm);
    itemProto.extractable = item.extractable;
    itemProto.type = item.type;
    itemProto.usages = item.usages;
    return itemProto;
  }
  public toX509Proto(item: core.CryptoX509Certificate) {
    const itemProto = new proto.CryptoX509CertificateProto();
    itemProto.providerID = this.providerID;
    itemProto.publicKey = this.toKeyProto(item.publicKey);
    itemProto.id = itemProto.publicKey.id;
    itemProto.serialNumber = item.serialNumber;
    itemProto.issuerName = item.issuerName;
    itemProto.subjectName = item.subjectName;
    itemProto.notBefore = item.notBefore;
    itemProto.notAfter = item.notAfter;
    itemProto.type = item.type;
    return itemProto;
  }
  public toX509RequestProto(item: core.CryptoX509CertificateRequest) {
    const itemProto = new proto.CryptoX509CertificateRequestProto();
    itemProto.providerID = this.providerID;
    itemProto.publicKey = this.toKeyProto(item.publicKey);
    itemProto.id = itemProto.publicKey.id;
    itemProto.subjectName = item.subjectName;
    itemProto.type = item.type;
    return itemProto;
  }

  public toProto() {
    switch (this.item.type) {
      case "secret":
      case "public":
      case "private": {
        return this.toKeyProto(this.item as any);
      }
      case "x509": {
        return this.toX509Proto(this.item as any);
      }
      case "request": {
        return this.toX509RequestProto(this.item as any);
      }
      default:
        throw new WebCryptoLocalError(WebCryptoLocalError.CODE.CARD_CONFIG_COMMON, `Unsupported CertificateItem type '${this.item.type}'`);
    }
  }
}
