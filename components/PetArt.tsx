import { useId, useState } from "react";
import type { Accessory, Expression, Pet, Scene } from "@/lib/types";

const INK = "#4A2E22";

/* ---------- Head (drawn in a 200x200 box, head centred ~ (100,108)) ---------- */

function Head({ pet, expression = "happy", accessory = "none" }: { pet: Pet; expression?: Expression; accessory?: Accessory }) {
  const { look, species } = pet;
  const fur = look.fur;
  const ear = look.ear ?? fur;
  const muzzle = look.muzzle ?? fur;
  const dark = fur === "#3E3A3A";
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  const isCatlike = species === "cat";
  const headRx = species === "hamster" ? 64 : isCatlike ? 60 : 57;
  const headRy = species === "hamster" ? 56 : isCatlike ? 51 : 54;

  // Ears behind the head
  let ears: React.ReactNode = null;
  switch (look.earStyle) {
    case "floppy":
      ears = (
        <>
          <ellipse cx="46" cy="110" rx="20" ry="40" fill={ear} transform="rotate(16 46 110)" {...stroke} />
          <ellipse cx="154" cy="110" rx="20" ry="40" fill={ear} transform="rotate(-16 154 110)" {...stroke} />
        </>
      );
      break;
    case "pointy":
      ears = (
        <>
          <path d="M52 88 L46 26 L96 62 Z" fill={ear} {...stroke} />
          <path d="M148 88 L154 26 L104 62 Z" fill={ear} {...stroke} />
          <path d="M58 78 L55 42 L84 63 Z" fill="#F6C1C1" opacity=".85" />
          <path d="M142 78 L145 42 L116 63 Z" fill="#F6C1C1" opacity=".85" />
        </>
      );
      break;
    case "cat":
      ears = (
        <>
          <path d="M50 86 L50 30 L92 60 Z" fill={ear} {...stroke} />
          <path d="M150 86 L150 30 L108 60 Z" fill={ear} {...stroke} />
          <path d="M58 76 L58 44 L82 62 Z" fill="#F4B6B9" />
          <path d="M142 76 L142 44 L118 62 Z" fill="#F4B6B9" />
        </>
      );
      break;
    case "bunny":
      ears = (
        <>
          <ellipse cx="72" cy="40" rx="15" ry="44" fill={ear} transform="rotate(-12 72 40)" {...stroke} />
          <ellipse cx="128" cy="40" rx="15" ry="44" fill={ear} transform="rotate(12 128 40)" {...stroke} />
          <ellipse cx="72" cy="42" rx="7" ry="32" fill="#F4C0C4" transform="rotate(-12 72 42)" />
          <ellipse cx="128" cy="42" rx="7" ry="32" fill="#F4C0C4" transform="rotate(12 128 42)" />
        </>
      );
      break;
    case "round":
      ears = (
        <>
          <circle cx="54" cy="64" r="16" fill={ear} {...stroke} />
          <circle cx="146" cy="64" r="16" fill={ear} {...stroke} />
          <circle cx="54" cy="64" r="8" fill="#F4B6B9" />
          <circle cx="146" cy="64" r="8" fill="#F4B6B9" />
        </>
      );
      break;
    case "fluffy":
      ears = (
        <>
          {[0, 1, 2].map((i) => (
            <circle key={`l${i}`} cx={42 - i * 2} cy={100 + i * 18} r="17" fill={ear} {...stroke} />
          ))}
          {[0, 1, 2].map((i) => (
            <circle key={`r${i}`} cx={158 + i * 2} cy={100 + i * 18} r="17" fill={ear} {...stroke} />
          ))}
        </>
      );
      break;
  }

  // Fluffy heads are a cloud of curls.
  const fluffy = look.earStyle === "fluffy";
  const curls = fluffy
    ? Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return { x: 100 + Math.cos(a) * 54, y: 104 + Math.sin(a) * 50 };
      })
    : [];

  const eyeY = 104;
  const eye = (cx: number, wink = false) =>
    expression === "sleepy" || wink ? (
      <path d={`M${cx - 8} ${eyeY} Q${cx} ${eyeY + 7} ${cx + 8} ${eyeY}`} fill="none" stroke={dark ? "#fff" : INK} strokeWidth="3.5" strokeLinecap="round" />
    ) : (
      <g>
        {isCatlike ? (
          <ellipse cx={cx} cy={eyeY} rx="7.5" ry="9.5" fill="#2B1B15" />
        ) : (
          <circle cx={cx} cy={eyeY} r="7.5" fill="#2B1B15" />
        )}
        <circle cx={cx - 2.5} cy={eyeY - 3} r="2.6" fill="#fff" />
      </g>
    );

  return (
    <g>
      {ears}
      {fluffy ? (
        <>
          {curls.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r="16" fill={fur} {...stroke} />
          ))}
          <ellipse cx="100" cy="104" rx="56" ry="52" fill={fur} />
        </>
      ) : (
        <ellipse cx="100" cy="108" rx={headRx} ry={headRy} fill={fur} {...stroke} />
      )}

      {/* tabby stripes */}
      {look.stripes && (
        <g stroke={look.stripes} strokeWidth="4.5" strokeLinecap="round" opacity=".8">
          <path d="M90 62 L93 78" />
          <path d="M100 59 L100 78" />
          <path d="M110 62 L107 78" />
          <path d="M44 104 L56 106" />
          <path d="M156 104 L144 106" />
        </g>
      )}

      {/* muzzle / blaze */}
      {species === "dog" && look.earStyle === "pointy" && (
        <path d="M100 82 C88 96 66 112 66 130 C66 150 84 160 100 160 C116 160 134 150 134 130 C134 112 112 96 100 82 Z" fill={muzzle} />
      )}
      {species === "dog" && look.earStyle !== "pointy" && <ellipse cx="100" cy="132" rx="27" ry="20" fill={muzzle} />}
      {isCatlike && <ellipse cx="100" cy="132" rx="24" ry="17" fill={muzzle} />}
      {(species === "hamster" || species === "bunny") && (
        <>
          <ellipse cx="72" cy="130" rx="20" ry="16" fill={muzzle} />
          <ellipse cx="128" cy="130" rx="20" ry="16" fill={muzzle} />
        </>
      )}

      {/* blush */}
      <ellipse cx="64" cy="126" rx="10" ry="5.5" fill="#F59AA6" opacity=".55" />
      <ellipse cx="136" cy="126" rx="10" ry="5.5" fill="#F59AA6" opacity=".55" />

      {eye(78)}
      {eye(122, expression === "wink")}

      {/* nose + mouth */}
      {species === "dog" ? (
        <path d="M89 120 Q100 113 111 120 Q107 131 100 132 Q93 131 89 120 Z" fill="#2B1B15" />
      ) : (
        <path d="M94 121 L106 121 L100 128 Z" fill="#E88A96" stroke="#C86C78" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      <path
        d={species === "dog" ? "M100 132 Q100 142 90 142 M100 132 Q100 142 110 142" : "M100 128 Q99 136 91 135 M100 128 Q101 136 109 135"}
        fill="none"
        stroke={dark ? "#fff" : INK}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {expression === "happy" && species === "dog" && (
        <path d="M93 142 Q100 162 107 142 Z" fill="#F07A8A" stroke="#C85B6B" strokeWidth="1.5" />
      )}
      {species === "bunny" && <rect x="96" y="134" width="8" height="8" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />}

      {/* whiskers */}
      {(isCatlike || species === "bunny" || species === "hamster") && (
        <g stroke={dark ? "#ddd" : "#6B5A50"} strokeWidth="1.6" strokeLinecap="round" opacity=".6">
          <path d="M70 128 L38 122" />
          <path d="M70 134 L38 138" />
          <path d="M130 128 L162 122" />
          <path d="M130 134 L162 138" />
        </g>
      )}

      <AccessoryArt kind={accessory} />
    </g>
  );
}

