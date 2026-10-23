"""Render the Mars logo assets as 1024px PNGs.

The geometry intentionally mirrors the SVG sources in assets/brand so the
icon and symbol can be generated without a rasterizer dependency.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"

SIZE = 1024
SS = 3  # supersample factor for smoother edges
W, H = SIZE * SS, SIZE * SS
CX, CY = W // 2, H // 2

RUST = (195, 69, 31, 255)
CREAM = (246, 239, 230, 255)


def build_glyph(color: tuple[int, int, int, int], orbit_alpha: int) -> Image.Image:
    """Draw planet + tilted orbit + moon on a transparent layer."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Orbit ring, tilted -24deg (counter-clockwise on screen).
    a = 316 * SS
    b = 116 * SS
    w = 26 * SS
    orbit = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(orbit)
    od.ellipse(
        [CX - a, CY - b, CX + a, CY + b],
        outline=color[:3] + (orbit_alpha,),
        width=w,
    )
    orbit = orbit.rotate(24, resample=Image.Resampling.BICUBIC, center=(CX, CY))
    layer.alpha_composite(orbit)

    # Planet disc.
    r = 92 * 2 * SS
    d.ellipse([CX - r, CY - r, CX + r, CY + r], fill=color)

    # Moon on the orbit.
    mr = 15 * 2 * SS
    mx = 400 * 2 * SS
    my = 298 * 2 * SS
    d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=color[:3] + (217,))
    return layer


def rounded_tile() -> Image.Image:
    tile = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    inset = 28 * SS
    radius = 224 * SS
    d.rounded_rectangle(
        [inset, inset, W - inset, H - inset],
        radius=radius,
        fill=RUST,
    )
    return tile


def downscale(img: Image.Image) -> Image.Image:
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)

    icon = rounded_tile()
    icon.alpha_composite(build_glyph(CREAM, 179))
    downscale(icon).save(BRAND / "logo-icon-1024.png")

    symbol = build_glyph(RUST, 184)
    downscale(symbol).save(BRAND / "logo-symbol-1024.png")

    print("generated logo-icon-1024.png and logo-symbol-1024.png")


if __name__ == "__main__":
    main()
