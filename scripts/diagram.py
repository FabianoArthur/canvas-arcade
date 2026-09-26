#!/usr/bin/env python3
"""Generates the animated architecture diagrams in docs/assets/.

    python3 scripts/diagram.py

One source for four files: English and Portuguese, light and dark. The animation
is CSS @keyframes inside the SVG (no JS, no external fonts), so it plays when
GitHub renders the SVG as an image, and prefers-reduced-motion switches it off.
"""

from pathlib import Path

W, H = 880, 440
OUT = Path(__file__).resolve().parent.parent / "docs" / "assets"

THEMES = {
    "light": dict(
        bg="#ffffff", stroke="#d0d7de", card="#f6f8fa", fg="#1f2328", muted="#59636e",
        zone="#8c959f", edge="#8c959f", dot="#bc4c00", code="#0550ae",
    ),
    "dark": dict(
        bg="#0d1117", stroke="#30363d", card="#161b22", fg="#e6edf3", muted="#9198a1",
        zone="#545d68", edge="#6e7681", dot="#ffa657", code="#79c0ff",
    ),
}

TEXT = {
    "en": dict(
        title="How canvas-arcade works",
        desc=(
            "The player's keys, touches and mouse, or the autopilot in demo mode, feed an "
            "InputBuffer that reports each press exactly once per step. Inside the game loop, "
            "requestAnimationFrame drives a FixedStepper that runs update(state, input) at a fixed "
            "60 Hz; update is pure game logic covered by unit tests. render(ctx, state) then draws "
            "the state on a HiDPI canvas. Events and the final score flow out of update to the "
            "sound effects (WebAudio, muted by default) and to the high-score store "
            "(localStorage, guarded by try/catch)."
        ),
        player=("Player", "keys · touch · mouse"),
        pilot=("Autopilot", "demo mode (#/game/demo)"),
        buffer=("InputBuffer", "each press once per step"),
        zone="game loop · rAF + FixedStepper (60 Hz)",
        update=("update(state, input)", "pure logic · unit-tested"),
        render=("render(ctx, state)", "draws the state"),
        canvas=("<canvas>", "HiDPI · scales to fit"),
        scores=("ScoreStore", "localStorage · try/catch"),
        sfx=("Sfx", "WebAudio · muted by default"),
        events="events · score",
        note=("No DOM in game logic:", "it runs under Vitest in Node."),
    ),
    "pt-BR": dict(
        title="Como o canvas-arcade funciona",
        desc=(
            "Teclado, toque e mouse do jogador, ou o piloto automático no modo demo, alimentam um "
            "InputBuffer que entrega cada toque exatamente uma vez por passo. Dentro do loop do jogo, "
            "o requestAnimationFrame move um FixedStepper que roda update(state, input) a 60 Hz "
            "fixos; o update é lógica pura coberta por testes unitários. Depois, render(ctx, state) "
            "desenha o estado num canvas HiDPI. Eventos e o placar final saem do update para os "
            "efeitos sonoros (WebAudio, mudo por padrão) e para o placar local "
            "(localStorage, protegido por try/catch)."
        ),
        player=("Jogador", "teclado · toque · mouse"),
        pilot=("Piloto automático", "modo demo (#/jogo/demo)"),
        buffer=("InputBuffer", "cada toque 1× por passo"),
        zone="loop do jogo · rAF + FixedStepper (60 Hz)",
        update=("update(state, input)", "lógica pura · testada"),
        render=("render(ctx, state)", "desenha o estado"),
        canvas=("<canvas>", "HiDPI · ajusta à tela"),
        scores=("ScoreStore", "localStorage · try/catch"),
        sfx=("Sfx", "WebAudio · mudo por padrão"),
        events="eventos · placar",
        note=("Nenhum DOM na lógica:", "ela roda no Vitest, em Node."),
    ),
}

# name: (x, y, w, h)
BOXES = {
    "player": (24, 40, 240, 64),
    "pilot": (24, 140, 240, 64),
    "buffer": (304, 90, 240, 64),
    "update": (604, 84, 232, 64),
    "render": (604, 188, 232, 64),
    "canvas": (604, 292, 232, 64),
    "scores": (304, 264, 240, 64),
    "sfx": (304, 352, 240, 64),
}
CODE_BOXES = {"buffer", "update", "render", "canvas", "scores", "sfx"}

# Edges as polylines, in the order data really flows. Each gets a travelling dot.
EDGES = [
    [(264, 72), (284, 72), (284, 112), (304, 112)],  # player -> buffer
    [(544, 122), (564, 122), (564, 116), (604, 116)],  # buffer -> update
    [(720, 148), (720, 188)],  # update -> render
    [(720, 252), (720, 292)],  # render -> canvas
    [(604, 136), (574, 136), (574, 296), (544, 296)],  # update -> scores
    [(574, 296), (574, 384), (544, 384)],  # update -> sfx
    [(264, 172), (284, 172), (284, 132), (304, 132)],  # autopilot -> buffer (demo)
]
CYCLE = 9.0  # seconds
SLOT = 1 / len(EDGES)


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def pts(poly) -> str:
    return "M" + " L".join(f"{x},{y}" for x, y in poly)


