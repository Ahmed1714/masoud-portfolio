package com.englishapp.learning.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val EnglishMasterColorScheme = darkColorScheme(
    primary            = TealLight,
    onPrimary          = Color.White,
    primaryContainer   = TealMedium,
    onPrimaryContainer = AmberLight,
    secondary          = Amber,
    onSecondary        = InkDark,
    secondaryContainer = AmberDark,
    background         = InkDark,
    onBackground       = TextPrimary,
    surface            = InkMedium,
    onSurface          = TextPrimary,
    surfaceVariant     = InkSurface,
    onSurfaceVariant   = TextSecondary,
    outline            = TextHint,
    error              = Wrong,
    onError            = Color.White,
)

@Composable
fun EnglishMasterTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = EnglishMasterColorScheme,
        typography  = EnglishMasterTypography,
        content     = content
    )
}