function AccessoryArt({ kind }: { kind: Accessory }) {
  const s = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  switch (kind) {
    case "bandana":
      return (
        <g>
          <path d="M60 154 Q100 170 140 154 L100 196 Z" fill="#F08A9B" {...s} />
          {[[92, 168], [108, 168], [100, 180]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill="#fff" />
          ))}
        </g>
      );
    case "party":
      return (
        <g transform="rotate(18 130 40)">
          <path d="M112 62 L132 2 L152 62 Z" fill="#A9CDEB" {...s} />
          <path d="M118 44 L146 44 M124 26 L140 26" stroke="#F08A9B" strokeWidth="5" />
          <circle cx="132" cy="2" r="8" fill="#FBD58A" {...s} />
        </g>
      );
    case "flowers": {
      const pts = [
        [58, 70],
        [78, 58],
        [100, 54],
        [122, 58],
        [142, 70],
      ];
      const cols = ["#F7A9B8", "#FBD58A", "#F7A9B8", "#C9B7EE", "#F7A9B8"];
      return (
        <g>
          {pts.map(([x, y], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((r) => (
                <circle key={r} cx={x + Math.cos((r * Math.PI) / 180) * 6} cy={y + Math.sin((r * Math.PI) / 180) * 6} r="5.5" fill={cols[i]} />
              ))}
              <circle cx={x} cy={y} r="3.5" fill="#F5B94A" />
            </g>
          ))}
          <path d="M66 74 L70 66 M88 60 L92 56 M110 56 L114 58 M132 62 L136 66" stroke="#7DB36A" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    }
    case "sunglasses":
      return (
        <g>
          <rect x="60" y="92" width="34" height="22" rx="9" fill="#2B1B15" {...s} />
          <rect x="106" y="92" width="34" height="22" rx="9" fill="#2B1B15" {...s} />
          <path d="M94 100 Q100 96 106 100" fill="none" {...s} />
          <path d="M66 98 L76 98" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
          <path d="M112 98 L122 98" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
        </g>
      );
    case "bow":
      return (
        <g transform="translate(128 52) rotate(14)">
          <path d="M0 0 L-20 -12 L-20 12 Z" fill="#F08A9B" {...s} />
          <path d="M0 0 L20 -12 L20 12 Z" fill="#F08A9B" {...s} />
          <circle cx="0" cy="0" r="6" fill="#F7B2BE" {...s} />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M72 64 L68 30 L86 46 L100 24 L114 46 L132 30 L128 64 Z" fill="#FBD58A" {...s} />
          <circle cx="100" cy="50" r="4" fill="#F08A9B" />
          <circle cx="82" cy="54" r="3" fill="#A9CDEB" />
          <circle cx="118" cy="54" r="3" fill="#A9CDEB" />
        </g>
      );
    case "hat":
      return (
        <g>
          <ellipse cx="100" cy="64" rx="62" ry="12" fill="#EAD7B7" {...s} />
          <path d="M66 62 Q68 22 100 22 Q132 22 134 62 Z" fill="#EAD7B7" {...s} />
          <path d="M68 52 Q100 60 132 52" fill="none" stroke="#C9A06B" strokeWidth="6" />
        </g>
      );
    case "duck":
      return (
        <g transform="translate(100 46)">
          <ellipse cx="0" cy="6" rx="22" ry="14" fill="#FFD95A" {...s} />
          <circle cx="8" cy="-12" r="13" fill="#FFD95A" {...s} />
          <path d="M19 -12 L30 -8 L19 -5 Z" fill="#F59A3C" {...s} />
          <circle cx="11" cy="-15" r="2.2" fill="#2B1B15" />
          <path d="M-8 4 Q0 -2 6 6" fill="none" stroke="#E8B530" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

/* ---------- Avatar ---------- */

export function PetAvatar({
  pet,
  size = 44,
  ring,
  className = "",
}: {
  pet: Pet;
  size?: number;
  ring?: "story" | "seen" | "me" | "none";
  className?: string;
}) {
  const ringCls =
    ring === "story"
      ? "p-[2.5px] bg-gradient-to-tr from-[#F7A07A] via-[#F08A9B] to-[#C9B7EE]"
      : ring === "seen"
        ? "p-[2px] bg-[#E6D8C8]"
        : ring === "me"
          ? "p-[2px] bg-[#F08A9B]"
          : "";
  return <AvatarInner pet={pet} size={size} cls={`${ringCls} ${className}`} />;
}

function AvatarInner({ pet, size, cls }: { pet: Pet; size: number; cls: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = pet.photo && broken !== pet.photo;
  return (
    <span className={`inline-block shrink-0 rounded-full ${cls}`} style={{ width: size, height: size }}>
      <span className="block h-full w-full overflow-hidden rounded-full border-2 border-paper" style={{ background: pet.bg }}>
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.photo} alt={pet.name} loading="lazy" onError={() => setBroken(pet.photo ?? null)} className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="22 30 156 156" className="h-full w-full" role="img" aria-label={pet.name}>
            <Head pet={pet} expression="smile" />
          </svg>
        )}
      </span>
    </span>
  );
}