def keyframes(i: int, poly) -> str:
    """Dot i travels its polyline during its slot of the cycle, hidden otherwise."""
    start = i * SLOT * 100
    travel = SLOT * 0.8 * 100
    lengths = [abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in zip(poly, poly[1:])]
    total = sum(lengths)
    x0, y0 = poly[0]
    frames = [f"0%,{start:.2f}%{{opacity:0;transform:translate({x0}px,{y0}px)}}"]
    frames.append(f"{start + 1:.2f}%{{opacity:1}}")
    acc = 0.0
    for (x, y), seg in zip(poly[1:], lengths):
        acc += seg
        t = start + travel * acc / total
        frames.append(f"{t:.2f}%{{opacity:1;transform:translate({x}px,{y}px)}}")
    xe, ye = poly[-1]
    frames.append(f"{start + travel + 2:.2f}%,100%{{opacity:0;transform:translate({xe}px,{ye}px)}}")
    hl_on, hl_off = start, start + travel + 4
    hl = (
        f"@keyframes h{i}{{0%,{hl_on:.2f}%{{opacity:0}}{hl_on + 1:.2f}%,{hl_off - 2:.2f}%"
        f"{{opacity:.9}}{hl_off:.2f}%,100%{{opacity:0}}}}"
    )
    return f"@keyframes d{i}{{{''.join(frames)}}}{hl}"


def box(name: str, t: dict, lang: dict) -> str:
    x, y, w, h = BOXES[name]
    title, sub = lang[name]
    title_cls = "code" if name in CODE_BOXES else "b"
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" class="card"/>'
        f'<text x="{x + 16}" y="{y + 27}" class="{title_cls}">{esc(title)}</text>'
        f'<text x="{x + 16}" y="{y + 48}" class="m">{esc(sub)}</text>'
    )


def build(theme: str, lang_key: str) -> str:
    t = THEMES[theme]
    lang = TEXT[lang_key]
    mono = "ui-monospace, SFMono-Regular, &quot;SF Mono&quot;, Menlo, Consolas, &quot;Liberation Mono&quot;, monospace"
    sans = "ui-sans-serif, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Helvetica, Arial, sans-serif"
    anims = "".join(keyframes(i, e) for i, e in enumerate(EDGES))
    per_edge = "".join(
        f".pk{i}{{animation:d{i} {CYCLE}s linear infinite}}.hl{i}{{animation:h{i} {CYCLE}s linear infinite}}"
        for i in range(len(EDGES))
    )
    style = (
        f"text{{font-family:{sans};fill:{t['fg']}}}"
        f".b{{font-size:14px;font-weight:600}}"
        f".m{{font-size:12.5px;fill:{t['muted']}}}"
        f".code{{font-family:{mono};font-size:13.5px;font-weight:600;fill:{t['code']}}}"
        f".h{{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;fill:{t['muted']}}}"
        f".bg{{fill:{t['bg']};stroke:{t['stroke']}}}"
        f".card{{fill:{t['card']};stroke:{t['stroke']}}}"
        f".zone{{fill:none;stroke:{t['zone']};stroke-dasharray:5 4}}"
        f".e{{fill:none;stroke:{t['edge']};stroke-width:1.5;stroke-linejoin:round}}"
        f".dash{{stroke-dasharray:4 4}}"
        f".hl{{fill:none;stroke:{t['dot']};stroke-width:2;stroke-linejoin:round;opacity:0}}"
        f".pk{{opacity:0}}.dot{{fill:{t['dot']}}}.halo{{fill:{t['dot']};opacity:.25}}"
        f"{anims}{per_edge}"
        "@media (prefers-reduced-motion:reduce){.pk,.hl{animation:none;display:none}}"
    )
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        f'role="img" aria-labelledby="title desc" lang="{"pt-BR" if lang_key == "pt-BR" else "en"}">',
        f'<title id="title">{esc(lang["title"])}</title>',
        f'<desc id="desc">{esc(lang["desc"])}</desc>',
        f"<style>{style}</style>",
        '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
        f'orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="{t["edge"]}"/></marker></defs>',
        f'<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="16" class="bg"/>',
        f'<rect x="584" y="24" width="272" height="{H - 48}" rx="14" class="zone"/>',
        f'<text x="604" y="50" class="h">{esc(lang["zone"].split(" · ")[0])}</text>',
        f'<text x="604" y="68" class="m">{esc(lang["zone"].split(" · ")[1])}</text>',
    ]
    for name in BOXES:
        parts.append(box(name, t, lang))
    for i, e in enumerate(EDGES):
        dashed = " dash" if i == len(EDGES) - 1 else ""
        parts.append(f'<path d="{pts(e)}" class="e{dashed}" marker-end="url(#ah)"/>')
    parts.append(f'<text x="566" y="224" class="m" text-anchor="end">{esc(lang["events"])}</text>')
    parts.append(f'<text x="24" y="376" class="b">{esc(lang["note"][0])}</text>')
    parts.append(f'<text x="24" y="396" class="m">{esc(lang["note"][1])}</text>')
    for i, e in enumerate(EDGES):
        parts.append(f'<path d="{pts(e)}" class="hl hl{i}"/>')
        parts.append(
            f'<g class="pk pk{i}"><circle r="9" class="halo"/><circle r="4.5" class="dot"/></g>'
        )
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for lang_key in TEXT:
        for theme in THEMES:
            suffix = "" if lang_key == "en" else ".pt-BR"
            path = OUT / f"architecture{suffix}-{theme}.svg"
            path.write_text(build(theme, lang_key), encoding="utf-8")
            print(f"wrote {path.relative_to(OUT.parent.parent)}")


if __name__ == "__main__":
    main()
