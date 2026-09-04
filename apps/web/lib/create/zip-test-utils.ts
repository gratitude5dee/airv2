/** Minimal stored-zip writer for tests (mirrors lib/miniapps/bundles.test.ts). */
export function makeZip(entries: { name: string; data: Buffer | string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const payload = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    const localFull = Buffer.concat([local, name, payload]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(payload.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    locals.push(localFull);
    offset += localFull.length;
  }
  const centralStart = offset;
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}