/* ---------- Scenes ---------- */

function Backdrop({ scene, id }: { scene: Scene; id: string }) {
  const g = (a: string, b: string) => (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={a} />
        <stop offset="1" stopColor={b} />
      </linearGradient>
    </defs>
  );
  const sky = <rect width="400" height="400" fill={`url(#${id})`} />;
  const cloud = (x: number, y: number, s = 1) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity=".9">
      <circle cx="0" cy="0" r="16" />
      <circle cx="18" cy="-8" r="20" />
      <circle cx="40" cy="0" r="16" />
      <rect x="0" y="0" width="40" height="16" />
    </g>
  );
  switch (scene) {
    case "park":
      return (
        <g>
          {g("#CFE9F7", "#FFF6E6")}
          {sky}
          <circle cx="330" cy="70" r="30" fill="#FFE08A" />
          {cloud(50, 70)}
          {cloud(220, 50, 0.8)}
          <path d="M0 270 Q120 220 240 260 T400 250 L400 400 L0 400Z" fill="#B9DBA4" />
          <path d="M0 310 Q140 270 260 305 T400 300 L400 400 L0 400Z" fill="#9FCB88" />
          {[[40, 330], [90, 360], [320, 340], [360, 372], [280, 380], [30, 384]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill={i % 2 ? "#F7A9B8" : "#FFF"} />
              <circle cx={x} cy={y} r="2" fill="#F5B94A" />
            </g>
          ))}
        </g>
      );
    case "beach":
      return (
        <g>
          {g("#BFE3F5", "#E9F6FB")}
          {sky}
          <circle cx="320" cy="80" r="28" fill="#FFE08A" />
          {cloud(60, 80, 0.9)}
          <rect y="230" width="400" height="90" fill="#7EC4DE" />
          <path d="M0 250 Q25 242 50 250 T100 250 T150 250 T200 250 T250 250 T300 250 T350 250 T400 250" stroke="#fff" strokeWidth="3" fill="none" opacity=".7" />
          <path d="M0 285 Q25 277 50 285 T100 285 T150 285 T200 285 T250 285 T300 285 T350 285 T400 285" stroke="#fff" strokeWidth="3" fill="none" opacity=".5" />
          <path d="M0 320 Q200 300 400 320 L400 400 L0 400Z" fill="#F3DDB3" />
        </g>
      );
    case "blossom":
      return (
        <g>
          {g("#FBE1E8", "#FFF4EE")}
          {sky}
          <path d="M-10 60 Q120 90 210 40" stroke="#8B6150" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M400 100 Q300 120 250 70" stroke="#8B6150" strokeWidth="7" fill="none" strokeLinecap="round" />
          {Array.from({ length: 26 }, (_, i) => {
            const x = (i * 67) % 400;
            const y = 30 + ((i * 41) % 120);
            return <circle key={i} cx={x} cy={y} r={9 + (i % 3) * 3} fill={i % 3 ? "#F7B6C5" : "#FBD3DC"} opacity=".9" />;
          })}
          {Array.from({ length: 14 }, (_, i) => (
            <ellipse key={`p${i}`} cx={(i * 97) % 400} cy={180 + ((i * 53) % 200)} rx="5" ry="3" fill="#F7B6C5" transform={`rotate(${i * 40} ${(i * 97) % 400} ${180 + ((i * 53) % 200)})`} />
          ))}
          <path d="M0 330 Q200 300 400 330 L400 400 L0 400Z" fill="#C8E2B5" />
        </g>
      );
    case "expo":
      return (
        <g>
          {g("#E3D9F7", "#FFF2E3")}
          {sky}
          <g transform="rotate(-6 90 90)">
            <rect x="24" y="44" width="150" height="96" rx="14" fill="#8E6CC9" stroke={INK} strokeWidth="3" />
            <text x="99" y="88" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="34" fill="#FFE08A">PET</text>
            <text x="99" y="124" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="34" fill="#FFE08A">EXPO</text>
          </g>
          <path d="M180 30 L400 50" stroke={INK} strokeWidth="2" />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 190 + i * 24;
            const y = 31 + i * 2.2;
            const cols = ["#F08A9B", "#FBD58A", "#A9CDEB", "#A9C79A"];
            return <path key={i} d={`M${x} ${y} L${x + 20} ${y + 2} L${x + 9} ${y + 22} Z`} fill={cols[i % 4]} />;
          })}
          <rect y="320" width="400" height="80" fill="#EBD9C2" />
        </g>
      );
    case "salon":
      return (
        <g>
          {g("#DCEFEA", "#FFF7F0")}
          {sky}
          <rect x="250" y="40" width="110" height="140" rx="55" fill="#fff" stroke="#BFDCD4" strokeWidth="6" />
          {[[60, 80, 14], [100, 50, 9], [40, 160, 10], [350, 230, 12], [320, 300, 8]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#fff" stroke="#BFDCD4" strokeWidth="2" opacity=".9" />
          ))}
          <text x="300" y="130" textAnchor="middle" fontSize="44">✂️</text>
          <rect y="330" width="400" height="70" fill="#F4E3D3" />
        </g>
      );
    case "cozy":
      return (
        <g>
          {g("#FFE7D2", "#FFF6EC")}
          {sky}
          <rect x="230" y="36" width="130" height="150" rx="10" fill="#CFE9F7" stroke="#C99A72" strokeWidth="8" />
          <path d="M295 36 L295 186 M230 111 L360 111" stroke="#C99A72" strokeWidth="6" />
          <path d="M210 40 L240 40 L250 200 L200 200Z" fill="#F7B6A0" opacity=".7" />
          <path d="M0 320 L400 320 L400 400 L0 400Z" fill="#E6C7A8" />
          <ellipse cx="200" cy="360" rx="180" ry="26" fill="#F2A7A0" opacity=".6" />
        </g>
      );
    case "snow":
      return (
        <g>
          {g("#DCE6F2", "#F5F8FC")}
          {sky}
          <path d="M0 220 L80 120 L150 200 L240 90 L330 190 L400 140 L400 400 L0 400Z" fill="#EEF3F9" stroke="#C9D6E6" strokeWidth="3" />
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={(i * 73) % 400} cy={(i * 47) % 300} r={2 + (i % 3)} fill="#fff" />
          ))}
          <path d="M0 330 Q200 300 400 330 L400 400 L0 400Z" fill="#fff" />
        </g>
      );
    case "party":
      return (
        <g>
          {g("#FFF0C2", "#FFF8EA")}
          {sky}
          {Array.from({ length: 28 }, (_, i) => {
            const cols = ["#F08A9B", "#A9CDEB", "#A9C79A", "#C9B7EE", "#F7A07A"];
            const x = (i * 59) % 400;
            const y = (i * 37) % 320;
            return <rect key={i} x={x} y={y} width="8" height="14" rx="2" fill={cols[i % 5]} transform={`rotate(${i * 33} ${x} ${y})`} />;
          })}
          {[[50, 110, "#F08A9B"], [350, 90, "#A9CDEB"]].map(([x, y, c], i) => (
            <g key={i}>
              <ellipse cx={x as number} cy={y as number} rx="24" ry="30" fill={c as string} />
              <path d={`M${x} ${(y as number) + 30} Q${(x as number) + 8} ${(y as number) + 70} ${x} ${(y as number) + 110}`} stroke={INK} strokeWidth="1.5" fill="none" />
            </g>
          ))}
          <rect y="330" width="400" height="70" fill="#F7DFC4" />
        </g>
      );
    case "sunset":
      return (
        <g>
          {g("#F7B58E", "#FBE3C9")}
          {sky}
          <circle cx="200" cy="250" r="70" fill="#FFD69A" />
          <rect y="250" width="400" height="60" fill="#E79A86" opacity=".8" />
          <path d="M0 270 L400 270 M40 288 L360 288" stroke="#FFE1C2" strokeWidth="3" opacity=".7" />
          <path d="M0 310 Q200 290 400 310 L400 400 L0 400Z" fill="#D9A27E" />
        </g>
      );
    case "vet":
      return (
        <g>
          {g("#D8ECF8", "#F7FBFF")}
          {sky}
          <rect x="280" y="40" width="80" height="80" rx="18" fill="#fff" stroke="#A9CDEB" strokeWidth="4" />
          <path d="M320 58 L320 102 M298 80 L342 80" stroke="#F08A9B" strokeWidth="12" strokeLinecap="round" />
          <text x="60" y="90" fontSize="36">💙</text>
          <rect y="320" width="400" height="80" fill="#E3EEF5" />
        </g>
      );
    case "night":
      return (
        <g>
          {g("#5B4E7A", "#8C7BA8")}
          {sky}
          <circle cx="320" cy="80" r="30" fill="#FFF0C2" />
          <circle cx="334" cy="70" r="28" fill="#5F5280" />
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={(i * 83) % 400} cy={(i * 29) % 200} r={1.5 + (i % 2)} fill="#FFF6D8" />
          ))}
          <ellipse cx="200" cy="370" rx="230" ry="80" fill="#B49AC9" />
          <ellipse cx="200" cy="350" rx="190" ry="50" fill="#C9B2DA" />
        </g>
      );
  }
}

