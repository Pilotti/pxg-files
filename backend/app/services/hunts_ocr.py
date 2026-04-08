from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import difflib
import io
import json
from pathlib import Path
import re
import statistics
import unicodedata
from uuid import uuid4

import pytesseract
from PIL import Image, ImageFilter, ImageOps


@dataclass(frozen=True)
class ParsedDropLine:
    name_display: str
    name_normalized: str
    quantity: float
    npc_total_price: float
    npc_unit_price: float
    duplicate_key: str


@dataclass(frozen=True)
class OcrWord:
    text: str
    x: int
    y: int
    w: int
    h: int
    conf: float


# ---------------------------------------------------------------------------
# Known-item dictionary for post-OCR fuzzy name correction
# ---------------------------------------------------------------------------

_KNOWN_ITEMS_CACHE: dict[str, str] | None = None  # normalized → display
_KNOWN_ITEMS_MTIME: float = 0.0

# Approved aliases from DB: observed_normalized → canonical_name
# Populated externally via refresh_approved_aliases_cache().
_APPROVED_ALIASES_CACHE: dict[str, str] = {}


def _normalize_for_cache(key: str) -> str:
    norm = unicodedata.normalize("NFKD", key or "")
    norm = "".join(char for char in norm if not unicodedata.combining(char))
    norm = re.sub(r"[^a-z0-9 ]+", " ", norm.lower())
    return " ".join(norm.split())


def _get_known_items() -> dict[str, str]:
    """Return {normalized_name: display_name} for all items in hunts_npc_prices.json.
    Reloads automatically when the file changes on disk.
    """
    global _KNOWN_ITEMS_CACHE, _KNOWN_ITEMS_MTIME

    data_file = Path(__file__).resolve().parent.parent / "data" / "hunts_npc_prices.json"
    try:
        current_mtime = data_file.stat().st_mtime
    except OSError:
        current_mtime = 0.0

    if _KNOWN_ITEMS_CACHE is not None and current_mtime == _KNOWN_ITEMS_MTIME:
        return _KNOWN_ITEMS_CACHE

    try:
        raw: dict = json.loads(data_file.read_text(encoding="utf-8"))
    except Exception:
        raw = {}

    mapping: dict[str, str] = {}
    for key in raw:
        norm = _normalize_for_cache(key)
        if norm:
            mapping[norm] = key.strip()

    _KNOWN_ITEMS_CACHE = mapping
    _KNOWN_ITEMS_MTIME = current_mtime
    return _KNOWN_ITEMS_CACHE


def refresh_approved_aliases_cache(db: object) -> int:
    """Load all approved aliases from the DB into the in-memory cache.
    Call this from API endpoints before running OCR so the fuzzy corrector
    can use admin-trained aliases immediately.
    Returns the number of aliases loaded.
    """
    global _APPROVED_ALIASES_CACHE
    try:
        from app.models.hunt_item_alias import HuntItemAlias  # avoid circular at module level
        from sqlalchemy.orm import Session as _Session

        rows = (
            db.query(HuntItemAlias)  # type: ignore[attr-defined]
            .filter(
                HuntItemAlias.is_approved.is_(True),
                HuntItemAlias.canonical_name.isnot(None),
            )
            .all()
        )
        mapping: dict[str, str] = {}
        for row in rows:
            obs_norm = _normalize_for_cache(row.observed_name or "")
            canonical = (row.canonical_name or "").strip()
            if obs_norm and canonical:
                mapping[obs_norm] = canonical
        _APPROVED_ALIASES_CACHE = mapping
        return len(mapping)
    except Exception:
        return 0


def _get_approved_aliases() -> dict[str, str]:
    return _APPROVED_ALIASES_CACHE


def _fuzzy_correct_item_name(name: str) -> tuple[str, float | None]:
    """Try to match OCR name against known items via difflib.

    Strategy:
    - Exact match: always correct (score 1.0).
    - Prefix match: if the name appears to be a truncated prefix of a known item
      (either ending with '...', or unique prefix), use that known item.
      This handles cases like 'compressed ghos...' → 'compressed ghost essence'.
    - High-confidence fuzzy (>= 0.85): correct for unambiguous substitutions.
    - Otherwise: leave unchanged to avoid false positives.

    Returns (corrected_name, score) or (original_name, None) if no correction made.
    """
    is_truncated = (name or "").rstrip().endswith("...")
    # Strip trailing ellipsis before normalizing
    clean = re.sub(r"\.{2,}\s*$", "", (name or "")).strip()
    # Strip leading digits/symbols that may bleed from the count column (e.g. "12 ghost es")
    clean = re.sub(r"^\d+\s+", "", clean).strip()

    normalized = re.sub(r"[^a-z0-9 ]+", " ", clean.lower())
    normalized = " ".join(normalized.split())
    if not normalized:
        return name, None

    # Approved DB aliases take priority over static JSON
    aliases = _get_approved_aliases()
    if normalized in aliases:
        return aliases[normalized], 1.0

    known = _get_known_items()

    # Merge both sources for prefix/fuzzy search
    combined: dict[str, str] = {**known, **aliases}

    # Exact hit in static JSON
    if normalized in combined:
        return combined[normalized], 1.0

    # Prefix match: find known names that start with the OCR text
    prefix_matches = [(k, v) for k, v in combined.items() if k.startswith(normalized)]
    if prefix_matches and (is_truncated or len(prefix_matches) == 1):
        # Pick the shortest completion (most specific)
        best_k, best_v = min(prefix_matches, key=lambda pair: len(pair[0]))
        score = difflib.SequenceMatcher(None, normalized, best_k).ratio()
        return best_v, score

    # High-confidence fuzzy match only (threshold 0.85 to avoid false positives)
    matches = difflib.get_close_matches(normalized, combined.keys(), n=1, cutoff=0.85)
    if not matches:
        return name, None

    best_norm = matches[0]
    score = difflib.SequenceMatcher(None, normalized, best_norm).ratio()
    return combined[best_norm], score


