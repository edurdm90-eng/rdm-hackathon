function bytesToObjectIdHex(value: unknown): string | null {
  let bytes: unknown[] | null = null;

  if (value instanceof Uint8Array) {
    bytes = Array.from(value);
  } else if (Array.isArray(value)) {
    bytes = value;
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.data)) {
      bytes = record.data;
    } else {
      const numericKeys = Object.keys(record)
        .filter((key) => /^\d+$/.test(key))
        .sort((left, right) => Number(left) - Number(right));

      if (numericKeys.length === 12) {
        bytes = numericKeys.map((key) => record[key]);
      }
    }
  }

  if (
    !bytes ||
    bytes.length !== 12 ||
    !bytes.every((byte) => Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255)
  ) {
    return null;
  }

  return bytes.map((byte) => Number(byte).toString(16).padStart(2, "0")).join("");
}

function cleanIdString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 && normalized !== "[object Object]" ? normalized : null;
}

export function normalizeAuthRecordId(value: unknown): string | null {
  const primitiveId = cleanIdString(value);

  if (primitiveId) {
    return primitiveId;
  }

  if (value == null) {
    return null;
  }

  if (typeof value !== "object") {
    return cleanIdString(String(value));
  }

  const record = value as Record<string, unknown>;

  for (const key of ["$oid", "oid"] as const) {
    const id = cleanIdString(record[key]);

    if (id) {
      return id;
    }
  }

  if (typeof record.toHexString === "function") {
    const id = cleanIdString(record.toHexString());

    if (id) {
      return id;
    }
  }

  for (const key of ["buffer", "id"] as const) {
    const id = bytesToObjectIdHex(record[key]);

    if (id) {
      return id;
    }
  }

  if (record._id !== value) {
    const id = normalizeAuthRecordId(record._id);

    if (id) {
      return id;
    }
  }

  if (record.id !== value) {
    const id = normalizeAuthRecordId(record.id);

    if (id) {
      return id;
    }
  }

  if (
    typeof record.toString === "function" &&
    record.toString !== Object.prototype.toString
  ) {
    return cleanIdString(record.toString());
  }

  return null;
}
