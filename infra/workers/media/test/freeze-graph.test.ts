import { describe, expect, it } from "vitest";
import { buildFreezeEditGraph } from "../container/freeze-graph.mjs";

describe("buildFreezeEditGraph", () => {
  it("splices the camera move between two source legs", () => {
    const { graph, hasAudio } = buildFreezeEditGraph(1920, 1080, { clipIn: 4, clipOut: 20, freezeAt: 12 }, 5, true, false);
    expect(hasAudio).toBe(true);
    expect(graph).toContain("trim=start=4:end=12");
    expect(graph).toContain("trim=start=12:end=20");
    expect(graph).toContain("scale=1920:1080,setsar=1,fps=30,format=yuv420p");
    expect(graph).toContain("[before][camera][after]concat=n=3:v=1:a=0[v]");
    expect(graph).toContain("atrim=start=4:end=12");
    expect(graph).toContain("anullsrc=r=48000:cl=stereo,atrim=duration=5");
    expect(graph).toContain("[abefore][acamera][aafter]concat=n=3:v=0:a=1[a]");
  });

  it("drops a sub-frame front edge instead of emitting an empty leg", () => {
    const { graph, hasAudio } = buildFreezeEditGraph(1280, 720, { clipIn: 10, clipOut: 20, freezeAt: 10.01 }, 5, false, false);
    expect(hasAudio).toBe(false);
    expect(graph).not.toContain("[before]");
    expect(graph).not.toContain("[a]");
    expect(graph).toContain("[camera][after]concat=n=2:v=1:a=0[v]");
  });

  it("clamps freezeAt into the window", () => {
    const { graph } = buildFreezeEditGraph(1280, 720, { clipIn: 2, clipOut: 8, freezeAt: 30 }, 6, true, true);
    expect(graph).toContain("trim=start=2:end=8");
    expect(graph).toContain("[1:a]asetpts");
    expect(graph).toContain("[before][camera]concat=n=2:v=1:a=0[v]");
  });
});