def _apply_fuzzy_name_correction(
    lines: list["ParsedDropLine"],
    debug_notes: list[str] | None = None,
) -> list["ParsedDropLine"]:
    """Apply fuzzy name correction to a list of parsed drop lines."""
    corrected: list[ParsedDropLine] = []
    for line in lines:
        new_name, score = _fuzzy_correct_item_name(line.name_display)
        if new_name != line.name_display:
            if debug_notes is not None:
                debug_notes.append(
                    f"DEBUG fuzzy correction: '{line.name_display}' → '{new_name}' (score={score:.2f})"
                )
            new_normalized = re.sub(r"[^a-z0-9 ]+", " ", new_name.lower())
            new_normalized = " ".join(new_normalized.split())
            qty = line.quantity
            total = line.npc_total_price
            unit = total / qty if qty else 0.0
            corrected.append(
                ParsedDropLine(
                    name_display=new_name,
                    name_normalized=new_normalized,
                    quantity=qty,
                    npc_total_price=total,
                    npc_unit_price=unit,
                    duplicate_key=f"{new_normalized}:{int(qty)}:{total:.2f}",
                )
            )
        else:
            corrected.append(line)
    return corrected


def preprocess(image: Image.Image) -> Image.Image:
    img = ImageOps.grayscale(image)
    img = ImageOps.autocontrast(img)
    img = img.resize((img.width * 2, img.height * 2))
    img = img.filter(ImageFilter.MedianFilter(3))
    return img


def _prepare_ocr_patch(image: Image.Image, invert: bool = True, scale: int = 3) -> Image.Image:
    patch = ImageOps.grayscale(image)
    patch = ImageOps.autocontrast(patch)
    patch = patch.resize((max(1, patch.width * scale), max(1, patch.height * scale)))
    patch = patch.filter(ImageFilter.MedianFilter(3))
    if invert:
        patch = ImageOps.invert(patch)
    patch = patch.point(lambda pixel: 255 if pixel > 150 else 0)
    return patch


def _escape_tesseract_value(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def _build_tesseract_config(psm: int, oem: int, whitelist: str | None = None) -> str:
    config_parts = [f"--oem {oem}", f"--psm {psm}"]
    if whitelist:
        config_parts.append(f'-c tessedit_char_whitelist="{_escape_tesseract_value(whitelist)}"')
    return " ".join(config_parts)


def _ocr_single_line(
    image: Image.Image,
    whitelist: str | None = None,
    *,
    lang: str = "eng",
    oem: int = 1,
) -> str:
    config = _build_tesseract_config(psm=7, oem=oem, whitelist=whitelist)
    return pytesseract.image_to_string(image, lang=lang, config=config).strip()


def _ocr_multiline(
    image: Image.Image,
    whitelist: str | None = None,
    *,
    lang: str = "eng",
    oem: int = 1,
) -> str:
    config = _build_tesseract_config(psm=6, oem=oem, whitelist=whitelist)
    return pytesseract.image_to_string(image, lang=lang, config=config).strip()


def _save_debug_image(debug_dir: Path | None, name: str, image: Image.Image) -> str | None:
    if debug_dir is None:
        return None

    debug_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", name).strip("_") or "stage"
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}_{safe_name}_{uuid4().hex[:6]}.png"
    target = debug_dir / filename
    image.save(target)
    return str(target)


def _save_debug_text(debug_dir: Path | None, name: str, content: str) -> str | None:
    if debug_dir is None:
        return None

    debug_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", name).strip("_") or "text"
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}_{safe_name}_{uuid4().hex[:6]}.txt"
    target = debug_dir / filename
    target.write_text(content or "", encoding="utf-8")
    return str(target)


def _extract_words(image: Image.Image, *, lang: str = "eng", oem: int = 1) -> list[OcrWord]:
    config = _build_tesseract_config(psm=6, oem=oem)
    data = pytesseract.image_to_data(
        image,
        output_type=pytesseract.Output.DICT,
        lang=lang,
        config=config,
    )
    words: list[OcrWord] = []
    for index, text in enumerate(data["text"]):
        cleaned = (text or "").strip()
        if not cleaned:
            continue

        raw_conf = data["conf"][index]
        try:
            confidence = float(raw_conf)
        except Exception:
            confidence = -1.0

        words.append(
            OcrWord(
                text=cleaned,
                x=int(data["left"][index]),
                y=int(data["top"][index]),
                w=int(data["width"][index]),
                h=int(data["height"][index]),
                conf=confidence,
            )
        )

    return words


def _normalize_ocr_word(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z]", "", normalized.lower())


def _detect_party_window_region(image: Image.Image, words: list[OcrWord]) -> Image.Image | None:
    if not words:
        return None

    pokemon_words: list[OcrWord] = []
    party_words: list[OcrWord] = []
    close_words: list[OcrWord] = []

    for word in words:
        normalized = _normalize_ocr_word(word.text)
        if normalized in {"pokemon", "pokmon"}:
            pokemon_words.append(word)
            continue
        if normalized == "party":
            party_words.append(word)
            continue
        # Close button rendered as "X" on the right side of the header.
        if normalized == "x" and word.x > int(image.width * 0.45):
            close_words.append(word)

    if not pokemon_words or not party_words:
        return None

    best_pair: tuple[OcrWord, OcrWord] | None = None
    best_score = 10**9
    for pokemon in pokemon_words:
        pokemon_center_y = pokemon.y + (pokemon.h / 2)
        for party in party_words:
            party_center_y = party.y + (party.h / 2)
            vertical_gap = abs(pokemon_center_y - party_center_y)
            if vertical_gap > max(24, int((pokemon.h + party.h) * 0.8)):
                continue
            horizontal_gap = abs((party.x + party.w) - pokemon.x)
            score = vertical_gap * 10 + horizontal_gap
            if score < best_score:
                best_score = score
                best_pair = (pokemon, party)

    if best_pair is None:
        return None

    first, second = best_pair
    title_left = min(first.x, second.x)
    title_right = max(first.x + first.w, second.x + second.w)
    title_top = min(first.y, second.y)
    title_bottom = max(first.y + first.h, second.y + second.h)

    width, height = image.size
    title_height = max(24, title_bottom - title_top)

    matching_close_word = None
    for close_word in close_words:
        close_center_y = close_word.y + (close_word.h / 2)
        title_center_y = (title_top + title_bottom) / 2
        if (
            abs(close_center_y - title_center_y) <= max(30, int(title_height * 1.3))
            and close_word.x > title_right
        ):
            if matching_close_word is None or close_word.x > matching_close_word.x:
                matching_close_word = close_word

    # Require the close button anchor to avoid drifting to unrelated UI regions.
    if matching_close_word is None:
        return None

    right = min(width, matching_close_word.x + matching_close_word.w + max(20, int(width * 0.015)))

    # Derive a stable window width from title-left to close-button span.
    span_title_to_close = max(220, right - title_left)
    estimated_window_width = max(360, int(span_title_to_close * 1.45))
    left = max(0, right - estimated_window_width)

    top = max(0, title_top - max(34, int(title_height * 1.2)))
    estimated_window_height = max(260, int(estimated_window_width * 0.68))
    bottom = min(height, top + estimated_window_height)

    if right - left < max(240, int(width * 0.20)):
        return None

    if bottom - top < max(180, int(height * 0.20)):
        return None

    return image.crop((left, top, right, bottom))


