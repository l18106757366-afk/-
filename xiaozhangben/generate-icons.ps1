Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $scriptDir 'icons'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$sizes = 180, 192, 512

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $c1 = [System.Drawing.Color]::FromArgb(255, 61, 220, 107)
    $c2 = [System.Drawing.Color]::FromArgb(255, 22, 160, 72)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
    $g.FillRectangle($brush, $rect)

    $fontSize = [float]($size * 0.46)
    $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $layout = New-Object System.Drawing.RectangleF(0, [float]($size * 0.03), $size, $size)
    $yenSign = [string][char]0x00A5
    $g.DrawString($yenSign, $font, [System.Drawing.Brushes]::White, $layout, $sf)

    $path = Join-Path $outDir ("icon-{0}.png" -f $size)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose()
    $sf.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Saved: $path"
}
