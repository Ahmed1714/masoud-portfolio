package com.quranapp.memorization.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val QuranColorScheme = darkColorScheme(
    primary          = GreenLight,
    onPrimary        = Color.White,
    primaryContainer = GreenDark,
    onPrimaryContainer = GoldLight,
    secondary        = Gold,
    onSecondary      = NavyDark,
    secondaryContainer = GoldDark,
    background       = NavyDark,
    onBackground     = TextPrimary,
    surface          = NavyMedium,
    onSurface        = TextPrimary,
    surfaceVariant   = NavySurface,
    onSurfaceVariant = TextSecondary,
    outline          = TextHint,
    error            = Wrong,
    onError          = Color.White,
)

@Composable
fun QuranTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = QuranColorScheme,
        typography  = QuranTypography,
        content     = content
    )
}
