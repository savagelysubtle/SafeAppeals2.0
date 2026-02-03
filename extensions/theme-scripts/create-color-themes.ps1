# Create Matching Color Themes for Safe Appeals Navigator Icon Themes
# This script generates color theme extensions that match each icon theme

$root = "D:\Coding\SafeAppeals2.0\extensions"

# Define all themes with their color schemes
$themes = @(
    @{
        name = 'green'
        displayName = 'Safe Appeals Green Dark'
        description = 'Official green theme - Professional and trustworthy'
        accent = '#A6E22E'
        accentDark = '#8CBF22'
        statusBar = '#A6E22E'
        type = 'dark'
    },
    @{
        name = 'grey'
        displayName = 'Safe Appeals Grey Dark'
        description = 'Neutral grey theme - Professional minimalist'
        accent = '#A0AEC0'
        accentDark = '#718096'
        statusBar = '#718096'
        type = 'dark'
    },
    @{
        name = 'purple'
        displayName = 'Safe Appeals Purple Dark'
        description = 'Creative purple theme - Modern and sophisticated'
        accent = '#9B7EDE'
        accentDark = '#7B5EBE'
        statusBar = '#9B7EDE'
        type = 'dark'
    },
    @{
        name = 'teal'
        displayName = 'Safe Appeals Teal Dark'
        description = 'Fresh teal theme - Tech-forward and modern'
        accent = '#4ECDC4'
        accentDark = '#2C9A91'
        statusBar = '#4ECDC4'
        type = 'dark'
    },
    @{
        name = 'red'
        displayName = 'Safe Appeals Red Dark'
        description = 'Bold red theme - Attention-grabbing and energetic'
        accent = '#E85D75'
        accentDark = '#C0374A'
        statusBar = '#E85D75'
        type = 'dark'
    },
    @{
        name = 'yellow'
        displayName = 'Safe Appeals Yellow Dark'
        description = 'Bright yellow theme - Optimistic and cheerful'
        accent = '#F7DC6F'
        accentDark = '#D4AC0D'
        statusBar = '#D4AC0D'
        type = 'dark'
    },
    @{
        name = 'contrast'
        displayName = 'Safe Appeals High Contrast'
        description = 'High contrast theme - Maximum accessibility'
        accent = '#FFFF00'
        accentDark = '#00FF00'
        statusBar = '#00FF00'
        type = 'hc-black'
    },
    @{
        name = 'dark'
        displayName = 'Safe Appeals Dark Optimized'
        description = 'Dark mode optimized - Easy on the eyes'
        accent = '#4A5361'
        accentDark = '#3A3F4B'
        statusBar = '#3A3F4B'
        type = 'dark'
    },
    @{
        name = 'pastel'
        displayName = 'Safe Appeals Pastel Dark'
        description = 'Soft pastel theme - Calming and minimal'
        accent = '#B8E6D5'
        accentDark = '#8DCDB7'
        statusBar = '#8DCDB7'
        type = 'dark'
    },
    @{
        name = 'neon'
        displayName = 'Safe Appeals Neon Dark'
        description = 'Neon theme - Bold and modern'
        accent = '#00FFF0'
        accentDark = '#FF00FF'
        statusBar = '#00FFF0'
        type = 'dark'
    },
    @{
        name = 'icy'
        displayName = 'Safe Appeals Icy Dark'
        description = 'Arctic icy theme - Cool and refreshing'
        accent = '#A6D8E7'
        accentDark = '#5B8FA3'
        statusBar = '#A6D8E7'
        type = 'dark'
    },
    @{
        name = 'material'
        displayName = 'Safe Appeals Material Dark'
        description = 'Material Design theme - Google-inspired'
        accent = '#5C6BC0'
        accentDark = '#3949AB'
        statusBar = '#5C6BC0'
        type = 'dark'
    },
    # =====================================================
    # BLACK + JEWEL/METALLIC ACCENT THEMES
    # True black backgrounds with rich accent colors
    # =====================================================
    @{
        name = 'black-gold'
        displayName = 'Black & Gold'
        description = 'Luxurious black with gold accents - Executive elegance'
        accent = '#FFD700'
        accentDark = '#DAA520'
        statusBar = '#DAA520'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-emerald'
        displayName = 'Black & Emerald'
        description = 'Deep black with emerald accents - Rich and regal'
        accent = '#50C878'
        accentDark = '#2E8B57'
        statusBar = '#2E8B57'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-ruby'
        displayName = 'Black & Ruby'
        description = 'Sleek black with ruby red accents - Bold and passionate'
        accent = '#E0115F'
        accentDark = '#9B111E'
        statusBar = '#9B111E'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-sapphire'
        displayName = 'Black & Sapphire'
        description = 'Pure black with sapphire blue accents - Deep and mysterious'
        accent = '#0F52BA'
        accentDark = '#082567'
        statusBar = '#0F52BA'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-amethyst'
        displayName = 'Black & Amethyst'
        description = 'Noir black with amethyst purple accents - Mystical elegance'
        accent = '#9966CC'
        accentDark = '#7B4F9D'
        statusBar = '#7B4F9D'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-silver'
        displayName = 'Black & Silver'
        description = 'Jet black with silver accents - Sleek and modern'
        accent = '#C0C0C0'
        accentDark = '#A8A8A8'
        statusBar = '#808080'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-platinum'
        displayName = 'Black & Platinum'
        description = 'Obsidian black with platinum accents - Premium finish'
        accent = '#E5E4E2'
        accentDark = '#B0B0B0'
        statusBar = '#9E9E9E'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-copper'
        displayName = 'Black & Copper'
        description = 'Coal black with copper accents - Industrial warmth'
        accent = '#B87333'
        accentDark = '#8C5828'
        statusBar = '#8C5828'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-bronze'
        displayName = 'Black & Bronze'
        description = 'Midnight black with bronze accents - Timeless classic'
        accent = '#CD7F32'
        accentDark = '#A56727'
        statusBar = '#A56727'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-rosegold'
        displayName = 'Black & Rose Gold'
        description = 'Void black with rose gold accents - Feminine sophistication'
        accent = '#B76E79'
        accentDark = '#8E5A5F'
        statusBar = '#B76E79'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-jade'
        displayName = 'Black & Jade'
        description = 'Abyss black with jade green accents - Eastern elegance'
        accent = '#00A86B'
        accentDark = '#007A4D'
        statusBar = '#007A4D'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-crimson'
        displayName = 'Black & Crimson'
        description = 'Shadow black with crimson accents - Dark and intense'
        accent = '#DC143C'
        accentDark = '#8B0000'
        statusBar = '#8B0000'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-topaz'
        displayName = 'Black & Topaz'
        description = 'Ink black with topaz orange accents - Warm and inviting'
        accent = '#FFC87C'
        accentDark = '#E59400'
        statusBar = '#E59400'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-opal'
        displayName = 'Black & Opal'
        description = 'Onyx black with opal iridescent accents - Unique and captivating'
        accent = '#A8C3BC'
        accentDark = '#6B8E84'
        statusBar = '#6B8E84'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-aquamarine'
        displayName = 'Black & Aquamarine'
        description = 'Obsidian black with aquamarine accents - Ocean depths'
        accent = '#7FFFD4'
        accentDark = '#3CB371'
        statusBar = '#3CB371'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-peridot'
        displayName = 'Black & Peridot'
        description = 'Charcoal black with peridot lime accents - Fresh and vibrant'
        accent = '#B4C424'
        accentDark = '#8AA31A'
        statusBar = '#8AA31A'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-garnet'
        displayName = 'Black & Garnet'
        description = 'Deep black with garnet burgundy accents - Wine sophistication'
        accent = '#733635'
        accentDark = '#582829'
        statusBar = '#733635'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-citrine'
        displayName = 'Black & Citrine'
        description = 'Raven black with citrine yellow accents - Sunny optimism'
        accent = '#E4D00A'
        accentDark = '#B8A600'
        statusBar = '#B8A600'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-turquoise'
        displayName = 'Black & Turquoise'
        description = 'Pitch black with turquoise accents - Southwest flair'
        accent = '#40E0D0'
        accentDark = '#00CED1'
        statusBar = '#00CED1'
        type = 'dark'
        trueBlack = $true
    },
    @{
        name = 'black-tanzanite'
        displayName = 'Black & Tanzanite'
        description = 'Velvet black with tanzanite violet accents - Rare beauty'
        accent = '#4B0082'
        accentDark = '#310052'
        statusBar = '#4B0082'
        type = 'dark'
        trueBlack = $true
    }
)

