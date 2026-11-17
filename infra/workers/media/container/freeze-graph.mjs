// The freeze edit plan: source[clipIn→freezeAt] + camera move +
// source[freezeAt→clipOut], normalized to the camera clip's geometry at
// 30fps. Sub-frame edges (<1/30s) are dropped rather than producing an empty
// concat leg; audio legs mirror the video legs, padded silent where a side
// has no track. Mirrors buildFreezeEditGraph in apps/web/lib/miniapps/freeze.ts.

/**
 * @param {number} width
 * @param {number} height
 * @param {{ clipIn: number, clipOut: number, freezeAt: number }} window
 * @param {number} cameraDuration
 * @param {boolean} sourceAudio
 * @param {boolean} cameraAudio
 * @returns {{ graph: string, hasAudio: boolean }}
 */
export function buildFreezeEditGraph(width, height, window, cameraDuration, sourceAudio, cameraAudio) {
  const clipIn = Math.max(0, window.clipIn);
  const clipOut = window.clipOut;
  const freezeAt = Math.min(Math.max(window.freezeAt, clipIn), clipOut);
  const normalize = `scale=${width}:${height},setsar=1,fps=30,format=yuv420p`;
  const hasAudio = sourceAudio || cameraAudio;
  const graph = [];
  const segments = [];
  const audios = [];

  const sourceLeg = (label, start, end) => {
    const duration = end - start;
    if (duration < 1 / 30) return;
    graph.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,${normalize}[${label}]`);
    segments.push(`[${label}]`);
    if (!hasAudio) return;
    graph.push(
      sourceAudio
        ? `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${duration}[a${label}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${label}]`,
    );
    audios.push(`[a${label}]`);
  };

  sourceLeg("before", clipIn, freezeAt);
  graph.push(`[1:v]setpts=PTS-STARTPTS,${normalize}[camera]`);
  segments.push("[camera]");
  if (hasAudio) {
    graph.push(
      cameraAudio
        ? `[1:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${cameraDuration}[acamera]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${cameraDuration},asetpts=PTS-STARTPTS[acamera]`,
    );
    audios.push("[acamera]");
  }
  sourceLeg("after", freezeAt, clipOut);

  graph.push(`${segments.join("")}concat=n=${segments.length}:v=1:a=0[v]`);
  if (hasAudio) graph.push(`${audios.join("")}concat=n=${audios.length}:v=0:a=1[a]`);
  return { graph: graph.join(";"), hasAudio };
}
