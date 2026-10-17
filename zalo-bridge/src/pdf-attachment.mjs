import { createHash } from 'node:crypto';

export const MAX_PDF_BYTES = 1024 * 1024;

export function pdfAttachmentSource(value) {
  if (!value || typeof value !== 'object'
      || typeof value.name !== 'string' || !/^P97_BaoGia_[a-f0-9-]{36}\.pdf$/i.test(value.name)
      || typeof value.base64 !== 'string' || value.base64.length > Math.ceil(MAX_PDF_BYTES / 3) * 4
      || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    throw Object.assign(new Error('Invalid PDF attachment'), { name:'ZaloValidationError' });
  }
  const data = Buffer.from(value.base64,'base64');
  if (data.length > MAX_PDF_BYTES || !data.subarray(0,5).equals(Buffer.from('%PDF-'))
      || data.toString('base64') !== value.base64
      || createHash('sha256').update(data).digest('hex') !== value.sha256) {
    throw Object.assign(new Error('Invalid PDF content or checksum'), { name:'ZaloValidationError' });
  }
  return { data,filename:value.name,metadata:{ totalSize:data.length } };
}
