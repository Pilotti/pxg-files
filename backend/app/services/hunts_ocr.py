from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import io
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


def _ocr_single_line(image: Image.Image, whitelist: str | None = None) -> str:
    config = "--psm 7"
    return pytesseract.image_to_string(image, config=config).strip()


def _ocr_multiline(image: Image.Image, whitelist: str | None = None) -> str:
    config = "--psm 6"
    return pytesseract.image_to_string(image, config=config).strip()


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


def _extract_words(image: Image.Image) -> list[OcrWord]:
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
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
    return re.sub(r"[^a-z]", "", (text or "").lower())


def detect_table(image: Image.Image) -> Image.Image:
    words = _extract_words(image)

    header = {"item": None, "count": None, "value": None}

    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text == "item":
            header["item"] = word
        elif normalized_text in ["contagem", "count"]:
            header["count"] = word
        elif normalized_text in ["valor", "valuedl", "value"]:
            header["value"] = word

    if not all(header.values()):
        # Fallback to full image to avoid losing data when header detection fails.
        return image

    width, height = image.size
    x_margin = max(20, int(width * 0.04))
    y_margin = max(16, int(height * 0.02))

    item_to_count_gap = max(120, header["count"].x - header["item"].x)
    left_padding = max(120, int(item_to_count_gap * 0.75))
    left = max(0, header["item"].x - left_padding)
    right = min(width, header["value"].x + header["value"].w + x_margin)
    top = max(0, header["item"].y - y_margin)

    footer_candidates: list[int] = []
    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text in {"ganho", "total", "pagina", "redefinir", "reset"}:
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
        return image

    return image.crop((left, top, right, bottom))


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


def _extract_column_candidates(crop: Image.Image, kind: str) -> tuple[list[tuple[float, str]], str]:
    patch = _prepare_ocr_patch(crop, scale=4)
    raw_text = _ocr_multiline(patch)
    words = _extract_words(patch)

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

    item_candidates, item_text = _extract_column_candidates(item_crop, "item")
    count_candidates, count_text = _extract_column_candidates(count_crop, "count")
    value_candidates, value_text = _extract_column_candidates(value_crop, "value")

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


def extract_drop_lines_from_image(
    image_bytes: bytes,
    debug_dir: Path | None = None,
    debug_notes: list[str] | None = None,
) -> list[ParsedDropLine]:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    _save_debug_image(debug_dir, "original", image)

    image = preprocess(image)
    _save_debug_image(debug_dir, "preprocessed", image)

    table = ImageOps.autocontrast(detect_table(image))
    table_path = _save_debug_image(debug_dir, "detected_table", table)
    if table_path and debug_notes is not None:
        debug_notes.append(f"DEBUG detected table: {table_path}")

    words = _extract_words(table)

    header = {"item": None, "count": None, "value": None}
    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text == "item":
            header["item"] = word
        elif normalized_text in {"contagem", "count"}:
            header["count"] = word
        elif normalized_text in {"valor", "valuedl", "value"}:
            header["value"] = word

    if not all(header.values()):
        raw_text = pytesseract.image_to_string(table, config="--psm 6")
        raw_txt_path = _save_debug_text(debug_dir, "fallback_raw_text", raw_text)
        if raw_txt_path and debug_notes is not None:
            debug_notes.append(f"DEBUG fallback raw OCR text: {raw_txt_path}")
        return parse_drop_lines(raw_text)

    column_lines = _extract_drop_lines_by_columns(table, words, header, debug_dir=debug_dir, debug_notes=debug_notes)
    if column_lines:
        parsed_dump = "\n".join(
            f"{line.name_display} | qtd={line.quantity:.0f} | valor={line.npc_total_price:.2f}"
            for line in column_lines
        )
        parsed_path = _save_debug_text(debug_dir, "parsed_lines_column_mode", parsed_dump)
        if parsed_path and debug_notes is not None:
            debug_notes.append(f"DEBUG parsed lines (column mode): {parsed_path}")
        return column_lines

    table_width, table_height = table.size
    row_start_y = header["item"].y + header["item"].h + 8
    footer_start_y = table_height

    for word in words:
        normalized_text = _normalize_ocr_word(word.text)
        if normalized_text in {"ganho", "total", "pagina", "redefinir", "reset"} and word.y > row_start_y:
            footer_start_y = min(footer_start_y, word.y)

    usable_words = [
        word
        for word in words
        if row_start_y <= word.y < footer_start_y
    ]

    if not usable_words:
        raw_text = pytesseract.image_to_string(table, config="--psm 6")
        raw_txt_path = _save_debug_text(debug_dir, "fallback_raw_text_no_words", raw_text)
        if raw_txt_path and debug_notes is not None:
            debug_notes.append(f"DEBUG fallback raw OCR text: {raw_txt_path}")
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
        count_words = [
            word
            for word in row_words
            if count_boundary_left <= word.x < value_boundary_left
        ]
        value_words = [word for word in row_words if word.x >= value_boundary_left]

        row_top = max(0, min(word.y for word in row_words) - 6)
        row_bottom = min(table_height, max(word.y + word.h for word in row_words) + 6)

        item_crop = table.crop((item_region_left, row_top, item_region_right, row_bottom))
        item_crop_trimmed = table.crop((min(item_region_right - 1, item_region_left + icon_trim), row_top, item_region_right, row_bottom))
        count_crop = table.crop((max(0, count_boundary_left - 8), row_top, max(count_boundary_left + 8, value_boundary_left - 10), row_bottom))
        value_crop = table.crop((max(0, value_boundary_left - 8), row_top, table_width, row_bottom))

        item_candidate_words = _join_words(item_words)
        item_candidate_full = _ocr_single_line(_prepare_ocr_patch(item_crop), whitelist="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-")
        item_candidate_trimmed = _ocr_single_line(_prepare_ocr_patch(item_crop_trimmed), whitelist="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-")

        item_candidates = [item_candidate_words, item_candidate_full, item_candidate_trimmed]
        name_display = max(item_candidates, key=_score_item_text)

        quantity_from_words = _join_words(count_words).replace(" ", "")
        quantity_from_crop = _ocr_single_line(_prepare_ocr_patch(count_crop), whitelist="0123456789")
        quantity_text = quantity_from_crop or quantity_from_words
        quantity_text = re.sub(r"[^0-9]", "", quantity_text)

        value_from_words = _join_words(value_words).replace(" ", "")
        value_from_crop = _ocr_single_line(_prepare_ocr_patch(value_crop), whitelist="0123456789.kK")
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
        parsed_path = _save_debug_text(debug_dir, "parsed_lines_row_mode", parsed_dump)
        if parsed_path and debug_notes is not None:
            debug_notes.append(f"DEBUG parsed lines (row mode): {parsed_path}")
        return parsed_lines

    raw_text = pytesseract.image_to_string(table, config="--psm 6")
    raw_txt_path = _save_debug_text(debug_dir, "fallback_raw_text_final", raw_text)
    if raw_txt_path and debug_notes is not None:
        debug_notes.append(f"DEBUG fallback raw OCR text: {raw_txt_path}")
    return parse_drop_lines(raw_text)


def extract_text_from_image(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = preprocess(image)

    table = detect_table(image)
    table = ImageOps.autocontrast(table)

    table_text = pytesseract.image_to_string(table, config="--psm 6")
    full_text = pytesseract.image_to_string(image, config="--psm 6")

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


def extract_text(image_bytes: bytes) -> str:
    return extract_text_from_image(image_bytes)


def parse_lines(raw_text: str) -> list[ParsedDropLine]:
    return parse_drop_lines(raw_text)