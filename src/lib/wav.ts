export type WavInfo = {
  /** 1 = PCM, 3 = IEEE float, 0xfffe = extensible. */
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSeconds: number;
};

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

/** Reads the RIFF/WAVE header. Returns null for anything that isn't a usable WAV file. */
export function parseWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let fmt: Omit<WavInfo, "dataBytes" | "durationSeconds"> | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && size >= 16 && body + 16 <= bytes.length) {
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data" && fmt) {
      // Streaming writers sometimes leave the size at 0 or 0xffffffff; trust the file length then.
      const dataBytes = size === 0 || size === 0xffffffff ? bytes.length - body : Math.min(size, bytes.length - body);
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      if (!fmt.channels || !fmt.sampleRate || !bytesPerSecond) return null;
      return { ...fmt, dataBytes, durationSeconds: dataBytes / bytesPerSecond };
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  return null;
}

/** Builds a mono 16-bit PCM WAV file. */
export function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  new Int16Array(buffer, 44).set(samples);
  return new Uint8Array(buffer);
}

/** A few soft beeps; stands in for speech in the development mock. */
export function toneWav(seconds: number, sampleRate = 24000): Uint8Array {
  const samples = new Int16Array(Math.round(seconds * sampleRate));
  const beat = Math.round(sampleRate * 0.25);
  for (let i = 0; i < samples.length; i++) {
    const inBeat = i % beat;
    if (inBeat > beat * 0.6) continue; // short pause between beeps
    const pitch = 440 + 110 * (Math.floor(i / beat) % 3);
    const envelope = Math.sin((Math.PI * inBeat) / (beat * 0.6));
    samples[i] = Math.round(Math.sin((2 * Math.PI * pitch * i) / sampleRate) * envelope * 8000);
  }
  return encodeWav(samples, sampleRate);
}
