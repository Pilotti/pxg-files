#!/usr/bin/env python3
"""
Quick local diagnostic script for visual anchor detection on party window images.
This is not part of the product runtime.
"""
import sys
from pathlib import Path
from PIL import Image

# Add backend root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.hunts_ocr import (
    _detect_close_button_visual,
    _detect_blue_header_bar_visual,
    _detect_redefinir_button_visual,
    _detect_party_window_region_visual,
    preprocess,
)


def test_image_visual_anchors(image_path: str) -> None:
    """Test visual anchor detection on a single image."""
    print(f"\n{'='*60}")
    print(f"Testing: {image_path}")
    print(f"{'='*60}")
    
    try:
        image = Image.open(image_path).convert("RGB")
        print(f"✓ Image loaded: {image.size[0]}×{image.size[1]} pixels")
        
        # Test each anchor independently
        close_button = _detect_close_button_visual(image)
        print(f"  X close button: {close_button}")
        
        blue_bar_y = _detect_blue_header_bar_visual(image)
        print(f"  Blue header bar y: {blue_bar_y}")
        
        redefinir_button = _detect_redefinir_button_visual(image)
        print(f"  Redefinir button: {redefinir_button}")
        
        # Test combined detection
        party_region = _detect_party_window_region_visual(image)
        if party_region is not None:
            print(f"  ✓ Party window detected: {party_region.size[0]}×{party_region.size[1]} pixels")
        else:
            print(f"  ✗ Party window NOT detected (missing anchors)")
        
    except Exception as e:
        print(f"  ✗ Error: {e}")


def main():
    """Find and test local .png files in data/hunts or provided paths."""
    print("\nVisual Anchor Detection Test")
    print("="*60)
    
    # Check for test images in typical locations
    test_dirs = [Path("app/data/hunts")]
    
    image_files = []
    for test_dir in test_dirs:
        if test_dir.exists():
            image_files.extend(test_dir.glob("*.png"))
            image_files.extend(test_dir.glob("*.jpg"))
            image_files.extend(test_dir.glob("*.jpeg"))
    
    if not image_files:
        print(f"\nNo test images found in {test_dirs}")
        print("To test, place .png/.jpg files in app/data/hunts/")
        print("\nUsage: python test_visual_anchors.py [image_path1] [image_path2] ...")
        
        # Check if paths provided as arguments
        if len(sys.argv) > 1:
            image_files = [Path(arg) for arg in sys.argv[1:]]
        else:
            return
    
    for image_path in sorted(image_files)[:10]:  # Test first 10 images
        test_image_visual_anchors(str(image_path))
    
    print(f"\n{'='*60}")
    print(f"Tested {len(image_files)} image(s)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
