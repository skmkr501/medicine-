#!/usr/bin/env python3
import struct
import zlib
import math

def create_png(width, height, get_pixel):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT (Scanlines with filter byte 0)
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type none
        for x in range(width):
            r, g, b, a = get_pixel(x, y, width, height)
            raw_data.extend((r, g, b, a))
            
    compressed = zlib.compress(bytes(raw_data), level=9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    return png

def render_logo_pixel(x, y, width, height):
    # Normalize coordinates to 0..1
    nx = x / (width - 1)
    ny = y / (height - 1)
    
    # Rounded corner squircle mask (radius ~ 0.22)
    # Distance from center
    cx, cy = 0.5, 0.5
    dx = abs(nx - cx) * 2
    dy = abs(ny - cy) * 2
    # Superellipse / rounded rect
    corner_r = 0.22
    if dx > (1 - corner_r) and dy > (1 - corner_r):
        cdx = dx - (1 - corner_r)
        cdy = dy - (1 - corner_r)
        if math.hypot(cdx, cdy) > corner_r:
            return 0, 0, 0, 0

    # Background gradient: Deep Teal #0F766E (15, 118, 110) to #042F2E (4, 47, 46)
    grad_t = (nx + ny) * 0.5
    bg_r = int(15 * (1 - grad_t) + 4 * grad_t)
    bg_g = int(118 * (1 - grad_t) + 47 * grad_t)
    bg_b = int(110 * (1 - grad_t) + 46 * grad_t)
    
    # Coordinate centered at (cx, cy) = (0.5, 0.5)
    px = (nx - 0.5) * 2.0
    py = (ny - 0.5) * 2.0
    
    # 1. Subtle Heart Contour
    # Standard heart equation: (x^2 + (y - 0.2)^2 - 0.35)^3 - x^2 * (y - 0.2)^3 < 0
    hx = px * 1.3
    hy = -py * 1.3 + 0.15 # flip y
    heart_val = (hx*hx + hy*hy - 0.4)**3 - (hx*hx)*(hy*hy*hy)
    is_heart_edge = abs(heart_val) < 0.08 and hy > -0.6
    
    color_r, color_g, color_b = bg_r, bg_g, bg_b
    
    if is_heart_edge:
        # Soft glowing white heart line
        alpha_heart = min(1.0, max(0.0, 1.0 - abs(heart_val) / 0.08)) * 0.35
        color_r = int(color_r * (1 - alpha_heart) + 255 * alpha_heart)
        color_g = int(color_g * (1 - alpha_heart) + 255 * alpha_heart)
        color_b = int(color_b * (1 - alpha_heart) + 255 * alpha_heart)
        
    # 2. Angled Pill Capsule in Center
    # Rotate by -40 degrees
    angle = math.radians(-40)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    
    rx = px * cos_a - py * sin_a
    ry = px * sin_a + py * cos_a
    
    # Pill dimensions: width [-0.18, 0.18], length [-0.45, 0.45]
    pill_w = 0.18
    pill_cap = 0.45 - pill_w
    
    in_pill = False
    is_top_half = False
    dist_pill = 0
    
    if abs(rx) <= pill_w:
        if abs(ry) <= pill_cap:
            in_pill = True
            is_top_half = (ry < 0)
        else:
            cap_y = -pill_cap if ry < 0 else pill_cap
            d = math.hypot(rx, ry - cap_y)
            if d <= pill_w:
                in_pill = True
                is_top_half = (ry < 0)
                dist_pill = d
                
    if in_pill:
        if is_top_half:
            # Top half: Pure White / Off-white (255, 255, 255) with specular highlight
            pr, pg, pb = 255, 255, 255
            if rx < -0.06 and rx > -0.14: # subtle highlight stripe
                pr, pg, pb = 255, 255, 255
            elif rx > 0.08:
                pr, pg, pb = 230, 245, 245
        else:
            # Bottom half: Vibrant Mint Teal #2DD4BF (45, 212, 191) to #0D9488 (13, 148, 136)
            mint_t = (ry / 0.45)
            pr = int(45 * (1 - mint_t) + 13 * mint_t)
            pg = int(212 * (1 - mint_t) + 148 * mint_t)
            pb = int(191 * (1 - mint_t) + 136 * mint_t)
            if rx < -0.06 and rx > -0.14:
                pr = min(255, pr + 40)
                pg = min(255, pg + 30)
                pb = min(255, pb + 30)
                
        # Dividing ring at ry ~ 0
        if abs(ry) < 0.015:
            pr, pg, pb = 15, 118, 110 # dark teal line
            
        color_r, color_g, color_b = pr, pg, pb
        
    # 3. Warm Care Sparkle (circle at px=0.45, py=-0.4)
    spark_d = math.hypot(px - 0.42, py + 0.38)
    if spark_d < 0.07:
        spark_a = max(0.0, 1.0 - spark_d / 0.07)
        color_r = int(color_r * (1 - spark_a) + 250 * spark_a)
        color_g = int(color_g * (1 - spark_a) + 204 * spark_a)
        color_b = int(color_b * (1 - spark_a) + 21 * spark_a)
        
    return color_r, color_g, color_b, 255

print("Rendering 512x512 icon...")
png512 = create_png(512, 512, render_logo_pixel)
with open('public/icon-512.png', 'wb') as f:
    f.write(png512)
print("Saved public/icon-512.png")

print("Rendering 192x192 icon...")
png192 = create_png(192, 192, render_logo_pixel)
with open('public/icon-192.png', 'wb') as f:
    f.write(png192)
print("Saved public/icon-192.png")