def _detect_close_button_visual(image: Image.Image) -> tuple[int, int] | None:
    """
    Detect the red X close button in the top-right corner of the party window.
    Returns (right, top) coordinates of the close button, or None if not found.
    """
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    pixels = image.load()
    width, height = image.size
    
    # Search in top-right quadrant (right 30% × top 15%)
    search_x_start = int(width * 0.70)
    search_y_end = int(height * 0.15)
    
    # Red pixels: R >= 180, G <= 100, B <= 100
    red_points: list[tuple[int, int]] = []
    for y in range(0, search_y_end):
        for x in range(search_x_start, width):
            r, g, b = pixels[x, y][:3] if len(pixels[x, y]) >= 3 else (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2])
            if r >= 180 and g <= 100 and b <= 100:
                red_points.append((x, y))
    
    if not red_points:
        return None
    
    # Find the rightmost red cluster (close button is typically right-aligned)
    avg_x = sum(p[0] for p in red_points) / len(red_points)
    avg_y = sum(p[1] for p in red_points) / len(red_points)
    
    # Return position slightly right and below to account for button size
    return (int(avg_x + 15), int(avg_y - 5))


def _detect_blue_header_bar_visual(image: Image.Image) -> int | None:
    """
    Detect the blue horizontal bar at the top of the party window.
    Returns the y-coordinate of the blue bar, or None if not found.
    """
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    pixels = image.load()
    width, height = image.size
    
    # Search in top 20% of image
    search_height = int(height * 0.20)
    
    # Blue pixels: R <= 100, G <= 150, B >= 180
    for y in range(0, search_height):
        blue_count = 0
        for x in range(0, width):
            r, g, b = pixels[x, y][:3] if len(pixels[x, y]) >= 3 else (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2])
            if r <= 100 and g <= 150 and b >= 180:
                blue_count += 1
        
        # If more than 20% of the row is blue, we found the bar
        if blue_count > width * 0.20:
            return y
    
    return None


def _detect_redefinir_button_visual(image: Image.Image) -> tuple[int, int] | None:
    """
    Detect the red 'Redefinir' button in the bottom-right corner of the party window.
    Returns (right, bottom) coordinates of the button, or None if not found.
    """
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    pixels = image.load()
    width, height = image.size
    
    # Search in bottom-right quadrant (right 40% × bottom 15%)
    search_x_start = int(width * 0.60)
    search_y_start = int(height * 0.85)
    
    # Red pixels: R >= 180, G <= 100, B <= 100
    red_points: list[tuple[int, int]] = []
    for y in range(search_y_start, height):
        for x in range(search_x_start, width):
            r, g, b = pixels[x, y][:3] if len(pixels[x, y]) >= 3 else (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2])
            if r >= 180 and g <= 100 and b <= 100:
                red_points.append((x, y))
    
    if not red_points:
        return None
    
    # Find the centroid of red cluster
    avg_x = sum(p[0] for p in red_points) / len(red_points)
    avg_y = sum(p[1] for p in red_points) / len(red_points)
    
    # Return position slightly right and below to account for button size
    return (int(avg_x + 20), int(avg_y + 10))


def _detect_party_window_region_visual(image: Image.Image) -> Image.Image | None:
    """
    Detect party window using visual anchors: X button (top-right), blue bar (top), Redefinir button (bottom-right).
    This approach is robust across font scales, UI scales, and language variations.
    Returns cropped window region or None if not all anchors found.
    """
    close_button = _detect_close_button_visual(image)
    blue_bar_y = _detect_blue_header_bar_visual(image)
    redefinir_button = _detect_redefinir_button_visual(image)
    
    # All three anchors should be present for reliable detection
    if close_button is None or blue_bar_y is None or redefinir_button is None:
        return None
    
    width, height = image.size
    close_x, close_y = close_button
    redefinir_x, redefinir_y = redefinir_button
    
    # Calculate window boundaries from anchors
    # Top: use blue_bar_y with margin
    top = max(0, blue_bar_y - max(5, int(height * 0.01)))
    
    # Right: use close button x-coordinate with margin
    right = min(width, close_x + max(10, int(width * 0.02)))
    
    # Bottom: use redefinir button y-coordinate with margin
    bottom = min(height, redefinir_y + max(8, int(height * 0.02)))
    
    # Left: derive from typical window width (estimate from top, close button, and bottom positions)
    # Typical party window is about 360-400px wide
    estimated_width = max(360, int(close_x * 0.9))
    left = max(0, right - estimated_width)
    
    # Validate crop dimensions
    crop_width = right - left
    crop_height = bottom - top
    
    if crop_width < 240 or crop_height < 180:
        return None
    
    return image.crop((left, top, right, bottom))


