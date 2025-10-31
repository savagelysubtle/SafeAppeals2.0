$themes = @(
    @{name="green"; path="extensions/theme-safeappeals-colors-green/themes/green-color-theme.json"},
    @{name="grey"; path="extensions/theme-safeappeals-colors-grey/themes/grey-color-theme.json"},
    @{name="purple"; path="extensions/theme-safeappeals-colors-purple/themes/purple-color-theme.json"},
    @{name="teal"; path="extensions/theme-safeappeals-colors-teal/themes/teal-color-theme.json"},
    @{name="red"; path="extensions/theme-safeappeals-colors-red/themes/red-color-theme.json"},
    @{name="yellow"; path="extensions/theme-safeappeals-colors-yellow/themes/yellow-color-theme.json"},
    @{name="contrast"; path="extensions/theme-safeappeals-colors-contrast/themes/contrast-color-theme.json"},
    @{name="dark"; path="extensions/theme-safeappeals-colors-dark/themes/dark-color-theme.json"},
    @{name="pastel"; path="extensions/theme-safeappeals-colors-pastel/themes/pastel-color-theme.json"},
    @{name="neon"; path="extensions/theme-safeappeals-colors-neon/themes/neon-color-theme.json"},
    @{name="icy"; path="extensions/theme-safeappeals-colors-icy/themes/icy-color-theme.json"},
    @{name="material"; path="extensions/theme-safeappeals-colors-material/themes/material-color-theme.json"}
)

# New more visible scrollbar colors
$newColors = @"
"scrollbarSlider.background": "#4a4a4aaa",
		"scrollbarSlider.hoverBackground": "#646464ee",
		"scrollbarSlider.activeBackground": "#808080ff",
"@

foreach ($theme in $themes) {
    $content = Get-Content $theme.path -Raw

    # Replace scrollbar colors
    $content = $content -replace '"scrollbarSlider\.background":\s*"[^"]*"', '"scrollbarSlider.background": "#4a4a4aaa"'
    $content = $content -replace '"scrollbarSlider\.hoverBackground":\s*"[^"]*"', '"scrollbarSlider.hoverBackground": "#646464ee"'
    $content = $content -replace '"scrollbarSlider\.activeBackground":\s*"[^"]*"', '"scrollbarSlider.activeBackground": "#808080ff"'

    Set-Content -Path $theme.path -Value $content -NoNewline
    Write-Host "✅ Updated $($theme.name) theme scrollbar colors"
}

Write-Host "`n🎉 All themes updated with visible scrollbar colors!"