export function PetScene({
  pet,
  scene,
  accessory = "none",
  expression = "happy",
  className = "",
  usePhoto = false,
}: {
  pet: Pet;
  scene: Scene;
  accessory?: Accessory;
  expression?: Expression;
  className?: string;
  /** Show the pet's real photo instead of the drawing when it has one. */
  usePhoto?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [broken, setBroken] = useState(false);
  if (usePhoto && pet.photo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pet.photo} alt={pet.name} loading="lazy" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
  }
  const fur = pet.look.fur;
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label={`${pet.name} illustration`} preserveAspectRatio="xMidYMid slice">
      <Backdrop scene={scene} id={`g${id}`} />
      <g transform="translate(60 92) scale(1.4)">
        {/* body + paws */}
        <ellipse cx="100" cy="214" rx="66" ry="48" fill={fur} stroke={INK} strokeWidth="3" />
        {[74, 126].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="214" rx="17" ry="12" fill={pet.look.muzzle ?? fur} stroke={INK} strokeWidth="2.5" />
            <path d={`M${x - 6} 204 L${x - 6} 210 M${x + 6} 204 L${x + 6} 210`} stroke={INK} strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
        <Head pet={pet} expression={expression} accessory={accessory} />
      </g>
    </svg>
  );
}

type MediaPost = { scene: Scene; accessory: Accessory; expression: Expression; image?: string; images?: string[]; overlay?: string };