def _detect_table_region_and_strategy(
    image: Image.Image,
    *,
    lang: str = "eng",
    oem: int = 1,
    visual_image: Image.Image | None = None,
) -> tuple[Image.Image, str]:
    # Try visual anchor detection first (X + blue bar + Redefinir) - most robust across scales/languages
    visual_source = visual_image if visual_image is not None else image
    party_region = _detect_party_window_region_visual(visual_source)
    if party_region is not None:
        return party_region, "visual-anchor"
    
    # Fall back to text-based anchor detection (Pokémon Party + X)
    words = _extract_words(image, lang=lang, oem=oem)
    party_region = _detect_party_window_region(image, words)
    crop_strategy = "text-anchor" if party_region is not None else "full-image"
    if party_region is not None:
        source_image = party_region
        source_words = _extract_words(source_image, lang=lang, oem=oem)
    else:
        source_image = image
        source_words = words

    header = {"item": None, "count": None, "value": None}

    # Header keywords for PT-BR, EN, ES, PL
    item_keywords = {"item", "articulo", "objeto", "przedmiot"}
    count_keywords = {"contagem", "count", "cantidad", "conteo", "ilosc"}
    value_keywords = {"valor", "value", "precio", "valoracion", "wartosc", "valuedl"}

    for word in source_words:
        normalized_text = _normalize_ocr_word(word.text)
        if header["item"] is None and normalized_text in item_keywords:
            header["item"] = word
        elif header["count"] is None and normalized_text in count_keywords:
            header["count"] = word
        elif header["value"] is None and normalized_text in value_keywords:
            header["value"] = word

    if not all(header.values()):
        # Fallback keeps current behavior, but prefers the party window if detected.
        return source_image, crop_strategy

    width, height = source_image.size
    x_margin = max(20, int(width * 0.04))
    y_margin = max(16, int(height * 0.02))

    item_to_count_gap = max(120, header["count"].x - header["item"].x)
    left_padding = max(120, int(item_to_count_gap * 0.75))
    left = max(0, header["item"].x - left_padding)
    right = min(width, header["value"].x + header["value"].w + x_margin)
    top = max(0, header["item"].y - y_margin)

    footer_candidates: list[int] = []
    footer_keywords = {
        "ganho", "total", "pagina", "redefinir", "reset",
        "gain", "earnings", "page",
        "ganancia", "reiniciar", "pagina",
        "zysk", "strona", "resetuj",
    }
    for word in source_words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text in footer_keywords:
            if word.y > (header["item"].y + header["item"].h):
                footer_candidates.append(word.y)

    if footer_candidates:
        bottom = min(footer_candidates) - y_margin
    else:
        bottom = top + int(height * 0.78)

    bottom = min(height, max(top + 140, bottom))

    # If crop area is too small, fallback to full image to preserve lines.
    crop_width = max(0, right - left)
    crop_height = max(0, bottom - top)
    crop_area = crop_width * crop_height
    full_area = max(1, width * height)
    if crop_area / full_area < 0.22:
        return source_image, crop_strategy

    return source_image.crop((left, top, right, bottom)), f"{crop_strategy}-header-crop"


def detect_table(
    image: Image.Image,
    *,
    lang: str = "eng",
    oem: int = 1,
    visual_image: Image.Image | None = None,
) -> Image.Image:
    table, _ = _detect_table_region_and_strategy(
        image,
        lang=lang,
        oem=oem,
        visual_image=visual_image,
    )
    return table


def _normalize_item_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-z0-9 ]+", " ", normalized.lower())
    return " ".join(normalized.split())


def _parse_value(value: str) -> float:
    normalized = (value or "").strip().lower().replace("dl", "")
    normalized = normalized.replace("o", "0")
    normalized = normalized.replace(",", ".")
    normalized = re.sub(r"[^0-9.k]", "", normalized)

    if not normalized:
        raise ValueError("valor vazio")

    # Keep only the trailing compact suffix and avoid OCR garbage like extra dots.
    suffix_match = re.search(r"k+$", normalized)
    suffix = suffix_match.group(0) if suffix_match else ""
    number_part = normalized[: len(normalized) - len(suffix)] if suffix else normalized
    number_part = number_part.strip(".")

    if not number_part:
        raise ValueError("valor invalido")

    base_value = float(number_part)

    if suffix == "kk":
        return base_value * 1_000_000

    if suffix == "k":
        return base_value * 1_000

    return base_value


def _looks_like_value_token(token: str) -> bool:
    normalized = (token or "").strip().lower().replace("dl", "")
    normalized = normalized.replace("o", "0").replace(",", ".")
    return bool(re.match(r"^\d+(?:\.\d+)?(?:k|kk)?$", normalized))


def _cluster_rows(words: list[OcrWord], tolerance: int) -> list[list[OcrWord]]:
    rows: list[list[OcrWord]] = []

    for word in sorted(words, key=lambda current: (current.y, current.x)):
        center_y = word.y + (word.h / 2)
        matched_row = None
        for row in rows:
            row_center = sum(item.y + (item.h / 2) for item in row) / len(row)
            if abs(center_y - row_center) <= tolerance:
                matched_row = row
                break

        if matched_row is None:
            rows.append([word])
        else:
            matched_row.append(word)

    return rows


def _join_words(words: list[OcrWord]) -> str:
    ordered = sorted(words, key=lambda current: current.x)
    return " ".join(word.text for word in ordered).strip()


def _score_item_text(text: str) -> tuple[int, int, int]:
    cleaned = (text or "").strip()
    alpha_count = sum(char.isalpha() for char in cleaned)
    word_count = len(cleaned.split())
    return (alpha_count, word_count, len(cleaned))


