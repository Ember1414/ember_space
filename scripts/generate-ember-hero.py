"""Generate the deterministic bitmap used by the Ember homepage hero."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


WIDTH = 1920
HEIGHT = 1200
SEED = 1414
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "assets" / "ember-hero.webp"


def make_charcoal_texture(rng: random.Random) -> Image.Image:
    small = Image.new("RGB", (WIDTH // 6, HEIGHT // 6), (13, 15, 14))
    pixels = small.load()
    for y in range(small.height):
        for x in range(small.width):
            wave = math.sin(x * 0.075) * 2.1 + math.cos(y * 0.061) * 1.8
            grain = rng.gauss(0, 4.2)
            value = max(6, min(29, int(15 + wave + grain)))
            pixels[x, y] = (value, value + rng.randint(0, 2), value)

    base = small.resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC)
    base = base.filter(ImageFilter.GaussianBlur(2.4))

    shapes = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shapes, "RGBA")
    for _ in range(170):
        cx = rng.randint(int(WIDTH * 0.35), WIDTH + 100)
        cy = rng.randint(-80, HEIGHT + 80)
        radius = rng.randint(55, 190)
        points: list[tuple[int, int]] = []
        sides = rng.randint(7, 13)
        for step in range(sides):
            angle = math.tau * step / sides
            distance = radius * rng.uniform(0.72, 1.22)
            points.append((int(cx + math.cos(angle) * distance), int(cy + math.sin(angle) * distance)))
        shade = rng.randint(8, 28)
        draw.polygon(points, fill=(shade, shade + 2, shade + 1, rng.randint(90, 175)))
        if rng.random() < 0.55:
            draw.line(points + [points[0]], fill=(55, 49, 43, 48), width=rng.randint(2, 5))

    return Image.alpha_composite(base.convert("RGBA"), shapes)


def fissure_points(rng: random.Random, start: tuple[int, int], steps: int) -> list[tuple[int, int]]:
    x, y = start
    points = [(x, y)]
    direction = rng.uniform(-0.75, 0.75)
    for _ in range(steps):
        direction += rng.uniform(-0.55, 0.55)
        direction *= 0.72
        length = rng.randint(34, 76)
        x += int(math.cos(direction) * length)
        y += int(math.sin(direction) * length)
        points.append((x, y))
    return points


def make_heat(rng: random.Random) -> Image.Image:
    broad = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    mid = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    core = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    broad_draw = ImageDraw.Draw(broad, "RGBA")
    mid_draw = ImageDraw.Draw(mid, "RGBA")
    core_draw = ImageDraw.Draw(core, "RGBA")

    fissures: list[list[tuple[int, int]]] = []
    starts = [
        (1040, 1080),
        (1210, 990),
        (1370, 1130),
        (1510, 930),
        (1660, 1050),
        (1280, 620),
        (1570, 520),
        (1770, 730),
    ]
    for start in starts:
        points = fissure_points(rng, start, rng.randint(5, 10))
        fissures.append(points)
        broad_draw.line(points, fill=(224, 42, 10, 225), width=rng.randint(28, 54), joint="curve")
        mid_draw.line(points, fill=(255, 83, 18, 245), width=rng.randint(9, 18), joint="curve")
        core_draw.line(points, fill=(255, 209, 116, 235), width=rng.randint(2, 5), joint="curve")

        if len(points) > 4 and rng.random() < 0.8:
            bx, by = points[rng.randint(2, len(points) - 2)]
            branch = fissure_points(rng, (bx, by), rng.randint(2, 4))
            broad_draw.line(branch, fill=(210, 38, 8, 185), width=rng.randint(16, 28), joint="curve")
            mid_draw.line(branch, fill=(255, 94, 22, 220), width=rng.randint(5, 10), joint="curve")
            core_draw.line(branch, fill=(255, 196, 105, 210), width=2, joint="curve")

    broad = broad.filter(ImageFilter.GaussianBlur(34))
    mid = mid.filter(ImageFilter.GaussianBlur(8))
    heat = Image.alpha_composite(broad, mid)
    heat = Image.alpha_composite(heat, core.filter(ImageFilter.GaussianBlur(0.7)))

    sparks = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sparks_draw = ImageDraw.Draw(sparks, "RGBA")
    for _ in range(210):
        x = int(rng.triangular(WIDTH * 0.42, WIDTH * 0.98, WIDTH * 0.84))
        y = int(rng.triangular(HEIGHT * 0.08, HEIGHT * 0.9, HEIGHT * 0.58))
        radius = rng.choice([1, 1, 2, 2, 3, 5])
        alpha = rng.randint(70, 220)
        sparks_draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, rng.randint(90, 190), 55, alpha))

    blurred_sparks = sparks.filter(ImageFilter.GaussianBlur(5))
    heat = Image.alpha_composite(heat, blurred_sparks)
    return Image.alpha_composite(heat, sparks)


def apply_vignette(image: Image.Image) -> Image.Image:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    pixels = mask.load()
    for y in range(HEIGHT):
        ny = abs((y / (HEIGHT - 1)) * 2 - 1)
        for x in range(WIDTH):
            nx = abs((x / (WIDTH - 1)) * 2 - 1)
            edge = max(nx * 0.72, ny)
            pixels[x, y] = int(max(0, min(170, (edge ** 2.3) * 170)))
    dark = Image.new("RGBA", image.size, (0, 0, 0, 255))
    return Image.composite(dark, image, mask)


def main() -> None:
    rng = random.Random(SEED)
    charcoal = make_charcoal_texture(rng)
    heat = make_heat(rng)
    image = Image.alpha_composite(charcoal, heat).convert("RGB")
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Color(image).enhance(1.06)
    image = apply_vignette(image.convert("RGBA")).convert("RGB")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, "WEBP", quality=88, method=6)
    print(f"Generated {OUTPUT} ({OUTPUT.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    main()
