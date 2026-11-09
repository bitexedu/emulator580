import AppKit
let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> NSColor {
    NSColor(srgbRed: r, green: g, blue: b, alpha: 1)
}
for size in [16, 32, 64, 128, 256, 512, 1024] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let transform = NSAffineTransform()
    transform.scale(by: CGFloat(size) / 1024)
    transform.concat()
    func box(_ rect: NSRect, _ radius: CGFloat, _ fill: NSColor) {
        fill.setFill(); NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
    }
    box(NSRect(x: 36, y: 36, width: 952, height: 952), 210, color(0.12, 0.20, 0.24))
    box(NSRect(x: 150, y: 152, width: 724, height: 720), 100, color(0.95, 0.95, 0.91))
    box(NSRect(x: 210, y: 552, width: 604, height: 250), 40, color(0.12, 0.20, 0.24))
    box(NSRect(x: 230, y: 572, width: 564, height: 210), 24, color(0.77, 0.86, 0.73))
    let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedDigitSystemFont(ofSize: 118, weight: .medium), .foregroundColor: color(0.10, 0.18, 0.12)]
    ("1+2" as NSString).draw(at: NSPoint(x: 295, y: 617), withAttributes: attrs)
    for x in [CGFloat(215), 425, 635] {
        for y in [CGFloat(206), 373] { box(NSRect(x: x, y: y, width: 174, height: 125), 26, color(0.16, 0.26, 0.30)) }
    }
    box(NSRect(x: 635, y: 206, width: 174, height: 125), 26, color(0.75, 0.17, 0.26))
    ("=" as NSString).draw(at: NSPoint(x: 683, y: 218), withAttributes: [.font: NSFont.systemFont(ofSize: 90, weight: .bold), .foregroundColor: NSColor.white])
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent("icon-\(size).png"))
}
