import { Type, Schema } from 'quantizer';

export default new Schema('Request', {
  id: Type.ObjectID,
  _id: Type.ObjectID,
  name: Type.String,
  selected: Type.Boolean,
  type: Type.String,
  pem: Type.String,
  subject: Type.Map,
  publicKey: {
    modulusBits: Type.Any,
    namedCurve: Type.Any,
    type: Type.String,
    publicExponent: Type.Any,
    algorithm: Type.String,
    value: Type.String,
  },
  signature: {
    algorithm: Type.String,
    hash: Type.String,
    value: Type.String,
  },
});