def _parse_line_triplet(name_display: str, quantity_text: str, value_text: str) -> ParsedDropLine | None:
    name_display = re.sub(r"^[^a-zA-Z0-9]+", "", (name_display or "").strip()).strip()
    quantity_text = re.sub(r"[^0-9]", "", quantity_text or "")
    value_text = (value_text or "").replace(" ", "").strip()

    if not name_display or not quantity_text or not _looks_like_value_token(value_text):
        return None

    name_normalized = _normalize_item_name(name_display)
    quantity = float(quantity_text)
    if quantity < 0:
        return None

    npc_total_price = _parse_value(value_text)
    npc_unit_price = npc_total_price / quantity if quantity else 0
    duplicate_key = f"{name_normalized}:{int(quantity)}:{npc_total_price:.2f}"

    return ParsedDropLine(
        name_display=name_display,
        name_normalized=name_normalized,
        quantity=quantity,
        npc_total_price=npc_total_price,
        npc_unit_price=npc_unit_price,
        duplicate_key=duplicate_key,
    )


def _clean_column_line(raw_line: str, kind: str) -> str | None:
    line = " ".join((raw_line or "").split())
    if not line:
        return None

    normalized = _normalize_ocr_word(line)
    if normalized in {"item", "contagem", "count", "valor", "valuedl", "value", "ganhototal", "pagina", "redefinir", "reset"}:
        return None

    if kind == "item":
        line = re.sub(r"^[^a-zA-Z0-9]+", "", line).strip()
        if not any(char.isalpha() for char in line):
            return None
        return line

    if kind == "count":
        line = re.sub(r"[^0-9]", "", line)
        return line or None

    if kind == "value":
        # OCR can inject symbols like |, / or stray letters. Keep only price-friendly chars.
        line = line.replace(" ", "")
        line = re.sub(r"[^0-9oOkK.,]", "", line)
        line = line.replace("O", "0").replace("K", "k")
        if not _looks_like_value_token(line):
            return None
        return line

    return None


def _clean_column_lines(raw_text: str, kind: str) -> list[str]:
    cleaned_lines: list[str] = []
    for raw_line in raw_text.splitlines():
        cleaned = _clean_column_line(raw_line, kind)
        if cleaned is not None:
            cleaned_lines.append(cleaned)

    return cleaned_lines


def _extract_column_candidates(
    crop: Image.Image,
    kind: str,
    *,
    lang: str = "eng",
    oem: int = 1,
) -> tuple[list[tuple[float, str]], str]:
    patch = _prepare_ocr_patch(crop, scale=4)
    whitelist_by_kind = {
        "item": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-",
        "count": "0123456789",
        "value": "0123456789.,kKoO",
    }
    raw_text = _ocr_multiline(
        patch,
        whitelist=whitelist_by_kind.get(kind),
        lang=lang,
        oem=oem,
    )
    words = _extract_words(patch, lang=lang, oem=oem)

    if not words:
        fallback = [(float(index), value) for index, value in enumerate(_clean_column_lines(raw_text, kind), start=1)]
        return fallback, raw_text

    avg_height = sum(word.h for word in words) / len(words)
    tolerance = max(10, int(avg_height * 0.8))
    rows = _cluster_rows(words, tolerance)

    candidates: list[tuple[float, str]] = []
    for row in rows:
        row_text = _join_words(row)
        cleaned = _clean_column_line(row_text, kind)
        if cleaned is None:
            continue
        center_y = sum((item.y + (item.h / 2)) for item in row) / len(row)
        candidates.append((center_y, cleaned))

    return sorted(candidates, key=lambda item: item[0]), raw_text


def _best_match_by_y(
    target_y: float,
    candidates: list[tuple[float, str]],
    used_indexes: set[int],
    tolerance: float,
) -> tuple[int, tuple[float, str]] | None:
    best_index = -1
    best_candidate: tuple[float, str] | None = None
    best_distance = 10**9

    for index, candidate in enumerate(candidates):
        if index in used_indexes:
            continue
        distance = abs(candidate[0] - target_y)
        if distance > tolerance:
            continue
        if distance < best_distance:
            best_distance = distance
            best_index = index
            best_candidate = candidate

    if best_candidate is None:
        return None

    return best_index, best_candidate


def _align_column_triplets(
    item_candidates: list[tuple[float, str]],
    count_candidates: list[tuple[float, str]],
    value_candidates: list[tuple[float, str]],
) -> list[ParsedDropLine]:
    if not item_candidates or not count_candidates or not value_candidates:
        return []

    if len(count_candidates) > 1:
        gaps = [
            count_candidates[index + 1][0] - count_candidates[index][0]
            for index in range(len(count_candidates) - 1)
        ]
        median_gap = statistics.median(gaps)
        tolerance = max(18.0, float(median_gap) * 0.48)
    else:
        tolerance = 28.0

    used_item_indexes: set[int] = set()
    used_value_indexes: set[int] = set()
    parsed_lines: list[ParsedDropLine] = []

    for count_y, count_text in count_candidates:
        value_match = _best_match_by_y(count_y, value_candidates, used_value_indexes, tolerance)
        item_match = _best_match_by_y(count_y, item_candidates, used_item_indexes, tolerance * 1.35)

        if value_match is None or item_match is None:
            continue

        value_index, (_, value_text) = value_match
        item_index, (_, item_text) = item_match

        parsed_line = _parse_line_triplet(item_text, count_text, value_text)
        if parsed_line is None:
            continue

        used_value_indexes.add(value_index)
        used_item_indexes.add(item_index)
        parsed_lines.append(parsed_line)

    return parsed_lines


def _align_column_triplets_by_index(
    item_lines: list[str],
    count_lines: list[str],
    value_lines: list[str],
) -> list[ParsedDropLine]:
    line_count = min(len(item_lines), len(count_lines), len(value_lines))
    if line_count <= 0:
        return []

    parsed_lines: list[ParsedDropLine] = []
    for index in range(line_count):
        parsed_line = _parse_line_triplet(item_lines[index], count_lines[index], value_lines[index])
        if parsed_line is not None:
            parsed_lines.append(parsed_line)

    return parsed_lines


