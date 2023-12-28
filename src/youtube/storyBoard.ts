interface StoryboardFragment {
  url: string;
  duration: number;
}

interface Storyboard {
  format_id: string;
  format_note: string;
  ext: string;
  protocol: string;
  acodec: string;
  vcodec: string;
  url: string;
  width: number;
  height: number;
  fps: number;
  rows: number;
  columns: number;
  fragments: StoryboardFragment[];
}

export function extractStoryboard(specUrl: any, duration: number): Storyboard[] | undefined {
  const spec = (specUrl || '').split('|').reverse();
  const baseUrl = urlOrNone(urljoin('https://i.ytimg.com/', spec.pop() || null));

  if (!baseUrl) {
    return;
  }

  const L = spec.length - 1;
  const storyboards: Storyboard[] = [];

  function reportWarning(message: string): void {
    console.warn(`Warning: ${message}`);
  }

  for (let i = 0; i < spec.length; i++) {
    const args = spec[i].split('#').map((arg: string) => arg.trim());
    const counts = args.slice(0, 5).map(Number);

    if (args.length !== 8 || counts.some(isNaN) || counts.some((count: number) => count === 0)) {
      reportWarning(`Malformed storyboard ${i}: ${args.join('#')}`);
      continue;
    }

    const [width, height, frameCount, cols, rows] = counts;
    const [N, sigh] = args.slice(6);

    const url = baseUrl.replace('$L', (L - i).toString()).replace('$N', N) + `&sigh=${sigh}`;
    const fragmentCount = frameCount / (cols * rows);
    const fragmentDuration = duration / fragmentCount;

    const storyboard: Storyboard = {
      format_id: `sb${i}`,
      format_note: 'storyboard',
      ext: 'mhtml',
      protocol: 'mhtml',
      acodec: 'none',
      vcodec: 'none',
      url: url,
      width: width,
      height: height,
      fps: frameCount / duration,
      rows: rows,
      columns: cols,
      fragments: Array.from({ length: Math.ceil(fragmentCount) }, (_, j) => ({
        url: url.replace('$M', j.toString()),
        duration: Math.min(fragmentDuration, duration - (j * fragmentDuration)),
      })),
    };

    storyboards.push(storyboard);
  }

  return storyboards;
}

function isNaN(value: number): boolean {
  return Number.isNaN(value);
}
function urljoin(base: string, path: string): string {
  return new URL(path, base).toString();
}

function urlOrNone(url: string | null): string | null {
  return url ?? null;
}