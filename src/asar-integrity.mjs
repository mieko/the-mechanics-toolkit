import crypto from "node:crypto";
import fs from "node:fs";

export function asarHeaderSha256(archive) {
  const descriptor = fs.openSync(archive, "r");
  try {
    const archiveSize = fs.fstatSync(descriptor).size;
    const prefix = readExactly(descriptor, 16, 0, archive);
    const sizePicklePayload = prefix.readUInt32LE(0);
    const headerPickleSize = prefix.readUInt32LE(4);
    const headerPicklePayload = prefix.readUInt32LE(8);
    const headerStringSize = prefix.readUInt32LE(12);

    if (sizePicklePayload !== 4) throw new Error(`Invalid ASAR size pickle in ${archive}`);
    if (headerPickleSize !== headerPicklePayload + 4 || headerPickleSize > archiveSize - 8) {
      throw new Error(`Invalid ASAR header size in ${archive}`);
    }
    if (headerStringSize > headerPicklePayload - 4) {
      throw new Error(`Invalid ASAR header string size in ${archive}`);
    }

    const header = readExactly(descriptor, headerStringSize, 16, archive);
    JSON.parse(header.toString("utf8"));
    return crypto.createHash("sha256").update(header).digest("hex");
  } finally {
    fs.closeSync(descriptor);
  }
}

function readExactly(descriptor, size, offset, archive) {
  const buffer = Buffer.alloc(size);
  if (fs.readSync(descriptor, buffer, 0, size, offset) !== size) {
    throw new Error(`Truncated ASAR header in ${archive}`);
  }
  return buffer;
}
