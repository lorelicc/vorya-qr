import { Illustration, art } from "./Illustration";
import { Blob, Lines, MiniQr, Paper, Stroke } from "./parts";

/** Artwork of the authentication pages (same layout idea as Sign's login artwork). */
export function AuthArtwork() {
  return (
    <Illustration size={360} viewBox="0 0 320 240">
      <Blob x={100} y={130} r={84} tone="glow" />
      <Blob x={236} y={86} r={52} tone="lilac" slow />
      <Blob x={250} y={196} r={30} tone="peach" />
      <g className={art.float}>
        <Paper x={56} y={70} w={208} h={104} r={18} />
        <MiniQr x={76} y={92} cell={9} />
        <Lines x={160} y={98} w={84} rows={3} />
      </g>
      <Stroke d="M40 52c18-20 44-24 62-10" tone="paper" />
      <Stroke d="M220 206c20 6 40 0 52-18" tone="paper" width={2.5} />
    </Illustration>
  );
}