def _extract_drop_lines_by_columns(
    table: Image.Image,
    words: list[OcrWord],
    header: dict[str, OcrWord],
    debug_dir: Path | None = None,
    debug_notes: list[str] | None = None,
    *,
    lang: str = "eng",
    oem: int = 1,
) -> list[ParsedDropLine]:
    table_width, table_height = table.size
    row_start_y = header["item"].y + header["item"].h + 8
    footer_start_y = table_height

    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text in {"ganho", "total", "pagina", "redefinir", "reset"} and word.y > row_start_y:
            footer_start_y = min(footer_start_y, word.y)

    item_x = header["item"].x
    count_x = header["count"].x
    value_x = header["value"].x

    item_to_count_gap = max(120, count_x - item_x)
    count_to_value_gap = max(120, value_x - count_x)

    item_left = max(0, item_x - max(120, int(item_to_count_gap * 0.75)))
    item_right = min(table_width, count_x - max(18, int(item_to_count_gap * 0.10)))
    count_left = max(0, count_x - max(22, int(item_to_count_gap * 0.16)))
    count_right = min(table_width, value_x - max(22, int(count_to_value_gap * 0.24)))
    value_left = max(0, value_x - max(20, int(count_to_value_gap * 0.16)))
    value_right = min(table_width, value_x + max(120, int(count_to_value_gap * 0.9)))

    if not (item_left < item_right and count_left < count_right and value_left < value_right):
        item_left = 0
        item_right = int(table_width * 0.45)
        count_left = item_right
        count_right = item_right + int(table_width * 0.25)
        value_left = count_right
        value_right = table_width

    if footer_start_y <= row_start_y:
        return []

    item_crop = table.crop((item_left, row_start_y, item_right, footer_start_y))
    count_crop = table.crop((count_left, row_start_y, count_right, footer_start_y))
    value_crop = table.crop((value_left, row_start_y, value_right, footer_start_y))

    item_crop_path = _save_debug_image(debug_dir, "item_column", item_crop)
    count_crop_path = _save_debug_image(debug_dir, "count_column", count_crop)
    value_crop_path = _save_debug_image(debug_dir, "value_column", value_crop)
    if debug_notes is not None:
        if item_crop_path:
            debug_notes.append(f"DEBUG item column: {item_crop_path}")
        if count_crop_path:
            debug_notes.append(f"DEBUG count column: {count_crop_path}")
        if value_crop_path:
            debug_notes.append(f"DEBUG value column: {value_crop_path}")

    item_candidates, item_text = _extract_column_candidates(item_crop, "item", lang=lang, oem=oem)
    count_candidates, count_text = _extract_column_candidates(count_crop, "count", lang=lang, oem=oem)
    value_candidates, value_text = _extract_column_candidates(value_crop, "value", lang=lang, oem=oem)

    item_txt_path = _save_debug_text(debug_dir, "item_column_text", item_text)
    count_txt_path = _save_debug_text(debug_dir, "count_column_text", count_text)
    value_txt_path = _save_debug_text(debug_dir, "value_column_text", value_text)
    if debug_notes is not None:
        if item_txt_path:
            debug_notes.append(f"DEBUG item text: {item_txt_path}")
        if count_txt_path:
            debug_notes.append(f"DEBUG count text: {count_txt_path}")
        if value_txt_path:
            debug_notes.append(f"DEBUG value text: {value_txt_path}")

    aligned_lines_by_y = _align_column_triplets(item_candidates, count_candidates, value_candidates)

    item_lines_by_text = _clean_column_lines(item_text, "item")
    count_lines_by_text = _clean_column_lines(count_text, "count")
    value_lines_by_text = _clean_column_lines(value_text, "value")
    aligned_lines_by_index = _align_column_triplets_by_index(
        item_lines_by_text,
        count_lines_by_text,
        value_lines_by_text,
    )

    aligned_lines = aligned_lines_by_y
    strategy = "y"
    if len(aligned_lines_by_index) > len(aligned_lines_by_y):
        aligned_lines = aligned_lines_by_index
        strategy = "index"

    aligned_dump = "\n".join(
        f"y={int(item[0])} item={item[1]}"
        for item in item_candidates
    )
    aligned_dump += "\n---\n"
    aligned_dump += "\n".join(
        f"y={int(item[0])} qtd={item[1]}"
        for item in count_candidates
    )
    aligned_dump += "\n---\n"
    aligned_dump += "\n".join(
        f"y={int(item[0])} valor={item[1]}"
        for item in value_candidates
    )
    aligned_dump += "\n---\n"
    aligned_dump += f"strategy={strategy} rows_y={len(aligned_lines_by_y)} rows_index={len(aligned_lines_by_index)}"
    aligned_txt_path = _save_debug_text(debug_dir, "column_candidates_by_y", aligned_dump)
    if aligned_txt_path and debug_notes is not None:
        debug_notes.append(f"DEBUG column candidates by y: {aligned_txt_path}")

    return aligned_lines