Write-Host "🎨 Creating matching color theme extensions for Safe Appeals Navigator..."
Write-Host ""

foreach($theme in $themes) {
    $themeName = "theme-safeappeals-colors-$($theme.name)"
    $themePath = "$root\$themeName"
    $themesDir = "$themePath\themes"

    Write-Host "Creating $($theme.displayName)..." -ForegroundColor Cyan

    # Create directories
    New-Item -Path $themePath -ItemType Directory -Force | Out-Null
    New-Item -Path $themesDir -ItemType Directory -Force | Out-Null

    # Create package.json
    $packageJson = @"
{
	"name": "$themeName",
	"displayName": "$($theme.displayName)",
	"description": "$($theme.description)",
	"version": "1.0.0",
	"publisher": "safeappeals",
	"license": "MIT",
	"engines": {
		"vscode": "*"
	},
	"categories": ["Themes"],
	"contributes": {
		"themes": [
			{
				"label": "$($theme.displayName)",
				"uiTheme": "vs-$($theme.type)",
				"path": "./themes/$($theme.name)-color-theme.json"
			}
		]
	}
}
"@

    $packageJson | Out-File "$themePath\package.json" -Encoding UTF8

    # Create color theme JSON
    # Use true black backgrounds for black-themed variants
    $isTrueBlack = $theme.trueBlack -eq $true

    if ($isTrueBlack) {
        $bgEditor = "#000000"
        $bgSidebar = "#050505"
        $bgPanel = "#050505"
        $bgActivityBar = "#000000"
        $bgTitleBar = "#000000"
        $bgTitleBarInactive = "#000000"
        $bgTabActive = "#0A0A0A"
        $bgTabInactive = "#000000"
        $bgTabHeader = "#000000"
        $bgInput = "#0A0A0A"
        $bgDropdown = "#0A0A0A"
        $bgWidget = "#0A0A0A"
        $bgWelcome = "#050505"
        $bgSectionHeader = "#0A0A0A"
        $bgLineHighlight = "#0F0F0F"
        $bgHover = "#0F0F0F"
        $borderColor = "#1A1A1A"
        $inputBorder = "#252525"
    } else {
        $bgEditor = "#1E1E1E"
        $bgSidebar = "#1A1A1A"
        $bgPanel = "#1A1A1A"
        $bgActivityBar = "#111111"
        $bgTitleBar = "#121212"
        $bgTitleBarInactive = "#0B0B0B"
        $bgTabActive = "#161616"
        $bgTabInactive = "#101010"
        $bgTabHeader = "#101010"
        $bgInput = "#202020"
        $bgDropdown = "#202020"
        $bgWidget = "#202020"
        $bgWelcome = "#151515"
        $bgSectionHeader = "#202020"
        $bgLineHighlight = "#2A2A2A"
        $bgHover = "#2A2A2A"
        $borderColor = "#1C1C1C"
        $inputBorder = "#303030"
    }

    $colorThemeJson = @"
{
	"name": "$($theme.displayName)",
	"type": "$($theme.type)",
	"colors": {
		"activityBar.background": "$bgActivityBar",
		"activityBar.foreground": "#ffffff",
		"activityBar.activeBorder": "$($theme.accent)",
		"activityBar.inactiveForeground": "#ffffff66",
		"activityBar.border": "$borderColor",
		"activityBarBadge.background": "$($theme.accent)",
		"activityBarBadge.foreground": "#ffffff",

		"statusBar.background": "$($theme.statusBar)",
		"statusBar.foreground": "#ffffff",
		"statusBar.border": "$borderColor",
		"statusBar.noFolderBackground": "$($theme.accentDark)",
		"statusBar.debuggingBackground": "#FF6B6B",
		"statusBar.debuggingForeground": "#ffffff",

		"titleBar.activeBackground": "$bgTitleBar",
		"titleBar.activeForeground": "#CCCCCC",
		"titleBar.inactiveBackground": "$bgTitleBarInactive",
		"titleBar.inactiveForeground": "#999999",
		"titleBar.border": "$borderColor",

		"editor.background": "$bgEditor",
		"editor.foreground": "#D4D4D4",
		"editor.lineHighlightBackground": "$bgLineHighlight",
		"editor.selectionBackground": "#264F78",
		"editorCursor.foreground": "$($theme.accent)",
		"editorLineNumber.foreground": "#858585",
		"editorLineNumber.activeForeground": "$($theme.accent)",
		"editorIndentGuide.background": "#404040",
		"editorIndentGuide.activeBackground": "$($theme.accent)",
		"editorWhitespace.foreground": "#404040",

		"tab.activeBackground": "$bgTabActive",
		"tab.inactiveBackground": "$bgTabInactive",
		"tab.activeForeground": "#ffffff",
		"tab.inactiveForeground": "#808080",
		"tab.activeBorderTop": "$($theme.accent)",
		"tab.border": "$bgTabInactive",
		"tab.hoverBackground": "$bgHover",
		"tab.unfocusedActiveBorderTop": "$($theme.accentDark)",
		"editorGroupHeader.tabsBackground": "$bgTabHeader",
		"editorGroupHeader.tabsBorder": "$bgTabHeader",

		"sideBar.background": "$bgSidebar",
		"sideBar.foreground": "#CCCCCC",
		"sideBar.border": "$borderColor",
		"sideBarTitle.foreground": "#ffffff",
		"sideBarSectionHeader.background": "$bgSectionHeader",
		"sideBarSectionHeader.foreground": "#ffffff",
		"sideBarSectionHeader.border": "$borderColor",

		"panel.background": "$bgPanel",
		"panel.border": "$borderColor",
		"panelTitle.activeBorder": "$($theme.accent)",
		"panelTitle.activeForeground": "#ffffff",
		"panelTitle.inactiveForeground": "#808080",

		"button.background": "$($theme.accent)",
		"button.foreground": "#ffffff",
		"button.hoverBackground": "$($theme.accentDark)",
		"button.secondaryBackground": "#3A3D41",
		"button.secondaryForeground": "#ffffff",
		"button.secondaryHoverBackground": "#45494E",

		"input.background": "$bgInput",
		"input.border": "$inputBorder",
		"input.foreground": "#CCCCCC",
		"input.placeholderForeground": "#808080",
		"inputOption.activeBorder": "$($theme.accent)",
		"inputOption.activeBackground": "$($theme.accent)33",
		"inputValidation.errorBorder": "#E74C3C",
		"inputValidation.warningBorder": "#F39C12",
		"inputValidation.infoBorder": "$($theme.accent)",

		"dropdown.background": "$bgDropdown",
		"dropdown.border": "$inputBorder",
		"dropdown.foreground": "#CCCCCC",

		"list.activeSelectionBackground": "$($theme.accentDark)66",
		"list.activeSelectionForeground": "#ffffff",
		"list.hoverBackground": "$bgHover",
		"list.inactiveSelectionBackground": "#37373D",
		"list.focusOutline": "$($theme.accent)",
		"list.highlightForeground": "$($theme.accent)",
		"list.focusBackground": "$bgHover",

		"scrollbarSlider.background": "#4a4a4aaa",
		"scrollbarSlider.hoverBackground": "#646464ee",
		"scrollbarSlider.activeBackground": "#808080ff",

		"badge.background": "$($theme.accent)",
		"badge.foreground": "#ffffff",

		"progressBar.background": "$($theme.accent)",

		"notificationCenter.border": "$($theme.accent)",
		"notificationCenterHeader.background": "$bgPanel",
		"notifications.background": "$bgPanel",
		"notifications.border": "$($theme.accent)",
		"notifications.foreground": "#CCCCCC",
		"notificationLink.foreground": "$($theme.accent)",

		"terminal.background": "$bgPanel",
		"terminal.foreground": "#CCCCCC",
		"terminal.ansiBlack": "#000000",
		"terminal.ansiRed": "#E74C3C",
		"terminal.ansiGreen": "$($theme.accent)",
		"terminal.ansiYellow": "#F39C12",
		"terminal.ansiBlue": "#3498DB",
		"terminal.ansiMagenta": "#9B59B6",
		"terminal.ansiCyan": "#1ABC9C",
		"terminal.ansiWhite": "#ECF0F1",
		"terminal.ansiBrightBlack": "#7F8C8D",
		"terminal.ansiBrightRed": "#E74C3C",
		"terminal.ansiBrightGreen": "$($theme.accent)",
		"terminal.ansiBrightYellow": "#F39C12",
		"terminal.ansiBrightBlue": "#3498DB",
		"terminal.ansiBrightMagenta": "#9B59B6",
		"terminal.ansiBrightCyan": "#1ABC9C",
		"terminal.ansiBrightWhite": "#FFFFFF",

		"textLink.foreground": "$($theme.accent)",
		"textLink.activeForeground": "$($theme.accentDark)",
		"textPreformat.foreground": "#D4D4D4",
		"textBlockQuote.background": "$bgPanel",
		"textCodeBlock.background": "$bgPanel",

		"widget.shadow": "#00000080",
		"editorWidget.background": "$bgWidget",
		"editorWidget.foreground": "#CCCCCC",
		"editorWidget.border": "$inputBorder",

		"pickerGroup.border": "$($theme.accent)",
		"pickerGroup.foreground": "$($theme.accent)",

		"debugToolBar.background": "$bgWidget",
		"debugToolBar.border": "$inputBorder",

		"welcomePage.tileBackground": "$bgWelcome",
		"welcomePage.tileBorder": "$borderColor",
		"welcomePage.buttonBackground": "$($theme.accent)",
		"welcomePage.buttonHoverBackground": "$($theme.accentDark)",

		"gitDecoration.modifiedResourceForeground": "#E2C08D",
		"gitDecoration.deletedResourceForeground": "#E74C3C",
		"gitDecoration.untrackedResourceForeground": "$($theme.accent)",
		"gitDecoration.ignoredResourceForeground": "#808080",
		"gitDecoration.conflictingResourceForeground": "#F39C12"
	},
	"tokenColors": [
		{
			"scope": ["comment", "punctuation.definition.comment"],
			"settings": {
				"foreground": "#6A9955",
				"fontStyle": "italic"
			}
		},
		{
			"scope": ["string", "string.quoted"],
			"settings": {
				"foreground": "#CE9178"
			}
		},
		{
			"scope": ["keyword", "storage.type", "storage.modifier"],
			"settings": {
				"foreground": "#569CD6"
			}
		},
		{
			"scope": ["variable", "variable.parameter", "variable.other"],
			"settings": {
				"foreground": "#9CDCFE"
			}
		},
		{
			"scope": ["entity.name.function", "support.function"],
			"settings": {
				"foreground": "#DCDCAA"
			}
		},
		{
			"scope": ["constant.numeric", "constant.language"],
			"settings": {
				"foreground": "#B5CEA8"
			}
		},
		{
			"scope": ["entity.name.type", "entity.name.class", "support.class"],
			"settings": {
				"foreground": "#4EC9B0"
			}
		},
		{
			"scope": ["entity.name.tag"],
			"settings": {
				"foreground": "#569CD6"
			}
		},
		{
			"scope": ["entity.other.attribute-name"],
			"settings": {
				"foreground": "#9CDCFE"
			}
		},
		{
			"scope": ["support.type.property-name"],
			"settings": {
				"foreground": "#9CDCFE"
			}
		},
		{
			"scope": ["punctuation"],
			"settings": {
				"foreground": "#D4D4D4"
			}
		}
	]
}
"@

    $colorThemeJson | Out-File "$themesDir\$($theme.name)-color-theme.json" -Encoding UTF8

    # Create package-lock.json
    $packageLockJson = @"
{
	"name": "$themeName",
	"version": "1.0.0",
	"lockfileVersion": 3,
	"requires": true,
	"packages": {
		"": {
			"name": "$themeName",
			"version": "1.0.0",
			"license": "MIT",
			"engines": {
				"vscode": "*"
			}
		}
	}
}
"@

    $packageLockJson | Out-File "$themePath\package-lock.json" -Encoding UTF8

    # Create README
    $readme = @"
# $($theme.displayName)

$($theme.description)

## Color Palette

- **Status Bar**: ``$($theme.statusBar)``
- **Primary Accent**: ``$($theme.accent)``
- **Secondary Accent**: ``$($theme.accentDark)``

## Matching Icon Theme

This color theme is designed to match the **Safe Appeals Icons ($($theme.name.Substring(0,1).ToUpper() + $theme.name.Substring(1)))** icon theme.

To get the full coordinated experience:
1. Select this color theme: ``Ctrl+Shift+P`` → "Color Theme" → "$($theme.displayName)"
2. Select matching icon theme: ``Ctrl+Shift+P`` → "File Icon Theme" → "Safe Appeals Icons ($($theme.name.Substring(0,1).ToUpper() + $theme.name.Substring(1)))"

Or mix and match with any other icon theme!

## License

MIT License - Copyright (c) 2025 Safe Appeals Navigator
"@

    $readme | Out-File "$themePath\README.md" -Encoding UTF8

    Write-Host "  ✓ Created $themeName" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ All $($themes.Count) color theme extensions created!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run the product.json registration script (see below)"
Write-Host "2. Rebuild the app: npm run compile"
Write-Host "3. Users can now choose:"
Write-Host "   - Color Theme: Ctrl+Shift+P → 'Color Theme'"
Write-Host "   - Icon Theme: Ctrl+Shift+P → 'File Icon Theme'"
Write-Host ""

# Generate product.json entries
Write-Host "📄 Add these to product.json builtInExtensions array:" -ForegroundColor Cyan
Write-Host ""

$productJsonEntries = @()
foreach($theme in $themes) {
    $themeName = "theme-safeappeals-colors-$($theme.name)"
    $entry = @"
		{
			"name": "$themeName",
			"version": "1.0.0",
			"repo": "https://github.com/savagelysubtle/SafeAppeals2.0",
			"metadata": {
				"id": "safeappeals.$themeName",
				"publisherId": "safeappeals",
				"publisherDisplayName": "Safe Appeals Navigator",
				"targetPlatform": "undefined",
				"isApplicationScoped": true,
				"updated": false,
				"isPreReleaseVersion": false,
				"installedTimestamp": 0,
				"pinned": true,
				"preRelease": false
			}
		}
"@
    $productJsonEntries += $entry
}

$productJsonEntries -join ",`n" | Out-File "$root\color-themes-product-json-entries.txt" -Encoding UTF8

Write-Host "Product.json entries saved to: $root\color-themes-product-json-entries.txt"
Write-Host ""
Write-Host "🎨 Theme Combinations Available:" -ForegroundColor Magenta
Write-Host "================================="
foreach($theme in $themes) {
    Write-Host "  $($theme.displayName)" -ForegroundColor White -NoNewline
    Write-Host " + " -NoNewline
    Write-Host "Safe Appeals Icons ($($theme.name.Substring(0,1).ToUpper() + $theme.name.Substring(1)))" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Done! 🚀" -ForegroundColor Green