/** All photos of a post, cover first. */
export function photosOf(post: { image?: string; images?: string[] }) {
  if (post.images && post.images.length) return post.images;
  return post.image ? [post.image] : [];
}

export function PostMedia({
  post,
  pet,
  className = "",
  carousel = false,
}: {
  post: MediaPost;
  pet: Pet;
  className?: string;
  /** Swipeable photos with a counter. Off for thumbnails, which show the cover only. */
  carousel?: boolean;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const photos = photosOf(post);
  const cover = photos[0];
  const multi = photos.length > 1;

  const overlay = post.overlay && (
    <span className="pointer-events-none absolute right-4 top-11 max-w-[60%] rotate-[-6deg] text-right font-hand text-3xl leading-tight text-white [text-shadow:0_0_2px_#4a2e22,0_1px_2px_#4a2e22,0_2px_8px_rgba(74,46,34,.6)]">
      {post.overlay}
    </span>
  );

  if (carousel && multi) return <Carousel photos={photos} overlay={overlay} className={className} />;

  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {cover && broken !== cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" loading="lazy" onError={() => setBroken(cover)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <PetScene pet={pet} scene={post.scene} accessory={post.accessory} expression={post.expression} className="absolute inset-0 h-full w-full" />
      )}
      {overlay}
      {multi && (
        <span className="absolute right-2 top-2 text-white drop-shadow" aria-label={`${photos.length} photos`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
            <rect x="7" y="7" width="13" height="13" rx="2.5" fill="currentColor" fillOpacity=".35" />
            <path d="M4 16V6a2 2 0 0 1 2-2h10" />
          </svg>
        </span>
      )}
    </div>
  );
}

function Carousel({ photos, overlay, className }: { photos: string[]; overlay: React.ReactNode; className: string }) {
  const [index, setIndex] = useState(0);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);

  const go = (i: number) => {
    if (!track) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={`group relative overflow-hidden bg-sand ${className}`}>
      <div
        ref={setTrack}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src + i}
            src={src}
            alt={`Photo ${i + 1} of ${photos.length}`}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {index === 0 && overlay}

      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-cocoa/70 px-2.5 py-0.5 text-xs font-bold text-white">
        {index + 1}/{photos.length}
      </span>

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(index - 1);
          }}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 pb-0.5 text-2xl font-bold leading-none text-cocoa shadow"
        >
          ‹
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(index + 1);
          }}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 pb-0.5 text-2xl font-bold leading-none text-cocoa shadow"
        >
          ›
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {photos.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
        ))}
      </div>
    </div>
  );
}
