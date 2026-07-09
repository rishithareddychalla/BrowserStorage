import os
from PIL import Image, ImageDraw

def create_gradient_icon(size):
    # Create an image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate dimensions
    center = size / 2
    radius = size * 0.45
    
    # Draw background circle with a rich gradient (simulated with concentric circles or custom interpolation)
    # We will simulate a linear/radial gradient
    for r in range(int(radius), 0, -1):
        # Interpolate between dark obsidian (#0f172a), royal blue (#2563eb), and neon cyan (#06b6d4)
        ratio = r / radius
        if ratio > 0.5:
            # Outer gradient: obsidian to blue
            r2 = (ratio - 0.5) * 2
            color_r = int(15 * (1 - r2) + 37 * r2)
            color_g = int(23 * (1 - r2) + 99 * r2)
            color_b = int(42 * (1 - r2) + 235 * r2)
        else:
            # Inner gradient: blue to cyan
            r2 = ratio * 2
            color_r = int(37 * (1 - r2) + 6 * r2)
            color_g = int(99 * (1 - r2) + 182 * r2)
            color_b = int(235 * (1 - r2) + 212 * r2)
            
        draw.ellipse(
            [center - r, center - r, center + r, center + r],
            fill=(color_r, color_g, color_b, 255)
        )
        
    # Draw a stylized database/vault icon in the center
    # Size-dependent coordinates
    scale = size / 128.0
    
    # Let's draw 3 stacked storage disks (cylinders)
    # Center of the stack is at center
    disk_w = 54 * scale
    disk_h = 16 * scale
    gap = 6 * scale
    
    y_start = center - (disk_h + gap)
    
    for i in range(3):
        y = y_start + i * (disk_h + gap)
        
        # Draw bottom ellipse shadow/highlight
        draw.ellipse(
            [center - disk_w/2, y, center + disk_w/2, y + disk_h],
            fill=(10, 15, 30, 230),
            outline=(100, 200, 255, 255),
            width=int(max(1, 2 * scale))
        )
        
        # Connect to create 3D cylinder (if i < 2 we draw side walls)
        # Actually draw side walls for all, then overlap
        if i < 2:
            # Draw the walls
            draw.rectangle(
                [center - disk_w/2, y + disk_h/2, center + disk_w/2, y + disk_h/2 + gap + disk_h/2],
                fill=(10, 15, 30, 230)
            )
            
        # Draw top face of the cylinder
        draw.ellipse(
            [center - disk_w/2, y, center + disk_w/2, y + disk_h/2],
            fill=(15, 23, 42, 255),
            outline=(100, 220, 255, 255),
            width=int(max(1, 2 * scale))
        )
        
        # Draw small glowing node on each cylinder top face
        node_r = 3 * scale
        draw.ellipse(
            [center + disk_w/4 - node_r, y + disk_h/4 - node_r, center + disk_w/4 + node_r, y + disk_h/4 + node_r],
            fill=(34, 197, 94, 255) if i == 0 else ((234, 179, 8, 255) if i == 1 else (59, 130, 246, 255)) # Green, Yellow, Blue lights
        )

    # Let's add a neat glowing circular ring around the disk stack
    ring_r = size * 0.38
    draw.ellipse(
        [center - ring_r, center - ring_r, center + ring_r, center + ring_r],
        outline=(255, 255, 255, 60),
        width=int(max(1, 1.5 * scale))
    )
    
    return img

def main():
    os.makedirs("icons", exist_ok=True)
    sizes = [16, 32, 48, 128]
    for size in sizes:
        img = create_gradient_icon(size)
        img.save(f"icons/icon{size}.png")
        print(f"Generated icons/icon{size}.png")

if __name__ == "__main__":
    main()
