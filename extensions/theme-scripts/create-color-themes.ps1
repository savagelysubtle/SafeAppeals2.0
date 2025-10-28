[10:52:46] Error: D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/emailWorkspaceService.ts(67,33): Property 'emailDashboardEnabled' does not exist on type 'GlobalSettings'.
[10:52:46] Error: D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/emailWorkspaceService.ts(68,37): Property 'emailAutoParseEnabled' does not exist on type 'GlobalSettings'.
[10:52:46] Finished compilation with 2 errors after 25 ms
[10:52:48] Starting compilation...
[10:52:48] Error: D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/emailWorkspaceService.ts(67,33): Property 'emailDashboardEnabled' does not exist on type 'GlobalSettings'.
[10:52:48] Error: D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/emailWorkspaceService.ts(68,37): Property 'emailAutoParseEnabled' does not exist on type 'GlobalSettings'.
[10:52:48] Finished compilation with 2 errors after 39 ms
[10:52:50] Starting compilation...
[10:52:50] Error: D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/emailWorkspaceService.ts(67,33): Property 'emailDashboardEnabled' does not exist on type 'GlobalSettings'.
[10:52:50] Error: D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/emailWorkspaceService.ts(68,37): Property 'emailAutoParseEnabled' does not exist on type 'GlobalSettings'.
[10:52:50] Finished compilation with 2 errors after 7 ms
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
    $colorThemeJson = @"
{
	"name": "$($theme.displayName)",
	"type": "$($theme.type)",
	"colors": {
		"activityBar.background": "#111111",
		"activityBar.foreground": "#ffffff",
		"activityBar.activeBorder": "$($theme.accent)",
		"activityBar.inactiveForeground": "#ffffff66",
		"activityBar.border": "#1C1C1C",
		"activityBarBadge.background": "$($theme.accent)",
		"activityBarBadge.foreground": "#ffffff",

		"statusBar.background": "$($theme.statusBar)",
		"statusBar.foreground": "#ffffff",
		"statusBar.border": "#1C1C1C",
		"statusBar.noFolderBackground": "$($theme.accentDark)",
		"statusBar.debuggingBackground": "#FF6B6B",
		"statusBar.debuggingForeground": "#ffffff",

		"titleBar.activeBackground": "#121212",
		"titleBar.activeForeground": "#CCCCCC",
		"titleBar.inactiveBackground": "#0B0B0B",
		"titleBar.inactiveForeground": "#999999",
		"titleBar.border": "#1C1C1C",

		"editor.background": "#1E1E1E",
		"editor.foreground": "#D4D4D4",
		"editor.lineHighlightBackground": "#2A2A2A",
		"editor.selectionBackground": "#264F78",
		"editorCursor.foreground": "$($theme.accent)",
		"editorLineNumber.foreground": "#858585",
		"editorLineNumber.activeForeground": "$($theme.accent)",
		"editorIndentGuide.background": "#404040",
		"editorIndentGuide.activeBackground": "$($theme.accent)",
		"editorWhitespace.foreground": "#404040",

		"tab.activeBackground": "#161616",
		"tab.inactiveBackground": "#101010",
		"tab.activeForeground": "#ffffff",
		"tab.inactiveForeground": "#808080",
		"tab.activeBorderTop": "$($theme.accent)",
		"tab.border": "#101010",
		"tab.hoverBackground": "#1A1A1A",
		"tab.unfocusedActiveBorderTop": "$($theme.accentDark)",
		"editorGroupHeader.tabsBackground": "#101010",
		"editorGroupHeader.tabsBorder": "#101010",

		"sideBar.background": "#1A1A1A",
		"sideBar.foreground": "#CCCCCC",
		"sideBar.border": "#1C1C1C",
		"sideBarTitle.foreground": "#ffffff",
		"sideBarSectionHeader.background": "#202020",
		"sideBarSectionHeader.foreground": "#ffffff",
		"sideBarSectionHeader.border": "#1C1C1C",

		"panel.background": "#1A1A1A",
		"panel.border": "#1C1C1C",
		"panelTitle.activeBorder": "$($theme.accent)",
		"panelTitle.activeForeground": "#ffffff",
		"panelTitle.inactiveForeground": "#808080",

		"button.background": "$($theme.accent)",
		"button.foreground": "#ffffff",
		"button.hoverBackground": "$($theme.accentDark)",
		"button.secondaryBackground": "#3A3D41",
		"button.secondaryForeground": "#ffffff",
		"button.secondaryHoverBackground": "#45494E",

		"input.background": "#202020",
		"input.border": "#303030",
		"input.foreground": "#CCCCCC",
		"input.placeholderForeground": "#808080",
		"inputOption.activeBorder": "$($theme.accent)",
		"inputOption.activeBackground": "$($theme.accent)33",
		"inputValidation.errorBorder": "#E74C3C",
		"inputValidation.warningBorder": "#F39C12",
		"inputValidation.infoBorder": "$($theme.accent)",

		"dropdown.background": "#202020",
		"dropdown.border": "#303030",
		"dropdown.foreground": "#CCCCCC",

		"list.activeSelectionBackground": "$($theme.accentDark)66",
		"list.activeSelectionForeground": "#ffffff",
		"list.hoverBackground": "#2A2A2A",
		"list.inactiveSelectionBackground": "#37373D",
		"list.focusOutline": "$($theme.accent)",
		"list.highlightForeground": "$($theme.accent)",
		"list.focusBackground": "#2A2A2A",

		"scrollbarSlider.background": "#79797933",
		"scrollbarSlider.hoverBackground": "#646464b3",
		"scrollbarSlider.activeBackground": "#bfbfbf66",

		"badge.background": "$($theme.accent)",
		"badge.foreground": "#ffffff",

		"progressBar.background": "$($theme.accent)",

		"notificationCenter.border": "$($theme.accent)",
		"notificationCenterHeader.background": "#1A1A1A",
		"notifications.background": "#1A1A1A",
		"notifications.border": "$($theme.accent)",
		"notifications.foreground": "#CCCCCC",
		"notificationLink.foreground": "$($theme.accent)",

		"terminal.background": "#1A1A1A",
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
		"textBlockQuote.background": "#1A1A1A",
		"textCodeBlock.background": "#1A1A1A",

		"widget.shadow": "#00000080",
		"editorWidget.background": "#202020",
		"editorWidget.foreground": "#CCCCCC",
		"editorWidget.border": "#303030",

		"pickerGroup.border": "$($theme.accent)",
		"pickerGroup.foreground": "$($theme.accent)",

		"debugToolBar.background": "#202020",
		"debugToolBar.border": "#303030",

		"welcomePage.tileBackground": "#151515",
		"welcomePage.tileBorder": "#1C1C1C",
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
Write-Host "✅ All 12 color theme extensions created!" -ForegroundColor Green
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