def _extract_drop_lines_from_table(
    table: Image.Image,
    *,
    debug_dir: Path | None = None,
    debug_notes: list[str] | None = None,
    ocr_lang: str = "eng",
    ocr_oem: int = 1,
    variant_label: str = "table",
) -> list[ParsedDropLine]:
    words = _extract_words(table, lang=ocr_lang, oem=ocr_oem)

    item_keywords = {"item", "articulo", "objeto", "przedmiot"}
    count_keywords = {"contagem", "count", "cantidad", "conteo", "ilosc"}
    value_keywords = {"valor", "value", "precio", "valoracion", "wartosc", "valuedl"}

    header = {"item": None, "count": None, "value": None}
    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if header["item"] is None and normalized_text in item_keywords:
            header["item"] = word
        elif header["count"] is None and normalized_text in count_keywords:
            header["count"] = word
        elif header["value"] is None and normalized_text in value_keywords:
            header["value"] = word

    if not all(header.values()):
        if debug_notes is not None:
            debug_notes.append(f"DEBUG {variant_label}: missing headers, using raw text fallback")
        raw_text = _ocr_multiline(table, lang=ocr_lang, oem=ocr_oem)
        raw_txt_path = _save_debug_text(debug_dir, f"{variant_label}_fallback_raw_text", raw_text)
        if raw_txt_path and debug_notes is not None:
            debug_notes.append(f"DEBUG {variant_label} raw OCR text: {raw_txt_path}")
        return parse_drop_lines(raw_text)

    column_lines = _extract_drop_lines_by_columns(
        table,
        words,
        header,
        debug_dir=debug_dir,
        debug_notes=debug_notes,
        lang=ocr_lang,
        oem=ocr_oem,
    )
    if column_lines:
        parsed_dump = "\n".join(
            f"{line.name_display} | qtd={line.quantity:.0f} | valor={line.npc_total_price:.2f}"
            for line in column_lines
        )
        parsed_path = _save_debug_text(debug_dir, f"{variant_label}_parsed_lines_column_mode", parsed_dump)
        if parsed_path and debug_notes is not None:
            debug_notes.append(f"DEBUG {variant_label} parsed lines (column mode): {parsed_path}")
        return column_lines

    table_width, table_height = table.size
    row_start_y = header["item"].y + header["item"].h + 8
    footer_start_y = table_height

    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text in {"ganho", "total", "pagina", "redefinir", "reset", "gain", "earnings", "page", "ganancia", "reiniciar", "zysk", "strona", "resetuj"} and word.y > row_start_y:
            footer_start_y = min(footer_start_y, word.y)

    usable_words = [word for word in words if row_start_y <= word.y < footer_start_y]

    if not usable_words:
        raw_text = _ocr_multiline(table, lang=ocr_lang, oem=ocr_oem)
        raw_txt_path = _save_debug_text(debug_dir, f"{variant_label}_fallback_raw_text_no_words", raw_text)
        if raw_txt_path and debug_notes is not None:
            debug_notes.append(f"DEBUG {variant_label} fallback raw OCR text: {raw_txt_path}")
        return parse_drop_lines(raw_text)

    avg_height = sum(word.h for word in usable_words) / len(usable_words)
    tolerance = max(10, int(avg_height * 0.7))
    rows = _cluster_rows(usable_words, tolerance)

    item_x = header["item"].x
    count_x = header["count"].x
    value_x = header["value"].x
    item_to_count_gap = max(120, count_x - item_x)
    count_to_value_gap = max(120, value_x - count_x)

    item_region_left = max(0, item_x - max(120, int(item_to_count_gap * 0.75)))
    item_region_right = min(table_width, count_x - max(18, int(item_to_count_gap * 0.10)))
    count_boundary_left = max(0, count_x - max(22, int(item_to_count_gap * 0.16)))
    value_boundary_left = max(0, value_x - max(20, int(count_to_value_gap * 0.16)))

    if not (item_region_left < item_region_right and count_boundary_left < value_boundary_left):
        item_region_left = 0
        item_region_right = int(table_width * 0.45)
        count_boundary_left = item_region_right
        value_boundary_left = item_region_right + int(table_width * 0.25)

    icon_trim = max(8, int((item_region_right - item_region_left) * 0.08))

    parsed_lines: list[ParsedDropLine] = []
    for row in rows:
        row_words = sorted(row, key=lambda current: current.x)
        item_words = [word for word in row_words if word.x < count_boundary_left]
        count_words = [word for word in row_words if count_boundary_left <= word.x < value_boundary_left]
        value_words = [word for word in row_words if word.x >= value_boundary_left]

        row_top = max(0, min(word.y for word in row_words) - 6)
        row_bottom = min(table_height, max(word.y + word.h for word in row_words) + 6)

        item_crop = table.crop((item_region_left, row_top, item_region_right, row_bottom))
        item_crop_trimmed = table.crop((min(item_region_right - 1, item_region_left + icon_trim), row_top, item_region_right, row_bottom))
        count_crop = table.crop((max(0, count_boundary_left - 8), row_top, max(count_boundary_left + 8, value_boundary_left - 10), row_bottom))
        value_crop = table.crop((max(0, value_boundary_left - 8), row_top, table_width, row_bottom))

        item_candidate_words = _join_words(item_words)
        item_candidate_full = _ocr_single_line(
            _prepare_ocr_patch(item_crop),
            whitelist="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-",
            lang=ocr_lang,
            oem=ocr_oem,
        )
        item_candidate_trimmed = _ocr_single_line(
            _prepare_ocr_patch(item_crop_trimmed),
            whitelist="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-",
            lang=ocr_lang,
            oem=ocr_oem,
        )

        item_candidates = [item_candidate_words, item_candidate_full, item_candidate_trimmed]
        name_display = max(item_candidates, key=_score_item_text)

        quantity_from_words = _join_words(count_words).replace(" ", "")
        quantity_from_crop = _ocr_single_line(
            _prepare_ocr_patch(count_crop),
            whitelist="0123456789",
            lang=ocr_lang,
            oem=ocr_oem,
        )
        quantity_text = quantity_from_crop or quantity_from_words
        quantity_text = re.sub(r"[^0-9]", "", quantity_text)

        value_from_words = _join_words(value_words).replace(" ", "")
        value_from_crop = _ocr_single_line(
            _prepare_ocr_patch(value_crop),
            whitelist="0123456789.kK",
            lang=ocr_lang,
            oem=ocr_oem,
        )
        value_text = value_from_crop or value_from_words
        value_text = value_text.replace(" ", "")

        name_display = re.sub(r"^[^a-zA-Z0-9]+", "", name_display).strip()
        value_text = value_text.strip()

        if not name_display or not quantity_text or not _looks_like_value_token(value_text):
            continue

        name_normalized = _normalize_item_name(name_display)
        quantity = float(quantity_text)
        if quantity < 0:
            continue

        npc_total_price = _parse_value(value_text)
        npc_unit_price = npc_total_price / quantity if quantity else 0
        duplicate_key = f"{name_normalized}:{int(quantity)}:{npc_total_price:.2f}"

        parsed_lines.append(
            ParsedDropLine(
                name_display=name_display,
                name_normalized=name_normalized,
                quantity=quantity,
                npc_total_price=npc_total_price,
                npc_unit_price=npc_unit_price,
                duplicate_key=duplicate_key,
            )
        )

    if parsed_lines:
        parsed_dump = "\n".join(
            f"{line.name_display} | qtd={line.quantity:.0f} | valor={line.npc_total_price:.2f}"
            for line in parsed_lines
        )
        parsed_path = _save_debug_text(debug_dir, f"{variant_label}_parsed_lines_row_mode", parsed_dump)
        if parsed_path and debug_notes is not None:
            debug_notes.append(f"DEBUG {variant_label} parsed lines (row mode): {parsed_path}")
        return parsed_lines

    raw_text = _ocr_multiline(table, lang=ocr_lang, oem=ocr_oem)
    raw_txt_path = _save_debug_text(debug_dir, f"{variant_label}_fallback_raw_text_final", raw_text)
    if raw_txt_path and debug_notes is not None:
        debug_notes.append(f"DEBUG {variant_label} fallback raw OCR text: {raw_txt_path}")
    return parse_drop_lines(raw_text)


