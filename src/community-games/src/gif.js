// مشفّر GIF متحرك بدون اي مكتبة خارجية (باليت موحد + LZW)
// الاستخدام:
//   const g = new GifWriter(w, h);
//   g.setPalette(g.buildPalette([rgbaFrame1, rgbaFrame2, ...]));
//   g.addFrame(rgbaData, delayInCentiseconds);
//   const buffer = g.finish();
// الفريمات تكون Uint8ClampedArray / Buffer بصيغة RGBA (مثل getImageData().data)

const key5 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

class GifWriter {
  constructor(w, h, { loop = false, transparent = false } = {}) {
    this.w = w; this.h = h; this.out = [];
    this.palette = null; this.lut = null;
    this.transparent = transparent;
    this.u8(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // GIF89a
    this.u16(w); this.u16(h);
    this.u8(0xF7, 0, 0); // جدول الوان عام 256 لون
    this.headerPos = this.out.length; // مكان الباليت العام (نكتبه بعدين)
    this.loop = loop;
  }
  u8(...a) { for (const v of a) this.out.push(v & 255); }
  u16(v) { this.out.push(v & 255, (v >> 8) & 255); }

  // median cut على هيستوجرام 5 بت لكل قناة، ناخذ عينة من عدة فريمات
  buildPalette(frames, size = this.transparent ? 255 : 256) {
    const hist = new Uint32Array(32768);
    for (const f of frames) {
      for (let i = 0; i < f.length; i += 4) {
        if (!this.transparent || f[i + 3] >= 128) hist[key5(f[i], f[i + 1], f[i + 2])]++;
      }
    }
    let boxes = [{ keys: [] }];
    for (let k = 0; k < 32768; k++) if (hist[k]) boxes[0].keys.push(k);
    const rgb = k => [(k >> 10) << 3 | 4, ((k >> 5) & 31) << 3 | 4, (k & 31) << 3 | 4];
    const stats = box => {
      let min = [255, 255, 255], max = [0, 0, 0], n = 0;
      for (const k of box.keys) {
        const c = rgb(k), h = hist[k]; n += h;
        for (let i = 0; i < 3; i++) { if (c[i] < min[i]) min[i] = c[i]; if (c[i] > max[i]) max[i] = c[i]; }
      }
      const rg = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
      box.n = n; box.axis = rg.indexOf(Math.max(...rg)); box.range = rg[box.axis];
    };
    stats(boxes[0]);
    while (boxes.length < size) {
      // نقسم اكبر صندوق (بعدد البكسلات × مداه)
      let bi = -1, best = 0;
      boxes.forEach((b, i) => { const s = b.keys.length > 1 ? b.n * (1 + b.range) : 0; if (s > best) { best = s; bi = i; } });
      if (bi < 0) break;
      const b = boxes[bi], ax = b.axis;
      b.keys.sort((p, q) => rgb(p)[ax] - rgb(q)[ax]);
      let acc = 0, cut = 1;
      for (let i = 0; i < b.keys.length - 1; i++) { acc += hist[b.keys[i]]; cut = i + 1; if (acc >= b.n / 2) break; }
      const a = { keys: b.keys.slice(0, cut) }, c = { keys: b.keys.slice(cut) };
      stats(a); stats(c);
      boxes.splice(bi, 1, a, c);
    }
    const pal = boxes.map(b => {
      let r = 0, g = 0, bl = 0, n = 0;
      for (const k of b.keys) { const c = rgb(k), h = hist[k]; r += c[0] * h; g += c[1] * h; bl += c[2] * h; n += h; }
      return n ? [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] : [0, 0, 0];
    });
    while (pal.length < size) pal.push([0, 0, 0]);
    return pal;
  }

  setPalette(pal) {
    this.palette = this.transparent ? [[0, 0, 0], ...pal].slice(0, 256) : pal;
    while (this.palette.length < 256) this.palette.push([0, 0, 0]);
    // جدول بحث: كل لون 5 بت -> اقرب لون بالباليت
    this.lut = new Uint8Array(32768);
    for (let k = 0; k < 32768; k++) {
      const r = (k >> 10) << 3 | 4, g = ((k >> 5) & 31) << 3 | 4, b = (k & 31) << 3 | 4;
      let bi = 0, bd = Infinity;
      for (let i = this.transparent ? 1 : 0; i < this.palette.length; i++) {
        const dr = r - this.palette[i][0], dg = g - this.palette[i][1], db = b - this.palette[i][2];
        const d = dr * dr * 3 + dg * dg * 4 + db * db * 2; // وزن تقريبي للعين
        if (d < bd) { bd = d; bi = i; }
      }
      this.lut[k] = bi;
    }
    for (const c of this.palette) this.u8(c[0], c[1], c[2]);
    if (this.loop) { // تكرار لا نهائي (بدون هذا الامتداد يتشغل مرة وحدة ويوقف)
      this.u8(0x21, 0xFF, 0x0B); for (const ch of 'NETSCAPE2.0') this.u8(ch.charCodeAt(0));
      this.u8(3, 1, 0, 0, 0);
    }
  }

  addFrame(rgba, delayCs = 5) {
    if (!this.palette) throw new Error('setPalette اول');
    const n = this.w * this.h, idx = new Uint8Array(n), lut = this.lut;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      idx[i] = this.transparent && rgba[p + 3] < 128 ? 0 : lut[key5(rgba[p], rgba[p + 1], rgba[p + 2])];
    }
    this.u8(0x21, 0xF9, 4, this.transparent ? 0x09 : 0x04);
    this.u16(delayCs); this.u8(0, 0);
    this.u8(0x2C); this.u16(0); this.u16(0); this.u16(this.w); this.u16(this.h); this.u8(0);
    this.u8(8); // الحد الادنى لحجم كود LZW
    const data = lzw(idx, 8);
    for (let i = 0; i < data.length; i += 255) {
      const len = Math.min(255, data.length - i);
      this.out.push(len);
      for (let j = 0; j < len; j++) this.out.push(data[i + j]);
    }
    this.out.push(0);
  }

  finish() { this.out.push(0x3B); return Buffer.from(this.out); }
}

// ضغط LZW حسب مواصفات GIF
function lzw(idx, minBits) {
  const clear = 1 << minBits, eoi = clear + 1;
  const bytes = [];
  let cur = 0, nbits = 0;
  const write = (code, size) => {
    cur |= code << nbits; nbits += size;
    while (nbits >= 8) { bytes.push(cur & 255); cur >>>= 8; nbits -= 8; }
  };
  let size = minBits + 1, next = eoi + 1;
  let dict = new Map();
  write(clear, size);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const c = idx[i], k = (prefix << 8) | c, hit = dict.get(k);
    if (hit !== undefined) { prefix = hit; continue; }
    write(prefix, size);
    if (next < 4096) {
      dict.set(k, next++);
      if (next > (1 << size) && size < 12) size++;
    } else {
      write(clear, size); dict = new Map(); size = minBits + 1; next = eoi + 1;
    }
    prefix = c;
  }
  write(prefix, size);
  write(eoi, size);
  if (nbits > 0) bytes.push(cur & 255);
  return bytes;
}

module.exports = { GifWriter };
