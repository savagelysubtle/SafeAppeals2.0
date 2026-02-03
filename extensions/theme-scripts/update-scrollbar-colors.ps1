$themes = @(
    # Original themes
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
    @{name="material"; path="extensions/theme-safeappeals-colors-material/themes/material-color-theme.json"},
    # Black + Jewel/Metallic themes
    @{name="black-gold"; path="extensions/theme-safeappeals-colors-black-gold/themes/black-gold-color-theme.json"},
    @{name="black-emerald"; path="extensions/theme-safeappeals-colors-black-emerald/themes/black-emerald-color-theme.json"},
    @{name="black-ruby"; path="extensions/theme-safeappeals-colors-black-ruby/themes/black-ruby-color-theme.json"},
    @{name="black-sapphire"; path="extensions/theme-safeappeals-colors-black-sapphire/themes/black-sapphire-color-theme.json"},
    @{name="black-amethyst"; path="extensions/theme-safeappeals-colors-black-amethyst/themes/black-amethyst-color-theme.json"},
    @{name="black-silver"; path="extensions/theme-safeappeals-colors-black-silver/themes/black-silver-color-theme.json"},
    @{name="black-platinum"; path="extensions/theme-safeappeals-colors-black-platinum/themes/black-platinum-color-theme.json"},
    @{name="black-copper"; path="extensions/theme-safeappeals-colors-black-copper/themes/black-copper-color-theme.json"},
    @{name="black-bronze"; path="extensions/theme-safeappeals-colors-black-bronze/themes/black-bronze-color-theme.json"},
    @{name="black-rosegold"; path="extensions/theme-safeappeals-colors-black-rosegold/themes/black-rosegold-color-theme.json"},
    @{name="black-jade"; path="extensions/theme-safeappeals-colors-black-jade/themes/black-jade-color-theme.json"},
    @{name="black-crimson"; path="extensions/theme-safeappeals-colors-black-crimson/themes/black-crimson-color-theme.json"},
    @{name="black-topaz"; path="extensions/theme-safeappeals-colors-black-topaz/themes/black-topaz-color-theme.json"},
    @{name="black-opal"; path="extensions/theme-safeappeals-colors-black-opal/themes/black-opal-color-theme.json"},
    @{name="black-aquamarine"; path="extensions/theme-safeappeals-colors-black-aquamarine/themes/black-aquamarine-color-theme.json"},
    @{name="black-peridot"; path="extensions/theme-safeappeals-colors-black-peridot/themes/black-peridot-color-theme.json"},
    @{name="black-garnet"; path="extensions/theme-safeappeals-colors-black-garnet/themes/black-garnet-color-theme.json"},
    @{name="black-citrine"; path="extensions/theme-safeappeals-colors-black-citrine/themes/black-citrine-color-theme.json"},
    @{name="black-turquoise"; path="extensions/theme-safeappeals-colors-black-turquoise/themes/black-turquoise-color-theme.json"},
    @{name="black-tanzanite"; path="extensions/theme-safeappeals-colors-black-tanzanite/themes/black-tanzanite-color-theme.json"}
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

