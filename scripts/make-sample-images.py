"""Generate four original flat-style vector/shape illustrations for SignalDoor sample visitor testing.

Generated files:
  1. src/server/assets/sample-visitors/delivery.jpg    (person holding a plain, unmarked box at the door)
  2. src/server/assets/sample-visitors/visitor.jpg     (person waving/standing with no objects)
  3. src/server/assets/sample-visitors/empty-porch.jpg (empty porch with nobody in the scene)
  4. src/server/assets/sample-visitors/dark-porch.jpg  (dim evening / night scene of the porch)

All images:
  - Long edge: 800 px (800 x 600)
  - Quality: JPEG ~85
  - Stripped of any metadata (EXIF/GPS)
  - Bottom-right label: "SIMULATED - SAMPLE IMAGE"
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH = 800
HEIGHT = 600
LABEL_TEXT = "SIMULATED - SAMPLE IMAGE"

def get_font():
    # Prefer standard system sans-serif font
    candidates = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, 14)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_label(draw: ImageDraw.ImageDraw, font):
    bbox = font.getbbox(LABEL_TEXT)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    margin = 14
    pad = 5
    x = WIDTH - text_w - margin
    y = HEIGHT - text_h - margin
    
    # Dark semi-translucent-style badge backing for crisp contrast
    draw.rectangle(
        [x - pad, y - pad, x + text_w + pad, y + text_h + pad],
        fill=(15, 23, 42)
    )
    # White ASCII text
    draw.text((x, y), LABEL_TEXT, font=font, fill=(248, 250, 252))

def draw_porch_background(draw: ImageDraw.ImageDraw, is_night: bool = False):
    if not is_night:
        # Sky outside porch
        draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(219, 234, 254)) # #dbeafe soft sky blue
        # Lawn / front garden strip
        draw.rectangle([0, 380, WIDTH, HEIGHT], fill=(134, 239, 172)) # #86efac soft green
        # Porch concrete foundation / floor
        draw.polygon([(80, 420), (720, 420), (800, 600), (0, 600)], fill=(203, 213, 225)) # #cbd5e1
        # Welcome mat
        draw.rectangle([320, 480, 480, 530], fill=(120, 80, 50))
        # House wall / facade
        draw.rectangle([140, 60, 660, 430], fill=(241, 245, 249)) # #f1f5f9 siding
        # Siding horizontal lines
        for y in range(80, 430, 30):
            draw.line([(140, y), (660, y)], fill=(226, 232, 240), width=1)
        # Door frame
        draw.rectangle([340, 140, 460, 430], fill=(71, 85, 105)) # #475569 frame
        # Door panel
        draw.rectangle([350, 150, 450, 430], fill=(30, 41, 59)) # #1e293b dark slate door
        # Door window panels
        draw.rectangle([365, 175, 395, 225], fill=(191, 219, 254))
        draw.rectangle([405, 175, 435, 225], fill=(191, 219, 254))
        # Door handle
        draw.ellipse([360, 290, 370, 300], fill=(234, 179, 8)) # brass knob
        # Overhang porch roof
        draw.polygon([(100, 60), (700, 60), (660, 20), (140, 20)], fill=(51, 65, 85))
        # Porch wall sconce / light fixture
        draw.rectangle([475, 220, 495, 260], fill=(100, 116, 139))
        draw.ellipse([478, 230, 492, 250], fill=(254, 240, 138))
        # Window on the left
        draw.rectangle([180, 180, 280, 320], fill=(51, 65, 85))
        draw.rectangle([190, 190, 270, 310], fill=(191, 219, 254))
        draw.line([(230, 190), (230, 310)], fill=(51, 65, 85), width=2)
        draw.line([(190, 250), (270, 250)], fill=(51, 65, 85), width=2)
    else:
        # Dim evening / night scene
        # Dark indigo night sky
        draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(10, 15, 28))
        # Dim shadowy ground
        draw.rectangle([0, 380, WIDTH, HEIGHT], fill=(15, 23, 42))
        # Porch floor in deep shadow
        draw.polygon([(80, 420), (720, 420), (800, 600), (0, 600)], fill=(30, 41, 59))
        # Dark house wall
        draw.rectangle([140, 60, 660, 430], fill=(24, 32, 47))
        for y in range(80, 430, 30):
            draw.line([(140, y), (660, y)], fill=(18, 24, 38), width=1)
        # Door frame
        draw.rectangle([340, 140, 460, 430], fill=(15, 23, 42))
        # Door panel
        draw.rectangle([350, 150, 450, 430], fill=(8, 12, 20))
        # Dim door window glass
        draw.rectangle([365, 175, 395, 225], fill=(28, 40, 60))
        draw.rectangle([405, 175, 435, 225], fill=(28, 40, 60))
        # Door handle
        draw.ellipse([360, 290, 370, 300], fill=(160, 120, 20))
        # Overhang
        draw.polygon([(100, 60), (700, 60), (660, 20), (140, 20)], fill=(15, 23, 42))
        # Porch light sconce with warm night glow
        draw.ellipse([450, 190, 520, 290], fill=(85, 70, 20)) # soft glow halo
        draw.rectangle([475, 220, 495, 260], fill=(50, 55, 65))
        draw.ellipse([478, 230, 492, 250], fill=(254, 240, 138)) # warm lit bulb
        # Window in shadow
        draw.rectangle([180, 180, 280, 320], fill=(15, 23, 42))
        draw.rectangle([190, 190, 270, 310], fill=(24, 34, 52))
        draw.line([(230, 190), (230, 310)], fill=(15, 23, 42), width=2)
        draw.line([(190, 250), (270, 250)], fill=(15, 23, 42), width=2)

def generate_delivery_image(out_path: Path, font):
    """Person standing on the porch holding a plain, unmarked cardboard box."""
    im = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(im)
    draw_porch_background(draw, is_night=False)
    
    # Person standing centered at front door
    center_x = 400
    
    # Shadow on floor
    draw.ellipse([center_x - 60, 500, center_x + 60, 530], fill=(148, 163, 184))
    
    # Legs (dark navy trousers)
    draw.rectangle([center_x - 28, 360, center_x - 8, 490], fill=(30, 41, 59))
    draw.rectangle([center_x + 8, 360, center_x + 28, 490], fill=(30, 41, 59))
    # Shoes
    draw.rectangle([center_x - 32, 485, center_x - 4, 505], fill=(15, 23, 42))
    draw.rectangle([center_x + 4, 485, center_x + 32, 505], fill=(15, 23, 42))
    
    # Torso (royal blue plain shirt/jacket, no logo)
    draw.rectangle([center_x - 38, 240, center_x + 38, 370], fill=(37, 99, 235))
    
    # Arms holding box
    draw.polygon([(center_x - 38, 250), (center_x - 55, 310), (center_x - 30, 330), (center_x - 20, 280)], fill=(29, 78, 216))
    draw.polygon([(center_x + 38, 250), (center_x + 55, 310), (center_x + 30, 330), (center_x + 20, 280)], fill=(29, 78, 216))
    
    # Plain unmarked brown cardboard parcel
    box_left = center_x - 45
    box_top = 280
    box_right = center_x + 45
    box_bottom = 350
    draw.rectangle([box_left, box_top, box_right, box_bottom], fill=(217, 119, 6)) # cardboard brown #d97706
    # Box top flap depth
    draw.polygon([(box_left, box_top), (box_left + 15, box_top - 15), (box_right + 15, box_top - 15), (box_right, box_top)], fill=(245, 158, 11))
    draw.polygon([(box_right, box_top), (box_right + 15, box_top - 15), (box_right + 15, box_bottom - 15), (box_right, box_bottom)], fill=(180, 83, 9))
    # Hands holding box edges
    draw.ellipse([box_left - 8, box_top + 20, box_left + 4, box_top + 40], fill=(224, 172, 105)) # hand
    draw.ellipse([box_right - 4, box_top + 20, box_right + 8, box_top + 40], fill=(224, 172, 105)) # hand

    # Head and face
    draw.ellipse([center_x - 22, 180, center_x + 22, 235], fill=(224, 172, 105)) # skin tone
    # Hair / cap (plain navy cap, no logo)
    draw.ellipse([center_x - 24, 172, center_x + 24, 205], fill=(30, 41, 59))
    draw.polygon([(center_x - 24, 195), (center_x + 10, 195), (center_x + 28, 190)], fill=(15, 23, 42))

    draw_label(draw, font)
    im.save(out_path, "JPEG", quality=85, optimize=True)

def generate_visitor_image(out_path: Path, font):
    """Person standing on the porch waving one hand with no objects."""
    im = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(im)
    draw_porch_background(draw, is_night=False)
    
    center_x = 400
    
    # Shadow
    draw.ellipse([center_x - 55, 500, center_x + 55, 530], fill=(148, 163, 184))
    
    # Legs (dark jeans)
    draw.rectangle([center_x - 26, 360, center_x - 8, 490], fill=(51, 65, 85))
    draw.rectangle([center_x + 8, 360, center_x + 26, 490], fill=(51, 65, 85))
    # Shoes
    draw.rectangle([center_x - 30, 485, center_x - 4, 505], fill=(30, 41, 59))
    draw.rectangle([center_x + 4, 485, center_x + 30, 505], fill=(30, 41, 59))
    
    # Torso (emerald green sweater, plain, no logo)
    draw.rectangle([center_x - 34, 240, center_x + 34, 370], fill=(22, 163, 74))
    
    # Left arm relaxed by side
    draw.polygon([(center_x - 34, 250), (center_x - 48, 320), (center_x - 36, 335), (center_x - 24, 270)], fill=(21, 128, 61))
    draw.ellipse([center_x - 48, 325, center_x - 34, 345], fill=(224, 172, 105)) # left hand
    
    # Right arm raised waving!
    draw.polygon([(center_x + 30, 250), (center_x + 60, 210), (center_x + 72, 222), (center_x + 34, 275)], fill=(21, 128, 61))
    # Forearm pointing upward
    draw.polygon([(center_x + 60, 210), (center_x + 75, 160), (center_x + 88, 165), (center_x + 72, 222)], fill=(21, 128, 61))
    # Waving open hand
    draw.ellipse([center_x + 70, 145, center_x + 92, 168], fill=(224, 172, 105))
    # Small fingers on waving hand
    draw.rectangle([center_x + 72, 138, center_x + 76, 148], fill=(224, 172, 105))
    draw.rectangle([center_x + 78, 136, center_x + 82, 148], fill=(224, 172, 105))
    draw.rectangle([center_x + 84, 138, center_x + 88, 148], fill=(224, 172, 105))

    # Head and face
    draw.ellipse([center_x - 22, 180, center_x + 22, 235], fill=(224, 172, 105))
    # Hair (brown flat hair)
    draw.ellipse([center_x - 24, 172, center_x + 24, 205], fill=(120, 53, 15))

    draw_label(draw, font)
    im.save(out_path, "JPEG", quality=85, optimize=True)

def generate_empty_porch_image(out_path: Path, font):
    """Empty porch scene with nobody there."""
    im = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(im)
    draw_porch_background(draw, is_night=False)
    # Porch is completely empty
    draw_label(draw, font)
    im.save(out_path, "JPEG", quality=85, optimize=True)

def generate_dark_porch_image(out_path: Path, font):
    """Dim evening / night porch scene."""
    im = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(im)
    draw_porch_background(draw, is_night=True)
    # Dim night scene
    draw_label(draw, font)
    im.save(out_path, "JPEG", quality=85, optimize=True)

def main():
    target_dir = Path("src/server/assets/sample-visitors")
    target_dir.mkdir(parents=True, exist_ok=True)
    
    font = get_font()
    
    files = {
        "delivery.jpg": generate_delivery_image,
        "visitor.jpg": generate_visitor_image,
        "empty-porch.jpg": generate_empty_porch_image,
        "dark-porch.jpg": generate_dark_porch_image,
    }
    
    print("Generating sample visitor illustrations:")
    for filename, generator in files.items():
        out_path = target_dir / filename
        generator(out_path, font)
        size_kb = out_path.stat().st_size / 1024
        print(f"  [OK] {filename} ({WIDTH}x{HEIGHT}, {size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
