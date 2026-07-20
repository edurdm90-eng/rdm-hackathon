type BrowserBufferEncoding = "base64" | "hex" | "utf-8" | "utf8";

type BufferInput = ArrayBuffer | ArrayLike<number> | string;
type BrowserBufferValue = Uint8Array & {
  toString: (encoding?: BrowserBufferEncoding) => string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesFromHex(value: string) {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  const bytes = new Uint8Array(Math.ceil(normalized.length / 2));

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function makeBuffer(bytes: ArrayBuffer | ArrayLike<number>) {
  const buffer = new Uint8Array(bytes as ArrayLike<number>) as BrowserBufferValue;

  buffer.toString = (encoding: BrowserBufferEncoding = "utf8") => {
    if (encoding === "hex") {
      return [...buffer].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    if (encoding === "base64") {
      return base64FromBytes(buffer);
    }

    return textDecoder.decode(buffer);
  };

  return buffer;
}

const BrowserBuffer = {
  from(input: BufferInput, encoding?: BrowserBufferEncoding) {
    if (typeof input === "string") {
      if (encoding === "hex") {
        return makeBuffer(bytesFromHex(input));
      }

      if (encoding === "base64") {
        return makeBuffer(bytesFromBase64(input));
      }

      return makeBuffer(textEncoder.encode(input));
    }

    if (input instanceof ArrayBuffer) {
      return makeBuffer(input);
    }

    return makeBuffer(input);
  },

  alloc(size: number, fill = 0) {
    const buffer = makeBuffer(new Uint8Array(size));
    buffer.fill(fill);
    return buffer;
  },

  concat(buffers: Uint8Array[]) {
    const length = buffers.reduce((total, buffer) => total + buffer.length, 0);
    const output = makeBuffer(new Uint8Array(length));
    let offset = 0;

    for (const buffer of buffers) {
      output.set(buffer, offset);
      offset += buffer.length;
    }

    return output;
  },

  isBuffer(value: unknown) {
    return value instanceof Uint8Array;
  },
};

const browserGlobal = globalThis as Record<string, unknown>;

browserGlobal.Buffer ??= BrowserBuffer;
browserGlobal.global ??= globalThis;
