import { Type, Schema } from 'quantizer';

export default new Schema('Certificate', {
  id: Type.ObjectID,
  _id: Type.ObjectID,
  name: Type.String,
  commonName: Type.String,
  organization: Type.String,
  organizationUnit: Type.String,
  country: Type.String,
  region: Type.String,
  city: Type.String,
  keyInfo: {
    modulusBits: Type.Any,
    namedCurve: Type.Any,
    publicExponent: Type.Any,
    type: Type.String,
  },
  selected: Type.Boolean,
  type: Type.String,
});
