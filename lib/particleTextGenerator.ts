export type ParticleTargets = {
  positions: Float32Array;
  brightness: Float32Array;
  sizes: Float32Array;
};

export function generateParticleText(text: string, count: number): ParticleTargets {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 360;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const siteFont = getComputedStyle(document.body).fontFamily;
  ctx.font = `300 172px ${siteFont}`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const candidates: Array<[number, number, number]> = [];
  for (let y = 2; y < canvas.height; y += 2) {
    for (let x = 2; x < canvas.width; x += 2) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 40) candidates.push([x, y, alpha / 255]);
    }
  }

  const positions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const sample = candidates[(Math.random() * candidates.length) | 0];
    const jitterX = (Math.random() - 0.5) * 2.2;
    const jitterY = (Math.random() - 0.5) * 2.2;
    // Preserve the full particle count while compressing the wordmark by 15%,
    // producing a smaller but denser and more legible particle silhouette.
    positions[i * 3] = ((sample[0] + jitterX) / canvas.width - 0.5) * 1.462;
    positions[i * 3 + 1] = -((sample[1] + jitterY) / canvas.height - 0.5) * 0.442;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
    brightness[i] = 0.28 + Math.random() * 0.72;
    sizes[i] = 0.72 + Math.random() * 1.75;
  }
  return { positions, brightness, sizes };
}
