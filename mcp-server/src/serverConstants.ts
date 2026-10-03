// DataForSEO accepts ISO-639 language codes as well as locale-qualified
// BCP-47 values (for example `zh-CN` and `zh-TW`). Search Console's URL
// Inspection API likewise uses locale-qualified values such as `en-US`.
export const LANGUAGE_CODE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export const READ_ONLY_HINTS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