def extract_drop_lines_from_image(
    image_bytes: bytes,
    debug_dir: Path | None = None,
    debug_notes: list[str] | None = None,
    ocr_lang: str = "eng",
    ocr_oem: int = 1,
) -> list[ParsedDropLine]:
    original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    _save_debug_image(debug_dir, "original", original_image)

    # Detect and crop the table on the original RGB image so UI color anchors remain intact.
    detected_table_raw, detect_strategy = _detect_table_region_and_strategy(
        original_image,
        lang=ocr_lang,
        oem=ocr_oem,
        visual_image=original_image,
    )
    if debug_notes is not None:
        debug_notes.append(f"DEBUG table detection strategy: {detect_strategy}")

    detected_table = ImageOps.autocontrast(detected_table_raw)
    detected_table_path = _save_debug_image(debug_dir, "detected_table_color", detected_table)
    if detected_table_path and debug_notes is not None:
        debug_notes.append(f"DEBUG detected table (color): {detected_table_path}")

    # Only after cropping the table do we preprocess/grayscale for text OCR.
    preprocessed_table = preprocess(detected_table)
    table_path = _save_debug_image(debug_dir, "detected_table", preprocessed_table)
    if table_path and debug_notes is not None:
        debug_notes.append(f"DEBUG detected table (preprocessed): {table_path}")

    color_lines = _extract_drop_lines_from_table(
        detected_table,
        debug_dir=debug_dir,
        debug_notes=debug_notes,
        ocr_lang=ocr_lang,
        ocr_oem=ocr_oem,
        variant_label="color_table",
    )
    preprocessed_lines = _extract_drop_lines_from_table(
        preprocessed_table,
        debug_dir=debug_dir,
        debug_notes=debug_notes,
        ocr_lang=ocr_lang,
        ocr_oem=ocr_oem,
        variant_label="preprocessed_table",
    )

    def _score_lines(lines: list[ParsedDropLine]) -> tuple[int, int, float]:
        total_named = sum(1 for line in lines if len((line.name_display or "").strip()) >= 4)
        total_non_zero_value = sum(1 for line in lines if float(line.npc_total_price or 0) > 0)
        total_quantity = sum(float(line.quantity or 0) for line in lines)
        return (len(lines), total_non_zero_value, total_quantity + total_named)

    color_score = _score_lines(color_lines)
    preprocessed_score = _score_lines(preprocessed_lines)

    best_label = "color_table"
    best_lines = color_lines
    if preprocessed_score > color_score:
        best_label = "preprocessed_table"
        best_lines = preprocessed_lines

    if debug_notes is not None:
        debug_notes.append(
            f"DEBUG table OCR variant scores: color={color_score} preprocessed={preprocessed_score} winner={best_label}"
        )

    best_lines = _apply_fuzzy_name_correction(best_lines, debug_notes=debug_notes)
    return best_lines


def extract_text_from_image(image_bytes: bytes, *, ocr_lang: str = "eng", ocr_oem: int = 1) -> str:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = preprocess(image)

    table = detect_table(image, lang=ocr_lang, oem=ocr_oem)
    table = ImageOps.autocontrast(table)

    table_text = _ocr_multiline(table, lang=ocr_lang, oem=ocr_oem)
    full_text = _ocr_multiline(image, lang=ocr_lang, oem=ocr_oem)

    def _score_ocr_text(raw_text: str) -> int:
        score = 0
        for raw_line in raw_text.splitlines():
            line = " ".join(raw_line.split())
            if re.match(r"^.+?\s+\d+\s+[\doOkK.,]+$", line):
                score += 1
        return score

    if _score_ocr_text(full_text) > _score_ocr_text(table_text):
        return full_text

    return table_text


def parse_drop_lines(raw_text: str) -> list[ParsedDropLine]:
    parsed_lines: list[ParsedDropLine] = []

    for raw_line in raw_text.splitlines():
        line = " ".join(raw_line.split())
        if not line:
            continue

        line_normalized = re.sub(r"\s+", " ", line.lower())
        if any(token in line_normalized for token in ["item", "contagem", "valor", "ganho total", "pagina"]):
            continue

        tokens = line.split()
        if len(tokens) < 3:
            continue

        value_token = tokens[-1]
        quantity_token = tokens[-2]

        if not quantity_token.isdigit():
            continue

        if not _looks_like_value_token(value_token):
            continue

        name_display = " ".join(tokens[:-2]).strip()
        parsed_line = _parse_line_triplet(name_display, quantity_token, value_token)
        if parsed_line is not None:
            parsed_lines.append(parsed_line)

    return parsed_lines

def deduplicate_drop_lines(lines: list[ParsedDropLine]) -> tuple[list[ParsedDropLine], int]:
    unique_lines: list[ParsedDropLine] = []
    seen: set[str] = set()
    duplicates_ignored = 0

    for line in lines:
        if line.duplicate_key in seen:
            duplicates_ignored += 1
            continue

        seen.add(line.duplicate_key)
        unique_lines.append(line)

    return unique_lines, duplicates_ignored